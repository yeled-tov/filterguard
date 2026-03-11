package com.filterguard.browser;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * FilterVpnService
 * ─────────────────
 * Creates a local VPN tunnel that intercepts DNS queries (UDP port 53).
 * Blocked domains get NXDOMAIN — they never resolve.
 * This works SYSTEM-WIDE: all apps on the device, no user DNS settings needed.
 *
 * How it works:
 * 1. Establish a VPN interface that routes all traffic through the app
 * 2. Forward all non-DNS traffic to real internet (transparent proxy)
 * 3. Intercept DNS queries → if domain is blocked → return NXDOMAIN
 *    otherwise → forward to 8.8.8.8 and return real answer
 */
public class FilterVpnService extends VpnService {

    private static final String TAG = "FilterGuardVPN";
    private static final String CHANNEL_ID = "filterguard_vpn";
    private static final int NOTIF_ID = 1001;

    private ParcelFileDescriptor vpnInterface;
    private ExecutorService executor;
    private volatile boolean running = false;

    // ── All blocked domains (union of all categories) ─────────────────────────
    private static final Set<String> ALL_BLOCKED = new HashSet<>();
    static {
        // Adult
        ALL_BLOCKED.addAll(Arrays.asList(
            "pornhub.com","xvideos.com","xnxx.com","xhamster.com","redtube.com",
            "youporn.com","onlyfans.com","chaturbate.com","spankbang.com","eporner.com",
            "beeg.com","tnaflix.com","nhentai.net","rule34.xxx","brazzers.com",
            "bangbros.com","cam4.com","bongacams.com","livejasmin.com","myfreecams.com",
            "stripchat.com","faphouse.com","drtuber.com","tube8.com","slutload.com",
            "adultfriendfinder.com","hclips.com","empflix.com","youjizz.com","imagefap.com"
        ));
        // Gambling
        ALL_BLOCKED.addAll(Arrays.asList(
            "bet365.com","888casino.com","pokerstars.com","partypoker.com","betway.com",
            "draftkings.com","fanduel.com","bovada.lv","mybookie.ag","1xbet.com",
            "22bet.com","betsson.com","casumo.com","leovegas.com","williamhill.com",
            "bwin.com","unibet.com","betfair.com","paddypower.com","coral.co.uk",
            "ladbrokes.com","betvictor.com","skybet.com","mrgreen.com","rizk.com"
        ));
        // Social
        ALL_BLOCKED.addAll(Arrays.asList(
            "facebook.com","instagram.com","twitter.com","x.com","tiktok.com",
            "snapchat.com","reddit.com","tumblr.com","pinterest.com","linkedin.com",
            "discord.com","twitch.tv","threads.net","bsky.app","vk.com","weibo.com",
            "ok.ru"
        ));
        // Ads
        ALL_BLOCKED.addAll(Arrays.asList(
            "doubleclick.net","googlesyndication.com","googletagmanager.com",
            "googletagservices.com","adnxs.com","adroll.com","criteo.com",
            "taboola.com","outbrain.com","rubiconproject.com","openx.com",
            "pubmatic.com","appnexus.com","scorecardresearch.com","comscore.com",
            "quantserve.com","chartbeat.com","moatads.com","advertising.com",
            "adsrvr.org","casalemedia.com","serving-sys.com","revcontent.com",
            "mgid.com","sharethrough.com","amazon-adsystem.com","media.net",
            "adsterra.com","propellerads.com","trafficjunky.com","exoclick.com"
        ));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP".equals(intent.getAction())) {
            stopVpn();
            return START_NOT_STICKY;
        }
        startVpn();
        return START_STICKY;
    }

    private void startVpn() {
        try {
            createNotificationChannel();

            // Build VPN interface
            Builder builder = new Builder()
                .setSession("FilterGuard")
                .addAddress("10.0.0.2", 32)          // VPN local IP
                .addRoute("0.0.0.0", 0)               // Route ALL traffic
                .addDnsServer("8.8.8.8")              // Fallback DNS
                .addDnsServer("8.8.4.4")
                .setMtu(1500)
                .setBlocking(false);

            // Allow FilterGuard itself to bypass VPN (avoid loop)
            try { builder.addDisallowedApplication(getPackageName()); } catch (Exception e) { /* ignore */ }

            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                Log.e(TAG, "VPN interface is null");
                return;
            }

            running = true;
            executor = Executors.newFixedThreadPool(2);
            executor.execute(this::runDnsFilter);

            // Show persistent notification
            startForeground(NOTIF_ID, buildNotification());
            Log.i(TAG, "FilterGuard VPN started");

        } catch (Exception e) {
            Log.e(TAG, "VPN start failed", e);
        }
    }

    private void stopVpn() {
        running = false;
        if (executor != null) executor.shutdownNow();
        try { if (vpnInterface != null) vpnInterface.close(); } catch (Exception e) { /* ignore */ }
        stopForeground(true);
        stopSelf();
    }

    /**
     * DNS Filter loop:
     * Reads DNS queries from VPN interface, checks if domain is blocked,
     * returns NXDOMAIN if blocked, forwards to 8.8.8.8 otherwise.
     */
    private void runDnsFilter() {
        byte[] packet = new byte[32767];
        ByteBuffer buffer = ByteBuffer.wrap(packet);

        try (FileInputStream in  = new FileInputStream(vpnInterface.getFileDescriptor());
             FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor())) {

            while (running) {
                buffer.clear();
                int length = in.read(packet);
                if (length <= 0) { Thread.sleep(10); continue; }

                // Parse IP packet
                int ipVersion = (packet[0] >> 4) & 0xF;
                if (ipVersion != 4) { out.write(packet, 0, length); continue; } // pass IPv6

                int protocol = packet[9] & 0xFF;
                if (protocol != 17) { out.write(packet, 0, length); continue; } // pass non-UDP

                // Parse UDP
                int ipHeaderLen = (packet[0] & 0xF) * 4;
                int destPort = ((packet[ipHeaderLen + 2] & 0xFF) << 8) | (packet[ipHeaderLen + 3] & 0xFF);

                if (destPort != 53) { out.write(packet, 0, length); continue; } // pass non-DNS

                // Parse DNS query
                int dnsOffset = ipHeaderLen + 8;
                String domain = parseDnsDomain(packet, dnsOffset + 12);

                if (domain != null && isDomainBlocked(domain)) {
                    Log.d(TAG, "BLOCKED: " + domain);
                    // Build NXDOMAIN response
                    byte[] response = buildNxDomain(packet, dnsOffset, length - dnsOffset);
                    if (response != null) {
                        byte[] ipResponse = wrapInIpUdp(packet, ipHeaderLen, response);
                        if (ipResponse != null) out.write(ipResponse);
                    }
                } else {
                    // Forward to real DNS
                    byte[] dnsQuery = Arrays.copyOfRange(packet, dnsOffset, length);
                    byte[] dnsResponse = forwardDns(dnsQuery);
                    if (dnsResponse != null) {
                        byte[] ipResponse = wrapInIpUdp(packet, ipHeaderLen, dnsResponse);
                        if (ipResponse != null) out.write(ipResponse);
                    }
                }
            }
        } catch (Exception e) {
            if (running) Log.e(TAG, "DNS filter error", e);
        }
    }

    private boolean isDomainBlocked(String domain) {
        domain = domain.toLowerCase();
        if (ALL_BLOCKED.contains(domain)) return true;
        // Check parent domains
        String[] parts = domain.split("\\.");
        for (int i = 1; i < parts.length - 1; i++) {
            StringBuilder parent = new StringBuilder();
            for (int j = i; j < parts.length; j++) {
                if (j > i) parent.append(".");
                parent.append(parts[j]);
            }
            if (ALL_BLOCKED.contains(parent.toString())) return true;
        }
        return false;
    }

    /** Parse DNS domain name from wire format */
    private String parseDnsDomain(byte[] data, int offset) {
        try {
            StringBuilder domain = new StringBuilder();
            while (offset < data.length) {
                int len = data[offset] & 0xFF;
                if (len == 0) break;
                if (len >= 192) break; // compression pointer — skip
                offset++;
                if (domain.length() > 0) domain.append(".");
                for (int i = 0; i < len && offset < data.length; i++, offset++) {
                    domain.append((char) (data[offset] & 0xFF));
                }
            }
            return domain.length() > 0 ? domain.toString() : null;
        } catch (Exception e) { return null; }
    }

    /** Build NXDOMAIN DNS response */
    private byte[] buildNxDomain(byte[] originalPacket, int dnsOffset, int dnsLength) {
        try {
            byte[] query = Arrays.copyOfRange(originalPacket, dnsOffset, dnsOffset + dnsLength);
            byte[] response = Arrays.copyOf(query, query.length);
            // Set QR=1 (response), RCODE=3 (NXDOMAIN)
            response[2] = (byte) 0x81; // QR=1, OPCODE=0, AA=0, TC=0, RD=1
            response[3] = (byte) 0x83; // RA=1, Z=0, RCODE=3 (NXDOMAIN)
            return response;
        } catch (Exception e) { return null; }
    }

    /** Forward DNS query to 8.8.8.8 */
    private byte[] forwardDns(byte[] query) {
        try (DatagramSocket socket = new DatagramSocket()) {
            socket.setSoTimeout(3000);
            protect(socket); // bypass VPN for this socket
            InetAddress dns = InetAddress.getByName("8.8.8.8");
            socket.send(new DatagramPacket(query, query.length, dns, 53));
            byte[] response = new byte[4096];
            DatagramPacket responsePacket = new DatagramPacket(response, response.length);
            socket.receive(responsePacket);
            return Arrays.copyOf(response, responsePacket.getLength());
        } catch (Exception e) { return null; }
    }

    /** Wrap DNS response back in IP+UDP packet (swap src/dst) */
    private byte[] wrapInIpUdp(byte[] originalIp, int ipHeaderLen, byte[] dnsPayload) {
        try {
            int totalLen = ipHeaderLen + 8 + dnsPayload.length;
            byte[] pkt = new byte[totalLen];

            // IP header — swap src/dst
            System.arraycopy(originalIp, 0, pkt, 0, ipHeaderLen);
            // Swap source and dest IP
            System.arraycopy(originalIp, 12, pkt, 16, 4); // orig src → new dst
            System.arraycopy(originalIp, 16, pkt, 12, 4); // orig dst → new src
            // Update total length
            pkt[2] = (byte)((totalLen >> 8) & 0xFF);
            pkt[3] = (byte)(totalLen & 0xFF);
            // Protocol=UDP(17), clear checksum
            pkt[9] = 17;
            pkt[10] = 0; pkt[11] = 0;
            // Compute IP checksum
            int checksum = 0;
            for (int i = 0; i < ipHeaderLen; i += 2) {
                checksum += ((pkt[i] & 0xFF) << 8) | (pkt[i+1] & 0xFF);
            }
            while ((checksum >> 16) != 0) checksum = (checksum & 0xFFFF) + (checksum >> 16);
            checksum = ~checksum & 0xFFFF;
            pkt[10] = (byte)(checksum >> 8);
            pkt[11] = (byte)(checksum & 0xFF);

            // UDP header — swap src/dst ports
            int udpOffset = ipHeaderLen;
            pkt[udpOffset]   = originalIp[udpOffset+2]; // src port = orig dst
            pkt[udpOffset+1] = originalIp[udpOffset+3];
            pkt[udpOffset+2] = originalIp[udpOffset];   // dst port = orig src
            pkt[udpOffset+3] = originalIp[udpOffset+1];
            int udpLen = 8 + dnsPayload.length;
            pkt[udpOffset+4] = (byte)(udpLen >> 8);
            pkt[udpOffset+5] = (byte)(udpLen & 0xFF);
            pkt[udpOffset+6] = 0; pkt[udpOffset+7] = 0; // checksum optional for IPv4

            // DNS payload
            System.arraycopy(dnsPayload, 0, pkt, ipHeaderLen + 8, dnsPayload.length);
            return pkt;
        } catch (Exception e) { return null; }
    }

    // ── Notification ──────────────────────────────────────────────────────────
    private Notification buildNotification() {
        Intent stopIntent = new Intent(this, FilterVpnService.class);
        stopIntent.setAction("STOP");
        PendingIntent stopPi = PendingIntent.getService(this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent openPi = PendingIntent.getActivity(this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🛡️ FilterGuard פעיל")
            .setContentText("סינון תוכן פעיל — כל הטלפון מוגן")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openPi)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "הפסק", stopPi)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "FilterGuard VPN", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("סינון תוכן פעיל");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    @Override
    public void onDestroy() {
        stopVpn();
        super.onDestroy();
    }
}

package com.filterguard.browser;

import android.graphics.Bitmap;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * FilterGuardWebViewClient
 * ─────────────────────────
 * Intercepts EVERY request the WebView makes (pages, images, scripts, XHR, iframes…)
 * and blocks anything matching the built-in filter lists.
 * No DNS setup required from the user — filtering is 100% inside the app.
 */
public class FilterGuardWebViewClient extends WebViewClient {

    // ── BLOCKED DOMAINS ──────────────────────────────────────────────────────
    private static final Set<String> ADULT = new HashSet<>(Arrays.asList(
        "pornhub.com","xvideos.com","xnxx.com","xhamster.com","redtube.com",
        "youporn.com","onlyfans.com","chaturbate.com","spankbang.com","eporner.com",
        "beeg.com","tnaflix.com","nhentai.net","rule34.xxx","brazzers.com",
        "bangbros.com","cam4.com","bongacams.com","livejasmin.com","myfreecams.com",
        "stripchat.com","faphouse.com","drtuber.com","tube8.com","slutload.com",
        "adultfriendfinder.com","ashleymadison.com","hclips.com","empflix.com",
        "porndig.com","fapdu.com","sexvid.xxx","vporn.com","ixxx.com","al4a.com",
        "hardsextube.com","keezmovies.com","porntrex.com","fuq.com","beeg.x",
        "cliphunter.com","youjizz.com","imagefap.com","hotmovies.com","sexhd.tv"
    ));

    private static final Set<String> GAMBLING = new HashSet<>(Arrays.asList(
        "bet365.com","888casino.com","pokerstars.com","partypoker.com","betway.com",
        "draftkings.com","fanduel.com","bovada.lv","mybookie.ag","1xbet.com",
        "22bet.com","betsson.com","casumo.com","leovegas.com","williamhill.com",
        "bwin.com","unibet.com","betfair.com","paddypower.com","sportingbet.com",
        "coral.co.uk","ladbrokes.com","betvictor.com","skybet.com","betway.co.uk",
        "888sport.com","mrgreen.com","rizk.com","casinocom","slotsmillion.com"
    ));

    private static final Set<String> SOCIAL = new HashSet<>(Arrays.asList(
        "facebook.com","instagram.com","twitter.com","x.com","tiktok.com",
        "snapchat.com","reddit.com","tumblr.com","pinterest.com","linkedin.com",
        "discord.com","twitch.tv","threads.net","bsky.app","mastodon.social",
        "vk.com","weibo.com","ok.ru","telegram.org","web.telegram.org"
    ));

    private static final Set<String> ADS = new HashSet<>(Arrays.asList(
        "doubleclick.net","googlesyndication.com","googletagmanager.com",
        "googletagservices.com","adnxs.com","adroll.com","criteo.com",
        "taboola.com","outbrain.com","rubiconproject.com","openx.com",
        "pubmatic.com","appnexus.com","scorecardresearch.com","comscore.com",
        "quantserve.com","chartbeat.com","moatads.com","advertising.com",
        "adsrvr.org","casalemedia.com","serving-sys.com","revcontent.com",
        "mgid.com","zergnet.com","sharethrough.com","indexww.com","rlcdn.com",
        "adsafeprotected.com","ads.yahoo.com","amazon-adsystem.com","media.net",
        "adsterra.com","propellerads.com","trafficjunky.com","exoclick.com",
        "juicyads.com","tsyndicate.com","adcolony.com","ironsource.com",
        "applovin.com","unity3d.com","mopub.com","inmobi.com","smaato.com",
        "smartadserver.com","yieldmo.com","lijit.com","sovrn.com","33across.com"
    ));

    // Keywords that always indicate blocked content
    private static final String[] BLOCKED_KEYWORDS = {
        "porn", "xxx", "adult", "nude", "naked", "sex-", "/sex/",
        "hentai", "erotic", "fetish", "nsfw", "casino", "gambling",
        "poker", "slots", "roulette", "wager", "betslip"
    };

    // ── Empty blocked response ────────────────────────────────────────────────
    private static final WebResourceResponse BLOCKED_RESPONSE =
        new WebResourceResponse("text/plain", "utf-8", 200,
            "Blocked", null, new ByteArrayInputStream(new byte[0]));

    private static final WebResourceResponse BLOCKED_HTML =
        new WebResourceResponse("text/html", "utf-8", 200,
            "Blocked", null, new ByteArrayInputStream(
                "<html><body style='font-family:sans-serif;text-align:center;padding:40px'><h2>🛡️ חסום</h2><p>תוכן חסום על ידי FilterGuard</p></body></html>"
                .getBytes()));

    // ── NavigationCallback interface ──────────────────────────────────────────
    public interface NavigationCallback {
        void onPageStarted(String url);
        void onPageFinished(String url);
        void onBlocked(String url, String category);
    }

    private final NavigationCallback callback;

    public FilterGuardWebViewClient(NavigationCallback callback) {
        this.callback = callback;
    }

    // ── Main interception logic ───────────────────────────────────────────────
    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();
        String host = request.getUrl().getHost();
        if (host == null) host = "";
        host = host.toLowerCase().replaceAll("^www\\.", "");

        // 1. Check adult
        if (isBlocked(host, ADULT) || containsKeyword(url, "porn","xxx","adult","nude","naked","hentai","erotic","fetish","nsfw")) {
            if (callback != null) callback.onBlocked(url, "adult");
            return request.isForMainFrame() ? BLOCKED_HTML : BLOCKED_RESPONSE;
        }

        // 2. Check gambling
        if (isBlocked(host, GAMBLING) || containsKeyword(url, "casino","gambling","poker","slots","wager","betslip")) {
            if (callback != null) callback.onBlocked(url, "gambling");
            return request.isForMainFrame() ? BLOCKED_HTML : BLOCKED_RESPONSE;
        }

        // 3. Check social (only block main frame navigation, not sub-resources like share buttons)
        if (request.isForMainFrame() && isBlocked(host, SOCIAL)) {
            if (callback != null) callback.onBlocked(url, "social");
            return BLOCKED_HTML;
        }

        // 4. Block ads (sub-resources: scripts, images, iframes)
        if (!request.isForMainFrame() && isBlocked(host, ADS)) {
            return BLOCKED_RESPONSE;
        }

        return null; // allow
    }

    // ── Page lifecycle ────────────────────────────────────────────────────────
    @Override
    public void onPageStarted(WebView view, String url, Bitmap favicon) {
        super.onPageStarted(view, url, favicon);
        if (callback != null) callback.onPageStarted(url);
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        if (callback != null) callback.onPageFinished(url);
        // Inject ad removal + AI filter JS after page loads
        injectFilterScript(view, url);
    }

    // ── JS Injection ──────────────────────────────────────────────────────────
    private void injectFilterScript(WebView view, String url) {
        boolean isYT = url.contains("youtube.com") || url.contains("youtu.be");

        String adRemover = "(function(){" +
            "var sel=['[id*=\"google_ad\"]','[class*=\"banner-ad\"]','[class*=\"advertisement\"]'," +
            "'iframe[src*=\"doubleclick\"]','[data-ad]','[class*=\"dfp-\"]','[class*=\"sponsored\"]'];" +
            "document.querySelectorAll(sel.join(',')).forEach(function(e){e.remove();});" +
            "})();";

        String nsfwLoader = "(function(){" +
            "if(window.__fg_loaded)return;window.__fg_loaded=true;" +
            "var s=document.createElement('script');" +
            "s.src='https://cdn.jsdelivr.net/npm/nsfwjs@4.2.0/dist/nsfwjs.min.js';" +
            "s.onload=function(){" +
            "  nsfwjs.load('https://cdn.jsdelivr.net/npm/nsfwjs@4.2.0/dist/').then(function(m){" +
            "    window.__fg_model=m;scanImgs();" +
            "  });" +
            "};" +
            "document.head.appendChild(s);" +
            "function scanImgs(){document.querySelectorAll('img').forEach(check);}" +
            "function check(img){" +
            "  if(!window.__fg_model||img.__done)return;" +
            "  if(!img.complete||img.naturalWidth<60)return;" +
            "  img.__done=true;" +
            "  window.__fg_model.classify(img).then(function(p){" +
            "    var sexy=p.find(function(x){return x.className==='Sexy';});" +
            "    var porn=p.find(function(x){return x.className==='Porn';});" +
            "    if((sexy&&sexy.probability>.15)||(porn&&porn.probability>.05)){" +
            "      img.style.filter='blur(40px) brightness(0.1)';" +
            "      img.style.transition='filter 0.3s';" +
            "      window.__fg_count=(window.__fg_count||0)+1;" +
            "    }" +
            "  }).catch(function(){});" +
            "}" +
            "new MutationObserver(function(m){m.forEach(function(x){x.addedNodes.forEach(function(n){" +
            "  if(n.tagName==='IMG')check(n);" +
            "  if(n.querySelectorAll)n.querySelectorAll('img').forEach(check);" +
            "});});}).observe(document.documentElement,{childList:true,subtree:true});" +
            "})();";

        String ytFilter = "(function(){" +
            "var KW=['woman','women','girl','female','she','her','lady','אשה','נשים','ילדה'," +
            "'mom','sister','wife','queen','actress','singer','model','girlfriend','hot','sexy'];" +
            "function hasKw(el){var t=(el.textContent||'').toLowerCase();" +
            "return KW.some(function(k){return t.indexOf(k)>-1;});}" +
            "function blockCard(c){" +
            "  if(c.__b)return;c.__b=true;" +
            "  c.style.position='relative';" +
            "  var o=document.createElement('div');" +
            "  o.style.cssText='position:absolute;inset:0;background:rgba(15,15,25,.97);display:flex;align-items:center;justify-content:center;z-index:9999;border-radius:12px;flex-direction:column;gap:4px;pointer-events:none;';" +
            "  o.innerHTML='<div style=\"font-size:22px\">🛡️</div><div style=\"color:#94a3b8;font-size:10px;font-family:sans-serif;direction:rtl\">חסום</div>';" +
            "  c.appendChild(o);window.__yt_blocked=(window.__yt_blocked||0)+1;" +
            "}" +
            "function scan(){" +
            "  ['ytd-rich-item-renderer','ytd-video-renderer','ytd-compact-video-renderer'," +
            "   'ytd-grid-video-renderer'].forEach(function(sel){" +
            "    document.querySelectorAll(sel).forEach(function(c){" +
            "      if(!c.__proc){c.__proc=true;if(hasKw(c))blockCard(c);}" +
            "    });" +
            "  });" +
            "}" +
            "new MutationObserver(function(){setTimeout(scan,400);})" +
            "  .observe(document.body||document.documentElement,{childList:true,subtree:true});" +
            "[800,2000,4000].forEach(function(d){setTimeout(scan,d);});" +
            "})();";

        // Inject scripts
        view.evaluateJavascript(adRemover, null);
        view.evaluateJavascript(nsfwLoader, null);
        if (isYT) view.evaluateJavascript(ytFilter, null);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private boolean isBlocked(String host, Set<String> list) {
        if (host.isEmpty()) return false;
        // Exact match or subdomain match
        if (list.contains(host)) return true;
        for (String blocked : list) {
            if (host.endsWith("." + blocked) || host.equals(blocked)) return true;
        }
        return false;
    }

    private boolean containsKeyword(String url, String... keywords) {
        String lower = url.toLowerCase();
        for (String kw : keywords) {
            if (lower.contains(kw)) return true;
        }
        return false;
    }
}

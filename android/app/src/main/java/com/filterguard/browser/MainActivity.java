package com.filterguard.browser;

import android.app.Activity;
import android.content.Intent;
import android.net.VpnService;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

/**
 * MainActivity
 * ─────────────
 * 1. Starts FilterGuard WebViewClient (blocks inside browser)
 * 2. Requests VPN permission → starts FilterVpnService (blocks system-wide)
 */
public class MainActivity extends BridgeActivity {

    private static final int VPN_REQUEST_CODE = 100;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Hook our custom WebViewClient into Capacitor's WebView
        setupFilteredWebView();

        // Request VPN permission for system-wide filtering
        requestVpnPermission();

        // Handle intent if opened from a link (default browser behavior)
        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_VIEW.equals(action) && intent.getData() != null) {
            String url = intent.getData().toString();
            // Pass URL to WebView via JS
            runOnUiThread(() -> {
                try {
                    getBridge().getWebView().evaluateJavascript(
                        "window.__incomingUrl='" + url.replace("'", "\\'") + "';" +
                        "if(window.__handleIncomingUrl)window.__handleIncomingUrl('" + url.replace("'", "\\'") + "');",
                        null
                    );
                } catch (Exception e) { /* ignore */ }
            });
        }
    }

    private void setupFilteredWebView() {
        try {
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();

            // Performance settings
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setDomStorageEnabled(true);
            settings.setJavaScriptEnabled(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(false);
            settings.setBuiltInZoomControls(true);
            settings.setDisplayZoomControls(false);
            settings.setLoadWithOverviewMode(true);
            settings.setUseWideViewPort(true);
            settings.setSupportZoom(true);
            settings.setMediaPlaybackRequiresUserGesture(false);

            // Set our filter client
            webView.setWebViewClient(new FilterGuardWebViewClient(
                new FilterGuardWebViewClient.NavigationCallback() {
                    @Override
                    public void onPageStarted(String url) {
                        runOnUiThread(() -> {
                            try {
                                getBridge().getWebView().evaluateJavascript(
                                    "if(window.__onPageStart)window.__onPageStart('" +
                                    url.replace("'", "\\'") + "');", null);
                            } catch (Exception e) { /* ignore */ }
                        });
                    }

                    @Override
                    public void onPageFinished(String url) {
                        runOnUiThread(() -> {
                            try {
                                getBridge().getWebView().evaluateJavascript(
                                    "if(window.__onPageDone)window.__onPageDone('" +
                                    url.replace("'", "\\'") + "');", null);
                            } catch (Exception e) { /* ignore */ }
                        });
                    }

                    @Override
                    public void onBlocked(String url, String category) {
                        runOnUiThread(() -> {
                            try {
                                getBridge().getWebView().evaluateJavascript(
                                    "if(window.__onBlocked)window.__onBlocked('" +
                                    url.replace("'", "\\'") + "','" + category + "');", null);
                            } catch (Exception e) { /* ignore */ }
                        });
                    }
                }
            ));

        } catch (Exception e) {
            // Capacitor bridge not ready yet — retry after a moment
            getBridge().getWebView().postDelayed(this::setupFilteredWebView, 500);
        }
    }

    private void requestVpnPermission() {
        Intent intent = VpnService.prepare(this);
        if (intent != null) {
            // Need to ask user for VPN permission (one-time)
            startActivityForResult(intent, VPN_REQUEST_CODE);
        } else {
            // Already have permission
            startVpnService();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == VPN_REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK) {
                startVpnService();
            }
            // If denied, browser-level filtering still works
        }
    }

    private void startVpnService() {
        Intent intent = new Intent(this, FilterVpnService.class);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
    }
}

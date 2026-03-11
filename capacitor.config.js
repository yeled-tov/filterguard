/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.filterguard.browser',
  appName: 'FilterGuard',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    backgroundColor: '#ffffff',
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['*']
  },
  plugins: {
    StatusBar: { backgroundColor: '#ffffff', style: 'light' },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#161C36',
      androidSplashResourceName: 'splash',
      splashFullScreen: true,
      splashImmersive: true,
    }
  }
};
module.exports = config;

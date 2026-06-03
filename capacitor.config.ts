import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = { 
  appId: 'com.alorack17.app', 
  appName: 'Alorack17', 
  webDir: 'www', 
  plugins: { 
    SplashScreen: { 
      launchShowDuration: 2000, 
      launchAutoHide: true, 
      backgroundColor: '#09111f', 
      androidSplashResourceName: 'splash', 
      showSpinner: false,
    }, 
  }, 
};

export default config;

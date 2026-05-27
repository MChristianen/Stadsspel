import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.stadsspel.app',
  appName: 'Stadsspel',
  webDir: 'dist',
  server: {
    url: 'https://stadsspel.org',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.docscan.app',
  appName: 'DocScan',
  webDir: 'out',
  server: {
    androidScheme: 'http',
  },
};

export default config;

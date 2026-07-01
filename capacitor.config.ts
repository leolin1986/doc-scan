import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.docscan.app',
  appName: '扫立得',
  webDir: 'out',
  server: {
    androidScheme: 'http',
  },
};

export default config;

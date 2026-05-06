import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shanghaitower.damper.edu',
  appName: '上海慧眼科普',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

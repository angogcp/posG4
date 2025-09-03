import type { CapacitorConfig } from '@capacitor/cli';

// Allow overriding dev server for on-device live reload via env var
const devUrl = process.env.CAP_DEV_URL; // e.g. http://192.168.1.100:5791
let serverConfig: CapacitorConfig['server'] = {
  androidScheme: 'http',
  cleartext: true
};
if (devUrl) {
  serverConfig = {
    ...serverConfig,
    url: devUrl,
    allowNavigation: [new URL(devUrl).hostname]
  };
}

const config: CapacitorConfig = {
  appId: 'com.posg4.app',
  appName: 'posg4',
  webDir: 'dist',
  server: serverConfig
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.honor.bienestar', appName: 'Honor · Mi bienestar', webDir: 'dist',
  loggingBehavior: 'none',
  android: { allowMixedContent: false },
};
export default config;

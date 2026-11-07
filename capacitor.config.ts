import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.babyday.tracker',
  appName: '宝宝日记',
  webDir: 'dist',
  backgroundColor: '#F2F2F7',
  android: {
    backgroundColor: '#F2F2F7',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#F2F2F7',
      showSpinner: false,
      launchAutoHide: true,
    },
  },
}

export default config

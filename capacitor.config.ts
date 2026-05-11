import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.suki.knittinglog',
  appName: 'App name:나의 뜨개 프로젝트 기록App ID:com.suki.knittinglog',
  webDir: 'dist'
   plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"],
    },
  },
};

export default config;

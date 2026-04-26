import 'dotenv/config';
import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
    name: 'StablePay',
    slug: 'stablepay',
    version: '1.1.1',
    scheme: 'stablepay',
    description: 'Instant USDC payments on Base',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    icon: './assets/images/stablepay-icon.png',

    ios: {
      bundleIdentifier: 'com.vijithreddy.stablepay',
      buildNumber: process.env.IOS_BUILD_NUMBER ?? '1.0.0',
      supportsTablet: false,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    },

    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-localization',
      ['expo-splash-screen', { image: './assets/images/stablepay-splash.png', imageWidth: 200, resizeMode: 'contain', backgroundColor: '#ffffff' }],
      ['expo-build-properties', { ios: { deploymentTarget: '15.1' } }],
      ['expo-notifications', {
        icon: './assets/images/icon.png',
        color: '#0052FF'
      }],
    ],

    experiments: { typedRoutes: true },

    runtimeVersion: { policy: 'sdkVersion' },

    extra: {
      eas: {
        projectId: '981ff535-f8bf-4fac-97ef-1cdbc9038e85'
      }
    }
};

export default config;

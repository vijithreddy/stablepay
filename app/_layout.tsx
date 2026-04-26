import { CDPHooksProvider, Config } from "@coinbase/cdp-hooks";
import { Stack } from "expo-router";
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Paper } from "../constants/PaperTheme";

import { AuthGate } from "@/components/AuthGate";
import { AuthInitializer } from "@/components/AuthInitializer";
import { getTestWalletEvm, hydrateTestSession, hydrateVerifiedPhone, hydrateLifetimeTransactionThreshold, isTestSessionActive, setCurrentWalletAddress } from "@/utils/sharedState";
import { useEffect } from "react";

console.log('[StablePay] Backend URL:', process.env.EXPO_PUBLIC_BASE_URL);

// CDP configuration — USDC/Base/Apple-Pay only
const cdpConfig: Config = {
  projectId: process.env.EXPO_PUBLIC_CDP_PROJECT_ID!,
  basePath: "https://api.cdp.coinbase.com/platform",
  ethereum: {
    createOnLogin: "smart"
  },
  useMock: false
};
console.log('RootLayout mounted, CDP config:', cdpConfig);

export default function RootLayout() {
  useEffect(() => {
    // Hydrate phone verification
    hydrateVerifiedPhone().catch(() => {});

    // Hydrate lifetime transaction threshold
    hydrateLifetimeTransactionThreshold().catch(() => {});

    // Hydrate test session (TestFlight)
    hydrateTestSession().then(() => {
      if (isTestSessionActive()) {
        console.log('🧪 Test session restored from storage');
        setCurrentWalletAddress(getTestWalletEvm());
        // Test session uses hardcoded addresses for demo
      }
    }).catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CDPHooksProvider config={cdpConfig}>
        <StatusBar style="dark" />
        <AuthInitializer>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              {/* Auth screens */}
              <Stack.Screen
                name="auth/login"
                options={{
                  headerShown: false,
                  gestureEnabled: false,  // Can't swipe back from login
                  animation: 'fade',
                }}
              />

              {/* Phone verification pages - no tabs */}
              <Stack.Screen
                name="phone-verify"
                options={{
                  presentation: 'card',
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                  name="phone-code"
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                  }}
              />

              {/* Offramp send — reached via deep link after Coinbase sell flow */}
              <Stack.Screen
                name="offramp-send"
                options={{
                  presentation: 'card',
                  animation: 'slide_from_bottom',
                }}
              />

              {/* Main app with tabs */}
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </AuthGate>
        </AuthInitializer>
      </CDPHooksProvider>
    </GestureHandlerRootView>
  );
}
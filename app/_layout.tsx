import { CDPHooksProvider, Config } from "@coinbase/cdp-hooks";
import { Stack } from "expo-router";
import { COLORS } from "../constants/Colors";

import { AuthGate } from "@/components/AuthGate";
import { AuthInitializer } from "@/components/AuthInitializer";
import { getTestWalletEvm, hydrateSandboxMode, hydrateTestSession, hydrateVerifiedPhone, hydrateLifetimeTransactionThreshold, isTestSessionActive, setCurrentWalletAddress } from "@/utils/sharedState";
import { useEffect } from "react";

const { BLUE, TEXT_SECONDARY, CARD_BG, BORDER, TEXT_PRIMARY } = COLORS;

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
    // Hydrate sandbox mode preference
    hydrateSandboxMode().catch(() => {});

    // Hydrate phone verification
    hydrateVerifiedPhone().catch(() => {});

    // Hydrate lifetime transaction threshold
    hydrateLifetimeTransactionThreshold().catch(() => {});

    // Hydrate test session (TestFlight)
    hydrateTestSession().then(() => {
      if (isTestSessionActive()) {
        console.log('🧪 Test session restored from storage');
        setCurrentWalletAddress(getTestWalletEvm());
        // Note: NOT forcing sandbox - let reviewer choose mode via Profile
      }
    }).catch(() => {});
  }, []);

  return (
    <CDPHooksProvider config={cdpConfig}>
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
  );
}
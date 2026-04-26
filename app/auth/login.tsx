/**
 * Login Screen - Branded authentication page
 *
 * Full-screen login UI with StablePay branding.
 * Users must connect wallet to access the app.
 * TestFlight accounts auto-proceed after brief display.
 */

import { Paper } from '@/constants/PaperTheme';
import { isTestSessionActive } from '@/utils/sharedState';
import { useIsSignedIn } from '@coinbase/cdp-hooks';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Wordmark from '@/components/ui/Wordmark';
import PaperButton from '@/components/ui/PaperButton';

export default function LoginScreen() {
  const { isSignedIn } = useIsSignedIn();
  const router = useRouter();
  const testSession = isTestSessionActive();
  const [showTestMessage, setShowTestMessage] = useState(false);

  // TestFlight auto-login
  useEffect(() => {
    if (testSession) {
      setShowTestMessage(true);
      // Brief delay to show message, then proceed
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1500);
    }
  }, [testSession]);

  // Real user logged in → navigate to app
  useEffect(() => {
    if (isSignedIn && !testSession) {
      router.replace('/(tabs)');
    }
  }, [isSignedIn, testSession]);

  const handleEmailLogin = () => {
    router.push({
      pathname: '/email-verify',
      params: { mode: 'signin' }
    });
  };

  const handlePhoneLogin = () => {
    router.push({
      pathname: '/phone-verify',
      params: { mode: 'signin' }
    });
  };

  // TestFlight loading state
  if (showTestMessage) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.content}>
          <View style={styles.testMessageContainer}>
            <ActivityIndicator size="large" color={Paper.colors.orange} style={{ marginBottom: 16 }} />
            <Text style={styles.testTitle}>TestFlight Mode</Text>
            <Text style={styles.testSubtitle}>Test account detected{'\n'}Auto-login enabled...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Wordmark size={28} />
        <Text style={styles.tagline}>Instant USDC payments on Base</Text>

        <View style={styles.buttons}>
          <PaperButton label="Continue with Email" onPress={handleEmailLogin} variant="primary" />
          <PaperButton label="Continue with Phone" onPress={handlePhoneLogin} variant="secondary" />
        </View>
      </View>

      <Text style={styles.footer}>By continuing you agree to our Terms</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Paper.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  tagline: {
    fontSize: 14,
    color: Paper.colors.sand,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 40,
  },
  buttons: {
    width: '100%',
    gap: 14,
  },
  footer: {
    fontSize: 11,
    color: Paper.colors.sandLight,
    textAlign: 'center',
    paddingBottom: 32,
    paddingHorizontal: 28,
  },
  testMessageContainer: {
    alignItems: 'center',
    backgroundColor: Paper.colors.surface,
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Paper.colors.border,
  },
  testTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Paper.colors.navy,
    marginBottom: 8,
  },
  testSubtitle: {
    fontSize: 16,
    color: Paper.colors.sand,
    textAlign: 'center',
    lineHeight: 24,
  },
});

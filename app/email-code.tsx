import { useCurrentUser, useIsInitialized, useSignInWithEmail, useVerifyEmailOTP, useLinkEmail } from '@coinbase/cdp-hooks';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CoinbaseAlert } from '../components/ui/CoinbaseAlerts';
import { Paper } from '../constants/PaperTheme';
import { isTestAccount, TEST_ACCOUNTS } from '../constants/TestAccounts';
import { setCurrentWalletAddress, setTestSession } from '../utils/sharedState';
const RESEND_SECONDS = 30;

export default function EmailCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email as string;
  const flowId = params.flowId as string;
  const mode = (params.mode as 'signin' | 'link') || 'signin'; // Default to signin for new flow

  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);
  const [alert, setAlert] = useState<{visible:boolean; title:string; message:string; type:'success'|'error'|'info'}>({
    visible:false, title:'', message:'', type:'info'
  });

  // CDP hooks - use different hook based on mode (use same verify hook for both)
  const { signInWithEmail } = useSignInWithEmail();
  const { verifyEmailOTP } = useVerifyEmailOTP();
  const { linkEmail } = useLinkEmail();
  const { currentUser } = useCurrentUser();
  const { isInitialized } = useIsInitialized();

  const canResend = resendSeconds <= 0 && !sending && !verifying;

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setInterval(() => setResendSeconds(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendSeconds]);

  const resendCode = async () => {
    // Skip resend for test accounts
    if (isTestAccount(email)) {
      setResendSeconds(RESEND_SECONDS);
      return;
    }

    setSending(true);
    try {
      console.log(`📤 [Email Resend] Resending code for ${mode} flow`);

      let result;
      if (mode === 'signin') {
        result = await signInWithEmail({ email });
      } else {
        result = await linkEmail(email); // linkEmail takes string directly
      }

      console.log('✅ [Email Resend] Email sent successfully');
      setResendSeconds(RESEND_SECONDS);
    } catch (e: any) {
      console.error('❌ [Email Resend] Error:', e);

      // Handle METHOD_ALREADY_LINKED - already linked, just reset timer
      if (e.code === 'METHOD_ALREADY_LINKED') {
        setResendSeconds(RESEND_SECONDS);
        return;
      }

      setAlert({
        visible: true,
        title: 'Error',
        message: e.message || 'Failed to resend email',
        type: 'error'
      });
    } finally {
      setSending(false);
    }
  };

  const verifyEmail = async () => {
    if (!flowId || !otp) return;
    setVerifying(true);
    try {
      // Check if this is a test account (TestFlight) - only for signin mode
      if (isTestAccount(email) && mode === 'signin') {
        console.log('🧪 Test account detected, activating mock session');

        // Verify OTP matches
        if (otp !== TEST_ACCOUNTS.otp) {
          throw new Error(`Test account OTP must be: ${TEST_ACCOUNTS.otp}`);
        }

        // Set up mock session (no CDP involved)
        await setTestSession(TEST_ACCOUNTS.wallets.evm, '');
        setCurrentWalletAddress(TEST_ACCOUNTS.wallets.evm);

        setAlert({
          visible: true,
          title: 'TestFlight Mode',
          message: `Welcome, TestFlight Reviewer!\n\nTest Credentials:\n• Email: ${TEST_ACCOUNTS.email}\n• OTP: ${TEST_ACCOUNTS.otp}\n• Phone: ${TEST_ACCOUNTS.phone}\n• SMS Code: ${TEST_ACCOUNTS.smsCode}\n\nYou can test the full production flow without payment.`,
          type: 'info'
        });

        // Navigate immediately
        router.dismissAll();
        return;
      }

      // Real account flow via CDP
      console.log(`📤 [Email Verify] Verifying ${mode} flow`);

      // Use same verification hook for both signin and link
      await verifyEmailOTP({ flowId, otp });

      if (mode === 'signin') {
        // Sign in with email - creates wallet
        // Wait for CDP to finish wallet initialization
        console.log('⏳ Waiting for wallet creation...');
        const maxWaitTime = 10000; // 10 second timeout
        const startTime = Date.now();

        while (!isInitialized) {
          if (Date.now() - startTime > maxWaitTime) {
            console.warn('⚠️ Wallet initialization timeout - navigating anyway');
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 200)); // Check every 200ms
        }

        // Register push notifications after successful sign-in
        console.log('✅ Email sign-in successful, wallet ready');

        // Send ping FIRST to confirm we reached this code (visible in Vercel logs)
        fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/push-tokens/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'email-code-signin',
            hasCurrentUser: !!currentUser,
            userId: currentUser?.userId,
            timestamp: new Date().toISOString()
          })
        }).catch(() => {});

        // Register push token now that user is signed in
        const { registerForPushNotifications, sendPushTokenToServer } = await import('@/utils/pushNotifications');
        const { getAccessTokenGlobal } = await import('@/utils/getAccessTokenGlobal');

        try {
          const result = await registerForPushNotifications();
          if (result && currentUser?.userId) {
            console.log('📱 [EMAIL-CODE] Registering push token after sign-in:', currentUser.userId);
            await sendPushTokenToServer(result.token, currentUser.userId, getAccessTokenGlobal, result.type);
          } else {
            console.log('⚠️ [EMAIL-CODE] No push token result:', { hasResult: !!result, hasUserId: !!currentUser?.userId });
          }
        } catch (pushError) {
          console.error('⚠️ [EMAIL-CODE] Push registration failed (non-blocking):', pushError);
        }

        // Wait for CDP state to fully propagate before navigation (prevents race with AuthGate on real devices)
        await new Promise(resolve => setTimeout(resolve, 300));

        // Navigate to home page after successful sign-in
        router.replace('/(tabs)');
      } else {
        // Link email to existing account
        console.log('✅ Email linked successfully');

        // Show success message
        setAlert({
          visible: true,
          title: 'Email Verified',
          message: 'Your email address has been linked to your account.',
          type: 'success'
        });

        setTimeout(() => router.dismissAll(), 1500);
      }
    } catch (e: any) {
      console.error(`❌ [Email Verify] ${mode} error:`, e);
      setAlert({
        visible: true,
        title: 'Verification Failed',
        message: e.message || 'Invalid code. Please try again.',
        type: 'error'
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Paper.colors.navy} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stepContainer}>
            <Text style={styles.title}>
              {mode === 'signin' ? 'Check your email' : 'Link your email'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'signin'
                ? `Please enter the verification code we sent to ${email}`
                : `Please enter the verification code we sent to ${email} to link this email.`}
            </Text>

            <View style={styles.codeInputContainer}>
              <TextInput
                style={styles.codeInput}
                value={otp}
                onChangeText={setOtp}
                placeholder=""
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                keyboardType="number-pad"
                maxLength={6}
                editable={!verifying}
                selectTextOnFocus={true}
                autoFocus
              />
            </View>

            <Pressable
              style={[styles.continueButton, (verifying || otp.length < 4) && styles.disabledButton]}
              onPress={verifyEmail}
              disabled={verifying || otp.length < 4}
            >
              {verifying ? (
                <ActivityIndicator color={Paper.colors.white} />
              ) : (
                <Text style={styles.continueButtonText}>Verify</Text>
              )}
            </Pressable>

            <View style={styles.resendContainer}>
              {resendSeconds > 0 ? (
                <Text style={styles.resendText}>You can resend in {resendSeconds}s</Text>
              ) : (
                <Pressable onPress={resendCode} disabled={!canResend}>
                  <Text style={[styles.resendButton, !canResend && styles.disabledText]}>
                    Resend code
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CoinbaseAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onConfirm={() => setAlert(a => ({ ...a, visible:false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Paper.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    color: Paper.colors.sand,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stepContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Paper.colors.navy,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Paper.colors.sand,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  codeInputContainer: {
    marginBottom: 32,
    width: '100%',
  },
  codeInput: {
    backgroundColor: Paper.colors.surface,
    borderWidth: 1.5,
    borderColor: Paper.colors.border,
    borderRadius: Paper.radius.md,
    padding: 16,
    fontSize: 28,
    fontWeight: '700',
    color: Paper.colors.navy,
    textAlign: 'center',
    letterSpacing: 12,
    width: '100%',
  },
  continueButton: {
    backgroundColor: Paper.colors.orange,
    height: 54,
    borderRadius: Paper.radius.md,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: Paper.colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  resendContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: Paper.colors.sand,
    fontWeight: '500',
  },
  resendButton: {
    fontSize: 14,
    color: Paper.colors.sand,
    fontWeight: '500',
  },
  disabledText: {
    color: Paper.colors.sandLight,
  },
});
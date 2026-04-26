import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CoinbaseAlert } from '../components/ui/CoinbaseAlerts';
import { Paper } from '../constants/PaperTheme';
import { TEST_ACCOUNTS } from '../constants/TestAccounts';
import { setVerifiedPhone, setCurrentWalletAddress, setTestSession } from '../utils/sharedState';
import { useCurrentUser, useVerifySmsOTP, useSignInWithSms, useLinkSms, useIsInitialized } from '@coinbase/cdp-hooks';

const RESEND_SECONDS = 30;

export default function PhoneCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const phone = params.phone as string;
  const flowId = params.flowId as string;
  const mode = (params.mode as 'signin' | 'link' | 'reverify') || 'link'; // Default to link for backwards compat

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);
  const [alert, setAlert] = useState<{visible:boolean; title:string; message:string; type:'success'|'error'|'info'}>({
    visible:false, title:'', message:'', type:'info'
  });

  // CDP hooks - use different hook based on mode (use same verify hook for both)
  const { verifySmsOTP } = useVerifySmsOTP();
  const { signInWithSms } = useSignInWithSms();
  const { linkSms } = useLinkSms();
  const { isInitialized } = useIsInitialized();
  const { currentUser } = useCurrentUser();

  const canResend = resendSeconds <= 0 && !sending && !verifying;

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setInterval(() => setResendSeconds(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendSeconds]);

  const resendCode = async () => {
    // Skip resend for test accounts
    if (phone === TEST_ACCOUNTS.phone) {
      setResendSeconds(RESEND_SECONDS);
      return;
    }

    setSending(true);
    try {
      console.log(`📤 [SMS Resend] Resending code for ${mode} flow`);

      let result;
      if (mode === 'signin') {
        result = await signInWithSms({ phoneNumber: phone });
      } else {
        result = await linkSms(phone); // linkSms takes string directly
      }

      console.log('✅ [SMS Resend] SMS sent successfully');
      setResendSeconds(RESEND_SECONDS);
    } catch (e: any) {
      console.error('❌ [SMS Resend] Error:', e);

      // Handle METHOD_ALREADY_LINKED - already linked, just reset timer
      if (e.code === 'METHOD_ALREADY_LINKED') {
        setResendSeconds(RESEND_SECONDS);
        return;
      }

      setAlert({
        visible: true,
        title: 'Error',
        message: e.message || 'Failed to resend SMS',
        type: 'error'
      });
    } finally {
      setSending(false);
    }
  };

  const verifySms = async () => {
    if (!phone || !code) return;
    setVerifying(true);
    try {
      // Check if this is test phone (TestFlight)
      if (phone === TEST_ACCOUNTS.phone) {
        console.log(`🧪 Test phone detected, using mock verification (mode: ${mode})`);

        if (code !== TEST_ACCOUNTS.smsCode) {
          throw new Error(`Test SMS code must be: ${TEST_ACCOUNTS.smsCode}`);
        }

        if (mode === 'signin') {
          // Mock wallet creation for TestFlight
          console.log('🧪 Creating test session for phone signin');
          await setTestSession(TEST_ACCOUNTS.wallets.evm, '');
          setCurrentWalletAddress(TEST_ACCOUNTS.wallets.evm);
          await setVerifiedPhone(phone, TEST_ACCOUNTS.userId);
          router.replace('/(tabs)');
        } else if (mode === 'reverify') {
          // Mock phone re-verification for TestFlight
          console.log('🧪 Re-verifying test phone');
          await setVerifiedPhone(phone, TEST_ACCOUNTS.userId);

          setAlert({
            visible: true,
            title: 'Phone Re-verified ✅',
            message: 'Your test phone has been re-verified and is ready for Apple Pay checkout.',
            type: 'success'
          });

          setTimeout(() => router.dismissAll(), 1500);
        } else {
          // Mock phone linking for TestFlight
          console.log('🧪 Storing test phone for linking');
          await setVerifiedPhone(phone, TEST_ACCOUNTS.userId);

          setAlert({
            visible: true,
            title: 'Phone Verified',
            message: 'Your test phone has been linked to your account.',
            type: 'success'
          });

          setTimeout(() => router.dismissAll(), 1500);
        }
        return;
      }

      // Real phone verification flow via CDP
      console.log(`📤 [SMS Verify] Verifying ${mode} flow`);

      // Use same verification hook for both signin and link
      await verifySmsOTP({ flowId, otp: code });

      if (mode === 'signin') {
        // Sign in with phone - creates wallet
        // Wait for wallet initialization
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

        // Mark phone as verified (fresh OTP = verified for 60 days)
        // Wait a moment for currentUser to be available after sign-in
        await new Promise(resolve => setTimeout(resolve, 500));
        const userId = currentUser?.userId;
        await setVerifiedPhone(phone, userId);
        console.log('✅ Phone sign-in successful, wallet ready, phone verified', { userId});

        // Register push notifications after successful sign-in
        // Send ping FIRST to confirm we reached this code (visible in Vercel logs)
        fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/push-tokens/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'phone-code-signin',
            hasUserId: !!userId,
            userId: userId,
            timestamp: new Date().toISOString()
          })
        }).catch(() => {});

        const { registerForPushNotifications, sendPushTokenToServer } = await import('@/utils/pushNotifications');
        const { getAccessTokenGlobal } = await import('@/utils/getAccessTokenGlobal');

        try {
          const result = await registerForPushNotifications();
          if (result && userId) {
            console.log('📱 [PHONE-CODE] Registering push token after sign-in:', userId);
            await sendPushTokenToServer(result.token, userId, getAccessTokenGlobal, result.type);
          } else {
            console.log('⚠️ [PHONE-CODE] No push token result:', { hasResult: !!result, hasUserId: !!userId });
          }
        } catch (pushError) {
          console.error('⚠️ [PHONE-CODE] Push registration failed (non-blocking):', pushError);
        }

        // Navigate to home page after successful sign-in
        router.replace('/(tabs)');
      } else if (mode === 'reverify') {
        // Re-verify existing phone - just update verification timestamp
        console.log('✅ Phone re-verified successfully (already linked)');
        await setVerifiedPhone(phone, currentUser?.userId);

        // Show success message
        setAlert({
          visible: true,
          title: 'Phone Re-verified ✅',
          message: 'Your phone number has been re-verified and is ready for Apple Pay checkout.',
          type: 'success'
        });

        setTimeout(() => router.dismissAll(), 1500);
      } else {
        // Link phone to existing account
        console.log('✅ Phone linked successfully');
        await setVerifiedPhone(phone, currentUser?.userId);

        // Show success message
        setAlert({
          visible: true,
          title: 'Phone Verified',
          message: 'Your phone number has been linked to your account.',
          type: 'success'
        });

        setTimeout(() => router.dismissAll(), 1500);
      }
    } catch (e: any) {
      console.error(`❌ [SMS Verify] ${mode} error:`, e);
      console.error('Error type:', typeof e);
      console.error('Error constructor:', e?.constructor?.name);
      console.error('Error details:', {
        message: e.message,
        code: e.code,
        status: e.status,
        statusCode: e.statusCode,
        correlationId: e.correlationId,
        requestId: e.requestId,
        cause: e.cause,
        response: e.response,
        data: e.data
      });

      // Try to log wrapped errors
      if (e.cause) {
        console.error('Original error cause:', e.cause);
      }

      // Build comprehensive error message
      let errorMessage = e.message || 'Invalid code. Please try again.';

      // Add all error properties to the message
      const errorDetails: string[] = [];
      if (e.code) errorDetails.push(`Code: ${e.code}`);
      if (e.status) errorDetails.push(`Status: ${e.status}`);
      if (e.statusCode) errorDetails.push(`Status Code: ${e.statusCode}`);
      if (e.correlationId) errorDetails.push(`Correlation ID: ${e.correlationId}`);
      if (e.requestId) errorDetails.push(`Request ID: ${e.requestId}`);

      // Try to stringify the entire error object
      try {
        const errorJson = JSON.stringify(e, null, 2);
        if (errorJson !== '{}') {
          errorDetails.push(`\nFull Error:\n${errorJson}`);
        }
      } catch (jsonError) {
        // Ignore JSON stringify errors
      }

      if (errorDetails.length > 0) {
        errorMessage += '\n\n' + errorDetails.join('\n');
      }

      setAlert({
        visible: true,
        title: 'Verification Failed',
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Paper.colors.sand} />
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
              {mode === 'signin' ? 'Verify your phone' : mode === 'reverify' ? 'Re-verify your phone' : 'Link your phone'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'signin'
                ? `Please enter the verification code we texted to ${phone || 'your phone'}.`
                : mode === 'reverify'
                ? `Please enter the verification code we texted to ${phone || 'your phone'} to re-verify.`
                : `Please enter the verification code we texted to ${phone || 'your phone'}.`}
            </Text>

            <View style={styles.codeInputContainer}>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={setCode}
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
              style={[styles.continueButton, (verifying || code.length < 4) && styles.disabledButton]}
              onPress={verifySms}
              disabled={verifying || code.length < 4}
            >
              {verifying ? (
                <ActivityIndicator color={Paper.colors.white} />
              ) : (
                <Text style={styles.continueButtonText}>Verify</Text>
              )}
            </Pressable>

            {/* Resend section */}
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
  },
  subtitle: {
    fontSize: 16,
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
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 20,
    fontSize: 28,
    fontWeight: '700',
    color: Paper.colors.navy,
    textAlign: 'center',
    letterSpacing: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  continueButton: {
    backgroundColor: Paper.colors.orange,
    height: 54,
    borderRadius: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Paper.colors.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
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
    color: Paper.colors.sand,
    fontSize: 14,
  },
  resendButton: {
    color: Paper.colors.sand,
    fontSize: 14,
    fontWeight: '600',
  },
  topPadding: {
    height: 20,
  },
  disabledText: {
    color: Paper.colors.sand,
  },
  smsPreview: {
    marginTop: 40,
    backgroundColor: Paper.colors.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  smsLabel: {
    fontSize: 12,
    color: Paper.colors.sand,
    marginBottom: 4,
  },
  smsCode: {
    fontSize: 20,
    fontWeight: '600',
    color: Paper.colors.navy,
  },
});
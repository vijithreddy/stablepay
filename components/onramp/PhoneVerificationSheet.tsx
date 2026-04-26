import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useLinkSms, useVerifySmsOTP } from '@coinbase/cdp-hooks';
import { Paper } from '../../constants/PaperTheme';
import { storeVerifiedPhone } from '../../utils/phoneVerification';
import { setVerifiedPhone as setSharedVerifiedPhone } from '../../utils/sharedState';

type Props = {
  visible: boolean;
  onVerified: (phoneNumber: string) => void;
  onDismiss: () => void;
};

type State = 'input' | 'otp' | 'success';

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function PhoneVerificationSheet({ visible, onVerified, onDismiss }: Props) {
  const [state, setState] = useState<State>('input');
  const [rawDigits, setRawDigits] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [flowId, setFlowId] = useState<string | null>(null);

  const otpRefs = useRef<Array<TextInput | null>>([null, null, null, null, null, null]);

  // CDP hooks for phone linking
  const { linkSms } = useLinkSms();
  const { verifySmsOTP } = useVerifySmsOTP();

  // Spring animation shared values
  const translateY = useSharedValue(600);
  const overlayOpacity = useSharedValue(0);

  const phoneNumber = `+1${rawDigits}`;
  const formattedPhone = rawDigits.length > 0 ? formatPhoneDisplay(rawDigits) : '';

  // Reset state when sheet opens
  useEffect(() => {
    if (visible) {
      setState('input');
      setRawDigits('');
      setError('');
      setLoading(false);
      setOtpDigits(['', '', '', '', '', '']);
      setResendCountdown(0);
      setFlowId(null);
    }
  }, [visible]);

  // Animate sheet open/close
  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 26, stiffness: 300, mass: 0.8 });
    } else {
      overlayOpacity.value = withTiming(0, { duration: 150 });
      translateY.value = withSpring(600, { damping: 30, stiffness: 400 });
    }
  }, [visible]);

  const overlayAnimStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const sheetAnimStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const dragGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 800) {
        translateY.value = withSpring(600, { damping: 30, stiffness: 400 });
        overlayOpacity.value = withTiming(0, { duration: 150 }, () => runOnJS(onDismiss)());
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      } else {
        translateY.value = withSpring(0, { damping: 26, stiffness: 300 });
      }
    });

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Auto-submit when all 6 OTP digits are filled
  useEffect(() => {
    if (state === 'otp' && otpDigits.every((d) => d !== '') && flowId) {
      verifyOtp();
    }
  }, [otpDigits, state, flowId]);

  // Success auto-dismiss
  useEffect(() => {
    if (state === 'success') {
      const timer = setTimeout(() => {
        onVerified(phoneNumber);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    setRawDigits(digits);
    setError('');
  };

  // Send OTP via CDP account linking
  const sendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('[StablePay] Linking phone via CDP:', phoneNumber);
      const result = await linkSms(phoneNumber);
      console.log('[StablePay] CDP SMS sent, flowId:', result?.flowId);
      setFlowId(result?.flowId || null);
      setState('otp');
      setResendCountdown(30);
    } catch (err: any) {
      console.error('[StablePay] CDP linkSms error:', err);
      // Handle already linked — still need to verify
      if (err.code === 'METHOD_ALREADY_LINKED') {
        setError('Phone already linked. Please verify from your profile.');
      } else {
        setError(err.message || 'Failed to send code');
      }
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP via CDP
  const verifyOtp = async () => {
    const code = otpDigits.join('');
    if (code.length !== 6 || !flowId) return;
    setLoading(true);
    setError('');
    try {
      console.log('[StablePay] Verifying OTP via CDP');
      await verifySmsOTP({ flowId, otp: code });
      console.log('[StablePay] Phone verified via CDP');

      // Store in both our cache and the shared state (for Apple Pay flow)
      await storeVerifiedPhone(phoneNumber);
      await setSharedVerifiedPhone(phoneNumber);

      setState('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      console.error('[StablePay] CDP verify error:', err);
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
      setError(err.message || 'Incorrect code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    await sendOtp();
  };

  const handleOtpChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);
    setError('');

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && otpDigits[index] === '' && index > 0) {
      const updated = [...otpDigits];
      updated[index - 1] = '';
      setOtpDigits(updated);
      otpRefs.current[index - 1]?.focus();
    }
  };

  const renderInput = () => (
    <View>
      <Text style={styles.title}>Verify your phone</Text>
      <Text style={styles.subtitle}>
        Required for Apple Pay. We&apos;ll send a one-time code.
      </Text>
      <TextInput
        style={styles.phoneInput}
        value={formattedPhone}
        onChangeText={handlePhoneChange}
        keyboardType="phone-pad"
        placeholder="(555) 123-4567"
        placeholderTextColor={Paper.colors.sandLight}
        maxLength={14}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Pressable
        style={[styles.button, rawDigits.length < 10 && styles.buttonDisabled]}
        onPress={sendOtp}
        disabled={rawDigits.length < 10 || loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Send Code</Text>
        )}
      </Pressable>
    </View>
  );

  const renderOtp = () => (
    <View>
      <Text style={styles.title}>Enter the code</Text>
      <Text style={styles.subtitle}>Sent to {formattedPhone}</Text>
      <View style={styles.otpRow}>
        {otpDigits.map((digit, i) => (
          <TextInput
            key={i}
            ref={(ref) => {
              otpRefs.current[i] = ref;
            }}
            style={[
              styles.otpBox,
              digit !== '' && styles.otpBoxFocused,
            ]}
            value={digit}
            onChangeText={(text) => handleOtpChange(text, i)}
            onKeyPress={(e) => handleOtpKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
          />
        ))}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading && <ActivityIndicator style={{ marginTop: 16 }} color={Paper.colors.orange} />}
      <Pressable onPress={handleResend} disabled={resendCountdown > 0} style={styles.resendButton}>
        <Text
          style={[
            styles.resendText,
            resendCountdown > 0 && styles.resendTextDisabled,
          ]}
        >
          {resendCountdown > 0 ? `Resend code (${resendCountdown}s)` : 'Resend code'}
        </Text>
      </Pressable>
    </View>
  );

  const renderSuccess = () => (
    <View style={styles.successContainer}>
      <View style={styles.checkmarkCircle}>
        <Ionicons name="checkmark-circle" size={40} color={Paper.colors.success} />
      </View>
      <Text style={styles.successText}>Phone verified</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="none" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.overlayPressable, overlayAnimStyle]}>
          <Pressable style={{ flex: 1 }} onPress={onDismiss} />
        </Animated.View>
        <Animated.View style={[styles.sheet, sheetAnimStyle]}>
          <GestureDetector gesture={dragGesture}>
            <View style={styles.dragHandle} />
          </GestureDetector>
          {state === 'input' && renderInput()}
          {state === 'otp' && renderOtp()}
          {state === 'success' && renderSuccess()}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayPressable: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.5)',
  },
  sheet: {
    backgroundColor: Paper.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 20,
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: Paper.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Paper.colors.navy,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Paper.colors.sand,
    marginBottom: 24,
  },
  phoneInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Paper.colors.border,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 16,
    color: Paper.colors.navy,
  },
  button: {
    backgroundColor: Paper.colors.orange,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: Paper.colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  otpBox: {
    width: 44,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Paper.colors.border,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: Paper.colors.navy,
  },
  otpBoxFocused: {
    borderColor: Paper.colors.orange,
    backgroundColor: Paper.colors.orangeLight,
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendText: {
    fontSize: 14,
    color: Paper.colors.sand,
  },
  resendTextDisabled: {
    opacity: 0.5,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  checkmarkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Paper.colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    fontSize: 18,
    fontWeight: '600',
    color: Paper.colors.navy,
    marginTop: 16,
  },
});

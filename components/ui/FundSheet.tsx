import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Paper } from '../../constants/PaperTheme';
import AnimatedPressable from './AnimatedPressable';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onFund: (amount: string) => void;
  title?: string;
};

const PRESETS = ['10', '25', '50', '100'];

export default function FundSheet({ visible, onDismiss, onFund, title = 'Add USDC' }: Props) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>('25');
  const [customAmount, setCustomAmount] = useState('');
  const [inputMode, setInputMode] = useState<'preset' | 'custom'>('preset');

  const activeAmount = inputMode === 'preset' ? (selectedPreset ?? '') : customAmount;
  const isValid = parseFloat(activeAmount) >= 1;

  // Reset on open
  useEffect(() => {
    if (visible) {
      setSelectedPreset('25');
      setCustomAmount('');
      setInputMode('preset');
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlayPress} onPress={onDismiss} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.heading}>{title}</Text>
          <Text style={styles.subheading}>Instantly to your Base wallet</Text>

          {/* Preset pills */}
          <Text style={styles.label}>QUICK AMOUNTS</Text>
          <View style={styles.pillRow}>
            {PRESETS.map((amt) => {
              const selected = inputMode === 'preset' && selectedPreset === amt;
              return (
                <Pressable
                  key={amt}
                  style={[styles.pill, selected && styles.pillSelected]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedPreset(amt);
                    setInputMode('preset');
                    setCustomAmount('');
                  }}
                >
                  <Text style={[styles.pillText, selected && styles.pillTextSelected]}>${amt}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* OR divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Custom amount */}
          <Text style={styles.label}>CUSTOM AMOUNT</Text>
          <View style={[styles.customRow, inputMode === 'custom' && styles.customRowFocused]}>
            <Text style={[styles.dollarSign, inputMode === 'custom' && { color: Paper.colors.navy }]}>$</Text>
            <TextInput
              value={customAmount}
              onChangeText={(val) => {
                setCustomAmount(val);
                setInputMode('custom');
                setSelectedPreset(null);
              }}
              onFocus={() => setInputMode('custom')}
              placeholder="0.00"
              placeholderTextColor={Paper.colors.sandLight}
              keyboardType="decimal-pad"
              style={styles.customInput}
            />
            <Text style={styles.usdcSuffix}>USDC</Text>
          </View>

          {/* Summary */}
          {isValid && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>You&apos;ll receive</Text>
              <View>
                <Text style={styles.summaryValue}>${activeAmount} USDC</Text>
                <Text style={styles.summaryNote}>on Base · no fees</Text>
              </View>
            </View>
          )}

          {/* CTA */}
          <AnimatedPressable
            style={[styles.cta, !isValid && styles.ctaDisabled]}
            onPress={() => {
              if (!isValid) return;
              onFund(activeAmount);
              onDismiss();
            }}
            disabled={!isValid}
            haptic="medium"
          >
            <Text style={[styles.ctaText, !isValid && { color: Paper.colors.sand }]}>
              {isValid ? `Add $${activeAmount} via Apple Pay` : 'Select an amount'}
            </Text>
            {isValid && <Text style={styles.ctaSub}>Face ID · Instant · Gasless</Text>}
          </AnimatedPressable>

          {/* Cancel */}
          <Pressable style={styles.cancelButton} onPress={onDismiss}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(26, 26, 46, 0.6)', justifyContent: 'flex-end' },
  overlayPress: { flex: 1 },
  sheet: { backgroundColor: Paper.colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: 44, paddingTop: 8 },
  handle: { width: 36, height: 4, backgroundColor: Paper.colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: Paper.colors.navy, letterSpacing: -0.5, marginBottom: 4 },
  subheading: { fontSize: 14, color: Paper.colors.sand, marginBottom: 28 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: Paper.colors.sand, textTransform: 'uppercase', marginBottom: 10 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  pill: { flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Paper.colors.surfaceWarm },
  pillSelected: { backgroundColor: Paper.colors.orangeLight, borderWidth: 1.5, borderColor: Paper.colors.orange },
  pillText: { fontSize: 16, fontWeight: '600', color: Paper.colors.navy },
  pillTextSelected: { color: Paper.colors.orange, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Paper.colors.border },
  dividerText: { fontSize: 12, color: Paper.colors.sand },
  customRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Paper.colors.surfaceWarm, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: Paper.colors.border, marginBottom: 28 },
  customRowFocused: { borderWidth: 1.5, borderColor: Paper.colors.orange },
  dollarSign: { fontSize: 24, fontWeight: '700', color: Paper.colors.sandLight, marginRight: 6 },
  customInput: { flex: 1, fontSize: 28, fontWeight: '700', color: Paper.colors.navy, letterSpacing: -1, borderWidth: 0, backgroundColor: 'transparent', padding: 0 },
  usdcSuffix: { fontSize: 13, fontWeight: '600', color: Paper.colors.sand },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: Paper.colors.borderLight, marginBottom: 16 },
  summaryLabel: { fontSize: 14, color: Paper.colors.sand },
  summaryValue: { fontSize: 14, fontWeight: '600', color: Paper.colors.navy, textAlign: 'right' },
  summaryNote: { fontSize: 11, color: Paper.colors.success, textAlign: 'right', marginTop: 2 },
  cta: { backgroundColor: Paper.colors.orange, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { backgroundColor: Paper.colors.border },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  ctaSub: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 3 },
  cancelButton: { marginTop: 14, alignItems: 'center' },
  cancelText: { fontSize: 14, color: Paper.colors.sand },
});

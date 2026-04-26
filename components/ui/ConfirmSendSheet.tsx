import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Paper } from '../../constants/PaperTheme';
import { Contact, truncateAddress } from '../../utils/contacts';

type Props = {
  visible: boolean;
  contact: Contact | null;
  amountUsd: string;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
};

export default function ConfirmSendSheet({ visible, contact, amountUsd, onConfirm, onDismiss }: Props) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSending(true);
    setError(null);
    try {
      await onConfirm();
      onDismiss();
    } catch (e: any) {
      setError(e.message || 'Transfer failed');
      setSending(false);
    }
  };

  if (!contact) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <Pressable style={styles.overlayPress} onPress={sending ? undefined : onDismiss} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.heading}>Confirm transfer</Text>

          <View style={styles.recipientRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{contact.emoji}</Text>
            </View>
            <View style={styles.recipientInfo}>
              <Text style={styles.recipientName}>{contact.name}</Text>
              <Text style={styles.recipientAddress}>{truncateAddress(contact.address)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount</Text>
            <Text style={styles.detailValue}>${amountUsd} USDC</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Network</Text>
            <Text style={styles.detailValue}>Base Mainnet</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Network fee</Text>
            <Text style={[styles.detailValue, { color: Paper.colors.success }]}>Free · Gasless</Text>
          </View>

          <View style={styles.divider} />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={[styles.confirmButton, sending && styles.disabled]}
            onPress={handleConfirm}
            disabled={sending}
          >
            {sending ? <ActivityIndicator color={Paper.colors.white} /> : <Text style={styles.confirmText}>Send USDC</Text>}
          </Pressable>

          <Pressable style={[styles.cancelButton, sending && { opacity: 0.4 }]} onPress={onDismiss} disabled={sending}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(26, 26, 46, 0.6)', justifyContent: 'flex-end' },
  overlayPress: { flex: 1 },
  sheet: { backgroundColor: Paper.colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8 },
  handle: { width: 36, height: 4, backgroundColor: Paper.colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  heading: { fontSize: 22, fontWeight: '700', color: Paper.colors.navy, letterSpacing: -0.5, marginBottom: 24 },
  recipientRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Paper.colors.background, borderRadius: 14, padding: 14, marginBottom: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Paper.colors.surface, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: Paper.colors.navy },
  recipientInfo: { marginLeft: 12 },
  recipientName: { fontSize: 16, fontWeight: '600', color: Paper.colors.navy },
  recipientAddress: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 12, color: Paper.colors.sand, marginTop: 2 },
  divider: { height: 1, backgroundColor: Paper.colors.border, marginVertical: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  detailLabel: { fontSize: 14, color: Paper.colors.sand },
  detailValue: { fontSize: 14, fontWeight: '600', color: Paper.colors.navy },
  errorText: { fontSize: 13, color: Paper.colors.error, textAlign: 'center', marginBottom: 12 },
  confirmButton: { backgroundColor: Paper.colors.orange, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  disabled: { opacity: 0.4 },
  confirmText: { color: Paper.colors.white, fontSize: 15, fontWeight: '700' },
  cancelButton: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  cancelText: { fontSize: 14, fontWeight: '600', color: Paper.colors.sand },
});

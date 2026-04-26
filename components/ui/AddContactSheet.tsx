import React, { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Paper } from '../../constants/PaperTheme';
import { saveContact, validateAddress, Contact } from '../../utils/contacts';

type Props = {
  visible: boolean;
  onSaved: (contact: Contact) => void;
  onDismiss: () => void;
};

export default function AddContactSheet({ visible, onSaved, onDismiss }: Props) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const contact = await saveContact({
        name: name.trim(),
        address: address.trim(),
        emoji: name.trim()[0]?.toUpperCase() || '?',
      });
      setName('');
      setAddress('');
      onSaved(contact);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const isValid = name.trim().length > 0 && validateAddress(address.trim());

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlayPress} onPress={onDismiss} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.heading}>Add contact</Text>

          <Text style={styles.label}>NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Bob, Alice, Vendor..."
            placeholderTextColor={Paper.colors.sandLight}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>WALLET ADDRESS</Text>
          <TextInput
            style={[styles.input, { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 14 }]}
            value={address}
            onChangeText={setAddress}
            placeholder="0x..."
            placeholderTextColor={Paper.colors.sandLight}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {address.length > 0 && !validateAddress(address) && (
            <Text style={styles.validationError}>Invalid address format</Text>
          )}
          {validateAddress(address) && (
            <Text style={styles.validationSuccess}>Valid address ✓</Text>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={[styles.saveButton, (!isValid || saving) && styles.disabled]}
            onPress={handleSave}
            disabled={!isValid || saving}
          >
            {saving ? <ActivityIndicator color={Paper.colors.white} /> : <Text style={styles.saveText}>Save contact</Text>}
          </Pressable>

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
  sheet: { backgroundColor: Paper.colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8 },
  handle: { width: 36, height: 4, backgroundColor: Paper.colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  heading: { fontSize: 22, fontWeight: '700', color: Paper.colors.navy, letterSpacing: -0.5, marginBottom: 24 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: Paper.colors.sand, textTransform: 'uppercase', marginBottom: 8 },
  input: { backgroundColor: Paper.colors.surfaceWarm, borderWidth: 1, borderColor: Paper.colors.border, borderRadius: 14, padding: 14, fontSize: 16, color: Paper.colors.navy },
  validationError: { fontSize: 12, color: Paper.colors.error, marginTop: 4 },
  validationSuccess: { fontSize: 12, color: Paper.colors.success, marginTop: 4 },
  errorText: { fontSize: 13, color: Paper.colors.error, textAlign: 'center', marginTop: 16, marginBottom: 8 },
  saveButton: { backgroundColor: Paper.colors.orange, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  disabled: { opacity: 0.4 },
  saveText: { color: Paper.colors.white, fontSize: 15, fontWeight: '700' },
  cancelButton: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  cancelText: { fontSize: 14, fontWeight: '600', color: Paper.colors.sand },
});

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { FadeInDown, FadeIn, Layout } from 'react-native-reanimated';
import AnimatedPressable from './AnimatedPressable';
import { Paper } from '../../constants/PaperTheme';
import { Contact, truncateAddress } from '../../utils/contacts';

type Props = {
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (contact: Contact) => void;
  onAddNew: () => void;
};

export default function ContactPicker({ contacts, selectedId, onSelect, onAddNew }: Props) {
  if (contacts.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No contacts yet</Text>
          <Text style={styles.emptySubtitle}>Add someone to send USDC</Text>
          <Pressable style={styles.addFirstButton} onPress={onAddNew}>
            <Text style={styles.addFirstText}>Add first contact</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {contacts.map((contact, i) => {
        const selected = contact.id === selectedId;
        return (
          <Animated.View
            key={contact.id}
            entering={FadeInDown.delay(i * 60).springify().damping(20).stiffness(250)}
            layout={Layout.springify()}
          >
            <AnimatedPressable onPress={() => onSelect(contact)} haptic="light">
              <View
                style={[
                  styles.row,
                  selected && { backgroundColor: Paper.colors.orangeLight },
                ]}
              >
                <View style={[styles.avatar, selected && styles.avatarSelected]}>
                  <Text style={[styles.avatarText, selected && styles.avatarTextSelected]}>
                    {contact.emoji}
                  </Text>
                </View>
                <View style={styles.info}>
                  <Text style={[styles.name, selected && { color: Paper.colors.orange }]}>{contact.name}</Text>
                  <Text style={styles.address}>{truncateAddress(contact.address)}</Text>
                </View>
                {selected && <Text style={styles.check}>✓</Text>}
              </View>
            </AnimatedPressable>
            {i < contacts.length - 1 && <View style={styles.separator} />}
          </Animated.View>
        );
      })}

      <View style={styles.separator} />
      <AnimatedPressable onPress={onAddNew} haptic="light">
        <View style={styles.row}>
          <View style={styles.addCircle}>
            <Text style={styles.addPlus}>+</Text>
          </View>
          <Text style={styles.addText}>Add new contact</Text>
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: Paper.colors.surface, borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Paper.colors.background, alignItems: 'center', justifyContent: 'center' },
  avatarSelected: { backgroundColor: Paper.colors.orange },
  avatarText: { fontSize: 16, fontWeight: '700', color: Paper.colors.navy },
  avatarTextSelected: { color: '#FFFFFF' },
  info: { marginLeft: 12, flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: Paper.colors.navy },
  address: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 11, color: Paper.colors.sand, marginTop: 2 },
  check: { fontSize: 16, fontWeight: '700', color: Paper.colors.orange },
  separator: { height: 1, backgroundColor: Paper.colors.borderLight, marginLeft: 70 },
  addCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: Paper.colors.background, borderWidth: 1.5, borderColor: Paper.colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addPlus: { fontSize: 20, color: Paper.colors.sand },
  addText: { fontSize: 15, fontWeight: '600', color: Paper.colors.sand, marginLeft: 12 },
  emptyState: { paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 15, color: Paper.colors.sand, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: Paper.colors.sandLight, marginBottom: 16 },
  addFirstButton: { backgroundColor: Paper.colors.orangeLight, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 20 },
  addFirstText: { fontSize: 13, fontWeight: '700', color: Paper.colors.orange },
});

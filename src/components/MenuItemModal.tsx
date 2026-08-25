import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { MenuItemVariant } from '../types';
import { colors, radius, spacing } from '../theme';

type Props = {
  visible: boolean;
  itemName: string;
  basePrice: number;
  variants?: MenuItemVariant[];
  onCancel: () => void;
  onConfirm: (note: string, variant?: MenuItemVariant) => void;
};

const NOTE_CHIPS = ['No onion', 'Extra spicy', 'Less oil', 'No garlic'];

export default function MenuItemModal({ visible, itemName, basePrice, variants, onCancel, onConfirm }: Props) {
  const [note, setNote] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<MenuItemVariant | undefined>(variants?.[0]);

  // Re-seed the default selection whenever a different item's modal opens.
  useEffect(() => {
    if (visible) setSelectedVariant(variants?.[0]);
  }, [visible, variants]);

  const parts = note.split(',').map(s => s.trim()).filter(Boolean);
  const hasVariants = Boolean(variants && variants.length > 0);
  const price = selectedVariant?.price ?? basePrice;

  function toggleChip(chip: string) {
    const next = parts.includes(chip) ? parts.filter(p => p !== chip) : [...parts, chip];
    setNote(next.join(', '));
  }

  function handleCancel() {
    setNote('');
    onCancel();
  }

  function handleConfirm() {
    const finalNote = note.trim();
    setNote('');
    onConfirm(finalNote, selectedVariant);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleCancel} />
        <View style={styles.card}>
          <View style={styles.grabber} />
          <Text style={styles.itemName}>{itemName}</Text>
          <Text style={styles.subtitle}>Add a note for the kitchen</Text>

          {hasVariants && (
            <>
              <Text style={styles.sectionLabel}>Choose an option</Text>
              <View style={styles.chipRow}>
                {variants!.map(v => {
                  const active = selectedVariant?.label === v.label;
                  return (
                    <TouchableOpacity
                      key={v.label}
                      activeOpacity={0.75}
                      onPress={() => setSelectedVariant(v)}
                      style={[styles.variantChip, active && styles.variantChipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.variantChipTextActive]}>
                        {v.label} · ₹{v.price}
                      </Text>
                      {v.sufficient_for ? (
                        <Text style={[styles.variantSubText, active && styles.variantChipTextActive]}>
                          Serves {v.sufficient_for}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>Preferences</Text>
          <View style={styles.chipRow}>
            {NOTE_CHIPS.map(chip => {
              const active = parts.includes(chip);
              return (
                <TouchableOpacity
                  key={chip}
                  activeOpacity={0.75}
                  onPress={() => toggleChip(chip)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="e.g. No onion, extra spicy please"
            placeholderTextColor={colors.textMuted}
            style={styles.textArea}
            multiline
            numberOfLines={3}
          />

          <View style={styles.actions}>
            <TouchableOpacity activeOpacity={0.75} onPress={handleCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} onPress={handleConfirm} style={styles.confirmBtn}>
              <Text style={styles.confirmText}>Add to cart · ₹{price}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  card: {
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  itemName: { fontSize: 17, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: '#FFF1E6' },
  variantChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  variantChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  variantSubText: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextActive: { color: colors.accent },
  variantChipTextActive: { color: '#fff' },
  textArea: {
    marginTop: spacing.md,
    height: 90,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  confirmBtn: { flex: 2, height: 48, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

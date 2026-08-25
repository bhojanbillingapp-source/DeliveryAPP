import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput } from 'react-native';
import { COUNTRY_CODES, type CountryCode } from '../data/countryCodes';
import { colors, radius, spacing } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (country: CountryCode) => void;
};

export default function CountryCodePicker({ visible, onClose, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const searchLower = search.trim().toLowerCase();

  const filtered = searchLower
    ? COUNTRY_CODES.filter(
        c => c.name.toLowerCase().includes(searchLower) || c.dial_code.includes(searchLower)
      )
    : COUNTRY_CODES;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Select country code</Text>
          <TextInput
            style={styles.search}
            placeholder="Search country or code"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          <FlatList
            data={filtered}
            keyExtractor={c => c.name}
            style={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.row}
                onPress={() => {
                  onSelect(item);
                  setSearch('');
                  onClose();
                }}
              >
                <Text style={styles.flag}>{item.flag}</Text>
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.rowCode}>{item.dial_code}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No matches.</Text>}
          />
          <TouchableOpacity activeOpacity={0.75} onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 380, maxHeight: '75%', borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.lg },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 10,
    marginBottom: spacing.sm,
    color: colors.text,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  flag: { fontSize: 18 },
  rowName: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
  rowCode: { fontSize: 14, color: colors.textMuted, fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.textMuted, marginVertical: spacing.md },
  cancelBtn: { marginTop: spacing.sm, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
});

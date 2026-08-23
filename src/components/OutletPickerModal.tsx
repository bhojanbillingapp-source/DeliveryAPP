import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useOutlet, type Outlet } from '../context/OutletContext';
import { useCart } from '../context/CartContext';
import { colors, radius, spacing } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function outletLabel(o: Outlet): string {
  return o.restaurant_brand_name || o.legal_business_name || 'Outlet';
}

export default function OutletPickerModal({ visible, onClose }: Props) {
  const { outlets, selectedOutlet, setSelectedOutlet } = useOutlet();
  const { clear } = useCart();

  function handleSelect(outlet: Outlet) {
    const changed = outlet.outlet_id !== selectedOutlet?.outlet_id;
    setSelectedOutlet(outlet);
    // Prices/availability are outlet-specific — carrying a cart across
    // outlets risks charging the wrong prices, so start fresh.
    if (changed) clear();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Choose a location</Text>
          <FlatList
            data={outlets}
            keyExtractor={o => o.outlet_id}
            style={styles.list}
            renderItem={({ item }) => {
              const active = item.outlet_id === selectedOutlet?.outlet_id;
              return (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => handleSelect(item)}
                  style={[styles.row, active && styles.rowActive]}
                >
                  <Text style={[styles.rowText, active && styles.rowTextActive]}>{outletLabel(item)}</Text>
                  {item.is_parent && <Text style={styles.star}>★</Text>}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No locations available.</Text>}
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
  card: { width: '100%', maxWidth: 380, maxHeight: '70%', borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.lg },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  rowActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  rowText: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowTextActive: { color: '#fff' },
  star: { color: colors.accent, fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.textMuted, marginVertical: spacing.md },
  cancelBtn: { marginTop: spacing.sm, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
});

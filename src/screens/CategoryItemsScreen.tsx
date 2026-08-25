import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCart } from '../context/CartContext';
import MenuItemModal from '../components/MenuItemModal';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import type { MenuItem } from '../types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'CategoryItems'>;

export default function CategoryItemsScreen({ navigation, route }: Props) {
  const { title, items } = route.params;
  const insets = useSafeAreaInsets();
  const { lines, addItem, incrementLine, decrementLine, itemCount } = useCart();
  const [search, setSearch] = useState('');
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);

  const searchLower = search.trim().toLowerCase();
  const visible = useMemo(
    () => (searchLower ? items.filter(item => item.item_name.toLowerCase().includes(searchLower)) : items),
    [items, searchLower]
  );

  function totalQuantityFor(itemId: number) {
    return lines.filter(l => l.item_id === itemId).reduce((sum, l) => sum + l.quantity, 0);
  }

  function defaultLineFor(itemId: number) {
    return lines.find(l => l.cart_key === `${itemId}::default`);
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />

      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search for items"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: itemCount > 0 ? 96 + insets.bottom : spacing.md }}
        renderItem={({ item }) => {
          const hasVariants = Boolean(item.variants && item.variants.length > 0);
          const totalQty = totalQuantityFor(item.id);
          const defaultLine = defaultLineFor(item.id);
          const lowestVariantPrice = hasVariants ? Math.min(...item.variants!.map(v => v.price)) : null;

          return (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.item_name}</Text>
                <Text style={styles.itemPrice}>{hasVariants ? `From ₹${lowestVariantPrice}` : `₹${item.price}`}</Text>
              </View>
              {hasVariants ? (
                <TouchableOpacity style={styles.addButton} onPress={() => setModalItem(item)} activeOpacity={0.85}>
                  <Text style={styles.addButtonText}>{totalQty > 0 ? `Add · ${totalQty}` : 'Add'}</Text>
                </TouchableOpacity>
              ) : !defaultLine ? (
                <TouchableOpacity style={styles.addButton} onPress={() => setModalItem(item)} activeOpacity={0.85}>
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => decrementLine(defaultLine.cart_key)}
                    activeOpacity={0.85}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperQty}>{defaultLine.quantity}</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => incrementLine(defaultLine.cart_key)}
                    activeOpacity={0.85}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>{searchLower ? 'No items match your search.' : 'No items in this category.'}</Text>}
      />

      {modalItem && (
        <MenuItemModal
          visible
          itemName={modalItem.item_name}
          basePrice={modalItem.price ?? 0}
          variants={modalItem.variants}
          onCancel={() => setModalItem(null)}
          onConfirm={(note, variant) => {
            addItem(modalItem, note, variant);
            setModalItem(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchWrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.text,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemName: { fontSize: 16, fontWeight: '700', color: colors.text },
  itemPrice: { fontSize: 15, color: colors.text, marginTop: spacing.xs, fontWeight: '600' },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: 18,
    minWidth: 64,
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  stepperBtn: { minWidth: 16, alignItems: 'center' },
  stepperBtnText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  stepperQty: { fontSize: 14, fontWeight: '700', color: colors.text, minWidth: 16, textAlign: 'center' },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
});

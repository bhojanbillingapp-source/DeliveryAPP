import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCart } from '../context/CartContext';
import { useOutlet } from '../context/OutletContext';
import { getItemAddOns } from '../api/addOns';
import MenuItemModal from '../components/MenuItemModal';
import ScreenHeader from '../components/ScreenHeader';
import { resolveImageUri } from '../config';
import type { AppStackParamList } from '../navigation/types';
import type { AddOn, MenuItem } from '../types';
import { colors, radius, spacing } from '../theme';

function itemImageUri(item: MenuItem): string | null {
  const uris = item.image_uris;
  const first = Array.isArray(uris) ? uris[0] : uris;
  return resolveImageUri(first);
}

type Props = NativeStackScreenProps<AppStackParamList, 'CategoryItems'>;

export default function CategoryItemsScreen({ navigation, route }: Props) {
  const { title, items } = route.params;
  const insets = useSafeAreaInsets();
  const { selectedOutlet } = useOutlet();
  const { lines, addItem, incrementLine, decrementLine, itemCount } = useCart();
  const [search, setSearch] = useState('');
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [modalAddOns, setModalAddOns] = useState<AddOn[]>([]);
  const [addOnsLoading, setAddOnsLoading] = useState(false);

  function openModal(item: MenuItem) {
    setModalItem(item);
    setModalAddOns([]);
    const outletId = selectedOutlet?.outlet_id;
    if (!outletId) return;
    setAddOnsLoading(true);
    getItemAddOns(outletId, item.id)
      .then(setModalAddOns)
      .catch(() => setModalAddOns([]))
      .finally(() => setAddOnsLoading(false));
  }

  const searchLower = search.trim().toLowerCase();
  const visible = useMemo(
    () => (searchLower ? items.filter(item => item.item_name.toLowerCase().includes(searchLower)) : items),
    [items, searchLower]
  );

  function totalQuantityFor(itemId: number) {
    return lines.filter(l => l.item_id === itemId).reduce((sum, l) => sum + l.quantity, 0);
  }

  function defaultLineFor(itemId: number) {
    return lines.find(l => l.item_id === itemId && !l.variant_label && !l.add_ons?.length);
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
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: itemCount > 0 ? 96 + insets.bottom : spacing.md }}
        renderItem={({ item }) => {
          const hasVariants = Boolean(item.variants && item.variants.length > 0);
          const isAvailable = (hasVariants || item.price != null) && item.is_available_now !== false;
          const totalQty = totalQuantityFor(item.id);
          const defaultLine = defaultLineFor(item.id);
          const lowestVariantPrice = hasVariants ? Math.min(...item.variants!.map(v => v.price)) : null;
          const imageUri = itemImageUri(item);

          return (
            <View style={[styles.row, !isAvailable && styles.rowUnavailable]}>
              <View style={styles.cardInfo}>
                <Text style={styles.itemName}>{item.item_name}</Text>
                {isAvailable ? (
                  <Text style={styles.itemPrice}>{hasVariants ? `From ₹${lowestVariantPrice}` : `₹${item.price}`}</Text>
                ) : (
                  <Text style={styles.unavailableText}>Currently unavailable</Text>
                )}

                {!isAvailable ? (
                  <View style={[styles.addButton, styles.addButtonDisabled]}>
                    <Text style={styles.addButtonTextDisabled}>Unavailable</Text>
                  </View>
                ) : hasVariants ? (
                  <TouchableOpacity style={styles.addButton} onPress={() => openModal(item)} activeOpacity={0.85}>
                    <Text style={styles.addButtonText}>{totalQty > 0 ? `Add · ${totalQty}` : 'Add'}</Text>
                  </TouchableOpacity>
                ) : !defaultLine ? (
                  <TouchableOpacity style={styles.addButton} onPress={() => openModal(item)} activeOpacity={0.85}>
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

              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.itemImage} resizeMode="cover" />
              ) : (
                <View style={[styles.itemImage, styles.itemImagePlaceholder]} />
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
          addOns={modalAddOns}
          addOnsLoading={addOnsLoading}
          onCancel={() => setModalItem(null)}
          onConfirm={(note, variant, addOns) => {
            addItem(modalItem, note, variant, addOns);
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardInfo: { flex: 1, paddingRight: spacing.md },
  rowUnavailable: { opacity: 0.6 },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemPrice: { fontSize: 14, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  unavailableText: { fontSize: 12, color: colors.danger, marginTop: 2, fontWeight: '600' },
  itemImage: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  itemImagePlaceholder: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  addButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 64,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  addButtonDisabled: { backgroundColor: colors.border },
  addButtonTextDisabled: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  stepper: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: spacing.sm,
  },
  stepperBtn: { minWidth: 16, alignItems: 'center' },
  stepperBtnText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  stepperQty: { fontSize: 14, fontWeight: '700', color: colors.text, minWidth: 16, textAlign: 'center' },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import api from '../api/client';
import { OUTLET_ID } from '../config';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import type { AppStackParamList } from '../navigation/types';
import type { MenuItem } from '../types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Menu'>;

const UNCATEGORIZED = 'Other';

export default function MenuScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const { lines, addItem, incrementItem, decrementItem, itemCount, total } = useCart();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadMenu = useCallback(async () => {
    try {
      setError(null);
      const { data } = await api.get('/ordermenu', {
        params: { outlet_id: OUTLET_ID, order_type: 'delivery' },
      });
      setItems(data.filter((item: MenuItem) => item.is_active && item.price != null));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load the menu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  function quantityFor(itemId: number) {
    return lines.find(l => l.item_id === itemId)?.quantity ?? 0;
  }

  const searchLower = search.trim().toLowerCase();

  const sections = useMemo(() => {
    const visible = searchLower
      ? items.filter(item => item.item_name.toLowerCase().includes(searchLower))
      : items;

    const byCategory = new Map<string, MenuItem[]>();
    for (const item of visible) {
      const category = item.category_name?.trim() || UNCATEGORIZED;
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category)!.push(item);
    }

    return Array.from(byCategory.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }));
  }, [items, searchLower]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          PoSS<Text style={styles.logoDot}>.</Text>
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('Orders')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.ordersBtn}>
            <Text style={styles.ordersBtnText}>My Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.headerLinkMuted}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>

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

      {error && <Text style={styles.error}>{error}</Text>}

      <SectionList
        sections={sections}
        keyExtractor={item => String(item.id)}
        stickySectionHeadersEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMenu(); }} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: itemCount > 0 ? 96 + insets.bottom : spacing.md }}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const qty = quantityFor(item.id);
          return (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.item_name}</Text>
                <Text style={styles.itemPrice}>₹{item.price}</Text>
              </View>
              {qty === 0 ? (
                <TouchableOpacity style={styles.addButton} onPress={() => addItem(item)} activeOpacity={0.85}>
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => decrementItem(item.id)}
                    activeOpacity={0.85}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperQty}>{qty}</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => incrementItem(item.id)}
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
        ListEmptyComponent={
          !error ? (
            <Text style={styles.empty}>
              {searchLower ? 'No items match your search.' : 'No delivery menu items available right now.'}
            </Text>
          ) : undefined
        }
      />

      {itemCount > 0 && (
        <TouchableOpacity
          style={[styles.cartBar, { bottom: spacing.md + insets.bottom }]}
          onPress={() => navigation.navigate('Cart')}
          activeOpacity={0.9}
        >
          <Text style={styles.cartBarText}>{itemCount} item{itemCount > 1 ? 's' : ''} · ₹{total.toFixed(2)}</Text>
          <Text style={styles.cartBarLink}>View Cart →</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: { fontSize: 20, fontWeight: '800', color: colors.primary },
  logoDot: { color: colors.accent },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ordersBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  ordersBtnText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  headerLinkMuted: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  searchWrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
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
  error: { color: colors.danger, padding: spacing.md },
  sectionHeader: {
    backgroundColor: colors.background,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  sectionHeaderText: { fontSize: 15, fontWeight: '800', color: colors.primary },
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
  cartBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartBarText: { color: '#fff', fontWeight: '700' },
  cartBarLink: { color: colors.accent, fontWeight: '700' },
});

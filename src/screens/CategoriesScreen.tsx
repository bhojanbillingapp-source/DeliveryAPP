import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import api from '../api/client';
import { useCart } from '../context/CartContext';
import { useOutlet } from '../context/OutletContext';
import { useOrderType } from '../context/OrderTypeContext';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList, MainTabParamList } from '../navigation/types';
import { CART_BAR_CLEARANCE } from '../navigation/tabBarConfig';
import type { MenuItem } from '../types';
import { colors, radius, spacing } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Categories'>,
  NativeStackScreenProps<AppStackParamList>
>;

const UNCATEGORIZED = 'Other';

export default function CategoriesScreen({ navigation }: Props) {
  const { itemCount } = useCart();
  const { selectedOutlet } = useOutlet();
  const { orderType } = useOrderType();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outletId = selectedOutlet?.outlet_id ?? null;

  const loadMenu = useCallback(async () => {
    if (!outletId) return;
    try {
      setError(null);
      const { data } = await api.get('/ordermenu', {
        params: { outlet_id: outletId, order_type: orderType },
      });
      // Keep items with no delivery price/active variant in the list rather
      // than hiding them — CategoryItemsScreen shows them as "Unavailable"
      // so the customer sees they exist but can't add them, instead of the
      // item silently vanishing.
      setItems(data.filter((item: MenuItem) => item.is_active));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load the menu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [outletId, orderType]);

  useEffect(() => {
    if (outletId) loadMenu();
  }, [outletId, loadMenu]);

  const categories = useMemo(() => {
    const byCategory = new Map<string, MenuItem[]>();
    for (const item of items) {
      const category = item.category_name?.trim() || UNCATEGORIZED;
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category)!.push(item);
    }
    return Array.from(byCategory.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }));
  }, [items]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Order Now" />

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={categories}
        keyExtractor={c => c.title}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMenu(); }} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: itemCount > 0 ? CART_BAR_CLEARANCE : spacing.md }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('CategoryItems', { title: item.title, items: item.data })}
          >
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={!error ? <Text style={styles.empty}>No menu items available right now.</Text> : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { color: colors.danger, padding: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  arrow: { fontSize: 20, color: colors.textMuted },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
});

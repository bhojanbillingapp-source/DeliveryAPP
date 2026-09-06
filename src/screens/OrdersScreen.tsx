import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList, MainTabParamList } from '../navigation/types';
import { CART_BAR_CLEARANCE } from '../navigation/tabBarConfig';
import type { OrderSummary } from '../types';
import { colors, radius, spacing, statusColors } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'MyOrders'>,
  NativeStackScreenProps<AppStackParamList>
>;

export default function OrdersScreen({ navigation }: Props) {
  const { customer } = useAuth();
  const { itemCount } = useCart();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/customer-order/orders');
      setOrders(data.orders);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (customer) load();
    else setLoading(false);
  }, [customer, load]);

  if (!customer) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="My Orders" />
        <View style={styles.center}>
          <Text style={styles.signInPrompt}>Sign in to view your orders.</Text>
          <TouchableOpacity style={styles.signInButton} onPress={() => navigation.navigate('Login')} activeOpacity={0.85}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="My Orders" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => String(o.order_id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: itemCount > 0 ? CART_BAR_CLEARANCE : spacing.md }}
          renderItem={({ item }) => {
            const status = statusColors[item.status] || { bg: '#EEE', fg: colors.textMuted };
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('OrderDetail', { orderId: item.order_id })}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNo}>Order #{item.daily_order_no}</Text>
                  <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={[styles.badge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.badgeText, { color: status.fg }]}>{item.status}</Text>
                  </View>
                  <Text style={styles.amount}>₹{item.total_amount}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No orders yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  signInPrompt: { color: colors.textMuted, fontSize: 15, marginBottom: spacing.md, textAlign: 'center' },
  signInButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 14, paddingHorizontal: 28 },
  signInButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  orderNo: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontWeight: '700', fontSize: 11, textTransform: 'capitalize' },
  amount: { marginTop: spacing.xs, fontWeight: '700', color: colors.text },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
});

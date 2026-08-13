import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import api from '../api/client';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import type { OrderItem, OrderSummary } from '../types';
import { colors, radius, spacing, statusColors } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'OrderDetail'>;

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Order received — waiting on the kitchen',
  CLOSED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export default function OrderDetailScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/customer-orders/orders/${orderId}`);
      setOrder(data.order);
      setItems(data.items);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Order Status" onBack={() => navigation.goBack()} />

      {loading || !order ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.order_item_id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding: spacing.md }}
          ListHeaderComponent={
            <View style={styles.summary}>
              <View style={styles.summaryHeaderRow}>
                <Text style={styles.orderNo}>Order #{order.daily_order_no}</Text>
                <View style={[styles.badge, { backgroundColor: (statusColors[order.status] || { bg: '#EEE' }).bg }]}>
                  <Text style={[styles.badgeText, { color: (statusColors[order.status] || { fg: colors.textMuted }).fg }]}>
                    {order.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.statusText}>{STATUS_LABELS[order.status] || order.status}</Text>
              <Text style={styles.meta}>Payment: {order.payment_method} · {order.payment_status}</Text>
              <Text style={styles.meta}>Placed {new Date(order.created_at).toLocaleString()}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.itemName}>{item.item_name} × {item.quantity}</Text>
              <Text style={styles.itemStatus}>{item.status}</Text>
            </View>
          )}
          ListFooterComponent={
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.total}>₹{order.total_amount}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summary: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  summaryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNo: { fontSize: 20, fontWeight: '700', color: colors.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontWeight: '700', fontSize: 11, textTransform: 'capitalize' },
  statusText: { fontSize: 15, color: colors.primary, fontWeight: '600', marginTop: spacing.sm },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  itemName: { fontSize: 15, color: colors.text },
  itemStatus: { fontSize: 13, color: colors.textMuted },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, paddingHorizontal: spacing.xs },
  totalLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  total: { fontSize: 18, fontWeight: '800', color: colors.text },
});

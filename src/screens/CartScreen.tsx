import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import api from '../api/client';
import { useCart } from '../context/CartContext';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Cart'>;

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

export default function CartScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { lines, incrementItem, decrementItem, removeItem, total, clear } = useCart();
  const [landmark, setLandmark] = useState('');
  const [placing, setPlacing] = useState(false);

  async function placeOrder() {
    if (!lines.length) return;
    setPlacing(true);
    try {
      const { data } = await api.post('/customer-orders/orders', {
        items: lines.map(l => ({ item_id: l.item_id, quantity: l.quantity })),
        payment_method: 'COD',
        delivery_landmark: landmark.trim() || undefined,
      });
      clear();
      Alert.alert('Order placed!', `Order #${data.daily_order_no} — pay ₹${data.total_amount} on delivery.`, [
        { text: 'View order', onPress: () => navigation.replace('OrderDetail', { orderId: data.order_id }) },
      ]);
    } catch (err: any) {
      Alert.alert('Could not place order', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setPlacing(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Your Cart" onBack={() => navigation.goBack()} />

      <FlatList
        data={lines}
        keyExtractor={l => String(l.item_id)}
        contentContainerStyle={{ padding: spacing.md }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.item_name}</Text>
              <Text style={styles.itemPrice}>₹{item.price} × {item.quantity} = ₹{(item.price * item.quantity).toFixed(2)}</Text>
              <TouchableOpacity onPress={() => removeItem(item.item_id)} hitSlop={HIT_SLOP} style={styles.removeTouch}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.qtyControls}>
              <TouchableOpacity style={styles.qtyButton} onPress={() => decrementItem(item.item_id)} hitSlop={HIT_SLOP}>
                <Text style={styles.qtyButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{item.quantity}</Text>
              <TouchableOpacity style={styles.qtyButton} onPress={() => incrementItem(item.item_id)} hitSlop={HIT_SLOP}>
                <Text style={styles.qtyButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Your cart is empty.</Text>}
      />

      {lines.length > 0 && (
        <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
          <TextInput
            style={styles.input}
            placeholder="Delivery landmark (optional)"
            placeholderTextColor={colors.textMuted}
            value={landmark}
            onChangeText={setLandmark}
          />
          <View style={styles.totalRow}>
            <Text style={styles.total}>Total</Text>
            <Text style={styles.totalAmount}>₹{total.toFixed(2)}</Text>
          </View>
          <Text style={styles.codNote}>Pay by Cash on Delivery</Text>
          <TouchableOpacity
            style={[styles.checkoutButton, placing && styles.checkoutButtonDisabled]}
            onPress={placeOrder}
            disabled={placing}
            activeOpacity={0.85}
          >
            {placing ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutButtonText}>Place Order (COD) →</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  itemPrice: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  removeTouch: { alignSelf: 'flex-start', marginTop: spacing.xs },
  remove: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  qtyButton: { paddingHorizontal: 4 },
  qtyButtonText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  qtyValue: { minWidth: 20, textAlign: 'center', fontWeight: '700', color: colors.text },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: spacing.md,
    color: colors.text,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  total: { fontSize: 16, fontWeight: '600', color: colors.text },
  totalAmount: { fontSize: 18, fontWeight: '800', color: colors.text },
  codNote: { color: colors.textMuted, marginBottom: spacing.md, fontSize: 13 },
  checkoutButton: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 16, alignItems: 'center' },
  checkoutButtonDisabled: { opacity: 0.6 },
  checkoutButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

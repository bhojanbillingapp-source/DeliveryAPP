import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import api from '../api/client';
import { listAddresses } from '../api/addresses';
import { previewCoupons, type Coupon } from '../api/coupons';
import { validateCart } from '../api/cart';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useOutlet } from '../context/OutletContext';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import type { Address } from '../types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Cart'>;

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

export default function CartScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { customer } = useAuth();
  const { selectedOutlet } = useOutlet();
  const { lines, incrementLine, decrementLine, removeLine, updateLineNote, total, clear } = useCart();
  const [note, setNote] = useState('');
  const [placing, setPlacing] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  const [unavailableKeys, setUnavailableKeys] = useState<Set<string>>(new Set());

  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponPanelOpen, setCouponPanelOpen] = useState(false);

  const outletId = selectedOutlet?.outlet_id ?? null;

  function availabilityKey(itemId: number, variantLabel?: string) {
    return `${itemId}::${variantLabel || ''}`;
  }

  useFocusEffect(
    React.useCallback(() => {
      if (!outletId || !lines.length) {
        setUnavailableKeys(new Set());
        return;
      }
      let cancelled = false;
      validateCart(outletId, lines)
        .then(results => {
          if (cancelled) return;
          const bad = new Set(
            results.filter(r => !r.available).map(r => availabilityKey(r.item_id, r.variant_label || undefined))
          );
          setUnavailableKeys(bad);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [outletId, lines])
  );

  useEffect(() => {
    if (!outletId || !lines.length) {
      setAvailableCoupons([]);
      return;
    }
    let cancelled = false;
    previewCoupons(outletId, lines)
      .then(result => {
        if (cancelled) return;
        setAvailableCoupons(result.coupons);
        // The applied coupon may no longer be eligible (cart changed) — drop it.
        if (appliedCoupon && !result.coupons.some(c => c.campaign_code === appliedCoupon.campaign_code)) {
          setAppliedCoupon(null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId, lines]);

  async function applyCouponCode(code: string) {
    if (!outletId || !code.trim()) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      const result = await previewCoupons(outletId, lines, code.trim());
      if (result.code_error === 'NOT_FOUND') {
        setCouponError('Invalid coupon code.');
        return;
      }
      if (result.code_error === 'NOT_ELIGIBLE') {
        setCouponError("This code doesn't apply to your cart.");
        return;
      }
      const coupon = result.coupons.find(c => c.campaign_code === code.trim().toUpperCase());
      if (!coupon) {
        setCouponError("This code doesn't apply to your cart.");
        return;
      }
      setAppliedCoupon(coupon);
      setCouponCode('');
      setCouponPanelOpen(false);
    } catch (err: any) {
      setCouponError(err?.response?.data?.message || 'Could not apply coupon.');
    } finally {
      setCouponBusy(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponError(null);
  }

  const discountAmount = appliedCoupon?.discount_amount ?? 0;
  const finalTotal = Math.max(0, total - discountAmount);

  useFocusEffect(
    React.useCallback(() => {
      if (!customer) return;
      let cancelled = false;
      (async () => {
        try {
          const data = await listAddresses();
          if (cancelled) return;
          setAddresses(data);
          setSelectedAddressId(prev => prev ?? data.find(a => a.is_default)?.address_id ?? data[0]?.address_id ?? null);
        } catch (err: any) {
          if (!cancelled) {
            Alert.alert('Could not load addresses', err?.response?.data?.message || 'Something went wrong.');
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [customer])
  );

  useEffect(() => {
    if (route.params?.selectedAddressId != null) {
      setSelectedAddressId(route.params.selectedAddressId);
    }
  }, [route.params?.selectedAddressId]);

  const selectedAddress = addresses.find(a => a.address_id === selectedAddressId) || null;

  const hasUnavailableItems = lines.some(l => unavailableKeys.has(availabilityKey(l.item_id, l.variant_label)));

  async function placeOrder() {
    if (!lines.length) return;
    if (hasUnavailableItems) {
      Alert.alert('Remove unavailable items', 'Some items in your cart are no longer available. Remove them to continue.');
      return;
    }
    if (!customer) {
      navigation.navigate('Login');
      return;
    }
    if (!selectedAddressId) {
      Alert.alert('Add a delivery address', 'Add and select an address before placing your order.', [
        { text: 'Add address', onPress: () => navigation.navigate('AddressList', { selectMode: true }) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    setPlacing(true);
    try {
      const { data } = await api.post('/customer-order/orders', {
        items: lines.map(l => ({
          item_id: l.item_id,
          quantity: l.quantity,
          variant_label: l.variant_label,
          cooking_note: l.note,
          add_on_ids: l.add_ons?.map(a => a.id),
        })),
        payment_method: 'COD',
        address_id: selectedAddressId,
        delivery_landmark: note.trim() || undefined,
        promo_code: appliedCoupon?.campaign_code,
      });
      clear();
      setAppliedCoupon(null);
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
        keyExtractor={l => l.cart_key}
        contentContainerStyle={{ padding: spacing.md }}
        renderItem={({ item }) => {
          const isUnavailable = unavailableKeys.has(availabilityKey(item.item_id, item.variant_label));
          return (
            <View style={[styles.card, isUnavailable && styles.cardUnavailable]}>
              <View style={{ flex: 1 }}>
                <View style={styles.itemNameRow}>
                  <Text style={styles.itemName}>{item.item_name}</Text>
                  {isUnavailable && (
                    <View style={styles.unavailableBadge}>
                      <Text style={styles.unavailableBadgeText}>Unavailable</Text>
                    </View>
                  )}
                </View>
                {!!item.variant_label && <Text style={styles.itemVariant}>{item.variant_label}</Text>}
                {!!item.add_ons?.length && (
                  <Text style={styles.itemAddOns}>+ {item.add_ons.map(a => a.name).join(', ')}</Text>
                )}
                {isUnavailable && (
                  <Text style={styles.unavailableNote}>No longer available — please remove it to check out.</Text>
                )}
                <TextInput
                  style={styles.itemNoteInput}
                  placeholder="Add a note, e.g. less spicy (optional)"
                  placeholderTextColor={colors.textMuted}
                  value={item.note ?? ''}
                  onChangeText={text => updateLineNote(item.cart_key, text)}
                  editable={!isUnavailable}
                />
                <Text style={styles.itemPrice}>₹{item.price} × {item.quantity} = ₹{(item.price * item.quantity).toFixed(2)}</Text>
                <TouchableOpacity onPress={() => removeLine(item.cart_key)} hitSlop={HIT_SLOP} style={styles.removeTouch}>
                  <Text style={styles.remove}>Remove</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.qtyControls}>
                <TouchableOpacity style={styles.qtyButton} onPress={() => decrementLine(item.cart_key)} hitSlop={HIT_SLOP} disabled={isUnavailable}>
                  <Text style={styles.qtyButtonText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{item.quantity}</Text>
                <TouchableOpacity style={styles.qtyButton} onPress={() => incrementLine(item.cart_key)} hitSlop={HIT_SLOP} disabled={isUnavailable}>
                  <Text style={styles.qtyButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Your cart is empty.</Text>}
      />

      {lines.length > 0 && (
        <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
          {customer && (
            <TouchableOpacity
              style={styles.addressCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('AddressList', { selectMode: true })}
            >
              {selectedAddress ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressLabel}>Deliver to: {selectedAddress.label}</Text>
                  <Text style={styles.addressText} numberOfLines={2}>
                    {[selectedAddress.address_line1, selectedAddress.city].filter(Boolean).join(', ')}
                  </Text>
                </View>
              ) : (
                <Text style={styles.addressLabel}>+ Add a delivery address</Text>
              )}
              <Text style={styles.changeText}>Change</Text>
            </TouchableOpacity>
          )}
          {customer && (
            <TextInput
              style={styles.input}
              placeholder="Delivery note, e.g. ring the bell (optional)"
              placeholderTextColor={colors.textMuted}
              value={note}
              onChangeText={setNote}
            />
          )}

          {appliedCoupon ? (
            <View style={styles.couponAppliedRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.couponAppliedCode}>{appliedCoupon.campaign_code} applied</Text>
                <Text style={styles.couponAppliedName}>{appliedCoupon.campaign_name}</Text>
              </View>
              <TouchableOpacity onPress={removeCoupon} hitSlop={HIT_SLOP}>
                <Text style={styles.couponRemove}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.couponRow}
              activeOpacity={0.75}
              onPress={() => setCouponPanelOpen(v => !v)}
            >
              <Text style={styles.couponRowText}>+ Coupon</Text>
              <Text style={styles.changeText}>{couponPanelOpen ? 'Close' : 'View'}</Text>
            </TouchableOpacity>
          )}

          {!appliedCoupon && couponPanelOpen && (
            <View style={styles.couponPanel}>
              <View style={styles.couponInputRow}>
                <TextInput
                  style={[styles.input, styles.couponInput]}
                  placeholder="Enter coupon code"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  value={couponCode}
                  onChangeText={setCouponCode}
                />
                <TouchableOpacity
                  style={[styles.couponApplyBtn, couponBusy && styles.checkoutButtonDisabled]}
                  onPress={() => applyCouponCode(couponCode)}
                  disabled={couponBusy || !couponCode.trim()}
                  activeOpacity={0.85}
                >
                  {couponBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.couponApplyBtnText}>Apply</Text>}
                </TouchableOpacity>
              </View>
              {!!couponError && <Text style={styles.couponError}>{couponError}</Text>}
              {availableCoupons.filter(c => !c.requires_code || c.is_discoverable).map(c => (
                <TouchableOpacity key={c.campaign_code} style={styles.couponSuggestion} onPress={() => applyCouponCode(c.campaign_code)} activeOpacity={0.75}>
                  <Text style={styles.couponSuggestionText}>
                    {c.requires_code ? `${c.campaign_name} — use ${c.campaign_code} for ₹${c.discount_amount} off` : `${c.campaign_name} — ₹${c.discount_amount} off`}
                  </Text>
                  <Text style={styles.couponSuggestionApply}>Apply</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.total}>Subtotal</Text>
            <Text style={styles.totalAmount}>₹{total.toFixed(2)}</Text>
          </View>
          {discountAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.total}>Discount</Text>
              <Text style={[styles.totalAmount, styles.discountAmount]}>−₹{discountAmount.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.total}>Total</Text>
            <Text style={styles.totalAmount}>₹{finalTotal.toFixed(2)}</Text>
          </View>
          {customer && <Text style={styles.codNote}>Pay by Cash on Delivery</Text>}
          {hasUnavailableItems && (
            <Text style={styles.unavailableWarning}>Remove unavailable items to check out.</Text>
          )}
          <TouchableOpacity
            style={[styles.checkoutButton, (placing || hasUnavailableItems) && styles.checkoutButtonDisabled]}
            onPress={placeOrder}
            disabled={placing || hasUnavailableItems}
            activeOpacity={0.85}
          >
            {placing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.checkoutButtonText}>
                {customer ? 'Place Order (COD) →' : 'Sign In to Checkout →'}
              </Text>
            )}
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
  cardUnavailable: { opacity: 0.65, borderColor: colors.danger },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  unavailableBadge: {
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unavailableBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  unavailableNote: { color: colors.danger, fontSize: 11, marginTop: 2 },
  unavailableWarning: { color: colors.danger, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm, textAlign: 'center' },
  itemName: { fontSize: 16, fontWeight: '700', color: colors.text },
  itemVariant: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2 },
  itemAddOns: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  itemNoteInput: {
    fontSize: 12,
    color: colors.text,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
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
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: spacing.md,
  },
  addressLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  addressText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  changeText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: spacing.md,
    color: colors.text,
  },
  couponRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: spacing.md,
  },
  couponRowText: { fontSize: 14, fontWeight: '700', color: colors.text },
  couponAppliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: '#EAF6EC',
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: spacing.md,
  },
  couponAppliedCode: { fontSize: 14, fontWeight: '800', color: colors.success },
  couponAppliedName: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  couponRemove: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  couponPanel: { marginBottom: spacing.md },
  couponInputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  couponInput: { flex: 1, marginBottom: spacing.sm },
  couponApplyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 18,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponApplyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  couponError: { color: colors.danger, fontSize: 12, marginBottom: spacing.sm },
  couponSuggestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 10,
    marginBottom: spacing.sm,
  },
  couponSuggestionText: { flex: 1, fontSize: 13, color: colors.text, marginRight: spacing.sm },
  couponSuggestionApply: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  total: { fontSize: 16, fontWeight: '600', color: colors.text },
  totalAmount: { fontSize: 18, fontWeight: '800', color: colors.text },
  discountAmount: { color: colors.success },
  codNote: { color: colors.textMuted, marginBottom: spacing.md, fontSize: 13 },
  checkoutButton: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 16, alignItems: 'center' },
  checkoutButtonDisabled: { opacity: 0.6 },
  checkoutButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

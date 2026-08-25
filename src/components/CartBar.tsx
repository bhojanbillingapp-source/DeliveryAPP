import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../context/CartContext';
import { navigationRef } from '../navigation/navigationRef';
import { colors, radius, spacing } from '../theme';

const HIDDEN_ROUTES = new Set(['Cart', 'Login', 'Signup', 'ForgotPassword']);

export default function CartBar() {
  const insets = useSafeAreaInsets();
  const { itemCount, total } = useCart();
  const [routeName, setRouteName] = useState<string | undefined>();

  useEffect(() => {
    const update = () => setRouteName(navigationRef.getCurrentRoute()?.name);
    const unsubscribe = navigationRef.addListener('state', update);
    update();
    return unsubscribe;
  }, []);

  if (itemCount === 0 || (routeName && HIDDEN_ROUTES.has(routeName))) return null;

  return (
    <TouchableOpacity
      style={[styles.cartBar, { bottom: spacing.md + insets.bottom }]}
      onPress={() => navigationRef.navigate('Cart')}
      activeOpacity={0.9}
    >
      <Text style={styles.cartBarText}>
        {itemCount} item{itemCount > 1 ? 's' : ''} · ₹{total.toFixed(2)}
      </Text>
      <Text style={styles.cartBarLink}>View Cart →</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cartBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cartBarText: { color: '#fff', fontWeight: '700' },
  cartBarLink: { color: colors.accent, fontWeight: '700' },
});

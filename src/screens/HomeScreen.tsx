import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCart } from '../context/CartContext';
import { useOutlet } from '../context/OutletContext';
import OrderTypeDropdown from '../components/OrderTypeDropdown';
import type { AppStackParamList, MainTabParamList } from '../navigation/types';
import { CART_BAR_CLEARANCE } from '../navigation/tabBarConfig';
import { colors, radius, spacing } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<AppStackParamList>
>;

export default function HomeScreen({ navigation }: Props) {
  const { itemCount, total } = useCart();
  const { selectedOutlet } = useOutlet();

  const brandName = selectedOutlet?.restaurant_brand_name || selectedOutlet?.legal_business_name || 'PoSS';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.logo} numberOfLines={1}>{brandName}</Text>
        <OrderTypeDropdown />
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Hungry?</Text>
        <Text style={styles.heroSubtitle}>Browse the full menu and order in a few taps.</Text>
      </View>

      <View style={[styles.ctaRow, itemCount > 0 && { paddingBottom: CART_BAR_CLEARANCE }]}>
        <TouchableOpacity
          style={styles.viewMenuButton}
          onPress={() => navigation.navigate('Categories')}
          activeOpacity={0.85}
        >
          <Text style={styles.viewMenuButtonText}>View Menu</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.basketButton}
          onPress={() => navigation.navigate('Cart')}
          activeOpacity={0.85}
        >
          <Text style={styles.basketButtonText}>
            {itemCount > 0 ? `Basket · ${itemCount} · ₹${total.toFixed(2)}` : 'Basket'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: { fontSize: 20, fontWeight: '800', color: colors.primary, flexShrink: 1, marginRight: spacing.sm },
  hero: { padding: spacing.lg, flex: 1, justifyContent: 'center' },
  heroTitle: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  heroSubtitle: { fontSize: 15, color: colors.textMuted },
  ctaRow: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, paddingTop: 0 },
  viewMenuButton: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 16, alignItems: 'center' },
  viewMenuButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  basketButton: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 16, alignItems: 'center' },
  basketButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

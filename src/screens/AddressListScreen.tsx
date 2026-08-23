import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import { listAddresses, deleteAddress, setDefaultAddress } from '../api/addresses';
import type { AppStackParamList } from '../navigation/types';
import type { Address } from '../types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'AddressList'>;

export default function AddressListScreen({ navigation, route }: Props) {
  const selectMode = !!route.params?.selectMode;
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const data = await listAddresses();
          if (!cancelled) setAddresses(data);
        } catch (err: any) {
          if (!cancelled) {
            Alert.alert('Could not load addresses', err?.response?.data?.message || 'Something went wrong.');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  function handleSelect(address: Address) {
    if (selectMode) {
      // `navigate` pushes a new screen in React Navigation v7 even when one
      // already exists in the stack — `popTo` returns to the Cart screen the
      // user came from instead of stacking a duplicate on top of it.
      navigation.popTo('Cart', { selectedAddressId: address.address_id }, { merge: true });
    }
  }

  function handleDelete(address: Address) {
    Alert.alert('Remove address', `Remove "${address.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteAddress(address.address_id);
          setAddresses(prev => prev.filter(a => a.address_id !== address.address_id));
        },
      },
    ]);
  }

  async function handleSetDefault(address: Address) {
    const updated = await setDefaultAddress(address.address_id);
    setAddresses(prev => prev.map(a => (a.address_id === updated.address_id ? updated : { ...a, is_default: false })));
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Your Addresses" onBack={() => navigation.goBack()} />
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Your Addresses" onBack={() => navigation.goBack()} />
      <FlatList
        data={addresses}
        keyExtractor={a => String(a.address_id)}
        contentContainerStyle={{ padding: spacing.md }}
        ListEmptyComponent={<Text style={styles.empty}>No saved addresses yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={selectMode ? 0.7 : 1}
            onPress={() => handleSelect(item)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.label}>{item.label}</Text>
              {item.is_default && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>Default</Text>
                </View>
              )}
            </View>
            <Text style={styles.addressText}>
              {[item.address_line1, item.address_line2, item.city, item.state, item.pin_code].filter(Boolean).join(', ')}
            </Text>
            {!!item.landmark && <Text style={styles.landmark}>Near {item.landmark}</Text>}
            <View style={styles.actionsRow}>
              <TouchableOpacity onPress={() => navigation.navigate('AddressForm', { address: item })}>
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              {!item.is_default && (
                <TouchableOpacity onPress={() => handleSetDefault(item)}>
                  <Text style={styles.actionText}>Set as default</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleDelete(item)}>
                <Text style={[styles.actionText, styles.deleteText]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AddressForm', {})}
        >
          <Text style={styles.addButtonText}>+ Add new address</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: 16, fontWeight: '700', color: colors.text },
  defaultBadge: { backgroundColor: colors.iconBg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  defaultBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  addressText: { color: colors.text, marginTop: 4 },
  landmark: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
  actionsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actionText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  deleteText: { color: colors.danger },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addButton: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 16, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

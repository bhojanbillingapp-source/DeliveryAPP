import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import api from '../api/client';
import { useOutlet, type Outlet } from '../context/OutletContext';
import { useOrderType, type OrderType } from '../context/OrderTypeContext';
import { useCart } from '../context/CartContext';
import ScreenHeader from '../components/ScreenHeader';
import { CLIENT_GROUP_ID } from '../config';
import { requestLocationPermission, getCurrentCoords } from '../utils/geolocation';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'SelectOutlet'>;

type NearbyOutlet = Outlet & {
  address_line1?: string | null;
  city?: string | null;
  distance_km?: number | null;
};

export default function SelectOutletScreen({ navigation }: Props) {
  const { selectedOutlet, setSelectedOutlet } = useOutlet();
  const { orderType, setOrderType } = useOrderType();
  const { clear } = useCart();
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [outlets, setOutlets] = useState<NearbyOutlet[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshLocation = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const allowed = await requestLocationPermission();
      if (!allowed) {
        setLocationError('Location permission is needed to find nearby restaurants.');
        return;
      }
      const c = await getCurrentCoords();
      setCoords(c);
    } catch (err: any) {
      setLocationError(err?.message || 'Could not get your location.');
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    if (orderType === 'delivery') refreshLocation();
  }, [orderType, refreshLocation]);

  const loadOutlets = useCallback(async () => {
    if (orderType === 'delivery' && !coords) {
      setOutlets([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/customer-order/outlets/nearby', {
        params: {
          client_group_id: CLIENT_GROUP_ID,
          mode: orderType,
          lat: coords?.latitude,
          lng: coords?.longitude,
          search: orderType === 'pickup' ? search.trim() || undefined : undefined,
        },
      });
      setOutlets(data.outlets || []);
    } catch (err: any) {
      Alert.alert('Could not load restaurants', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [orderType, coords, search]);

  useEffect(() => {
    loadOutlets();
  }, [loadOutlets]);

  function handleSelectOutlet(outlet: NearbyOutlet) {
    const changed = outlet.outlet_id !== selectedOutlet?.outlet_id;
    setSelectedOutlet(outlet);
    // Prices/availability are outlet-specific — carrying a cart across
    // outlets risks charging the wrong prices, so start fresh.
    if (changed) clear();
    navigation.goBack();
  }

  function handleOrderTypeChange(type: OrderType) {
    setOrderType(type);
    setSearch('');
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={orderType === 'delivery' ? 'Choose a delivery restaurant' : 'Choose a pickup restaurant'} onBack={() => navigation.goBack()} />

      <View style={styles.toggleRow}>
        {(['delivery', 'pickup'] as OrderType[]).map(type => {
          const active = type === orderType;
          return (
            <TouchableOpacity
              key={type}
              style={[styles.toggleBtn, active && styles.toggleBtnActive]}
              onPress={() => handleOrderTypeChange(type)}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                {type === 'delivery' ? 'Delivery' : 'Pickup'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {orderType === 'pickup' && (
        <View style={styles.searchWrap}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search restaurants"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
      )}

      {orderType === 'delivery' && (
        <TouchableOpacity style={styles.locationRow} onPress={refreshLocation} activeOpacity={0.75} disabled={locating}>
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.locationText}>📍 {coords ? 'Update current location' : 'Use current location'}</Text>
          )}
        </TouchableOpacity>
      )}

      {locationError && orderType === 'delivery' && <Text style={styles.error}>{locationError}</Text>}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={outlets}
          keyExtractor={o => o.outlet_id}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) => {
            const active = item.outlet_id === selectedOutlet?.outlet_id;
            return (
              <TouchableOpacity
                style={[styles.row, active && styles.rowActive]}
                activeOpacity={0.75}
                onPress={() => handleSelectOutlet(item)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, active && styles.rowTitleActive]}>
                    {item.restaurant_brand_name || item.legal_business_name}
                  </Text>
                  {!!item.address_line1 && (
                    <Text style={[styles.rowSubtitle, active && styles.rowSubtitleActive]} numberOfLines={1}>
                      {[item.address_line1, item.city].filter(Boolean).join(', ')}
                    </Text>
                  )}
                </View>
                {item.distance_km != null && (
                  <Text style={[styles.distance, active && styles.rowSubtitleActive]}>{item.distance_km} km</Text>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {orderType === 'delivery'
                ? coords
                  ? 'No restaurants deliver to your location right now.'
                  : 'Turn on location to find restaurants that deliver to you.'
                : 'No restaurants found.'}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    margin: spacing.md,
    padding: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  toggleTextActive: { color: '#fff' },
  searchWrap: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchInput: {
    height: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.text,
  },
  locationRow: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  locationText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  error: { color: colors.danger, paddingHorizontal: spacing.md, marginBottom: spacing.sm, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowTitleActive: { color: '#fff' },
  rowSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowSubtitleActive: { color: '#fff' },
  distance: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginLeft: spacing.sm },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted, paddingHorizontal: spacing.lg },
});

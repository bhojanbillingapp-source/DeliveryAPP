import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, MapPressEvent, Region } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import { getCurrentCoords, requestLocationPermission } from '../utils/geolocation';
import { reverseGeocode } from '../api/geo';

type Props = NativeStackScreenProps<AppStackParamList, 'MapPicker'>;

// India-wide fallback view when there's no GPS/initial coordinate to center on.
const INDIA: Region = { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 24, longitudeDelta: 24 };
// An empty style array doesn't reliably override Google Maps' own
// "match the app's night theme" auto-styling on Android — an explicit,
// non-empty light style does.
const LIGHT_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  // Roads need their own explicit geometry colors — without these, the
  // blanket geometry rule above paints roads the exact same shade as the
  // surrounding landscape and they visually disappear (this was the "roads
  // not showing properly" bug).
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
];

export default function MapPickerScreen({ navigation, route }: Props) {
  const initial = route.params?.initialCoords;
  const mapRef = useRef<MapView | null>(null);

  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(initial ?? null);
  const [address, setAddress] = useState<string | null>(null);
  const [reverseBusy, setReverseBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  const resolveAddress = useCallback((lat: number, lng: number) => {
    setReverseBusy(true);
    reverseGeocode(lat, lng)
      .then(setAddress)
      .finally(() => setReverseBusy(false));
  }, []);

  const movePin = useCallback(
    (latitude: number, longitude: number) => {
      setPin({ latitude, longitude });
      resolveAddress(latitude, longitude);
    },
    [resolveAddress],
  );

  // "Locate me" always available — including when editing an existing address
  // (the old screen early-returned and could never re-center to current GPS).
  const locateMe = useCallback(async () => {
    const ok = await requestLocationPermission();
    if (!ok) return;
    setLocating(true);
    try {
      const c = await getCurrentCoords();
      movePin(c.latitude, c.longitude);
      mapRef.current?.animateToRegion(
        { ...c, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        400,
      );
    } catch {
      // keep whatever the map is showing
    } finally {
      setLocating(false);
    }
  }, [movePin]);

  const handleConfirm = () => {
    if (!pin) return;
    // React Navigation v7's `navigate` always pushes a new screen; `popTo`
    // returns to the original AddressForm and merges the picked coords.
    navigation.popTo('AddressForm', { pickedCoords: pin }, { merge: true });
  };

  const initialRegion: Region = initial
    ? { ...initial, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : INDIA;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Pick your location" onBack={() => navigation.goBack()} />

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          customMapStyle={LIGHT_MAP_STYLE}
          onPress={(e: MapPressEvent) =>
            movePin(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)
          }
        >
          {pin && (
            <Marker
              coordinate={pin}
              draggable
              onDragEnd={(e) =>
                movePin(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)
              }
              pinColor={colors.accent}
            />
          )}
        </MapView>

        <TouchableOpacity style={styles.locateBtn} onPress={locateMe} activeOpacity={0.85}>
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.locateBtnText}>◎ Locate me</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.hint}>
          {pin
            ? reverseBusy
              ? 'Looking up address…'
              : address || 'Tap the map or drag the pin to your exact delivery spot.'
            : 'Tap the map or use “Locate me” to drop a pin on your delivery address.'}
        </Text>
        <TouchableOpacity
          style={[styles.confirmButton, !pin && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={!pin}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmButtonText}>Confirm this location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapWrap: { flex: 1 },
  locateBtn: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  locateBtnText: { color: colors.primary, fontWeight: '700' },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: spacing.sm, minHeight: 34 },
  confirmButton: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 16, alignItems: 'center' },
  confirmButtonDisabled: { opacity: 0.5 },
  confirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

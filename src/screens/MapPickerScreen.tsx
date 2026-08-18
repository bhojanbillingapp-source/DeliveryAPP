import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Region } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'MapPicker'>;

// India-wide fallback view when there's no GPS/initial coordinate to center on.
const DEFAULT_REGION: Region = { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 8, longitudeDelta: 8 };

export default function MapPickerScreen({ navigation, route }: Props) {
  const initial = route.params?.initialCoords;
  const [region, setRegion] = useState<Region>(
    initial
      ? { latitude: initial.latitude, longitude: initial.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
      : DEFAULT_REGION
  );

  function handleConfirm() {
    navigation.navigate('AddressForm', {
      pickedCoords: { latitude: region.latitude, longitude: region.longitude },
    });
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Pick your location" onBack={() => navigation.goBack()} />
      <View style={styles.mapWrap}>
        <MapView style={StyleSheet.absoluteFill} initialRegion={region} onRegionChangeComplete={setRegion} />
        <View pointerEvents="none" style={styles.pinWrap}>
          <Text style={styles.pin}>📍</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.hint}>Move the map so the pin sits on your delivery location.</Text>
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm} activeOpacity={0.85}>
          <Text style={styles.confirmButtonText}>Confirm this location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapWrap: { flex: 1 },
  pinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -16,
    marginTop: -32,
    alignItems: 'center',
  },
  pin: { fontSize: 32 },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: spacing.sm },
  confirmButton: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 16, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

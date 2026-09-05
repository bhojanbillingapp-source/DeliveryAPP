import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import { createAddress, updateAddress } from '../api/addresses';
import { reverseGeocode } from '../api/geo';
import { getCurrentCoords, requestLocationPermission } from '../utils/geolocation';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'AddressForm'>;

export default function AddressFormScreen({ navigation, route }: Props) {
  const editing = route.params?.address;
  const [label, setLabel] = useState(editing?.label ?? 'Home');
  const [addressLine1, setAddressLine1] = useState(editing?.address_line1 ?? '');
  const [addressLine2, setAddressLine2] = useState(editing?.address_line2 ?? '');
  const [city, setCity] = useState(editing?.city ?? '');
  const [state, setState] = useState(editing?.state ?? '');
  const [pinCode, setPinCode] = useState(editing?.pin_code ?? '');
  const [landmark, setLandmark] = useState(editing?.landmark ?? '');
  const [isDefault, setIsDefault] = useState(editing?.is_default ?? false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    editing ? { latitude: editing.latitude, longitude: editing.longitude } : null
  );
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (route.params?.pickedCoords) {
      setCoords(route.params.pickedCoords);
    }
  }, [route.params?.pickedCoords]);

  async function useCurrentLocation() {
    const ok = await requestLocationPermission();
    if (!ok) {
      Alert.alert('Location needed', 'Enable location access in Settings, or pick your spot on the map.');
      return;
    }
    setLocating(true);
    try {
      const c = await getCurrentCoords();
      setCoords(c);
      const label = await reverseGeocode(c.latitude, c.longitude);
      if (label && !addressLine1.trim()) setAddressLine1(label);
    } catch {
      Alert.alert('Could not get your location', 'Try again, or pick your spot on the map.');
    } finally {
      setLocating(false);
    }
  }

  async function handleSave() {
    if (!addressLine1.trim()) {
      Alert.alert('Address required', 'Enter your address (house/flat, street, area).');
      return;
    }
    if (!coords) {
      Alert.alert(
        'Location required',
        'Pick your location on the map (or use “Use current location”) so we can check it’s inside the delivery area.'
      );
      return;
    }
    setSaving(true);
    try {
      const input = {
        label: label.trim() || 'Home',
        address_line1: addressLine1.trim(),
        address_line2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        pin_code: pinCode.trim() || undefined,
        landmark: landmark.trim() || undefined,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        is_default: isDefault,
      };
      if (editing) {
        await updateAddress(editing.address_id, input);
      } else {
        await createAddress(input);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Could not save address', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={editing ? 'Edit Address' : 'Add Address'} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Text style={styles.fieldLabel}>Label</Text>
        <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Home / Work / Other" placeholderTextColor={colors.textMuted} />

        <Text style={styles.fieldLabel}>Address</Text>
        <TextInput
          style={styles.input}
          value={addressLine1}
          onChangeText={setAddressLine1}
          placeholder="House/flat no., street, area"
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          style={styles.input}
          value={addressLine2}
          onChangeText={setAddressLine2}
          placeholder="Apartment, floor (optional)"
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInput]}
            value={city}
            onChangeText={setCity}
            placeholder="City"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={[styles.input, styles.rowInput]}
            value={state}
            onChangeText={setState}
            placeholder="State"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <TextInput
          style={styles.input}
          value={pinCode}
          onChangeText={setPinCode}
          placeholder="PIN code"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
        />
        <TextInput
          style={styles.input}
          value={landmark}
          onChangeText={setLandmark}
          placeholder="Landmark (optional)"
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.locationRow}>
          <TouchableOpacity
            style={[styles.locationButton, styles.locationButtonHalf]}
            onPress={useCurrentLocation}
            disabled={locating}
            activeOpacity={0.85}
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.locationButtonText}>◎ Use current location</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.locationButton, styles.locationButtonHalf]}
            onPress={() => navigation.navigate('MapPicker', { initialCoords: coords ?? undefined })}
            activeOpacity={0.85}
          >
            <Text style={styles.locationButtonText}>🗺️ Pick on map</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.locationHint}>
          {coords
            ? `Location set (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)})`
            : 'A precise location is required so we can confirm you’re inside the delivery area.'}
        </Text>

        <View style={styles.switchRow}>
          <Text style={styles.fieldLabel}>Set as default address</Text>
          <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: colors.accent }} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Address</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowInput: { flex: 1 },
  locationRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  locationButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  locationButtonHalf: { flex: 1 },
  locationButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  locationHint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 16, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

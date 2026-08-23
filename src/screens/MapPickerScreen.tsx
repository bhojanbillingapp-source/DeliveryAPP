import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'MapPicker'>;

// India-wide fallback view when there's no GPS/initial coordinate to center on.
const DEFAULT_COORDS = { latitude: 20.5937, longitude: 78.9629 };
const DEFAULT_ZOOM = 5;
const PICKED_ZOOM = 16;

// Leaflet + OpenStreetMap tiles — no API key required, unlike react-native-maps
// on Android which needs a billed Google Maps SDK key just to render tiles.
function buildMapHtml(latitude: number, longitude: number, zoom: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${latitude}, ${longitude}], ${zoom});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    function post(center) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ latitude: center.lat, longitude: center.lng }));
    }
    map.on('moveend', () => post(map.getCenter()));
    post(map.getCenter());
  </script>
</body>
</html>`;
}

export default function MapPickerScreen({ navigation, route }: Props) {
  const initial = route.params?.initialCoords;
  const startCoords = initial ?? DEFAULT_COORDS;
  const startZoom = initial ? PICKED_ZOOM : DEFAULT_ZOOM;

  const [coords, setCoords] = useState(startCoords);
  const htmlRef = useRef(buildMapHtml(startCoords.latitude, startCoords.longitude, startZoom));

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        setCoords({ latitude: data.latitude, longitude: data.longitude });
      }
    } catch {
      // ignore malformed messages
    }
  }

  function handleConfirm() {
    // React Navigation v7's `navigate` always pushes a new screen instead of
    // returning to an existing instance in the stack — using it here would
    // stack a second AddressForm on top of the one the user came from, so
    // Save would only pop back to this map screen instead of reaching
    // AddressList. `popTo` pops back to the original AddressForm and merges
    // the picked coords into its params.
    navigation.popTo('AddressForm', { pickedCoords: coords }, { merge: true });
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Pick your location" onBack={() => navigation.goBack()} />
      <View style={styles.mapWrap}>
        <WebView
          style={StyleSheet.absoluteFill}
          originWhitelist={['*']}
          source={{ html: htmlRef.current }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
        />
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

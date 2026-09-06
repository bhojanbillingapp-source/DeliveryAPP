import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { colors, radius } from '../theme';
import { decodePolyline, type LatLng } from '../utils/polyline';

interface Props {
  rider: LatLng | null;
  destination: LatLng | null;
  origin?: LatLng | null;
  routePolyline?: string | null;
  isStale?: boolean;
  height?: number;
}

const EDGE = { top: 50, right: 50, bottom: 50, left: 50 };
// Distinct route-line blue, not the navy brand color — stays legible
// regardless of tile theme.
const ROUTE_LINE_COLOR = '#1A73E8';
// An empty style array doesn't reliably override Google Maps' own
// "match the app's night theme" auto-styling on Android — an explicit,
// non-empty light style (Google's own published "standard light" baseline)
// does override it.
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
// How long the rider marker takes to glide to a new fix — matches the rider/
// manager app's own MARKER_ANIMATE_MS so the motion reads the same way
// everywhere.
const MARKER_ANIMATE_MS = 1000;

function regionFor(points: LatLng[]): Region | undefined {
  if (points.length === 0) return undefined;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.01),
  };
}

/**
 * `coordinate` is only ever set from the FIRST fix — React never re-binds
 * it, which would snap the marker instantly. Every fix after that calls the
 * native animateMarkerToCoordinate, which the SDK tweens smoothly. No
 * heading-based rotation — the glyph always stays upright.
 */
function RiderMarker({ rider, isStale }: { rider: LatLng; isStale: boolean }) {
  const markerRef = useRef<InstanceType<typeof Marker> | null>(null);
  const initialCoord = useRef(rider).current;
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    markerRef.current?.animateMarkerToCoordinate(rider, MARKER_ANIMATE_MS);
  }, [rider.latitude, rider.longitude]);

  return (
    <Marker ref={markerRef} coordinate={initialCoord} title="Delivery partner" anchor={{ x: 0.5, y: 0.5 }}>
      <View style={[styles.riderMarker, isStale && styles.riderMarkerStale]}>
        <Text style={styles.riderGlyph}>🛵</Text>
      </View>
    </Marker>
  );
}

export default function DeliveryMap({
  rider,
  destination,
  origin = null,
  routePolyline,
  isStale = false,
  height = 300,
}: Props) {
  const mapRef = useRef<MapView | null>(null);
  const routePoints = useMemo(() => decodePolyline(routePolyline), [routePolyline]);

  const fitPoints = useMemo(() => {
    const p: LatLng[] = [];
    if (rider) p.push(rider);
    if (destination) p.push(destination);
    if (origin) p.push(origin);
    for (const r of routePoints) p.push(r);
    return p;
  }, [rider, destination, origin, routePoints]);

  const fitKey = fitPoints.map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`).join('|');

  useEffect(() => {
    if (!mapRef.current || fitPoints.length < 2) return;
    const t = setTimeout(
      () => mapRef.current?.fitToCoordinates(fitPoints, { edgePadding: EDGE, animated: true }),
      250,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  if (!rider && !destination) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderText}>No live location yet</Text>
      </View>
    );
  }

  const straight = rider && destination && routePoints.length < 2 ? [rider, destination] : null;

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={regionFor(fitPoints)}
        customMapStyle={LIGHT_MAP_STYLE}
      >
        {routePoints.length >= 2 && (
          <>
            <Polyline coordinates={routePoints} strokeColor="#FFFFFF" strokeWidth={7} />
            <Polyline coordinates={routePoints} strokeColor={ROUTE_LINE_COLOR} strokeWidth={4} />
          </>
        )}
        {straight && (
          <Polyline coordinates={straight} strokeColor={ROUTE_LINE_COLOR} strokeWidth={3} lineDashPattern={[6, 8]} />
        )}
        {origin && <Marker coordinate={origin} title="Restaurant" pinColor="#1E8A44" />}
        {destination && <Marker coordinate={destination} title="Delivery address" pinColor={colors.accent} />}
        {rider && <RiderMarker rider={rider} isStale={isStale} />}
      </MapView>
      {isStale && (
        <View style={styles.staleBanner}>
          <Text style={styles.staleBannerText}>Live location temporarily unavailable</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  placeholder: {
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
  },
  placeholderText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  riderMarker: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  riderMarkerStale: { backgroundColor: colors.textMuted },
  riderGlyph: { fontSize: 18, lineHeight: 20 },
  staleBanner: {
    position: 'absolute', top: 8, left: 8, right: 8,
    backgroundColor: 'rgba(192,57,43,0.92)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10,
  },
  staleBannerText: { color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
});

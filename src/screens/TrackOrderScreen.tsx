import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, AppState } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import DeliveryMap from '../components/DeliveryMap';
import { trackOrder, TrackingInfo } from '../api/tracking';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'TrackOrder'>;

const TERMINAL_STATUSES = ['DELIVERED', 'RETURNED'];
const POLL_INTERVAL_MS = 10000;

function updatedAgo(iso: string | null): string {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `Updated ${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `Updated ${m}m ago` : `Updated ${Math.floor(m / 60)}h ago`;
}

export default function TrackOrderScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const [info, setInfo] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const sinceRef = useRef<string | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      try {
        const data = await trackOrder(orderId, sinceRef.current);
        if (cancelled) return;
        setError(false);
        setLoading(false);
        if (data) {
          setInfo(data);
          sinceRef.current = data.lastRecordedAt ?? sinceRef.current;
          if (data.status && TERMINAL_STATUSES.includes(data.status)) {
            stoppedRef.current = true;
            if (interval) { clearInterval(interval); interval = null; }
          }
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    function start() {
      if (stoppedRef.current || interval) return;
      poll();
      interval = setInterval(poll, POLL_INTERVAL_MS);
    }
    function stop() {
      if (interval) { clearInterval(interval); interval = null; }
    }

    start();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') start();
      else stop();
    });

    return () => {
      cancelled = true;
      stop();
      sub.remove();
    };
  }, [orderId]);

  const status = info?.status ?? null;
  const isLive = !!info?.location && !info.isStale;

  const callPartner = () => {
    if (!info?.partnerPhoneMasked) return;
    // The masked string isn't dialable — the backend exposes a tel: deep link
    // only when it chooses to; fall back to nothing if absent.
    Linking.openURL(`tel:${info.partnerPhoneMasked.replace(/[^\d+]/g, '')}`).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Track Order" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={{ padding: spacing.md, flex: 1 }}>
          <View style={styles.card}>
            <Text style={styles.statusText}>
              {info?.statusLabel || status || 'Waiting for a delivery partner'}
            </Text>
            <Text style={styles.meta}>
              {error
                ? "Couldn't refresh — retrying…"
                : info?.location
                  ? isLive
                    ? `Live · ${updatedAgo(info.lastRecordedAt)}`
                    : 'Location temporarily unavailable'
                  : 'Not out for delivery yet'}
              {info?.routeDistanceKm != null ? ` · ${info.routeDistanceKm.toFixed(1)} km away` : ''}
            </Text>
            {!!info?.partnerFirstName && (
              <View style={styles.partnerRow}>
                <Text style={styles.meta}>Delivery partner: {info.partnerFirstName}</Text>
                {!!info.partnerPhoneMasked && (
                  <TouchableOpacity onPress={callPartner}>
                    <Text style={styles.callLink}>Call {info.partnerPhoneMasked}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <DeliveryMap
            rider={info?.location ?? null}
            destination={info?.destination ?? null}
            origin={info?.origin ?? null}
            routePolyline={info?.routePolyline}
            isStale={!!info?.isStale}
            height={360}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusText: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  partnerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  callLink: { fontSize: 13, color: colors.primary, fontWeight: '700' },
});

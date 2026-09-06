import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import { trackOrder, TrackingInfo } from '../api/tracking';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'TrackOrder'>;

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'A delivery partner has been assigned',
  ACCEPTED: 'Delivery partner is heading to the restaurant',
  PICKED_UP: 'Order picked up',
  ON_THE_WAY: 'On the way to you',
  DELIVERED: 'Delivered',
  RETURNED: 'Order returned',
};

const TERMINAL_STATUSES = ['DELIVERED', 'RETURNED'];
const POLL_INTERVAL_MS = 8000;

export default function TrackOrderScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const [info, setInfo] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await trackOrder(orderId);
        if (cancelled) return;
        setInfo(data);
        setLoading(false);
        if (data.status && TERMINAL_STATUSES.includes(data.status) && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [orderId]);

  function openInMaps() {
    if (!info?.location) return;
    const { latitude, longitude } = info.location;
    Linking.openURL(`https://www.google.com/maps?q=${latitude},${longitude}`);
  }

  function callRider() {
    if (!info?.delivery_boy_phone) return;
    Linking.openURL(`tel:${info.delivery_boy_phone}`);
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Track Order" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={{ padding: spacing.md }}>
          <View style={styles.card}>
            <Text style={styles.statusText}>
              {info?.status ? STATUS_LABELS[info.status] || info.status : 'Waiting for a delivery partner to be assigned'}
            </Text>
            {!!info?.delivery_boy_name && <Text style={styles.meta}>Delivery partner: {info.delivery_boy_name}</Text>}
            {!!info?.delivery_boy_name && (
              <View style={styles.actionRow}>
                {!!info?.delivery_boy_phone && (
                  <TouchableOpacity style={[styles.callButton, styles.actionButton]} onPress={callRider} activeOpacity={0.85}>
                    <Text style={styles.callButtonText}>📞 Call</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.chatButton, styles.actionButton]}
                  onPress={() => navigation.navigate('DeliveryChat', { orderId })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.chatButtonText}>💬 Chat</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {!!info?.history?.length && (
            <View style={styles.card}>
              {info.history.map((entry, idx) => (
                <View key={`${entry.status}-${entry.created_at}`} style={styles.timelineRow}>
                  <View style={styles.timelineMarkerCol}>
                    <View style={[styles.timelineDot, idx === info.history.length - 1 && styles.timelineDotActive]} />
                    {idx < info.history.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineTextCol}>
                    <Text style={styles.timelineStatus}>{STATUS_LABELS[entry.status] || entry.status}</Text>
                    <Text style={styles.meta}>
                      {new Date(entry.created_at).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {info?.location ? (
            <View style={styles.card}>
              <Text style={styles.meta}>Last updated {new Date(info.location.recorded_at).toLocaleTimeString()}</Text>
              <TouchableOpacity style={styles.mapButton} onPress={openInMaps} activeOpacity={0.85}>
                <Text style={styles.mapButtonText}>📍 View live location in Maps</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.meta}>No live location yet — check back once your order is on the way.</Text>
            </View>
          )}
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
  timelineRow: { flexDirection: 'row' },
  timelineMarkerCol: { width: 20, alignItems: 'center' },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  timelineDotActive: { backgroundColor: colors.primary },
  timelineLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  timelineTextCol: { flex: 1, paddingBottom: spacing.sm, paddingLeft: spacing.sm },
  timelineStatus: { fontSize: 14, fontWeight: '600', color: colors.text },
  mapButton: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 14, alignItems: 'center', marginTop: spacing.sm },
  mapButtonText: { color: '#fff', fontWeight: '700' },
  actionRow: { flexDirection: 'row', marginTop: spacing.sm },
  actionButton: { flex: 1 },
  callButton: { backgroundColor: colors.primary, borderRadius: radius.sm, padding: 14, alignItems: 'center', marginRight: spacing.sm },
  callButtonText: { color: '#fff', fontWeight: '700' },
  chatButton: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 14, alignItems: 'center' },
  chatButtonText: { color: '#fff', fontWeight: '700' },
});

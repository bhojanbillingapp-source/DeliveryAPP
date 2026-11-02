/**
 * Watching your event happen — BRD group L on the customer side, FR-PO-197
 * and FR-PO-190.
 *
 * WHAT THIS SCREEN IS FOR
 * ----------------------
 * It answers one question, which a customer on the day asks every ten
 * minutes: "where is my food?" Everything else on the screen is secondary to
 * answering that honestly.
 *
 * Honestly matters more than precisely. The position the restaurant has may be
 * twenty minutes old, so its AGE is always shown — a pin with no age reads as
 * live, and a customer who believes the van is five minutes away when it is
 * not is worse off than one who knows the last sighting was at 18:40. When the
 * position is stale the screen says so and offers the driver's number.
 *
 * The stages are the restaurant's own timeline filtered to what a customer can
 * act on or wants to know. The kitchen's instructions, who ticked what off,
 * and any incident the restaurant marked internal never arrive here.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import {
  type PartyEventStatus,
  eventStatusHeadline,
  getPartyEventStatus,
} from '../api/party';

type Props = NativeStackScreenProps<AppStackParamList, 'PartyEvent'>;

export default function PartyEventScreen({ navigation, route }: Props) {
  const { bookingId } = route.params;

  const [status, setStatus] = useState<PartyEventStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStatus(await getPartyEventStatus(bookingId));
    } catch (err: any) {
      setError(err.message || 'Could not load your event');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.wrap}>
        <ScreenHeader title="Your event" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </View>
    );
  }

  if (!status) {
    return (
      <View style={styles.wrap}>
        <ScreenHeader title="Your event" onBack={() => navigation.goBack()} />
        <View style={[styles.card, styles.cardBad]}>
          <Text style={styles.badText}>{error || 'This event could not be loaded.'}</Text>
        </View>
      </View>
    );
  }

  const headline = eventStatusHeadline(status);
  const loc = status.live_location;

  return (
    <View style={styles.wrap}>
      <ScreenHeader title="Your event" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.primary}
          />
        )}
      >
        {/* ---------------- the one question ---------------- */}
        <View style={[styles.card, styles.cardHero]}>
          <Text style={styles.heroTitle}>{headline.title}</Text>
          <Text style={styles.heroBody}>{headline.body}</Text>
          <Text style={styles.heroRef}>{status.booking_no}</Text>
        </View>

        {/* ---------------- FR-PO-190: where it is ---------------- */}
        {loc ? (
          <View style={[styles.card, loc.is_stale && styles.cardStale]}>
            <Text style={styles.cardTitle}>Where your order is</Text>
            {loc.is_stale ? (
              <Text style={styles.staleText}>
                {`The last position we have is ${loc.age_minutes} minutes old, so `}
                it may have moved on. The driver&rsquo;s number is below if you
                need a firmer time.
              </Text>
            ) : (
              <Text style={styles.cardSub}>
                {`Updated ${loc.age_minutes === 0 ? 'just now' : `${loc.age_minutes} minute(s) ago`}`}
                {loc.eta_minutes ? ` · about ${loc.eta_minutes} minutes away` : ''}
              </Text>
            )}

            {/* A map is not embedded: this app has no map component, and a
                fake one would be worse than a link to the real thing. */}
            <TouchableOpacity
              style={styles.mapBtn}
              onPress={() => Linking.openURL(
                `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`,
              )}
            >
              <Text style={styles.mapBtnText}>Open the last position in Maps</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ---------------- who is bringing it ---------------- */}
        {status.vehicle ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Who is bringing it</Text>
            {status.vehicle.driver_name ? (
              <Text style={styles.rowValue}>{status.vehicle.driver_name}</Text>
            ) : null}
            {status.vehicle.vehicle_no ? (
              <Text style={styles.cardSub}>{status.vehicle.vehicle_no}</Text>
            ) : null}
            {status.vehicle.driver_mobile ? (
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => Linking.openURL(`tel:${status.vehicle!.driver_mobile}`)}
              >
                <Text style={styles.callBtnText}>
                  {`Call ${status.vehicle.driver_name || 'the driver'}`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* ---------------- FR-PO-197: the stages ---------------- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How it is going</Text>
          {status.stages.map((s, i) => (
            <View key={`${s.label}-${i}`} style={styles.stage}>
              <View style={[styles.stageDot, s.done && styles.stageDotDone]} />
              <View style={styles.stageBody}>
                <Text style={[styles.stageLabel, s.done && styles.stageLabelDone]}>
                  {s.label}
                </Text>
                {s.at ? (
                  <Text style={styles.stageAt}>
                    {new Date(s.at).toLocaleTimeString([], {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
          {status.next ? (
            <Text style={styles.cardHint}>{`Next: ${status.next.toLowerCase()}.`}</Text>
          ) : null}
        </View>

        {/* ---------------- FR-PO-192, from the customer's side ---------- */}
        {status.handover ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Handover at your venue</Text>
            <Text style={styles.cardSub}>
              {status.handover.acknowledged
                ? `${status.handover.contact_name} has confirmed everything arrived.`
                : `We will ask ${status.handover.contact_name} to confirm everything `
                  + 'has arrived, with a code sent to their phone.'}
            </Text>
          </View>
        ) : null}

        {/* ---------------- FR-PO-195, only what we chose to show ------- */}
        {status.incidents.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Things we wanted you to know</Text>
            {status.incidents.map((i) => (
              <View key={i.incident_id} style={styles.incident}>
                <Text style={styles.incidentText}>{i.description}</Text>
                {i.resolution ? (
                  <Text style={styles.incidentFix}>{i.resolution}</Text>
                ) : null}
                <Text style={styles.stageAt}>
                  {new Date(i.occurred_at).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.outlineBtn}
          onPress={() => navigation.navigate('PartyBooking', { bookingId })}
        >
          <Text style={styles.outlineBtnText}>Back to my booking</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardHero: { backgroundColor: colors.primary, borderColor: colors.primary },
  cardStale: { borderColor: colors.warning },
  cardBad: {
    margin: spacing.md,
    borderColor: colors.danger,
    backgroundColor: '#FDF4F4',
  },
  badText: {
    fontSize: 13, fontWeight: '500', lineHeight: 19,
    color: colors.danger, includeFontPadding: false,
  },

  heroTitle: {
    fontSize: 20, fontWeight: '700', lineHeight: 26,
    color: colors.surface, includeFontPadding: false,
  },
  heroBody: {
    fontSize: 14, fontWeight: '400', lineHeight: 20,
    color: colors.surface, includeFontPadding: false,
    marginTop: spacing.xs, opacity: 0.92,
  },
  heroRef: {
    fontSize: 12, fontWeight: '600', lineHeight: 17,
    color: colors.surface, includeFontPadding: false,
    marginTop: spacing.sm, opacity: 0.75,
  },

  cardTitle: {
    fontSize: 16, fontWeight: '700', lineHeight: 22,
    color: colors.text, includeFontPadding: false,
  },
  cardSub: {
    fontSize: 13, fontWeight: '400', lineHeight: 19,
    color: colors.textMuted, includeFontPadding: false, marginTop: 3,
  },
  cardHint: {
    fontSize: 12.5, fontWeight: '400', lineHeight: 18,
    color: colors.textMuted, includeFontPadding: false, marginTop: spacing.sm,
  },
  staleText: {
    fontSize: 13, fontWeight: '400', lineHeight: 19,
    color: colors.warning, includeFontPadding: false, marginTop: 4,
  },
  rowValue: {
    fontSize: 15, fontWeight: '600', lineHeight: 21,
    color: colors.text, includeFontPadding: false, marginTop: 4,
  },

  mapBtn: {
    marginTop: spacing.md, paddingVertical: 12, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.primary, alignItems: 'center',
  },
  mapBtnText: {
    fontSize: 14, fontWeight: '600', lineHeight: 20,
    color: colors.primary, includeFontPadding: false,
  },
  callBtn: {
    marginTop: spacing.md, paddingVertical: 13, borderRadius: radius.sm,
    backgroundColor: colors.accent, alignItems: 'center',
  },
  callBtnText: {
    fontSize: 15, fontWeight: '700', lineHeight: 21,
    color: colors.surface, includeFontPadding: false,
  },

  stage: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  stageDot: {
    width: 10, height: 10, borderRadius: 5, marginTop: 6,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  stageDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  stageBody: { flex: 1 },
  stageLabel: {
    fontSize: 14, fontWeight: '500', lineHeight: 20,
    color: colors.textMuted, includeFontPadding: false,
  },
  stageLabelDone: { color: colors.text, fontWeight: '600' },
  stageAt: {
    fontSize: 11.5, fontWeight: '400', lineHeight: 16,
    color: colors.textMuted, includeFontPadding: false,
  },

  incident: {
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  incidentText: {
    fontSize: 13.5, fontWeight: '500', lineHeight: 19,
    color: colors.text, includeFontPadding: false,
  },
  incidentFix: {
    fontSize: 12.5, fontWeight: '400', lineHeight: 18,
    color: colors.success, includeFontPadding: false, marginTop: 2,
  },

  outlineBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.sm,
    paddingVertical: 13, alignItems: 'center',
  },
  outlineBtnText: {
    fontSize: 14.5, fontWeight: '600', lineHeight: 20,
    color: colors.primary, includeFontPadding: false,
  },
});

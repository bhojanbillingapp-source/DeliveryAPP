/**
 * Where my party order is — BRD group N, FR-PO-214 and FR-PO-215.
 *
 * ONE timeline for the whole order: the enquiry, the quotation, the
 * negotiation, the confirmation, every payment, every document issued, the
 * event itself and the settlement — each with the date and time it happened.
 *
 * WHY ONE SCREEN AND NOT SIX
 * --------------------------
 * The customer thinks of their party as one thing. Asking them to know
 * whether it is still an enquiry or already a booking, in order to find out
 * where it is, is asking them to understand the restaurant's data model. The
 * backend merges the records; this screen just renders what came back.
 *
 * Plain language throughout (FR-PO-215) and nothing internal (FR-PO-222):
 * no cost, no margin, no capacity position, no internal note.
 *
 * The newest entries are rendered first and the rest below, so the screen is
 * useful before the whole list has painted on a slow connection (FR-PO-220).
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import {
  type PartyOrderTimeline,
  type TimelineEntry,
  getPartyOrderTimeline,
  timelineTone,
  timelineWhen,
} from '../api/party';

type Props = NativeStackScreenProps<AppStackParamList, 'PartyTimeline'>;

const TONE_COLOUR: Record<string, string> = {
  brand: colors.primary,
  success: colors.success,
  warning: colors.warning,
  muted: colors.textMuted,
};

/** The heading each group of entries sits under. */
const STAGE_LABEL: Record<TimelineEntry['stage'], string> = {
  STATUS: 'Progress',
  CONFIRMATION: 'Confirmation',
  PAYMENT: 'Payments',
  DOCUMENT: 'Documents',
  CHANGE: 'Changes',
  CANCELLATION: 'Cancellation',
  SETTLEMENT: 'Final bill',
  EVENT: 'Your event',
  FEEDBACK: 'Feedback',
};

export default function PartyTimelineScreen({ navigation, route }: Props) {
  const { enquiryId } = route.params;

  const [data, setData] = useState<PartyOrderTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getPartyOrderTimeline(enquiryId));
    } catch (err: any) {
      setError(err.message || 'Could not load your party order');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enquiryId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Your party order" onBack={() => navigation.goBack()} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Your party order" onBack={() => navigation.goBack()} />
        <View style={styles.loading}>
          <Text style={styles.errorText}>{error || 'Not found'}</Text>
          <TouchableOpacity style={styles.retry} onPress={load}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Newest first: the question is almost always "what happened last?"
  const entries = [...data.entries].reverse();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Your party order" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.primary}
          />
        )}
      >
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Right now</Text>
          <Text style={styles.statusValue}>{data.current_status}</Text>
          <Text style={styles.statusRef}>
            {data.booking_no ? `Booking ${data.booking_no}` : `Enquiry ${data.enquiry_no}`}
          </Text>
          {data.booking_id ? (
            <View style={styles.linkRow}>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => navigation.navigate('PartyBooking', {
                  bookingId: data.booking_id as string,
                })}
              >
                <Text style={styles.linkText}>Open the booking</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => navigation.navigate('PartyEvent', {
                  bookingId: data.booking_id as string,
                })}
              >
                <Text style={styles.linkText}>Event status</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => navigation.navigate('PartyEnquiryDetail', {
                enquiryId: data.enquiry_id,
              })}
            >
              <Text style={styles.linkText}>Open the enquiry</Text>
            </TouchableOpacity>
          )}
        </View>

        {entries.length === 0 ? (
          <Text style={styles.empty}>Nothing has happened yet.</Text>
        ) : (
          <View style={styles.timeline}>
            {entries.map((e, i) => {
              const colour = TONE_COLOUR[timelineTone(e.stage)] || colors.textMuted;
              const isLast = i === entries.length - 1;
              return (
                <View key={`${e.at}:${e.title}`} style={styles.entryRow}>
                  <View style={styles.rail}>
                    <View style={[styles.dot, { backgroundColor: colour }]} />
                    {!isLast ? <View style={styles.line} /> : null}
                  </View>
                  <View style={styles.entryBody}>
                    <Text style={styles.entryTitle}>{e.title}</Text>
                    {e.detail ? <Text style={styles.entryDetail}>{e.detail}</Text> : null}
                    <Text style={styles.entryWhen}>
                      {timelineWhen(e.at)} · {STAGE_LABEL[e.stage] || e.stage}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.footnote}>
          Every date and time here is the moment it actually happened on the
          restaurant's own record — there is no separate copy of your order.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  body: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },

  errorText: {
    fontSize: 14, fontWeight: '400', lineHeight: 20,
    color: colors.danger, includeFontPadding: false, textAlign: 'center',
  },
  retry: {
    paddingHorizontal: spacing.md, height: 38, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary,
  },
  retryText: {
    fontSize: 14, fontWeight: '600', lineHeight: 19,
    color: colors.surface, includeFontPadding: false,
  },

  statusCard: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4,
  },
  statusLabel: {
    fontSize: 12, fontWeight: '600', lineHeight: 16,
    color: colors.textMuted, includeFontPadding: false, textTransform: 'uppercase',
  },
  statusValue: {
    fontSize: 20, fontWeight: '700', lineHeight: 26,
    color: colors.text, includeFontPadding: false,
  },
  statusRef: {
    fontSize: 13, fontWeight: '400', lineHeight: 18,
    color: colors.textMuted, includeFontPadding: false,
  },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  linkBtn: {
    alignSelf: 'flex-start', marginTop: spacing.sm,
    paddingHorizontal: spacing.md, height: 36, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface,
  },
  linkText: {
    fontSize: 13.5, fontWeight: '600', lineHeight: 18,
    color: colors.primary, includeFontPadding: false,
  },

  timeline: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  entryRow: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 16, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 3 },
  entryBody: { flex: 1, paddingBottom: spacing.md },
  entryTitle: {
    fontSize: 14.5, fontWeight: '600', lineHeight: 20,
    color: colors.text, includeFontPadding: false,
  },
  entryDetail: {
    fontSize: 13, fontWeight: '400', lineHeight: 18,
    color: colors.text, includeFontPadding: false, marginTop: 2,
  },
  entryWhen: {
    fontSize: 12, fontWeight: '400', lineHeight: 16,
    color: colors.textMuted, includeFontPadding: false, marginTop: 3,
  },

  empty: {
    fontSize: 14, fontWeight: '400', lineHeight: 20,
    color: colors.textMuted, includeFontPadding: false, textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  footnote: {
    fontSize: 12, fontWeight: '400', lineHeight: 17,
    color: colors.textMuted, includeFontPadding: false,
  },
});

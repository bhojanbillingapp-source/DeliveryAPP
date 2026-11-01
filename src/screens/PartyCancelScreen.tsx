/**
 * Cancelling a party booking, and tracking the refund — BRD group K on the
 * customer side (FR-PO-170..173, 178, 179, 181).
 *
 * WHY THE FIGURE COMES FIRST
 * --------------------------
 * FR-PO-173 requires the refund computation to be shown to the customer
 * before the cancellation is agreed. So this screen leads with the money —
 * what comes back, what is kept, and why — and only then asks for a reason.
 * A customer should never agree to a cancellation and discover the refund
 * afterwards.
 *
 * The whole band table is shown beneath it on purpose. "Why am I only getting
 * half back?" is answered by seeing that a week earlier would have returned
 * all of it, and a customer who can see that is far less likely to ring up
 * about it.
 *
 * WHAT THIS SCREEN CANNOT DO
 * --------------------------
 * It records a REQUEST. The restaurant confirms it, and confirming is what
 * releases the date and raises the refund — because confirming moves money
 * and that cannot be the customer's own act.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import {
  type CancellationPreview,
  type PartyRefund,
  formatMoney,
  getPartyRefunds,
  previewPartyCancellation,
  refundReassurance,
  requestPartyCancellation,
} from '../api/party';

type Props = NativeStackScreenProps<AppStackParamList, 'PartyCancel'>;

const REFUND_TONE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#FDEBD3', fg: '#B4650A' },
  moving: { bg: '#E7EEFB', fg: '#1C274C' },
  done: { bg: '#DFF3E3', fg: '#1E7A3B' },
  problem: { bg: '#FBE0E0', fg: '#C0392B' },
};

export default function PartyCancelScreen({ navigation, route }: Props) {
  const { bookingId } = route.params;

  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [refunds, setRefunds] = useState<PartyRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [reasonNote, setReasonNote] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Both at once: a customer arriving here may already have cancelled and
      // be coming back only to see where the money is.
      const [p, r] = await Promise.all([
        previewPartyCancellation(bookingId).catch((err) => {
          // An already-cancelled booking has no preview, but its refunds are
          // still the reason the customer opened the screen.
          setError(err.message);
          return null;
        }),
        getPartyRefunds(bookingId).catch(() => []),
      ]);
      setPreview(p);
      setRefunds(r);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = () => {
    if (!reasonCode) {
      Alert.alert('Tell us why', 'Please choose a reason so the restaurant knows what happened.');
      return;
    }
    const refund = preview?.computed_refund ?? 0;
    Alert.alert(
      'Ask to cancel?',
      refund > 0
        ? `${formatMoney(refund, 2)} would be refunded under the restaurant's `
          + 'policy. The restaurant will confirm your request.'
        : 'No refund is due at this notice. The restaurant will confirm your request.',
      [
        { text: 'Keep my booking', style: 'cancel' },
        {
          text: 'Ask to cancel',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const result = await requestPartyCancellation(bookingId, {
                reason_code: reasonCode,
                reason_note: reasonNote.trim() || undefined,
              });
              setSubmitted(result.message);
              await load();
            } catch (err: any) {
              Alert.alert('Could not send that', err.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.wrap}>
        <ScreenHeader title="Cancel booking" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </View>
    );
  }

  const alreadyRequested = preview?.already_requested || Boolean(submitted);

  return (
    <View style={styles.wrap}>
      <ScreenHeader
        title={refunds.length && !preview ? 'Your refund' : 'Cancel booking'}
        onBack={() => navigation.goBack()}
      />

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
        {submitted ? (
          <View style={[styles.card, styles.cardGood]}>
            <Text style={styles.goodTitle}>Request sent</Text>
            <Text style={styles.goodBody}>{submitted}</Text>
          </View>
        ) : null}

        {error && !preview ? (
          <View style={[styles.card, styles.cardBad]}>
            <Text style={styles.badText}>{error}</Text>
          </View>
        ) : null}

        {/* ---------------- FR-PO-178/179: where the money is ---------------- */}
        {refunds.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your refund</Text>
            {refunds.map((r) => {
              const says = refundReassurance(r);
              const tone = REFUND_TONE[says.tone];
              return (
                <View key={r.refund_id} style={styles.refund}>
                  <View style={styles.refundHead}>
                    <Text style={styles.refundAmount}>{formatMoney(r.amount, 2)}</Text>
                    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.pillText, { color: tone.fg }]}>
                        {r.status_label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.refundTitle}>{says.title}</Text>
                  <Text style={styles.refundBody}>{says.body}</Text>

                  {/* The timeline, because a single word generates a phone call. */}
                  {r.timeline.length > 0 ? (
                    <View style={styles.timeline}>
                      {r.timeline.map((t, i) => (
                        <View key={`${t.status}-${t.at}-${i}`} style={styles.step}>
                          <View style={styles.stepDot} />
                          <View style={styles.stepBody}>
                            <Text style={styles.stepLabel}>{t.status_label}</Text>
                            <Text style={styles.stepNote}>{t.note}</Text>
                            <Text style={styles.stepWhen}>
                              {new Date(t.at).toLocaleString()}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {r.refund_voucher_no ? (
                    <Text style={styles.voucher}>
                      {`Refund voucher ${r.refund_voucher_no} — it is with your documents.`}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* ---------------- FR-PO-173: the figure, before anything else ---- */}
        {preview && !alreadyRequested ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>What you would get back</Text>
              <Text style={styles.cardSub}>
                {`${preview.days_to_event} day(s) before your event on ${preview.event_date}`}
              </Text>

              <View style={styles.bigRow}>
                <View style={styles.bigCell}>
                  <Text style={styles.bigLabel}>REFUNDED</Text>
                  <Text style={styles.bigValue}>
                    {formatMoney(preview.computed_refund, 2)}
                  </Text>
                </View>
                <View style={styles.bigCell}>
                  <Text style={styles.bigLabel}>NOT REFUNDED</Text>
                  <Text style={[styles.bigValue, styles.bigValueMuted]}>
                    {formatMoney(preview.forfeited_amount, 2)}
                  </Text>
                </View>
              </View>

              {preview.deposit_refund > 0 ? (
                <Text style={styles.depositLine}>
                  {`Your refundable deposit of ${formatMoney(preview.deposit_refund, 2)} comes `}
                  back in full as well — the policy does not touch it.
                </Text>
              ) : null}

              <Text style={styles.explain}>{preview.explanation}</Text>
              <Text style={styles.expected}>
                {`If you cancel now, we would expect it to reach you by ${preview.expected_completion_date}.`}
              </Text>
            </View>

            {/* The bands, so the figure above is not a mystery. */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>The restaurant&rsquo;s policy</Text>
              {preview.bands.map((b, i) => {
                const applies = Number(b.refund_pct) === preview.policy_refund_pct
                  && preview.days_to_event >= b.min_days_before
                  && (b.max_days_before === null || preview.days_to_event <= b.max_days_before);
                return (
                  <View
                    key={`band-${i}`}
                    style={[styles.bandRow, applies && styles.bandRowActive]}
                  >
                    <Text style={[styles.bandDays, applies && styles.bandActive]}>
                      {b.max_days_before === null
                        ? `${b.min_days_before} days or more before`
                        : `${b.min_days_before}–${b.max_days_before} days before`}
                    </Text>
                    <Text style={[styles.bandPct, applies && styles.bandActive]}>
                      {`${b.refund_pct}% back`}
                    </Text>
                  </View>
                );
              })}
              {preview.policy_text ? (
                <Text style={styles.policyText}>{preview.policy_text}</Text>
              ) : null}
            </View>

            {/* ---------------- FR-PO-171: the reason ---------------- */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Why are you cancelling?</Text>
              <Text style={styles.cardSub}>
                It helps the restaurant, and it is recorded with your request.
              </Text>
              <View style={styles.reasonWrap}>
                {preview.reasons.map((r) => (
                  <TouchableOpacity
                    key={r.code}
                    style={[styles.chip, reasonCode === r.code && styles.chipActive]}
                    onPress={() => setReasonCode(r.code)}
                  >
                    <Text style={[styles.chipText, reasonCode === r.code && styles.chipTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Anything else? (optional)</Text>
              <TextInput
                style={styles.textarea}
                value={reasonNote}
                onChangeText={setReasonNote}
                placeholder="Tell them anything that would help"
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <TouchableOpacity
                style={[styles.dangerBtn, busy && styles.btnDisabled]}
                onPress={submit}
                disabled={busy}
              >
                <Text style={styles.dangerBtnText}>Ask to cancel my booking</Text>
              </TouchableOpacity>
              <Text style={styles.footnote}>
                This sends a request. The restaurant confirms it, and you will see
                the refund appear on this screen as it moves.
              </Text>
            </View>

            {preview.partial_cancellation_available ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Fewer guests instead?</Text>
                <Text style={styles.cardSub}>
                  If the event is still going ahead with a smaller party, ask the
                  restaurant to reduce it rather than cancelling — the policy then
                  applies only to the part you are dropping.
                </Text>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={styles.secondaryBtnText}>Go back to my booking</Text>
                </TouchableOpacity>
                {preview.guaranteed_guest_count ? (
                  <Text style={styles.footnote}>
                    {`Your booking guarantees ${preview.guaranteed_guest_count} guests, so `}
                    reducing below that does not lower the bill.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        {alreadyRequested && !submitted ? (
          <View style={[styles.card, styles.cardInfo]}>
            <Text style={styles.cardTitle}>Your request is with the restaurant</Text>
            <Text style={styles.cardSub}>
              They will confirm it and, where a refund is due, you will see it on
              this screen as it moves. There is nothing else for you to do.
            </Text>
          </View>
        ) : null}
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
  cardGood: { borderColor: colors.success, backgroundColor: '#F4FBF5' },
  cardBad: { borderColor: colors.danger, backgroundColor: '#FDF4F4' },
  cardInfo: { borderColor: colors.primary, backgroundColor: '#F5F7FC' },
  cardTitle: {
    fontSize: 16, fontWeight: '700', lineHeight: 22,
    color: colors.text, includeFontPadding: false,
  },
  cardSub: {
    fontSize: 13, fontWeight: '400', lineHeight: 19,
    color: colors.textMuted, includeFontPadding: false, marginTop: 3,
  },
  goodTitle: {
    fontSize: 15, fontWeight: '700', lineHeight: 21,
    color: colors.success, includeFontPadding: false,
  },
  goodBody: {
    fontSize: 13, fontWeight: '400', lineHeight: 19,
    color: colors.text, includeFontPadding: false, marginTop: 4,
  },
  badText: {
    fontSize: 13, fontWeight: '500', lineHeight: 19,
    color: colors.danger, includeFontPadding: false,
  },

  bigRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  bigCell: {
    flex: 1,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.sm, backgroundColor: colors.iconBg,
  },
  bigLabel: {
    fontSize: 10.5, fontWeight: '700', lineHeight: 14,
    color: colors.textMuted, includeFontPadding: false, letterSpacing: 0.5,
  },
  bigValue: {
    fontSize: 20, fontWeight: '700', lineHeight: 26,
    color: colors.text, includeFontPadding: false, marginTop: 3,
  },
  bigValueMuted: { color: colors.textMuted },
  depositLine: {
    fontSize: 13, fontWeight: '400', lineHeight: 19,
    color: colors.success, includeFontPadding: false, marginTop: spacing.sm,
  },
  explain: {
    fontSize: 13.5, fontWeight: '400', lineHeight: 20,
    color: colors.text, includeFontPadding: false, marginTop: spacing.sm,
  },
  expected: {
    fontSize: 12.5, fontWeight: '400', lineHeight: 18,
    color: colors.textMuted, includeFontPadding: false, marginTop: spacing.xs,
  },

  bandRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: spacing.sm,
    borderRadius: radius.sm, marginTop: spacing.xs,
  },
  bandRowActive: { backgroundColor: '#E7EEFB' },
  bandDays: {
    flex: 1,
    fontSize: 13, fontWeight: '400', lineHeight: 19,
    color: colors.textMuted, includeFontPadding: false,
  },
  bandPct: {
    fontSize: 13, fontWeight: '600', lineHeight: 19,
    color: colors.text, includeFontPadding: false,
  },
  bandActive: { color: colors.primary, fontWeight: '700' },
  policyText: {
    fontSize: 12.5, fontWeight: '400', lineHeight: 18,
    color: colors.textMuted, includeFontPadding: false,
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },

  reasonWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: {
    fontSize: 13, fontWeight: '500', lineHeight: 18,
    color: colors.text, includeFontPadding: false,
  },
  chipTextActive: { color: colors.surface },

  label: {
    fontSize: 12, fontWeight: '600', lineHeight: 16,
    color: colors.textMuted, includeFontPadding: false,
    marginTop: spacing.md, marginBottom: spacing.xs,
  },
  textarea: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    minHeight: 76, textAlignVertical: 'top',
    fontSize: 14, fontWeight: '400', lineHeight: 20,
    color: colors.text, includeFontPadding: false,
  },

  dangerBtn: {
    backgroundColor: colors.danger, borderRadius: radius.sm,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.md,
  },
  dangerBtnText: {
    fontSize: 15, fontWeight: '700', lineHeight: 21,
    color: colors.surface, includeFontPadding: false,
  },
  secondaryBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.sm,
    paddingVertical: 13, alignItems: 'center', marginTop: spacing.md,
  },
  secondaryBtnText: {
    fontSize: 14.5, fontWeight: '600', lineHeight: 20,
    color: colors.primary, includeFontPadding: false,
  },
  btnDisabled: { opacity: 0.6 },
  footnote: {
    fontSize: 12, fontWeight: '400', lineHeight: 17,
    color: colors.textMuted, includeFontPadding: false, marginTop: spacing.sm,
  },

  refund: {
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  refundHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  refundAmount: {
    flex: 1,
    fontSize: 19, fontWeight: '700', lineHeight: 25,
    color: colors.text, includeFontPadding: false,
  },
  pill: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
  },
  pillText: {
    fontSize: 11.5, fontWeight: '700', lineHeight: 16,
    includeFontPadding: false,
  },
  refundTitle: {
    fontSize: 14.5, fontWeight: '700', lineHeight: 20,
    color: colors.text, includeFontPadding: false, marginTop: spacing.sm,
  },
  refundBody: {
    fontSize: 13, fontWeight: '400', lineHeight: 19,
    color: colors.textMuted, includeFontPadding: false, marginTop: 2,
  },

  timeline: { marginTop: spacing.md },
  step: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  stepDot: {
    width: 8, height: 8, borderRadius: 4, marginTop: 6,
    backgroundColor: colors.primary,
  },
  stepBody: { flex: 1 },
  stepLabel: {
    fontSize: 13.5, fontWeight: '600', lineHeight: 19,
    color: colors.text, includeFontPadding: false,
  },
  stepNote: {
    fontSize: 12.5, fontWeight: '400', lineHeight: 18,
    color: colors.textMuted, includeFontPadding: false,
  },
  stepWhen: {
    fontSize: 11.5, fontWeight: '400', lineHeight: 16,
    color: colors.textMuted, includeFontPadding: false,
  },
  voucher: {
    fontSize: 12.5, fontWeight: '500', lineHeight: 18,
    color: colors.primary, includeFontPadding: false, marginTop: spacing.sm,
  },
});

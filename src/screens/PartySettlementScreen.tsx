/**
 * Your final bill, and what you thought of the event — BRD group M on the
 * customer side: FR-PO-200, 201, 202, 206, 207, 210, 213.
 *
 * WHY THE COUNT IS EXPLAINED FIRST
 * --------------------------------
 * The single question this screen has to answer before any other is "why am I
 * billed for ninety people when eighty-five came?" The answer is the
 * guaranteed minimum they agreed to at booking, and it is printed above the
 * figures rather than buried in the terms — because a customer who has to go
 * looking for it rings up instead.
 *
 * EVERY LINE IS QUERYABLE
 * -----------------------
 * FR-PO-201 lets the customer query a LINE, so every line is tappable and the
 * query carries that line's key. The statement rendered here is the FROZEN one
 * the restaurant presented, which is what makes the query refer to something
 * stable.
 *
 * Agreeing is separate from paying, and nothing is collected while a query is
 * open — stated on the screen, because it is the reassurance that makes a
 * customer willing to ask.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Modal, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import {
  type FeedbackDimension,
  type PartyFeedbackState,
  type PartySettlement,
  type StatementLine,
  agreePartySettlement,
  formatMoney,
  getPartyFeedback,
  getPartySettlement,
  queryPartySettlementLine,
  settlementNextStep,
  submitPartyFeedback,
} from '../api/party';

type Props = NativeStackScreenProps<AppStackParamList, 'PartySettlement'>;

export default function PartySettlementScreen({ navigation, route }: Props) {
  const { bookingId } = route.params;

  const [settlement, setSettlement] = useState<PartySettlement | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<PartyFeedbackState | null>(null);
  const [dimensions, setDimensions] = useState<FeedbackDimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [queryLine, setQueryLine] = useState<StatementLine | null>(null);
  const [queryText, setQueryText] = useState('');

  const [showFeedback, setShowFeedback] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [consent, setConsent] = useState(false);
  const [reviewAsk, setReviewAsk] = useState<{ channel: string; url: string | null } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, f] = await Promise.all([
        getPartySettlement(bookingId),
        getPartyFeedback(bookingId).catch(() => null),
      ]);
      setSettlement(s.settlement);
      setPendingMessage(s.message);
      if (f) {
        setFeedback(f.feedback);
        setDimensions(f.dimensions);
      }
    } catch (err: any) {
      setError(err.message || 'Could not load your final bill');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submitQuery = async () => {
    if (!settlement || !queryText.trim()) return;
    setBusy(true);
    try {
      const r = await queryPartySettlementLine(settlement.settlement_id, {
        line_key: queryLine?.key,
        query: queryText.trim(),
      });
      setQueryLine(null);
      setQueryText('');
      Alert.alert('Query sent', r.message);
      await load();
    } catch (err: any) {
      Alert.alert('Could not send that', err.message);
    } finally {
      setBusy(false);
    }
  };

  const agree = () => {
    if (!settlement) return;
    Alert.alert(
      'Agree the final bill?',
      `${settlement.statement.summary} Once you agree, `
      + (settlement.balance > 0
        ? 'you can pay the balance here.'
        : settlement.balance < 0
          ? 'the restaurant will process your refund.'
          : 'the restaurant will close your booking.'),
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Agree',
          onPress: async () => {
            setBusy(true);
            try {
              const r = await agreePartySettlement(settlement.settlement_id);
              Alert.alert('Thank you', r.message);
              await load();
            } catch (err: any) {
              Alert.alert('Could not do that', err.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  /**
   * FR-PO-202 — pay the balance "through the same payment mechanisms available
   * for scheduled milestones".
   *
   * Agreeing the statement raises the balance AS a milestone on the server, so
   * this is the ordinary milestone payment path rather than a second mechanism
   * invented for settlement. The booking screen's payment section shows it the
   * same way it shows every other amount due.
   */
  const pay = () => {
    navigation.navigate('PartyBooking', { bookingId });
  };

  const sendFeedback = async () => {
    const overall = scores.overall;
    if (!overall) {
      Alert.alert('One score needed', 'Please give an overall score out of five.');
      return;
    }
    setBusy(true);
    try {
      const r = await submitPartyFeedback(bookingId, {
        scores: {
          overall,
          food: scores.food,
          service: scores.service,
          timeliness: scores.timeliness,
          value: scores.value,
        },
        comment: comment.trim() || undefined,
        photo_consent: consent,
      });
      setShowFeedback(false);
      setReviewAsk(r.review_request);
      Alert.alert('Thank you', r.message);
      await load();
    } catch (err: any) {
      Alert.alert('Could not send that', err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.wrap}>
        <ScreenHeader title="Your final bill" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </View>
    );
  }

  const step = settlement ? settlementNextStep(settlement) : null;
  const st = settlement?.statement;

  return (
    <View style={styles.wrap}>
      <ScreenHeader title="Your final bill" onBack={() => navigation.goBack()} />

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
        {error ? (
          <View style={[styles.card, styles.cardBad]}>
            <Text style={styles.badText}>{error}</Text>
          </View>
        ) : null}

        {!settlement ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Not ready yet</Text>
            <Text style={styles.cardSub}>
              {pendingMessage
                || 'Your final statement is being prepared. We will let you know '
                  + 'as soon as it is ready.'}
            </Text>
          </View>
        ) : (
          <>
            {step ? (
              <View style={[styles.card, step.action ? styles.cardAction : styles.cardInfo]}>
                <Text style={styles.cardTitle}>{step.title}</Text>
                <Text style={styles.cardSub}>{step.body}</Text>
                {step.action === 'AGREE' ? (
                  <TouchableOpacity
                    style={[styles.primaryBtn, busy && styles.btnOff]}
                    disabled={busy}
                    onPress={agree}
                  >
                    <Text style={styles.primaryBtnText}>Agree the final bill</Text>
                  </TouchableOpacity>
                ) : null}
                {step.action === 'PAY' ? (
                  <TouchableOpacity
                    style={[styles.primaryBtn, busy && styles.btnOff]}
                    disabled={busy}
                    onPress={pay}
                  >
                    <Text style={styles.primaryBtnText}>
                      {`Pay ${formatMoney(settlement.balance, 2)}`}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {settlement.status === 'SETTLED' ? (
              <View style={[styles.card, styles.cardGood]}>
                <Text style={styles.goodTitle}>All settled</Text>
                <Text style={styles.cardSub}>
                  {settlement.invoice_no
                    ? `Tax invoice ${settlement.invoice_no} is with your documents.`
                    : 'Nothing further is owed either way.'}
                </Text>
              </View>
            ) : null}

            {/* ---------------- why this number ---------------- */}
            {st ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>How many guests you are billed for</Text>
                <Text style={styles.basis}>{st.counts.basis}</Text>
                <View style={styles.countRow}>
                  <Count label="Agreed minimum" value={st.counts.guaranteed} />
                  {st.counts.actual !== null ? (
                    <Count label="Who came" value={st.counts.actual} />
                  ) : null}
                  <Count label="Billed for" value={st.counts.billable} strong />
                </View>
              </View>
            ) : null}

            {/* ---------------- the frozen statement ---------------- */}
            {st?.sections.map((sec) => (
              <View key={sec.key} style={styles.card}>
                <Text style={styles.cardTitle}>{sec.title}</Text>
                {sec.lines.map((l) => (
                  <TouchableOpacity
                    key={l.key}
                    style={styles.line}
                    activeOpacity={settlement.can_query ? 0.6 : 1}
                    disabled={!settlement.can_query}
                    onPress={() => { setQueryLine(l); setQueryText(''); }}
                  >
                    <View style={styles.lineBody}>
                      <Text style={styles.lineLabel}>{l.label}</Text>
                      {l.detail ? <Text style={styles.lineDetail}>{l.detail}</Text> : null}
                    </View>
                    <Text style={styles.lineAmount}>{formatMoney(l.amount, 2)}</Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.subtotal}>
                  <Text style={styles.subtotalLabel}>Subtotal</Text>
                  <Text style={styles.subtotalValue}>{formatMoney(sec.subtotal, 2)}</Text>
                </View>
              </View>
            ))}

            {settlement.can_query ? (
              <Text style={styles.queryHint}>
                Tap any line to query it. Nothing is collected while a query is open.
              </Text>
            ) : null}

            {/* ---------------- the total ---------------- */}
            {st ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Your final bill</Text>
                <Row label="Taxable value" value={formatMoney(st.totals.taxable_value, 2)} />
                <Row label="Tax" value={formatMoney(st.totals.tax_amount, 2)} />
                <Row label="Final value" value={formatMoney(st.totals.final_value, 2)} />
                <Row label="Already paid" value={formatMoney(st.totals.already_paid, 2)} />
                {st.totals.already_refunded > 0 ? (
                  <Row
                    label="Already refunded"
                    value={formatMoney(st.totals.already_refunded, 2)}
                  />
                ) : null}
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>
                    {st.totals.balance_direction === 'PAYABLE' ? 'To pay'
                      : st.totals.balance_direction === 'REFUNDABLE' ? 'Coming back to you'
                        : 'Balance'}
                  </Text>
                  <Text style={styles.balanceValue}>
                    {formatMoney(Math.abs(st.totals.balance), 2)}
                  </Text>
                </View>
                <Text style={styles.summary}>{st.summary}</Text>
              </View>
            ) : null}

            {/* ---------------- FR-PO-203: the deposit ---------------- */}
            {st && st.deposit.paid > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Your security deposit</Text>
                <Row label="You paid" value={formatMoney(st.deposit.paid, 2)} />
                {st.deposit.returned > 0 ? (
                  <Row label="Returned" value={formatMoney(st.deposit.returned, 2)} />
                ) : null}
                {st.deposit.forfeited > 0 ? (
                  <Row label="Retained" value={formatMoney(st.deposit.forfeited, 2)} />
                ) : null}
                {st.deposit.note ? (
                  <Text style={styles.cardSub}>{st.deposit.note}</Text>
                ) : null}
              </View>
            ) : null}

            {/* ---------------- FR-PO-201: my queries ---------------- */}
            {settlement.queries.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Your queries</Text>
                {settlement.queries.map((q) => (
                  <View key={q.dispute_id} style={styles.query}>
                    <Text style={styles.queryLine}>
                      {q.line_label || 'About the bill'}
                    </Text>
                    <Text style={styles.queryText}>{`“${q.query}”`}</Text>
                    {q.response ? (
                      <Text style={styles.queryResponse}>{q.response}</Text>
                    ) : q.status === 'OPEN' ? (
                      <Text style={styles.queryPending}>
                        We are looking into this and will come back to you.
                      </Text>
                    ) : null}
                    {q.resolution ? (
                      <Text style={styles.queryResolved}>
                        {q.resolution}
                        {q.adjustment_amount !== 0
                          ? ` Your bill was adjusted by ${formatMoney(q.adjustment_amount, 2)}.`
                          : ''}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}

        {/* ---------------- FR-PO-206/207: feedback ---------------- */}
        {feedback?.submitted ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Thank you for your feedback</Text>
            <Text style={styles.cardSub}>
              {`You scored us ${feedback.scores?.overall}/5 overall.`}
            </Text>
            {feedback.comment ? (
              <Text style={styles.myComment}>{`“${feedback.comment}”`}</Text>
            ) : null}
          </View>
        ) : (
          <View style={[styles.card, styles.cardAction]}>
            <Text style={styles.cardTitle}>How was your event?</Text>
            <Text style={styles.cardSub}>
              It takes a moment and it genuinely changes what we do next time.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setShowFeedback(true)}
            >
              <Text style={styles.primaryBtnText}>Leave feedback</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* FR-PO-213 — offered, never imposed. */}
        {reviewAsk ? (
          <View style={[styles.card, styles.cardGood]}>
            <Text style={styles.goodTitle}>Would you tell others?</Text>
            <Text style={styles.cardSub}>
              {`If you have a moment, a public review on ${reviewAsk.channel} `}
              helps other people find us.
            </Text>
            {reviewAsk.url ? (
              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={() => Linking.openURL(reviewAsk.url!)}
              >
                <Text style={styles.outlineBtnText}>Leave a review</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* FR-PO-210 */}
        <TouchableOpacity
          style={styles.outlineBtn}
          onPress={() => navigation.navigate('PartyEnquiryForm', {
            rebookFromBookingId: bookingId,
          })}
        >
          <Text style={styles.outlineBtnText}>Book this again</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ---------------- query a line ---------------- */}
      <Modal visible={Boolean(queryLine)} transparent animationType="slide">
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Query this line</Text>
            <Text style={styles.sheetBody}>
              {queryLine
                ? `${queryLine.label} — ${formatMoney(queryLine.amount, 2)}`
                : ''}
            </Text>
            <Text style={styles.label}>What would you like to ask?</Text>
            <TextInput
              style={styles.textarea}
              value={queryText}
              onChangeText={setQueryText}
              placeholder="Tell us what does not look right"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <Text style={styles.cardSub}>
              This goes to the person who has been looking after your booking.
              Nothing is collected while your query is open.
            </Text>
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={() => { setQueryLine(null); setQueryText(''); }}
              >
                <Text style={styles.outlineBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, (busy || !queryText.trim()) && styles.btnOff]}
                disabled={busy || !queryText.trim()}
                onPress={submitQuery}
              >
                <Text style={styles.primaryBtnText}>Send the query</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------- leave feedback ---------------- */}
      <Modal visible={showFeedback} transparent animationType="slide">
        <View style={styles.backdrop}>
          <ScrollView contentContainerStyle={styles.sheetScroll}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>How was your event?</Text>
              <Text style={styles.sheetBody}>
                Five out of five is excellent, one is poor. Only the overall
                score is needed.
              </Text>

              {dimensions.map((d) => (
                <View key={d.key} style={styles.dimRow}>
                  <Text style={styles.dimLabel}>
                    {d.label}
                    {d.required ? '' : ' (optional)'}
                  </Text>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity
                        key={n}
                        style={[
                          styles.star,
                          (scores[d.key] ?? 0) >= n && styles.starOn,
                        ]}
                        onPress={() => setScores((s) => ({ ...s, [d.key]: n }))}
                      >
                        <Text style={[
                          styles.starText,
                          (scores[d.key] ?? 0) >= n && styles.starTextOn,
                        ]}>
                          {n}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}

              <Text style={styles.label}>Anything you would like to add?</Text>
              <TextInput
                style={styles.textarea}
                value={comment}
                onChangeText={setComment}
                placeholder="What went well, and what did not"
                placeholderTextColor={colors.textMuted}
                multiline
              />

              {/* FR-PO-207: consent is asked for separately, and defaults to no. */}
              <TouchableOpacity
                style={styles.consentRow}
                onPress={() => setConsent((c) => !c)}
              >
                <View style={[styles.checkbox, consent && styles.checkboxOn]} />
                <Text style={styles.consentText}>
                  The restaurant may use my photographs and comments to promote
                  their party service.
                </Text>
              </TouchableOpacity>

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.outlineBtn}
                  onPress={() => setShowFeedback(false)}
                >
                  <Text style={styles.outlineBtnText}>Not now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, busy && styles.btnOff]}
                  disabled={busy}
                  onPress={sendFeedback}
                >
                  <Text style={styles.primaryBtnText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Count({
  label, value, strong,
}: { label: string; value: number; strong?: boolean }) {
  return (
    <View style={[styles.count, strong && styles.countStrong]}>
      <Text style={styles.countLabel}>{label}</Text>
      <Text style={[styles.countValue, strong && styles.countValueStrong]}>
        {String(value)}
      </Text>
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
  cardAction: { borderColor: colors.accent, backgroundColor: '#FFF8F2' },
  cardInfo: { borderColor: colors.primary, backgroundColor: '#F5F7FC' },
  cardGood: { borderColor: colors.success, backgroundColor: '#F4FBF5' },
  cardBad: { borderColor: colors.danger, backgroundColor: '#FDF4F4' },

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
  badText: {
    fontSize: 13, fontWeight: '500', lineHeight: 19,
    color: colors.danger, includeFontPadding: false,
  },

  basis: {
    fontSize: 13.5, fontWeight: '500', lineHeight: 20,
    color: colors.text, includeFontPadding: false, marginTop: spacing.sm,
  },
  countRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  count: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.sm, alignItems: 'center', backgroundColor: colors.iconBg,
  },
  countStrong: { borderColor: colors.primary, backgroundColor: '#E7EEFB' },
  countLabel: {
    fontSize: 10.5, fontWeight: '700', lineHeight: 14,
    color: colors.textMuted, includeFontPadding: false, textAlign: 'center',
  },
  countValue: {
    fontSize: 20, fontWeight: '700', lineHeight: 26,
    color: colors.text, includeFontPadding: false, marginTop: 2,
  },
  countValueStrong: { color: colors.primary },

  line: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    paddingVertical: 9,
  },
  lineBody: { flex: 1 },
  lineLabel: {
    fontSize: 14, fontWeight: '500', lineHeight: 20,
    color: colors.text, includeFontPadding: false,
  },
  lineDetail: {
    fontSize: 12, fontWeight: '400', lineHeight: 17,
    color: colors.textMuted, includeFontPadding: false,
  },
  lineAmount: {
    fontSize: 14, fontWeight: '600', lineHeight: 20,
    color: colors.text, includeFontPadding: false,
  },
  subtotal: {
    flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  subtotalLabel: {
    flex: 1,
    fontSize: 12.5, fontWeight: '600', lineHeight: 18,
    color: colors.textMuted, includeFontPadding: false,
  },
  subtotalValue: {
    fontSize: 14, fontWeight: '700', lineHeight: 20,
    color: colors.text, includeFontPadding: false,
  },
  queryHint: {
    fontSize: 12.5, fontWeight: '400', lineHeight: 18,
    color: colors.textMuted, includeFontPadding: false,
    paddingHorizontal: spacing.xs,
  },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  rowLabel: {
    flex: 1,
    fontSize: 13.5, fontWeight: '400', lineHeight: 19,
    color: colors.textMuted, includeFontPadding: false,
  },
  rowValue: {
    fontSize: 13.5, fontWeight: '600', lineHeight: 19,
    color: colors.text, includeFontPadding: false,
  },
  balanceRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  balanceLabel: {
    flex: 1,
    fontSize: 14.5, fontWeight: '700', lineHeight: 20,
    color: colors.text, includeFontPadding: false,
  },
  balanceValue: {
    fontSize: 22, fontWeight: '700', lineHeight: 28,
    color: colors.primary, includeFontPadding: false,
  },
  summary: {
    fontSize: 13, fontWeight: '500', lineHeight: 19,
    color: colors.text, includeFontPadding: false, marginTop: spacing.sm,
  },

  query: {
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  queryLine: {
    fontSize: 13, fontWeight: '700', lineHeight: 18,
    color: colors.text, includeFontPadding: false,
  },
  queryText: {
    fontSize: 13, fontWeight: '400', lineHeight: 19,
    color: colors.textMuted, includeFontPadding: false, fontStyle: 'italic',
  },
  queryResponse: {
    fontSize: 13, fontWeight: '500', lineHeight: 19,
    color: colors.text, includeFontPadding: false, marginTop: 3,
  },
  queryPending: {
    fontSize: 12.5, fontWeight: '400', lineHeight: 18,
    color: colors.warning, includeFontPadding: false, marginTop: 3,
  },
  queryResolved: {
    fontSize: 12.5, fontWeight: '500', lineHeight: 18,
    color: colors.success, includeFontPadding: false, marginTop: 3,
  },
  myComment: {
    fontSize: 13, fontWeight: '400', lineHeight: 19,
    color: colors.textMuted, includeFontPadding: false,
    marginTop: spacing.sm, fontStyle: 'italic',
  },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  sheetTitle: {
    fontSize: 18, fontWeight: '700', lineHeight: 24,
    color: colors.text, includeFontPadding: false,
  },
  sheetBody: {
    fontSize: 13, fontWeight: '400', lineHeight: 19,
    color: colors.textMuted, includeFontPadding: false, marginTop: 4,
  },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },

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

  dimRow: { marginTop: spacing.md },
  dimLabel: {
    fontSize: 13.5, fontWeight: '600', lineHeight: 19,
    color: colors.text, includeFontPadding: false, marginBottom: spacing.xs,
  },
  starRow: { flexDirection: 'row', gap: spacing.sm },
  star: {
    flex: 1, paddingVertical: 11, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  starOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  starText: {
    fontSize: 15, fontWeight: '700', lineHeight: 21,
    color: colors.textMuted, includeFontPadding: false,
  },
  starTextOn: { color: colors.surface },

  consentRow: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    marginTop: spacing.md,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, marginTop: 1,
    borderWidth: 1, borderColor: colors.border,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  consentText: {
    flex: 1,
    fontSize: 12.5, fontWeight: '400', lineHeight: 18,
    color: colors.textMuted, includeFontPadding: false,
  },

  primaryBtn: {
    flex: 1, backgroundColor: colors.accent, borderRadius: radius.sm,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.md,
  },
  primaryBtnText: {
    fontSize: 15, fontWeight: '700', lineHeight: 21,
    color: colors.surface, includeFontPadding: false,
  },
  outlineBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.sm,
    paddingVertical: 13, alignItems: 'center', marginTop: spacing.md,
  },
  outlineBtnText: {
    fontSize: 14.5, fontWeight: '600', lineHeight: 20,
    color: colors.primary, includeFontPadding: false,
  },
  btnOff: { opacity: 0.6 },
});

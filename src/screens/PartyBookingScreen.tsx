/**
 * Your confirmed party booking — BRD groups H, I and J on the customer side.
 *
 * The screen answers, in order, the three things a customer who has just
 * committed money wants to know:
 *
 *   1. What do I need to do? (pay the next milestone, or confirm the count)
 *   2. What am I committed to? The guaranteed minimum, and the fact that a
 *      lower count does not reduce the bill (FR-PO-123) — stated plainly
 *      here rather than left in the terms, because it is the single term
 *      customers most often misread.
 *   3. What have I paid, and where are my receipts? (FR-PO-134/216)
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
import { colors, radius, spacing, statusColors } from '../theme';
import {
  BOOKING_STATUS_HINT, MEAL_PERIOD_LABEL, SERVICE_MODE_LABEL,
  type PartyBooking,
  bookingNextStep, confirmPartyFinalCount, fetchPartyBooking,
  formatMoney, requestPartyPaymentLink, timeLeft,
  // Group K (FR-PO-170..179): asking to cancel or change, and seeing where a
  // refund has got to.
  type PartyChange,
  type PartyRefund,
  type PartySettlement,
  changeNextStep,
  getPartySettlement,
  confirmPartyChange,
  getPartyChanges,
  getPartyRefunds,
  refundReassurance,
} from '../api/party';

type Props = NativeStackScreenProps<AppStackParamList, 'PartyBooking'>;

export default function PartyBookingScreen({ navigation, route }: Props) {
  const { bookingId } = route.params;

  const [booking, setBooking] = useState<PartyBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showCount, setShowCount] = useState(false);
  const [countDraft, setCountDraft] = useState('');

  /* Group K. Loaded with the booking rather than on a tab, because a change
     awaiting the customer's confirmation and a refund in flight are both
     things they need to see without going looking. */
  const [changes, setChanges] = useState<PartyChange[]>([]);
  const [refunds, setRefunds] = useState<PartyRefund[]>([]);
  /* Groups L and M: the event is worth watching while it is on, and the final
     bill is the thing the customer comes back for afterwards. */
  const [settlement, setSettlement] = useState<PartySettlement | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [b, c, r, s] = await Promise.all([
        fetchPartyBooking(bookingId),
        getPartyChanges(bookingId).catch(() => []),
        getPartyRefunds(bookingId).catch(() => []),
        getPartySettlement(bookingId).catch(() => ({ settlement: null, message: null })),
      ]);
      setBooking(b);
      setChanges(c);
      setRefunds(r);
      setSettlement(s.settlement);
    } catch (err: any) {
      setError(err.message || 'Could not load your booking');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /** FR-PO-135/136: ask for a link, then hand the customer to the gateway. */
  const pay = async (payFull = false, milestoneId?: string) => {
    setBusy(true);
    try {
      const link = await requestPartyPaymentLink(bookingId, {
        pay_full: payFull || undefined,
        milestone_id: milestoneId,
      });
      if (link.pay_url) {
        Linking.openURL(link.pay_url);
      } else {
        Alert.alert('Payment link ready', 'Please check your messages for the link.');
      }
    } catch (err: any) {
      // The honest case: there is no gateway to pay through.
      if (err.code === 'PARTY_GATEWAY_UNAVAILABLE') {
        Alert.alert('Online payment unavailable', err.message);
      } else {
        Alert.alert('Could not start the payment', err.message || 'Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  /** FR-PO-122: revise the count, until the deadline. */
  const submitCount = async () => {
    const n = Number(countDraft);
    if (!Number.isInteger(n) || n < 1) {
      Alert.alert('Enter a number', 'How many guests are you expecting?');
      return;
    }
    setBusy(true);
    try {
      const r = await confirmPartyFinalCount(bookingId, n);
      setShowCount(false);
      Alert.alert('Thank you', r.message);
      load();
    } catch (err: any) {
      if (err.code === 'PARTY_HEADCOUNT_LOCKED') {
        setShowCount(false);
        Alert.alert('The deadline has passed', err.message);
      } else {
        Alert.alert('Could not update the count', err.message || 'Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Your booking" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Your booking" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || 'This booking could not be found.'}</Text>
        </View>
      </View>
    );
  }

  const position = booking.payment_position;
  const nextStep = bookingNextStep(booking);
  const g = booking.guests;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={booking.booking_no}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
          />
        }
      >
        {/* ---------------- status ---------------- */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>{booking.booking_status_label}</Text>
          <Text style={styles.statusHint}>
            {BOOKING_STATUS_HINT[booking.booking_status]
              || booking.financial_status_label}
          </Text>
        </View>

        {/* ---------------- the one thing to do ---------------- */}
        {nextStep ? (
          <View style={styles.ctaCard}>
            <Text style={styles.ctaTitle}>{nextStep.title}</Text>
            <Text style={styles.ctaBody}>{nextStep.body}</Text>
            {nextStep.action === 'PAY' ? (
              <View style={styles.ctaRow}>
                <TouchableOpacity
                  style={styles.ctaBtn}
                  activeOpacity={0.85}
                  disabled={busy}
                  onPress={() => pay(false, position.next_due?.milestone_id)}
                >
                  <Text style={styles.ctaBtnText}>
                    {`Pay ${formatMoney(position.next_due?.amount ?? 0, 2)}`}
                  </Text>
                </TouchableOpacity>
                {/* FR-PO-132: paying in full, where the restaurant offers it. */}
                {position.full_payment_offered
                  && position.amount_outstanding > (position.next_due?.amount ?? 0) ? (
                    <TouchableOpacity
                      style={styles.ctaOutlineBtn}
                      activeOpacity={0.8}
                      disabled={busy}
                      onPress={() => pay(true)}
                    >
                      <Text style={styles.ctaOutlineBtnText}>
                        {`Pay all ${formatMoney(position.amount_outstanding, 2)}`}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
              </View>
            ) : null}
            {nextStep.action === 'CONFIRM_COUNT' ? (
              <TouchableOpacity
                style={styles.ctaBtn}
                activeOpacity={0.85}
                onPress={() => {
                  setCountDraft(String(g.final ?? g.quoted));
                  setShowCount(true);
                }}
              >
                <Text style={styles.ctaBtnText}>Confirm my guest count</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* ---------------- guest count (FR-PO-121/122/123) ---------------- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your guest count</Text>
          <View style={styles.countGrid}>
            <View style={styles.countCell}>
              <Text style={styles.countLabel}>Quoted</Text>
              <Text style={styles.countValue}>{g.quoted}</Text>
            </View>
            <View style={styles.countCell}>
              <Text style={styles.countLabel}>Guaranteed</Text>
              <Text style={styles.countValue}>{g.guaranteed}</Text>
            </View>
            <View style={styles.countCell}>
              <Text style={styles.countLabel}>You confirmed</Text>
              <Text style={styles.countValue}>{g.final ?? '—'}</Text>
            </View>
          </View>

          {/* The term customers most often misread, said plainly. */}
          <View style={styles.guaranteeBox}>
            <Text style={styles.guaranteeText}>{g.note}</Text>
          </View>

          {g.locked ? (
            <Text style={styles.cardHint}>
              {`Your count is locked at ${g.final ?? g.guaranteed} and our kitchen is working to it. `}
              Contact your event contact if you need to add guests — an increase may carry a
              surcharge.
            </Text>
          ) : g.final_count_deadline ? (
            <>
              <Text style={styles.cardHint}>
                {`You can change it until ${new Date(g.final_count_deadline).toLocaleString()}`}
                {timeLeft(g.final_count_deadline) ? ` — ${timeLeft(g.final_count_deadline)}.` : '.'}
              </Text>
              <TouchableOpacity
                style={styles.outlineBtn}
                activeOpacity={0.8}
                onPress={() => {
                  setCountDraft(String(g.final ?? g.quoted));
                  setShowCount(true);
                }}
              >
                <Text style={styles.outlineBtnText}>
                  {g.final ? 'Change my guest count' : 'Confirm my guest count'}
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>

        {/* ---------------- the event ---------------- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your event</Text>
          <Row
            label="When"
            value={`${new Date(`${String(booking.event.date).slice(0, 10)}T00:00:00`)
              .toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`
              + (booking.event.start_time ? ` at ${String(booking.event.start_time).slice(0, 5)}` : '')}
          />
          <Row label="Served" value={SERVICE_MODE_LABEL[booking.event.service_mode]} />
          {booking.event.meal_period ? (
            <Row label="Meal" value={MEAL_PERIOD_LABEL[booking.event.meal_period]} />
          ) : null}
          {booking.event.venue ? <Row label="Where" value={booking.event.venue} /> : null}
          {booking.event.address ? <Row label="Address" value={booking.event.address} /> : null}
          {/* FR-PO-126: the times the restaurant's teams work to. */}
          {booking.event.setup_time || booking.event.serving_time ? (
            <Row
              label="Our timings"
              value={[
                booking.event.setup_time ? `setup ${String(booking.event.setup_time).slice(0, 5)}` : null,
                booking.event.serving_time ? `serving ${String(booking.event.serving_time).slice(0, 5)}` : null,
                booking.event.clearance_time ? `clearance ${String(booking.event.clearance_time).slice(0, 5)}` : null,
              ].filter(Boolean).join(' · ')}
            />
          ) : null}
          {booking.venue_contact ? (
            <Row
              label="Contact at the venue"
              value={`${booking.venue_contact.name}${booking.venue_contact.mobile ? ` · ${booking.venue_contact.mobile}` : ''}`}
            />
          ) : null}
        </View>

        {/* ---------------- what you have paid (FR-PO-134) ---------------- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payments</Text>
          <View style={styles.moneyRow}>
            <View style={styles.moneyCell}>
              <Text style={styles.moneyLabel}>Total</Text>
              <Text style={styles.moneyValue}>{formatMoney(position.order_value, 2)}</Text>
            </View>
            <View style={styles.moneyCell}>
              <Text style={styles.moneyLabel}>Paid</Text>
              <Text style={styles.moneyValuePaid}>{formatMoney(position.amount_paid, 2)}</Text>
            </View>
            <View style={styles.moneyCell}>
              <Text style={styles.moneyLabel}>Outstanding</Text>
              <Text style={styles.moneyValue}>{formatMoney(position.amount_outstanding, 2)}</Text>
            </View>
          </View>

          {position.milestones.map((m) => (
            <View key={m.milestone_id} style={styles.msRow}>
              <View style={styles.msMain}>
                <Text style={styles.msName}>{m.name}</Text>
                <Text style={styles.msMeta}>
                  {m.due_label || (m.due_date ? `Due ${String(m.due_date).slice(0, 10)}` : '')}
                  {m.paid_amount > 0 && m.status !== 'PAID'
                    ? ` · ${formatMoney(m.paid_amount, 2)} received`
                    : ''}
                </Text>
              </View>
              <View style={styles.msSide}>
                <Text style={styles.msAmount}>{formatMoney(m.amount, 2)}</Text>
                <View
                  style={[
                    styles.msPill,
                    {
                      backgroundColor: m.status === 'PAID' ? statusColors.CLOSED.bg
                        : m.is_overdue ? statusColors.CANCELLED.bg : statusColors.OPEN.bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.msPillText,
                      {
                        color: m.status === 'PAID' ? statusColors.CLOSED.fg
                          : m.is_overdue ? statusColors.CANCELLED.fg : statusColors.OPEN.fg,
                      },
                    ]}
                  >
                    {m.status === 'PAID' ? 'Paid'
                      : m.status === 'WAIVED' ? 'Waived'
                        : m.is_overdue ? 'Overdue'
                          : m.status === 'PARTIAL' ? 'Part paid' : 'Due'}
                  </Text>
                </View>
              </View>
              {m.status !== 'PAID' && m.status !== 'WAIVED' ? (
                <TouchableOpacity
                  style={styles.msPayBtn}
                  activeOpacity={0.8}
                  disabled={busy}
                  onPress={() => pay(false, m.milestone_id)}
                >
                  <Text style={styles.msPayBtnText}>Pay</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}

          {/* FR-PO-143: reported apart, so it is clear it comes back. */}
          {position.deposit.required > 0 ? (
            <View style={styles.depositBox}>
              <Text style={styles.depositTitle}>Refundable security deposit</Text>
              <Text style={styles.depositBody}>
                {`${formatMoney(position.deposit.paid, 2)} of `}
                {`${formatMoney(position.deposit.required, 2)} held`}
                {position.deposit.returned > 0
                  ? ` · ${formatMoney(position.deposit.returned, 2)} returned` : ''}
                {position.deposit.forfeited > 0
                  ? ` · ${formatMoney(position.deposit.forfeited, 2)} retained` : ''}
              </Text>
              <Text style={styles.depositNote}>
                Held separately from your order value and returned after the event, less any
                shortages.
              </Text>
            </View>
          ) : null}
        </View>

        {/* ---------------- documents (FR-PO-216) ---------------- */}
        {booking.documents.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your documents</Text>
            <Text style={styles.cardHint}>
              A receipt voucher is issued for every advance you pay. Your tax invoice is issued
              after the event and adjusts the advances you have already paid.
            </Text>
            {booking.documents.map((d) => (
              <TouchableOpacity
                key={d.document_id}
                style={styles.docRow}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('PartyDocument', { documentId: d.document_id })}
              >
                <View style={styles.docMain}>
                  <Text style={styles.docLabel}>{d.doc_label}</Text>
                  <Text style={styles.docMeta}>
                    {`${d.doc_number} · ${new Date(d.issued_at).toLocaleDateString()}`}
                  </Text>
                </View>
                <Text style={styles.docValue}>{formatMoney(d.total_value, 2)}</Text>
                <Text style={styles.docArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* ---------------- progress ---------------- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Progress</Text>
          {booking.timeline.map((t, i) => {
            const last = i === booking.timeline.length - 1;
            return (
              <View key={t.history_id} style={styles.tlRow}>
                <View style={styles.tlRail}>
                  <View style={[styles.tlDot, last && styles.tlDotLast]} />
                  {!last ? <View style={styles.tlLine} /> : null}
                </View>
                <View style={styles.tlBody}>
                  <Text style={[styles.tlLabel, last && styles.tlLabelLast]}>{t.label}</Text>
                  <Text style={styles.tlWhen}>{new Date(t.changed_at).toLocaleString()}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ---------------- group K: a change awaiting me (FR-PO-169) ------ */}
        {changes.filter((c) => c.status !== 'WITHDRAWN').map((c) => {
          const step = changeNextStep(c);
          if (!step) return null;
          return (
            <View
              key={c.amendment_id}
              style={[styles.card, step.action ? styles.cardAction : null]}
            >
              <Text style={styles.cardTitle}>{step.title}</Text>
              <Text style={styles.cardHint}>{step.body}</Text>

              {c.changes.map((ch, i) => (
                <Text key={`${c.amendment_id}-${ch.field}-${i}`} style={styles.changeLine}>
                  {`${ch.label}: ${ch.from ?? '\u2014'} \u2192 ${ch.to ?? '\u2014'}`}
                </Text>
              ))}

              {step.action === 'CONFIRM' ? (
                <TouchableOpacity
                  style={[styles.ctaBtn, busy && styles.btnOff]}
                  disabled={busy}
                  onPress={async () => {
                    setBusy(true);
                    try {
                      await confirmPartyChange(c.amendment_id);
                      await load();
                      Alert.alert(
                        'Thank you',
                        'The restaurant will now apply the change.',
                      );
                    } catch (err: any) {
                      Alert.alert('Could not confirm that', err.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Text style={styles.ctaBtnText}>Confirm the revised terms</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        {/* ---------------- group K: a refund in flight (FR-PO-178/179) ---- */}
        {refunds.length > 0 ? (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('PartyCancel', { bookingId })}
          >
            <Text style={styles.cardTitle}>Your refund</Text>
            {refunds.map((r) => {
              const says = refundReassurance(r);
              return (
                <View key={r.refund_id} style={styles.refundRow}>
                  <Text style={styles.refundAmount}>{formatMoney(r.amount, 2)}</Text>
                  <View style={styles.refundBody}>
                    <Text style={styles.refundTitle}>{says.title}</Text>
                    <Text style={styles.refundNote}>{says.body}</Text>
                  </View>
                </View>
              );
            })}
            <Text style={styles.cardHint}>Tap to see every step and when it is expected.</Text>
          </TouchableOpacity>
        ) : null}

        {/* ---------------- terms ---------------- */}
        {booking.terms_text || booking.cancellation_policy_text ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Terms for this booking</Text>
            {booking.terms_text ? (
              <Text style={styles.termsBody}>{booking.terms_text}</Text>
            ) : null}
            {booking.cancellation_policy_text ? (
              <>
                <Text style={styles.termsHeading}>Cancellation</Text>
                <Text style={styles.termsBody}>{booking.cancellation_policy_text}</Text>
              </>
            ) : null}
            <Text style={styles.cardHint}>
              These are the terms as they stood when you accepted, kept with your booking.
            </Text>
          </View>
        ) : null}

        {/* ---------------- group L: watch it happen (FR-PO-197) ---------- */}
        {['LOCKED_FOR_PRODUCTION', 'IN_PRODUCTION', 'DISPATCHED', 'IN_SERVICE']
          .includes(booking.booking_status) ? (
            <TouchableOpacity
              style={[styles.card, styles.cardAction]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('PartyEvent', { bookingId })}
            >
              <Text style={styles.cardTitle}>Follow your event</Text>
              <Text style={styles.cardHint}>
                {booking.booking_status === 'DISPATCHED'
                  ? 'Your order is on the way — see where it is.'
                  : 'See how your event is progressing, stage by stage.'}
              </Text>
            </TouchableOpacity>
          ) : null}

        {/* ---------------- group M: the final bill (FR-PO-200) ----------- */}
        {settlement ? (
          <TouchableOpacity
            style={[
              styles.card,
              settlement.can_agree ? styles.cardAction : null,
            ]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('PartySettlement', { bookingId })}
          >
            <Text style={styles.cardTitle}>
              {settlement.status === 'SETTLED' ? 'Your final bill' : 'Your final bill is ready'}
            </Text>
            <Text style={styles.cardHint}>{settlement.statement.summary}</Text>
            {settlement.can_agree ? (
              <Text style={styles.settlePrompt}>
                Tap to look it over and agree it. You can query any line.
              </Text>
            ) : null}
          </TouchableOpacity>
        ) : booking.booking_status === 'COMPLETED' ? (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('PartySettlement', { bookingId })}
          >
            <Text style={styles.cardTitle}>How was your event?</Text>
            <Text style={styles.cardHint}>
              Leave feedback, and see your final bill when it is ready.
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* ---------------- group K: the way out (FR-PO-170/173) ---------- */}
        {!['COMPLETED', 'CANCELLED'].includes(booking.booking_status) ? (
          <TouchableOpacity
            style={styles.cancelLink}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('PartyCancel', { bookingId })}
          >
            <Text style={styles.cancelLinkText}>
              {refunds.length ? 'Cancellation and refund' : 'I need to cancel this booking'}
            </Text>
            <Text style={styles.cancelLinkHint}>
              We will show you exactly what comes back before you decide.
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* ---------------- confirm the count ---------------- */}
      <Modal visible={showCount} transparent animationType="slide">
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>How many guests?</Text>
            <Text style={styles.sheetBody}>
              {`We will prepare for this number. You are billed on the higher of it and the `
              + `guaranteed minimum of ${g.guaranteed}, so a lower number will not reduce your bill.`}
            </Text>
            <TextInput
              style={styles.input}
              value={countDraft}
              onChangeText={setCountDraft}
              keyboardType="numeric"
              placeholder={String(g.quoted)}
              placeholderTextColor={colors.textMuted}
            />
            {Number(countDraft) > 0 && Number(countDraft) < g.guaranteed ? (
              <View style={styles.warnBox}>
                <Text style={styles.warnText}>
                  {`That is below your guaranteed ${g.guaranteed}. You will still be billed on `
                  + `${g.guaranteed}.`}
                </Text>
              </View>
            ) : null}
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.outlineBtn}
                activeOpacity={0.8}
                onPress={() => setShowCount(false)}
              >
                <Text style={styles.outlineBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ctaBtn, busy && styles.btnOff]}
                activeOpacity={0.85}
                disabled={busy}
                onPress={submitCount}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <Text style={styles.ctaBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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

const styles = StyleSheet.create({
  /* group K: a change awaiting confirmation, a refund in flight, and the
     way out of the booking */
  cardAction: { borderColor: colors.accent, backgroundColor: '#FFF8F2' },
  changeLine: {
    fontSize: 13, fontWeight: '500', lineHeight: 19,
    color: colors.text, includeFontPadding: false, marginTop: spacing.xs,
  },
  refundRow: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm,
  },
  refundAmount: {
    fontSize: 16, fontWeight: '700', lineHeight: 22,
    color: colors.text, includeFontPadding: false, minWidth: 90,
  },
  refundBody: { flex: 1 },
  refundTitle: {
    fontSize: 13.5, fontWeight: '600', lineHeight: 19,
    color: colors.text, includeFontPadding: false,
  },
  refundNote: {
    fontSize: 12.5, fontWeight: '400', lineHeight: 18,
    color: colors.textMuted, includeFontPadding: false,
  },
  cancelLink: {
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelLinkText: {
    fontSize: 14.5, fontWeight: '600', lineHeight: 20,
    color: colors.danger, includeFontPadding: false,
  },
  settlePrompt: {
    fontSize: 12.5, fontWeight: '600', lineHeight: 18,
    color: colors.accent, includeFontPadding: false, marginTop: spacing.xs,
  },
  cancelLinkHint: {
    fontSize: 12.5, fontWeight: '400', lineHeight: 18,
    color: colors.textMuted, includeFontPadding: false, marginTop: 2,
  },
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center', includeFontPadding: false },

  statusCard: {
    backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.md, gap: 3,
  },
  statusLabel: { fontSize: 18, fontWeight: '800', color: colors.surface, includeFontPadding: false },
  statusHint: { fontSize: 12.5, color: colors.surface, opacity: 0.9, lineHeight: 18, includeFontPadding: false },

  ctaCard: {
    backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md, gap: 6,
  },
  ctaTitle: { fontSize: 16, fontWeight: '800', color: colors.text, includeFontPadding: false },
  ctaBody: { fontSize: 13.5, color: colors.text, lineHeight: 19, includeFontPadding: false },
  ctaRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  ctaBtn: {
    flex: 1, minWidth: 140, backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
  },
  ctaBtnText: { fontSize: 14.5, fontWeight: '700', color: colors.surface, includeFontPadding: false },
  ctaOutlineBtn: {
    flex: 1, minWidth: 140, borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center',
  },
  ctaOutlineBtnText: { fontSize: 13.5, fontWeight: '700', color: colors.primary, includeFontPadding: false },
  btnOff: { opacity: 0.6 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 9,
  },
  cardTitle: { fontSize: 15.5, fontWeight: '700', color: colors.text, includeFontPadding: false },
  cardHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17, includeFontPadding: false },

  countGrid: { flexDirection: 'row', gap: spacing.sm },
  countCell: { flex: 1, alignItems: 'center', gap: 1 },
  countLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, includeFontPadding: false },
  countValue: { fontSize: 24, fontWeight: '800', color: colors.text, includeFontPadding: false },
  guaranteeBox: {
    backgroundColor: colors.iconBg, borderRadius: radius.sm, padding: spacing.sm,
  },
  guaranteeText: { fontSize: 12.5, fontWeight: '600', color: colors.text, lineHeight: 18, includeFontPadding: false },

  row: { gap: 1 },
  rowLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', includeFontPadding: false },
  rowValue: { fontSize: 14, color: colors.text, lineHeight: 20, includeFontPadding: false },

  moneyRow: { flexDirection: 'row', gap: spacing.sm },
  moneyCell: { flex: 1, gap: 1 },
  moneyLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, includeFontPadding: false },
  moneyValue: { fontSize: 16, fontWeight: '700', color: colors.text, includeFontPadding: false },
  moneyValuePaid: { fontSize: 16, fontWeight: '700', color: statusColors.CLOSED.fg, includeFontPadding: false },

  msRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9,
  },
  msMain: { flex: 1, gap: 1 },
  msName: { fontSize: 13.5, fontWeight: '600', color: colors.text, includeFontPadding: false },
  msMeta: { fontSize: 11.5, color: colors.textMuted, includeFontPadding: false },
  msSide: { alignItems: 'flex-end', gap: 3 },
  msAmount: { fontSize: 14, fontWeight: '700', color: colors.text, includeFontPadding: false },
  msPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  msPillText: { fontSize: 10.5, fontWeight: '700', includeFontPadding: false },
  msPayBtn: {
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  msPayBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.surface, includeFontPadding: false },

  depositBox: {
    backgroundColor: colors.iconBg, borderRadius: radius.md, padding: spacing.sm, gap: 3,
  },
  depositTitle: { fontSize: 13, fontWeight: '700', color: colors.text, includeFontPadding: false },
  depositBody: { fontSize: 12.5, color: colors.text, includeFontPadding: false },
  depositNote: { fontSize: 11.5, color: colors.textMuted, lineHeight: 16, includeFontPadding: false },

  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9,
  },
  docMain: { flex: 1, gap: 1 },
  docLabel: { fontSize: 13.5, fontWeight: '600', color: colors.text, includeFontPadding: false },
  docMeta: { fontSize: 11.5, color: colors.textMuted, includeFontPadding: false },
  docValue: { fontSize: 13.5, fontWeight: '700', color: colors.text, includeFontPadding: false },
  docArrow: { fontSize: 20, color: colors.textMuted, includeFontPadding: false },

  tlRow: { flexDirection: 'row', gap: spacing.sm },
  tlRail: { width: 14, alignItems: 'center' },
  tlDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.border, marginTop: 5 },
  tlDotLast: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  tlLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  tlBody: { flex: 1, paddingBottom: 13, gap: 1 },
  tlLabel: { fontSize: 13.5, fontWeight: '600', color: colors.textMuted, includeFontPadding: false },
  tlLabelLast: { color: colors.text, fontWeight: '700' },
  tlWhen: { fontSize: 11.5, color: colors.textMuted, includeFontPadding: false },

  termsHeading: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 3, includeFontPadding: false },
  termsBody: { fontSize: 12.5, color: colors.textMuted, lineHeight: 19, includeFontPadding: false },

  outlineBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.pill,
    paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  outlineBtnText: { fontSize: 13.5, fontWeight: '700', color: colors.primary, includeFontPadding: false },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.md, gap: spacing.sm,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text, includeFontPadding: false },
  sheetBody: { fontSize: 13, color: colors.textMuted, lineHeight: 19, includeFontPadding: false },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs },
  input: {
    height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, fontSize: 18, fontWeight: '700', color: colors.text,
    textAlign: 'center',
    includeFontPadding: false,
  },
  warnBox: {
    backgroundColor: statusColors.OPEN.bg, borderRadius: radius.sm, padding: spacing.sm,
  },
  warnText: { fontSize: 12.5, fontWeight: '600', color: statusColors.OPEN.fg, lineHeight: 18, includeFontPadding: false },
});

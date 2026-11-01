/**
 * The quotation, as the customer receives it — BRD group G plus FR-PO-100.
 *
 * FR-PO-100 is explicit and this screen obeys it literally: "present the
 * quotation IN FULL, with every line, charge and tax visible, and shall NOT
 * summarise the itemisation." So every line is rendered with its own quantity,
 * rate, tax and total — there is no "view details" to tap through.
 *
 * The three responses FR-PO-101 allows are given equal weight: accept, ask
 * for changes, or decline. Accepting requires the terms to be acknowledged in
 * the same action (FR-PO-109), and the result says plainly that the booking
 * is not yet confirmed — BRD 4.2.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, RefreshControl, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing, statusColors } from '../theme';
import {
  MEAL_PERIOD_LABEL, SERVICE_MODE_LABEL,
  type PartyQuotation, type PartyQuotationLine,
  acceptPartyQuotation, declinePartyQuotation, fetchPartyQuotation,
  formatMoney, postPartyMessage, requestPartyChanges, timeLeft,
} from '../api/party';

type Props = NativeStackScreenProps<AppStackParamList, 'PartyQuotation'>;

export default function PartyQuotationScreen({ navigation, route }: Props) {
  const { quotationId } = route.params;

  const [quote, setQuote] = useState<PartyQuotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Accept
  const [showAccept, setShowAccept] = useState(false);
  const [termsOk, setTermsOk] = useState(false);

  // Ask for changes (FR-PO-102)
  const [showChanges, setShowChanges] = useState(false);
  const [generalComment, setGeneralComment] = useState('');
  const [lineComments, setLineComments] = useState<Record<string, string>>({});
  const [proposedGuests, setProposedGuests] = useState('');
  const [proposedDate, setProposedDate] = useState('');
  const [proposedMenu, setProposedMenu] = useState('');

  // Decline (FR-PO-112)
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declineNote, setDeclineNote] = useState('');

  // Message thread
  const [messageDraft, setMessageDraft] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setQuote(await fetchPartyQuotation(quotationId));
    } catch (err: any) {
      setError(err.message || 'Could not load this quotation');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [quotationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = quote?.status === 'ISSUED' && !quote.is_expired;

  const groupedLines = useMemo(() => {
    if (!quote) return { food: [], addons: [], charges: [] };
    return {
      food: quote.lines.filter((l) => l.line_type === 'PACKAGE' || l.line_type === 'ITEM'),
      addons: quote.lines.filter((l) => l.line_type === 'ADDON'),
      charges: quote.lines.filter((l) => l.line_type === 'CHARGE'),
    };
  }, [quote]);

  /* ---------------- actions ---------------- */

  const accept = async () => {
    if (!termsOk) return;
    setBusy(true);
    try {
      const result = await acceptPartyQuotation(quotationId, true);
      setShowAccept(false);
      Alert.alert(
        'Thank you',
        result.message
        + `\n\nAdvance to confirm: ${formatMoney(result.quotation.min_advance_amount, 2)}`,
      );
      load();
    } catch (err: any) {
      Alert.alert('Could not accept', err.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendChanges = async () => {
    const comments = Object.entries(lineComments)
      .filter(([, v]) => v.trim())
      .map(([line_id, comment]) => ({ line_id, comment: comment.trim() }));

    if (!generalComment.trim() && !comments.length
        && !proposedGuests.trim() && !proposedDate.trim() && !proposedMenu.trim()) {
      Alert.alert('Tell them what to change', 'Add a comment or propose a different date or count.');
      return;
    }

    setBusy(true);
    try {
      await requestPartyChanges(quotationId, {
        general_comment: generalComment.trim() || undefined,
        line_comments: comments.length ? comments : undefined,
        proposed_guest_count: proposedGuests.trim() ? Number(proposedGuests) : null,
        proposed_event_date: proposedDate.trim() || null,
        proposed_menu_note: proposedMenu.trim() || null,
      });
      setShowChanges(false);
      setGeneralComment('');
      setLineComments({});
      setProposedGuests('');
      setProposedDate('');
      setProposedMenu('');
      Alert.alert(
        'Request sent',
        'The restaurant will respond with a revised quotation. Both versions stay here, so you '
        + 'can compare them.',
      );
      load();
    } catch (err: any) {
      Alert.alert('Could not send the request', err.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      await declinePartyQuotation(quotationId, declineReason || undefined, declineNote.trim() || undefined);
      setShowDecline(false);
      Alert.alert('Response sent', 'Thank you for letting the restaurant know.');
      load();
    } catch (err: any) {
      Alert.alert('Could not decline', err.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Quotation" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  if (!quote) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Quotation" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || 'This quotation could not be found.'}</Text>
        </View>
      </View>
    );
  }

  const renderLine = (l: PartyQuotationLine) => (
    <View key={l.line_id} style={styles.lineRow}>
      <View style={styles.lineMain}>
        <Text style={styles.lineName}>
          {l.name}
          {l.is_optional ? <Text style={styles.optional}>  optional</Text> : null}
        </Text>
        <Text style={styles.lineBasis}>
          {l.pricing_unit === 'PER_HEAD'
            ? `${formatMoney(l.unit_price, 2)} per head × ${Number(l.quantity)} guests`
            : l.pricing_unit === 'PER_UNIT'
              ? `${formatMoney(l.unit_price, 2)} × ${Number(l.quantity)}`
              : formatMoney(l.unit_price, 2)}
        </Text>

        {/* FR-PO-005: what was chosen within the package, course by course. */}
        {l.courses?.length ? (
          <View style={styles.lineCourses}>
            {l.courses.map((c) => (
              <Text key={c.course_id} style={styles.lineCourse}>
                <Text style={styles.lineCourseName}>{`${c.course_name}: `}</Text>
                {c.selected?.length
                  ? c.selected.map((s) => s.item_name).filter(Boolean).join(', ')
                  : 'to be chosen'}
              </Text>
            ))}
          </View>
        ) : null}

        {/* FR-PO-009: allergens, before the order is confirmed. */}
        {l.allergens?.length ? (
          <Text style={styles.allergenLine}>{`Contains: ${l.allergens.join(', ')}`}</Text>
        ) : null}

        {l.discount_amount > 0 ? (
          <Text style={styles.lineDiscount}>{`Discount −${formatMoney(l.discount_amount, 2)}`}</Text>
        ) : null}
        {l.tax_amount > 0 ? (
          <Text style={styles.lineTax}>
            {`Tax at ${Number(l.tax_rate)}% — ${formatMoney(l.tax_amount, 2)}`}
          </Text>
        ) : null}

        {/* FR-PO-102: comment on this specific line. */}
        {open && showChanges ? (
          <TextInput
            style={styles.lineCommentInput}
            value={lineComments[l.line_id] || ''}
            onChangeText={(v) => setLineComments((prev) => ({ ...prev, [l.line_id]: v }))}
            placeholder="Something to change about this line?"
            placeholderTextColor={colors.textMuted}
          />
        ) : null}
      </View>
      <Text style={styles.lineTotal}>{formatMoney(l.line_total, 2)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={`${quote.quotation_no} · v${quote.version}`}
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
        {/* ---------------- validity and hold (FR-PO-238) ---------------- */}
        {open ? (
          <View style={styles.validityCard}>
            <Text style={styles.validityTitle}>
              {timeLeft(quote.valid_until) || 'This quotation is open'}
            </Text>
            {quote.date_held_until ? (
              <Text style={styles.validityBody}>
                {`Your date is held until ${new Date(quote.date_held_until).toLocaleString()}. `}
                After that it goes back on the restaurant's calendar.
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.closedCard}>
            <Text style={styles.closedTitle}>{quote.status_label}</Text>
            {quote.is_expired ? (
              <Text style={styles.closedBody}>
                This quotation has expired and the date is no longer held. Ask your contact to
                reissue it.
              </Text>
            ) : null}
            {quote.status === 'ACCEPTED' ? (
              <Text style={styles.closedBody}>
                {`You accepted this on ${quote.accepted_at ? new Date(quote.accepted_at).toLocaleDateString() : ''}. `}
                {`Your booking is confirmed once the advance of ${formatMoney(quote.min_advance_amount, 2)} is received.`}
              </Text>
            ) : null}
          </View>
        )}

        {/* ---------------- what changed (FR-PO-090) ---------------- */}
        {quote.change_summary?.length ? (
          <View style={styles.changeCard}>
            <Text style={styles.changeTitle}>What changed from the last version</Text>
            {quote.change_summary.map((c, i) => (
              <Text key={i} style={styles.changeLine}>
                {`• ${c.label}`}
                {c.from != null ? `: ${c.from} → ${c.to ?? ''}` : c.to != null ? `: ${c.to}` : ''}
                {c.amount ? ` (${c.amount})` : ''}
              </Text>
            ))}
          </View>
        ) : null}

        {/* ---------------- the event ---------------- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quoted for</Text>
          <Text style={styles.eventLine}>
            {`${quote.guest_count} guests`}
            {`  ·  ${new Date(`${String(quote.event_date).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`}
            {quote.event_start_time ? `  ·  ${String(quote.event_start_time).slice(0, 5)}` : ''}
          </Text>
          <Text style={styles.eventSub}>
            {SERVICE_MODE_LABEL[quote.service_mode]}
            {quote.meal_period ? `  ·  ${MEAL_PERIOD_LABEL[quote.meal_period]}` : ''}
            {quote.venue_name ? `  ·  ${quote.venue_name}` : ''}
          </Text>
        </View>

        {/* ---------------- the itemisation, in full ---------------- */}
        {groupedLines.food.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Food</Text>
            {groupedLines.food.map(renderLine)}
          </View>
        ) : null}

        {groupedLines.addons.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add-ons</Text>
            {groupedLines.addons.map(renderLine)}
          </View>
        ) : null}

        {groupedLines.charges.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Other charges</Text>
            {groupedLines.charges.map(renderLine)}
          </View>
        ) : null}

        {/* ---------------- totals ---------------- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Total</Text>
          <TotalRow label="Food" value={formatMoney(quote.food_value, 2)} />
          {quote.addon_value > 0 ? (
            <TotalRow label="Add-ons" value={formatMoney(quote.addon_value, 2)} />
          ) : null}
          {quote.charges_value > 0 ? (
            <TotalRow label="Other charges" value={formatMoney(quote.charges_value, 2)} />
          ) : null}
          {quote.discount_amount > 0 ? (
            <TotalRow label="Discount" value={`−${formatMoney(quote.discount_amount, 2)}`} />
          ) : null}
          <TotalRow label="Before tax" value={formatMoney(quote.taxable_value, 2)} />
          <TotalRow
            label={`Tax at ${quote.tax_treatment.rate_percent}%`}
            value={formatMoney(quote.tax_amount, 2)}
          />
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Amount payable</Text>
            <Text style={styles.grandTotalValue}>{formatMoney(quote.total_value, 2)}</Text>
          </View>
        </View>

        {/* ---------------- payment schedule (FR-PO-087/134) ---------------- */}
        {quote.payment_schedule?.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>How you would pay</Text>
            {quote.payment_schedule.map((m, i) => (
              <View key={i} style={styles.scheduleRow}>
                <View style={styles.scheduleMain}>
                  <Text style={styles.scheduleName}>{m.name}</Text>
                  <Text style={styles.scheduleDue}>{m.due_label}</Text>
                </View>
                <Text style={styles.scheduleAmount}>{formatMoney(m.amount, 2)}</Text>
              </View>
            ))}
            <Text style={styles.cardHint}>
              {`Your booking is confirmed once the advance of ${formatMoney(quote.min_advance_amount, 2)} is received — not on acceptance alone. Until then the date is held but not committed.`}
            </Text>
          </View>
        ) : null}

        {/* ---------------- conversation (FR-PO-103) ---------------- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Messages</Text>
          {quote.assigned_contact ? (
            <Text style={styles.cardHint}>
              {`You are talking to ${quote.assigned_contact.display_name}`}
              {quote.assigned_contact.designation ? `, ${quote.assigned_contact.designation}` : ''}
              .
            </Text>
          ) : null}

          <TextInput
            style={styles.messageInput}
            value={messageDraft}
            onChangeText={setMessageDraft}
            placeholder="Ask a question about this quotation"
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <TouchableOpacity
            style={[styles.outlineBtn, (!messageDraft.trim() || busy) && styles.btnOff]}
            disabled={!messageDraft.trim() || busy}
            activeOpacity={0.8}
            onPress={async () => {
              setBusy(true);
              try {
                await postPartyMessage(quotationId, messageDraft.trim());
                setMessageDraft('');
                Alert.alert('Sent', 'Your contact at the restaurant has been notified.');
                load();
              } catch (err: any) {
                Alert.alert('Could not send', err.message || 'Please try again.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Text style={styles.outlineBtnText}>Send message</Text>
          </TouchableOpacity>
        </View>

        {/* ---------------- terms, carried on the quote as issued ---------------- */}
        {quote.terms_text || quote.cancellation_policy_text ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Terms for this quotation</Text>
            {quote.terms_text ? <Text style={styles.termsBody}>{quote.terms_text}</Text> : null}
            {quote.cancellation_policy_text ? (
              <>
                <Text style={styles.termsHeading}>Cancellation</Text>
                <Text style={styles.termsBody}>{quote.cancellation_policy_text}</Text>
              </>
            ) : null}
            {quote.fssai_licence_no ? (
              <Text style={styles.licence}>{`FSSAI licence ${quote.fssai_licence_no}`}</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* ---------------- the three responses (FR-PO-101) ---------------- */}
      {open ? (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.declineBtn}
            activeOpacity={0.8}
            onPress={() => setShowDecline(true)}
          >
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.changeBtn}
            activeOpacity={0.8}
            onPress={() => setShowChanges((v) => !v)}
          >
            <Text style={styles.changeBtnText}>
              {showChanges ? 'Review changes' : 'Ask for changes'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.acceptBtn}
            activeOpacity={0.85}
            onPress={() => (showChanges ? sendChanges() : setShowAccept(true))}
          >
            <Text style={styles.acceptBtnText}>{showChanges ? 'Send request' : 'Accept'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ---------------- ask for changes panel ---------------- */}
      <Modal visible={showChanges} transparent animationType="slide">
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>What would you like changed?</Text>
            <ScrollView contentContainerStyle={styles.sheetScroll}>
              <Text style={styles.label}>Your message</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={generalComment}
                onChangeText={setGeneralComment}
                placeholder="Tell them what you would like different"
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <Text style={styles.sheetHint}>
                You can also propose a different date or guest count. The restaurant will check
                whether the new date is available before replying.
              </Text>

              <View style={styles.sheetRow}>
                <View style={styles.sheetField}>
                  <Text style={styles.label}>Different guest count</Text>
                  <TextInput
                    style={styles.input}
                    value={proposedGuests}
                    onChangeText={setProposedGuests}
                    keyboardType="numeric"
                    placeholder={String(quote.guest_count)}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.sheetField}>
                  <Text style={styles.label}>Different date</Text>
                  <TextInput
                    style={styles.input}
                    value={proposedDate}
                    onChangeText={setProposedDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <Text style={styles.label}>Changes to the menu</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={proposedMenu}
                onChangeText={setProposedMenu}
                placeholder="What you would like added, removed or swapped"
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <Text style={styles.sheetHint}>
                Close this and tap any line above to comment on that line specifically.
              </Text>
            </ScrollView>
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.outlineBtn}
                activeOpacity={0.8}
                onPress={() => setShowChanges(false)}
              >
                <Text style={styles.outlineBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acceptBtn, busy && styles.btnOff]}
                disabled={busy}
                activeOpacity={0.85}
                onPress={sendChanges}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <Text style={styles.acceptBtnText}>Send request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------- accept (FR-PO-108/109/110) ---------------- */}
      <Modal visible={showAccept} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Accept this quotation</Text>
            <Text style={styles.sheetBody}>
              {`You are accepting ${quote.quotation_no} for ${formatMoney(quote.total_value, 2)}.`}
            </Text>
            <Text style={styles.sheetBody}>
              {`Your booking is confirmed once the advance of ${formatMoney(quote.min_advance_amount, 2)} is received. `}
              Accepting alone does not confirm it, and your date stays held only until the
              quotation's validity runs out.
            </Text>
            {quote.cancellation_policy_text ? (
              <ScrollView style={styles.termsScroll}>
                <Text style={styles.termsHeading}>Cancellation policy</Text>
                <Text style={styles.termsBody}>{quote.cancellation_policy_text}</Text>
                {quote.terms_text ? (
                  <>
                    <Text style={styles.termsHeading}>Terms</Text>
                    <Text style={styles.termsBody}>{quote.terms_text}</Text>
                  </>
                ) : null}
              </ScrollView>
            ) : null}
            <View style={styles.switchRow}>
              <Switch
                value={termsOk}
                onValueChange={setTermsOk}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
              <Text style={styles.switchLabel}>
                I accept this quotation, the party order terms and the cancellation policy
              </Text>
            </View>
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.outlineBtn}
                activeOpacity={0.8}
                onPress={() => { setShowAccept(false); setTermsOk(false); }}
              >
                <Text style={styles.outlineBtnText}>Not yet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acceptBtn, (!termsOk || busy) && styles.btnOff]}
                disabled={!termsOk || busy}
                activeOpacity={0.85}
                onPress={accept}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <Text style={styles.acceptBtnText}>Accept quotation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------- decline (FR-PO-112) ---------------- */}
      <Modal visible={showDecline} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Decline this quotation</Text>
            <Text style={styles.sheetBody}>
              Letting the restaurant know why helps them quote better next time. Your date will go
              back on their calendar.
            </Text>
            <View style={styles.chipWrap}>
              {quote.decline_reasons.map((r) => (
                <TouchableOpacity
                  key={r.code}
                  style={[styles.chip, declineReason === r.code && styles.chipOn]}
                  activeOpacity={0.8}
                  onPress={() => setDeclineReason(r.code)}
                >
                  <Text style={[styles.chipText, declineReason === r.code && styles.chipTextOn]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={declineNote}
              onChangeText={setDeclineNote}
              placeholder="Anything else you would like to say (optional)"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.outlineBtn}
                activeOpacity={0.8}
                onPress={() => setShowDecline(false)}
              >
                <Text style={styles.outlineBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.declineSolidBtn, busy && styles.btnOff]}
                disabled={busy}
                activeOpacity={0.85}
                onPress={decline}
              >
                <Text style={styles.acceptBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },

  validityCard: {
    backgroundColor: statusColors.OPEN.bg, borderRadius: radius.lg, padding: spacing.md, gap: 4,
  },
  validityTitle: { fontSize: 15.5, fontWeight: '800', color: statusColors.OPEN.fg },
  validityBody: { fontSize: 12.5, color: statusColors.OPEN.fg, lineHeight: 18 },
  closedCard: {
    backgroundColor: colors.iconBg, borderRadius: radius.lg, padding: spacing.md, gap: 4,
  },
  closedTitle: { fontSize: 15.5, fontWeight: '800', color: colors.text },
  closedBody: { fontSize: 12.5, color: colors.textMuted, lineHeight: 18 },

  changeCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.accent, padding: spacing.md, gap: 3,
  },
  changeTitle: { fontSize: 13.5, fontWeight: '700', color: colors.accent },
  changeLine: { fontSize: 12.5, color: colors.text, lineHeight: 18 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  eventLine: { fontSize: 14.5, fontWeight: '600', color: colors.text, lineHeight: 20 },
  eventSub: { fontSize: 12.5, color: colors.textMuted },

  lineRow: {
    flexDirection: 'row', gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9,
  },
  lineMain: { flex: 1, gap: 2 },
  lineName: { fontSize: 14, fontWeight: '600', color: colors.text },
  optional: { fontSize: 11, fontWeight: '500', color: colors.textMuted },
  lineBasis: { fontSize: 12, color: colors.textMuted },
  lineCourses: { gap: 2, paddingTop: 2 },
  lineCourse: { fontSize: 12, color: colors.text, lineHeight: 17 },
  lineCourseName: { fontWeight: '700' },
  allergenLine: { fontSize: 11, fontWeight: '600', color: colors.warning },
  lineDiscount: { fontSize: 11.5, fontWeight: '600', color: statusColors.CLOSED.fg },
  lineTax: { fontSize: 11, color: colors.textMuted },
  lineCommentInput: {
    marginTop: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 12.5, color: colors.text,
  },
  lineTotal: { fontSize: 14.5, fontWeight: '700', color: colors.text, minWidth: 76, textAlign: 'right' },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  totalLabel: { fontSize: 13, color: colors.textMuted },
  totalValue: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  grandTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9, gap: spacing.sm,
  },
  grandTotalLabel: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  grandTotalValue: { fontSize: 22, fontWeight: '800', color: colors.text },

  scheduleRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8,
  },
  scheduleMain: { flex: 1, gap: 1 },
  scheduleName: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  scheduleDue: { fontSize: 11.5, color: colors.textMuted },
  scheduleAmount: { fontSize: 14, fontWeight: '700', color: colors.text },

  messageInput: {
    minHeight: 70, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 11, paddingTop: 10, paddingBottom: 10,
    fontSize: 14, color: colors.text, textAlignVertical: 'top',
  },

  termsHeading: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 4 },
  termsBody: { fontSize: 12.5, color: colors.textMuted, lineHeight: 19 },
  termsScroll: { maxHeight: 170 },
  licence: { fontSize: 11, color: colors.textMuted, marginTop: 4 },

  footer: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  declineBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    paddingHorizontal: 16, paddingVertical: 13, justifyContent: 'center',
  },
  declineBtnText: { fontSize: 13.5, fontWeight: '600', color: colors.textMuted },
  changeBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
  },
  changeBtnText: { fontSize: 13.5, fontWeight: '700', color: colors.primary },
  acceptBtn: {
    flex: 1, backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
  },
  acceptBtnText: { fontSize: 14.5, fontWeight: '700', color: colors.surface },
  declineSolidBtn: {
    flex: 1, backgroundColor: colors.danger, borderRadius: radius.pill,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
  },
  btnOff: { opacity: 0.5 },
  outlineBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.pill,
    paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  outlineBtnText: { fontSize: 13.5, fontWeight: '700', color: colors.primary },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.md, gap: spacing.sm, maxHeight: '88%',
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  sheetBody: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  sheetHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  sheetScroll: { gap: 8, paddingBottom: 6 },
  sheetRow: { flexDirection: 'row', gap: spacing.sm },
  sheetField: { flex: 1, gap: 4 },
  sheetActions: {
    flexDirection: 'row', gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm,
  },

  label: { fontSize: 11.5, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  input: {
    height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, fontSize: 14.5, color: colors.text,
  },
  inputMultiline: {
    height: undefined, minHeight: 76, paddingTop: 11, paddingBottom: 11, textAlignVertical: 'top',
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.iconBg,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextOn: { color: colors.surface },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  switchLabel: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
});

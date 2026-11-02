/**
 * One party order, as the customer sees it — BRD FR-PO-214/215, plus the
 * customer half of group E.
 *
 * The three things the customer actually came here for:
 *   1. where is this (the status timeline, in plain language)
 *   2. who do I talk to (the named contact, and whether they are reachable)
 *   3. what am I being asked to do (the live quotation, and by when)
 *
 * None of this is a copy of the restaurant's data — it is the same record,
 * filtered (BRD 4.4). So a status the restaurant changes appears here with no
 * publish step and no delay.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing, statusColors } from '../theme';
import {
  MEAL_PERIOD_LABEL, SERVICE_MODE_LABEL,
  type PartyContact, type PartyEnquiryDetail,
  fetchPartyEnquiry, formatEventWhen, formatGuests, formatMoney,
  logPartyCall, requestPartyCallback, submitPartyEnquiry, timeLeft,
} from '../api/party';

type Props = NativeStackScreenProps<AppStackParamList, 'PartyEnquiryDetail'>;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function PartyEnquiryDetailScreen({ navigation, route }: Props) {
  const { enquiryId } = route.params;

  const [enquiry, setEnquiry] = useState<PartyEnquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEnquiry(await fetchPartyEnquiry(enquiryId));
    } catch (err: any) {
      setError(err.message || 'Could not load this party order');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enquiryId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /** FR-PO-072: dial, and record that the call was made. */
  const callContact = async (contact: PartyContact) => {
    try {
      // Logged first, so the restaurant's record is right even if the dialler
      // never comes back (the user may stay on the call for an hour).
      await logPartyCall(enquiryId);
    } catch {
      // A logging failure must never stop the customer making the call.
    }
    Linking.openURL(`tel:${contact.phone}`);
  };

  /** FR-PO-075: ask to be called back instead. */
  const askForCallback = (contact: PartyContact) => {
    const when = contact.availability.next_available;
    const suggested = new Date(Date.now() + 2 * 3600 * 1000);
    Alert.alert(
      'Request a callback',
      when
        ? `${contact.display_name} is next available on ${DAY_NAMES[when.day]} at ${when.from}. `
          + 'Shall we ask them to call you then?'
        : `Shall we ask ${contact.display_name} to call you back in about two hours?`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Yes, call me back',
          onPress: async () => {
            setBusy(true);
            try {
              await requestPartyCallback(enquiryId, suggested.toISOString());
              Alert.alert('We will call you back', 'Your request has been passed to your contact.');
              load();
            } catch (err: any) {
              Alert.alert('Could not request a callback', err.message || 'Please try again.');
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
      <View style={styles.container}>
        <ScreenHeader title="Party order" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  if (!enquiry) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Party order" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || 'This party order could not be found.'}</Text>
        </View>
      </View>
    );
  }

  const liveQuote = enquiry.quotations.find((q) => q.status === 'ACCEPTED')
    || enquiry.quotations.find((q) => q.status === 'ISSUED')
    || null;
  const contact = enquiry.assigned_contact;
  const alternative = enquiry.alternative_contact;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={enquiry.event_type_label || 'Party order'}
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
          <Text style={styles.statusLabel}>{enquiry.status_label}</Text>
          <Text style={styles.statusRef}>
            {enquiry.enquiry_no}
            {enquiry.restaurant_name ? ` · ${enquiry.restaurant_name}` : ''}
          </Text>
        </View>

        {/* ---------------- the thing to do now ---------------- */}
        {enquiry.status === 'DRAFT' ? (
          <TouchableOpacity
            style={styles.ctaCard}
            activeOpacity={0.85}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await submitPartyEnquiry(enquiryId, true);
                Alert.alert('Enquiry sent', 'The restaurant will respond shortly.');
                load();
              } catch (err: any) {
                Alert.alert('Could not send it', err.message || 'Please check your details.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Text style={styles.ctaTitle}>This enquiry is still a draft</Text>
            <Text style={styles.ctaBody}>
              Tap to send it to the restaurant. Nothing is committed by sending it.
            </Text>
          </TouchableOpacity>
        ) : null}

        {liveQuote && liveQuote.status === 'ISSUED' ? (
          <TouchableOpacity
            style={styles.ctaCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('PartyQuotation', {
              quotationId: liveQuote.quotation_id,
            })}
          >
            <Text style={styles.ctaTitle}>Your quotation is ready</Text>
            <Text style={styles.ctaAmount}>{formatMoney(liveQuote.total_value, 2)}</Text>
            <Text style={styles.ctaBody}>
              {timeLeft(liveQuote.valid_until)
                ? `${timeLeft(liveQuote.valid_until)} to accept or ask for changes. `
                  + 'Your date is held until then.'
                : 'Tap to review every line, ask for changes, or accept it.'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Once an advance has confirmed it, the BOOKING is the thing to open —
            it carries the payment position, the guest count and the receipts. */}
        {enquiry.booking ? (
          <TouchableOpacity
            style={styles.ctaCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('PartyBooking', {
              bookingId: enquiry.booking!.booking_id,
            })}
          >
            <Text style={styles.ctaTitle}>{enquiry.booking.booking_status_label}</Text>
            <Text style={styles.ctaBody}>
              {`Booking ${enquiry.booking.booking_no} · ${enquiry.booking.financial_status_label}. `}
              Open it to pay, confirm your guest count and download your receipts.
            </Text>
            <Text style={styles.linkRowText}>Open my booking ›</Text>
          </TouchableOpacity>
        ) : liveQuote && liveQuote.status === 'ACCEPTED' ? (
          <View style={styles.acceptedCard}>
            <Text style={styles.ctaTitle}>Accepted — one step left</Text>
            <Text style={styles.ctaBody}>
              {`Your booking is confirmed once the advance of ${formatMoney(liveQuote.min_advance_amount)} is received. `}
              Until then your date is held but not committed. Your contact will send you a payment
              link.
            </Text>
            <TouchableOpacity
              style={styles.linkRow}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('PartyQuotation', {
                quotationId: liveQuote.quotation_id,
              })}
            >
              <Text style={styles.linkRowText}>View the accepted quotation ›</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ---------------- your contact (FR-PO-071/074/076) ---------------- */}
        {contact ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your contact at the restaurant</Text>
            <View style={styles.contactRow}>
              {contact.photo_url ? (
                <Image source={{ uri: contact.photo_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>
                    {contact.display_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.contactText}>
                <Text style={styles.contactName}>{contact.display_name}</Text>
                {contact.designation ? (
                  <Text style={styles.contactRole}>{contact.designation}</Text>
                ) : null}
                <Text
                  style={[
                    styles.contactAvail,
                    { color: contact.availability.available ? statusColors.CLOSED.fg : colors.textMuted },
                  ]}
                >
                  {contact.availability.available
                    ? contact.availability.until
                      ? `Available now, until ${contact.availability.until}`
                      : 'Available now'
                    : contact.availability.next_available
                      ? `Next available ${DAY_NAMES[contact.availability.next_available.day]} at ${contact.availability.next_available.from}`
                      : 'Not available right now'}
                </Text>
              </View>
            </View>

            <View style={styles.contactActions}>
              <TouchableOpacity
                style={styles.callBtn}
                activeOpacity={0.85}
                onPress={() => callContact(contact)}
              >
                <Text style={styles.callBtnText}>Call {contact.display_name.split(' ')[0]}</Text>
              </TouchableOpacity>
              {!contact.availability.available ? (
                <TouchableOpacity
                  style={styles.outlineBtn}
                  activeOpacity={0.8}
                  disabled={busy}
                  onPress={() => askForCallback(contact)}
                >
                  <Text style={styles.outlineBtnText}>Ask for a callback</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* FR-PO-076: somebody else to reach, rather than a dead end. */}
            {alternative && !contact.availability.available ? (
              <TouchableOpacity
                style={styles.altRow}
                activeOpacity={0.8}
                onPress={() => Linking.openURL(`tel:${alternative.phone}`)}
              >
                <Text style={styles.altText}>
                  {`Or call ${alternative.display_name}`}
                  {alternative.designation ? ` (${alternative.designation})` : ''}
                  {alternative.availability.available ? ' — available now' : ''}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* ---------------- your event ---------------- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your event</Text>
          <Row label="When" value={formatEventWhen(enquiry)} />
          <Row label="Guests" value={formatGuests(enquiry)} />
          {enquiry.service_mode ? (
            <Row label="Served" value={SERVICE_MODE_LABEL[enquiry.service_mode]} />
          ) : null}
          {enquiry.meal_period ? (
            <Row label="Meal" value={MEAL_PERIOD_LABEL[enquiry.meal_period]} />
          ) : null}
          {enquiry.venue_name ? <Row label="Space" value={enquiry.venue_name} /> : null}
          {enquiry.event_address ? <Row label="Address" value={enquiry.event_address} /> : null}
          {enquiry.package_name ? <Row label="Package" value={enquiry.package_name} /> : null}
          {enquiry.custom_requirement ? (
            <Row label="Your requirement" value={enquiry.custom_requirement} />
          ) : null}
          {enquiry.veg_guest_count || enquiry.nonveg_guest_count ? (
            <Row
              label="Dietary split"
              value={`${enquiry.veg_guest_count || 0} vegetarian · ${enquiry.nonveg_guest_count || 0} non-vegetarian`}
            />
          ) : null}
          {enquiry.allergen_notes ? (
            <Row label="Allergies you told us" value={enquiry.allergen_notes} />
          ) : null}
          {enquiry.special_instructions ? (
            <Row label="Special instructions" value={enquiry.special_instructions} />
          ) : null}

          {['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED'].includes(enquiry.status) ? (
            <TouchableOpacity
              style={styles.linkRow}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('PartyEnquiryForm', {
                packageId: enquiry.package_id || undefined,
                enquiryId: enquiry.enquiry_id,
              })}
            >
              <Text style={styles.linkRowText}>Change these details ›</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ---------------- quotations (FR-PO-089/216) ---------------- */}
        {enquiry.quotations.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your quotations</Text>
            <Text style={styles.cardHint}>
              Every version is kept, so you can always go back and see exactly what you were
              quoted and what changed.
            </Text>
            {enquiry.quotations.map((q) => (
              <TouchableOpacity
                key={q.quotation_id}
                style={styles.quoteRow}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('PartyQuotation', {
                  quotationId: q.quotation_id,
                })}
              >
                <View style={styles.quoteMain}>
                  <Text style={styles.quoteNo}>
                    {`${q.quotation_no} · version ${q.version}`}
                    {q.label ? ` · ${q.label}` : ''}
                  </Text>
                  <Text style={styles.quoteMeta}>
                    {q.status_label}
                    {q.issued_at ? ` · sent ${new Date(q.issued_at).toLocaleDateString()}` : ''}
                  </Text>
                  {/* FR-PO-090: a plain summary of what changed. */}
                  {q.change_summary?.length ? (
                    <Text style={styles.changeLine}>
                      {`Changed: ${q.change_summary.slice(0, 3).map((c) => c.label).join(', ')}`}
                      {q.change_summary.length > 3 ? ` +${q.change_summary.length - 3} more` : ''}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.quoteValue}>{formatMoney(q.total_value)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* ---------------- timeline (FR-PO-214) ---------------- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Progress</Text>
          {enquiry.timeline.length ? enquiry.timeline.map((t, i) => {
            const last = i === enquiry.timeline.length - 1;
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
          }) : (
            <Text style={styles.cardHint}>Nothing has happened yet.</Text>
          )}
        </View>

        {/* ---------------- activity (FR-PO-078, filtered) ---------------- */}
        {enquiry.activity.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Updates</Text>
            {enquiry.activity.map((a) => (
              <View key={a.log_id} style={styles.actRow}>
                <Text style={styles.actSummary}>{a.summary}</Text>
                <Text style={styles.actWhen}>
                  {new Date(a.created_at).toLocaleString()}
                  {a.actor_type === 'CUSTOMER' ? ' · you' : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ---------------- terms (FR-PO-224) ---------------- */}
        {enquiry.terms_text || enquiry.cancellation_policy_text ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Terms and cancellation</Text>
            {enquiry.terms_text ? (
              <Text style={styles.termsBody}>{enquiry.terms_text}</Text>
            ) : null}
            {enquiry.cancellation_policy_text ? (
              <>
                <Text style={styles.termsHeading}>Cancellation</Text>
                <Text style={styles.termsBody}>{enquiry.cancellation_policy_text}</Text>
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
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
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center', includeFontPadding: false },

  statusCard: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    padding: spacing.md, gap: 3,
  },
  statusLabel: { fontSize: 18, fontWeight: '800', color: colors.surface, includeFontPadding: false },
  statusRef: { fontSize: 12, color: colors.surface, opacity: 0.85, includeFontPadding: false },

  ctaCard: {
    backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md, gap: 4,
  },
  acceptedCard: {
    backgroundColor: statusColors.CLOSED.bg, borderRadius: radius.lg,
    borderWidth: 1, borderColor: statusColors.CLOSED.fg,
    padding: spacing.md, gap: 5,
  },
  ctaTitle: { fontSize: 15.5, fontWeight: '800', color: colors.text, includeFontPadding: false },
  ctaAmount: { fontSize: 24, fontWeight: '800', color: colors.text, includeFontPadding: false },
  ctaBody: { fontSize: 13, color: colors.text, lineHeight: 19, includeFontPadding: false },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, includeFontPadding: false },
  cardHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17, includeFontPadding: false },

  row: { gap: 1 },
  rowLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', includeFontPadding: false },
  rowValue: { fontSize: 14, color: colors.text, lineHeight: 20, includeFontPadding: false },

  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.iconBg },
  avatarFallback: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '800', color: colors.surface, includeFontPadding: false },
  contactText: { flex: 1, gap: 2 },
  contactName: { fontSize: 15.5, fontWeight: '700', color: colors.text, includeFontPadding: false },
  contactRole: { fontSize: 12.5, color: colors.textMuted, includeFontPadding: false },
  contactAvail: { fontSize: 12, fontWeight: '600', includeFontPadding: false },
  contactActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  callBtn: {
    flex: 1, minWidth: 130, backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 13, alignItems: 'center',
  },
  callBtnText: { fontSize: 14.5, fontWeight: '700', color: colors.surface, includeFontPadding: false },
  outlineBtn: {
    flex: 1, minWidth: 130, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center',
  },
  outlineBtnText: { fontSize: 13.5, fontWeight: '700', color: colors.primary, includeFontPadding: false },
  altRow: { paddingTop: 4 },
  altText: { fontSize: 12.5, fontWeight: '600', color: colors.primary, lineHeight: 18, includeFontPadding: false },

  linkRow: { paddingTop: 4 },
  linkRowText: { fontSize: 13, fontWeight: '700', color: colors.primary, includeFontPadding: false },

  quoteRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9,
  },
  quoteMain: { flex: 1, gap: 2 },
  quoteNo: { fontSize: 13.5, fontWeight: '600', color: colors.text, includeFontPadding: false },
  quoteMeta: { fontSize: 11.5, color: colors.textMuted, includeFontPadding: false },
  changeLine: { fontSize: 11.5, fontWeight: '600', color: colors.accent, includeFontPadding: false },
  quoteValue: { fontSize: 15, fontWeight: '700', color: colors.text, includeFontPadding: false },

  tlRow: { flexDirection: 'row', gap: spacing.sm },
  tlRail: { width: 14, alignItems: 'center' },
  tlDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.border, marginTop: 5 },
  tlDotLast: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  tlLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  tlBody: { flex: 1, paddingBottom: 13, gap: 1 },
  tlLabel: { fontSize: 13.5, fontWeight: '600', color: colors.textMuted, includeFontPadding: false },
  tlLabelLast: { color: colors.text, fontWeight: '700' },
  tlWhen: { fontSize: 11.5, color: colors.textMuted, includeFontPadding: false },

  actRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 2 },
  actSummary: { fontSize: 13, color: colors.text, lineHeight: 18, includeFontPadding: false },
  actWhen: { fontSize: 11, color: colors.textMuted, includeFontPadding: false },

  termsHeading: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 3, includeFontPadding: false },
  termsBody: { fontSize: 12.5, color: colors.textMuted, lineHeight: 19, includeFontPadding: false },
});

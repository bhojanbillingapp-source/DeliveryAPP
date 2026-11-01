/**
 * A statutory document, as it was issued — BRD FR-PO-216.
 *
 * Renders the document's own frozen `content` rather than re-deriving it from
 * the booking, so a receipt opened a year from now reads exactly as it did on
 * the day: the same issuer name, the same GSTIN, the same figures. That is the
 * point of FR-PO-165's immutability, and it would be wasted if this screen
 * rebuilt the document from live data.
 *
 * The one piece of interpretation added is the note on a receipt voucher: a
 * customer handed a "receipt" for an advance very often believes they have
 * been invoiced, and they have not been.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet,
  Text, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing, statusColors } from '../theme';
import { type PartyDocument, fetchPartyDocument, formatMoney } from '../api/party';

type Props = NativeStackScreenProps<AppStackParamList, 'PartyDocument'>;

const DOC_NOTE: Record<string, string> = {
  RECEIPT_VOUCHER: 'This is a receipt voucher for an advance, not a tax invoice. '
    + 'Your tax invoice is issued after the event and will adjust this advance.',
  TAX_INVOICE: 'This is your tax invoice for the event. Any advances you paid have been '
    + 'adjusted against it, so the same amount is not charged twice.',
  REFUND_VOUCHER: 'This records an advance returned to you, and reverses the tax accounted '
    + 'on the original receipt.',
  CREDIT_NOTE: 'This reduces the value of a tax invoice already issued to you.',
};

export default function PartyDocumentScreen({ navigation, route }: Props) {
  const { documentId } = route.params;

  const [doc, setDoc] = useState<PartyDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDoc(await fetchPartyDocument(documentId));
    } catch (err: any) {
      setError(err.message || 'Could not load this document');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [documentId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Document" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  if (!doc) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Document" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || 'This document could not be found.'}</Text>
        </View>
      </View>
    );
  }

  const c = doc.content || {};
  const issuer = c.issuer || {};
  const recipient = c.recipient || {};
  const event = c.event || null;
  const receipt = c.receipt || null;
  const invoice = c.invoice || null;
  const refund = c.refund || null;

  return (
    <View style={styles.container}>
      <ScreenHeader title={doc.doc_label} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        {doc.cancelled_at ? (
          <View style={styles.cancelledBox}>
            <Text style={styles.cancelledTitle}>This document has been cancelled</Text>
            <Text style={styles.cancelledBody}>{doc.cancel_reason}</Text>
          </View>
        ) : null}

        {/* ---------------- the document ---------------- */}
        <View style={styles.doc}>
          <View style={styles.docHead}>
            <Text style={styles.docType}>{doc.doc_label}</Text>
            <Text style={styles.docNumber}>{doc.doc_number}</Text>
            <Text style={styles.docDate}>
              {new Date(doc.issued_at).toLocaleString()}
            </Text>
          </View>

          {/* The issuer as they were at the moment of issue. */}
          <View style={styles.block}>
            <Text style={styles.blockHead}>From</Text>
            {issuer.legal_name ? <Text style={styles.strong}>{issuer.legal_name}</Text> : null}
            {issuer.trading_name && issuer.trading_name !== issuer.legal_name ? (
              <Text style={styles.line}>{issuer.trading_name}</Text>
            ) : null}
            {issuer.address ? <Text style={styles.line}>{issuer.address}</Text> : null}
            {issuer.gstin ? <Text style={styles.line}>{`GSTIN ${issuer.gstin}`}</Text> : null}
            {/* FR-PO-163 */}
            {issuer.fssai_licence_no ? (
              <Text style={styles.line}>{`FSSAI licence ${issuer.fssai_licence_no}`}</Text>
            ) : null}
            {issuer.phone ? <Text style={styles.line}>{issuer.phone}</Text> : null}
          </View>

          <View style={styles.block}>
            <Text style={styles.blockHead}>To</Text>
            {recipient.name ? <Text style={styles.strong}>{recipient.name}</Text> : null}
            {recipient.mobile ? <Text style={styles.line}>{recipient.mobile}</Text> : null}
            {recipient.email ? <Text style={styles.line}>{recipient.email}</Text> : null}
            {recipient.place_of_supply ? (
              <Text style={styles.line}>{`Place of supply: ${recipient.place_of_supply}`}</Text>
            ) : null}
          </View>

          {event ? (
            <View style={styles.block}>
              <Text style={styles.blockHead}>Event</Text>
              {event.date ? (
                <Text style={styles.line}>
                  {new Date(`${String(event.date).slice(0, 10)}T00:00:00`)
                    .toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                  {event.start_time ? ` at ${String(event.start_time).slice(0, 5)}` : ''}
                </Text>
              ) : null}
              {event.venue ? <Text style={styles.line}>{event.venue}</Text> : null}
              {event.address ? <Text style={styles.line}>{event.address}</Text> : null}
            </View>
          ) : null}

          {/* ---------------- the money ---------------- */}
          {invoice?.lines?.length ? (
            <View style={styles.block}>
              <Text style={styles.blockHead}>Charged</Text>
              {invoice.lines.map((l: any, i: number) => (
                <View key={i} style={styles.lineRow}>
                  <View style={styles.lineMain}>
                    <Text style={styles.lineName}>{l.name}</Text>
                    <Text style={styles.lineMeta}>
                      {l.pricing_unit === 'PER_HEAD'
                        ? `${formatMoney(l.unit_price, 2)} × ${l.quantity} guests`
                        : l.quantity > 1
                          ? `${formatMoney(l.unit_price, 2)} × ${l.quantity}`
                          : ''}
                    </Text>
                  </View>
                  <Text style={styles.lineValue}>{formatMoney(l.taxable_value, 2)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {receipt ? (
            <View style={styles.block}>
              <Text style={styles.blockHead}>Received</Text>
              <View style={styles.lineRow}>
                <View style={styles.lineMain}>
                  <Text style={styles.lineName}>
                    {`Advance against booking ${receipt.booking_no}`}
                  </Text>
                  <Text style={styles.lineMeta}>
                    {String(receipt.mode || '').toLowerCase().replace('_', ' ')}
                    {receipt.gateway_reference ? ` · ${receipt.gateway_reference}` : ''}
                    {receipt.instrument_note ? ` · ${receipt.instrument_note}` : ''}
                  </Text>
                </View>
                <Text style={styles.lineValue}>
                  {formatMoney(receipt.amount_received, 2)}
                </Text>
              </View>
            </View>
          ) : null}

          {refund ? (
            <View style={styles.block}>
              <Text style={styles.blockHead}>Refunded</Text>
              <View style={styles.lineRow}>
                <View style={styles.lineMain}>
                  <Text style={styles.lineName}>
                    {`Against booking ${refund.booking_no}`}
                  </Text>
                  {refund.reason ? (
                    <Text style={styles.lineMeta}>{refund.reason}</Text>
                  ) : null}
                </View>
                <Text style={styles.lineValue}>{formatMoney(refund.amount_refunded, 2)}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.totals}>
            <Total label="Taxable value" value={formatMoney(doc.taxable_value, 2)} />
            <Total
              label={`Tax at ${Number(doc.tax_rate)}%`}
              value={formatMoney(doc.tax_amount, 2)}
            />
            {/* FR-PO-157: what this invoice absorbed. */}
            {Number(doc.advance_adjusted) > 0 ? (
              <Total
                label="Advances already paid, adjusted"
                value={`−${formatMoney(doc.advance_adjusted, 2)}`}
              />
            ) : null}
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>
                {doc.doc_type === 'REFUND_VOUCHER' ? 'Refunded' : 'Total'}
              </Text>
              <Text style={styles.grandValue}>{formatMoney(doc.total_value, 2)}</Text>
            </View>
            {invoice?.balance_payable != null ? (
              <Total
                label="Balance payable"
                value={formatMoney(invoice.balance_payable, 2)}
              />
            ) : null}
          </View>

          {c.tax?.sac_code ? (
            <Text style={styles.sac}>{`SAC ${c.tax.sac_code}`}</Text>
          ) : null}
          {/* FR-PO-161 */}
          {doc.irn ? <Text style={styles.irn}>{`IRN ${doc.irn}`}</Text> : null}
        </View>

        {/* What this document is, in words. */}
        {DOC_NOTE[doc.doc_type] ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteText}>{DOC_NOTE[doc.doc_type]}</Text>
          </View>
        ) : null}

        {invoice?.advances_adjusted?.note ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteText}>{invoice.advances_adjusted.note}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Total({ label, value }: { label: string; value: string }) {
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

  cancelledBox: {
    backgroundColor: statusColors.CANCELLED.bg, borderRadius: radius.md,
    padding: spacing.sm, gap: 2,
  },
  cancelledTitle: { fontSize: 13.5, fontWeight: '700', color: statusColors.CANCELLED.fg },
  cancelledBody: { fontSize: 12.5, color: statusColors.CANCELLED.fg, lineHeight: 18 },

  doc: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md,
  },
  docHead: {
    alignItems: 'center', gap: 2,
    borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm,
  },
  docType: {
    fontSize: 12, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  docNumber: { fontSize: 20, fontWeight: '800', color: colors.text },
  docDate: { fontSize: 11.5, color: colors.textMuted },

  block: { gap: 2 },
  blockHead: {
    fontSize: 10.5, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  strong: { fontSize: 14, fontWeight: '700', color: colors.text },
  line: { fontSize: 12.5, color: colors.text, lineHeight: 18 },

  lineRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 4,
  },
  lineMain: { flex: 1, gap: 1 },
  lineName: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  lineMeta: { fontSize: 11.5, color: colors.textMuted },
  lineValue: { fontSize: 13.5, fontWeight: '600', color: colors.text },

  totals: {
    gap: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  totalLabel: { flex: 1, fontSize: 12.5, color: colors.textMuted },
  totalValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  grandRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 7, marginTop: 3,
  },
  grandLabel: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  grandValue: { fontSize: 22, fontWeight: '800', color: colors.text },

  sac: { fontSize: 11, color: colors.textMuted },
  irn: { fontSize: 10.5, color: colors.textMuted },

  noteBox: {
    backgroundColor: colors.iconBg, borderRadius: radius.md, padding: spacing.sm,
  },
  noteText: { fontSize: 12.5, color: colors.text, lineHeight: 18 },
});

/**
 * My party orders — BRD FR-PO-055.
 *
 * "All their enquiries, quotes, bookings and past events in a single list
 * with current status against each." One list, not four tabs, because the
 * customer thinks in events, not in the restaurant's internal stages.
 *
 * Every status shown here is the plain-language label the backend derives
 * from the one stored status (FR-PO-215) — never an internal code.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing, statusColors } from '../theme';
import {
  CLOSED_STATUSES, SERVICE_MODE_LABEL,
  type PartyEnquirySummary, type PartyStatus,
  fetchMyPartyEnquiries, formatEventWhen, formatGuests, formatMoney, timeLeft,
} from '../api/party';

type Props = NativeStackScreenProps<AppStackParamList, 'PartyEnquiries'>;

/** Hoisted so the list does not get a new component type on every render. */
const Separator = () => <View style={styles.sep} />;

/**
 * The tone each status reads in. A quote waiting on the customer is the one
 * they must act on, so it is the only one given the accent treatment.
 */
function toneFor(status: PartyStatus): { bg: string; fg: string } {
  switch (status) {
    case 'QUOTE_ISSUED':
    case 'QUOTE_REVISED':
      return { bg: statusColors.OPEN.bg, fg: statusColors.OPEN.fg };
    case 'QUOTE_ACCEPTED':
      return { bg: statusColors.CLOSED.bg, fg: statusColors.CLOSED.fg };
    case 'QUOTE_DECLINED':
    case 'QUOTE_EXPIRED':
    case 'LOST':
      return { bg: statusColors.CANCELLED.bg, fg: statusColors.CANCELLED.fg };
    default:
      return { bg: colors.iconBg, fg: colors.textMuted };
  }
}

export default function PartyEnquiriesScreen({ navigation }: Props) {
  const { customer } = useAuth();

  const [rows, setRows] = useState<PartyEnquirySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // `all` so a customer who has ordered from more than one outlet of the
      // brand sees every party order, not only the one they last browsed.
      setRows(await fetchMyPartyEnquiries(true));
    } catch (err: any) {
      setError(err.message || 'Could not load your party orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reloaded on focus, so returning from accepting a quote shows the new
  // status without a manual pull-to-refresh.
  useFocusEffect(useCallback(() => {
    if (customer) load();
    else setLoading(false);
  }, [customer, load]));

  if (!customer) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Party Orders" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.prompt}>Sign in to see your party enquiries and quotations.</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderRow = ({ item }: { item: PartyEnquirySummary }) => {
    const tone = toneFor(item.status);
    const closed = CLOSED_STATUSES.includes(item.status);
    const validity = item.valid_until ? timeLeft(item.valid_until) : null;
    const needsYou = ['QUOTE_ISSUED', 'QUOTE_REVISED'].includes(item.status);

    return (
      <TouchableOpacity
        style={[styles.card, closed && styles.cardClosed]}
        activeOpacity={0.85}
        onPress={() => (item.booking_id
          // Once confirmed, the booking is what the customer came back for.
          ? navigation.navigate('PartyBooking', { bookingId: item.booking_id })
          : navigation.navigate('PartyEnquiryDetail', { enquiryId: item.enquiry_id }))}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.cardTitle}>
              {item.event_type_label || item.package_name || 'Party order'}
            </Text>
            <Text style={styles.cardRef}>
              {item.enquiry_no}
              {item.restaurant_name ? ` · ${item.restaurant_name}` : ''}
            </Text>
          </View>
          <View style={[styles.pill, { backgroundColor: tone.bg }]}>
            <Text style={[styles.pillText, { color: tone.fg }]}>
              {/* A confirmed booking has its own status, which is more useful
                  than "Accepted, awaiting advance" once the advance is in. */}
              {item.booking_status_label || item.status_label}
            </Text>
          </View>
        </View>

        <Text style={styles.cardMeta}>
          {formatEventWhen(item)}
          {`  ·  ${formatGuests(item)}`}
          {item.service_mode ? `  ·  ${SERVICE_MODE_LABEL[item.service_mode]}` : ''}
        </Text>

        {item.total_value != null ? (
          <View style={styles.moneyRow}>
            <Text style={styles.money}>{formatMoney(item.total_value, 2)}</Text>
            <Text style={styles.moneyLabel}>
              {item.status === 'QUOTE_ACCEPTED' ? 'accepted' : 'quoted'}
            </Text>
          </View>
        ) : null}

        {/* The one line that decides whether they open this today. */}
        {needsYou ? (
          <View style={styles.actionStrip}>
            <Text style={styles.actionStripText}>
              {validity
                ? `Your quotation is ready — ${validity} to respond`
                : 'Your quotation is ready to review'}
            </Text>
          </View>
        ) : item.booking_id && (item.booking_value ?? 0) > (item.amount_paid ?? 0) ? (
          <View style={styles.actionStrip}>
            <Text style={styles.actionStripText}>
              {`${formatMoney((item.booking_value ?? 0) - (item.amount_paid ?? 0))} outstanding`}
            </Text>
          </View>
        ) : item.status === 'QUOTE_ACCEPTED' && item.min_advance_amount ? (
          <View style={styles.actionStrip}>
            <Text style={styles.actionStripText}>
              {`Pay ${formatMoney(item.min_advance_amount)} to confirm your booking`}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Party Orders"
        onBack={() => navigation.goBack()}
        right={(
          <TouchableOpacity
            onPress={() => navigation.navigate('PartyPackages')}
            activeOpacity={0.75}
          >
            <Text style={styles.headerLink}>Browse packages</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.enquiry_id}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
            />
          }
          ListHeaderComponent={error ? (
            <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
          ) : undefined}
          ListEmptyComponent={(
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No party enquiries yet</Text>
              <Text style={styles.emptyBody}>
                Browse the packages and raise an enquiry. You will be able to track it here from
                the moment you send it.
              </Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.navigate('PartyPackages')}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Browse party packages</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  list: { padding: spacing.md, paddingBottom: spacing.xl },
  sep: { height: spacing.sm },
  headerLink: { fontSize: 13, fontWeight: '600', color: colors.primary, includeFontPadding: false },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: 7,
  },
  cardClosed: { opacity: 0.72 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitleBlock: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15.5, fontWeight: '700', color: colors.text, includeFontPadding: false },
  cardRef: { fontSize: 11.5, color: colors.textMuted, includeFontPadding: false },
  cardMeta: { fontSize: 13, color: colors.text, lineHeight: 18, includeFontPadding: false },

  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontSize: 11.5, fontWeight: '700', includeFontPadding: false },

  moneyRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  money: { fontSize: 17, fontWeight: '800', color: colors.text, includeFontPadding: false },
  moneyLabel: { fontSize: 11.5, color: colors.textMuted, includeFontPadding: false },

  actionStrip: {
    backgroundColor: statusColors.OPEN.bg, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  actionStripText: { fontSize: 12.5, fontWeight: '700', color: statusColors.OPEN.fg, includeFontPadding: false },

  prompt: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, includeFontPadding: false },
  primaryBtn: {
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingHorizontal: 24, paddingVertical: 13,
  },
  primaryBtnText: { fontSize: 14.5, fontWeight: '700', color: colors.surface, includeFontPadding: false },

  errorBox: {
    backgroundColor: statusColors.CANCELLED.bg, borderRadius: radius.md,
    padding: spacing.sm, marginBottom: spacing.sm,
  },
  errorText: { fontSize: 13, color: statusColors.CANCELLED.fg, includeFontPadding: false },

  emptyBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, includeFontPadding: false },
  emptyBody: {
    fontSize: 13.5, color: colors.textMuted, textAlign: 'center',
    lineHeight: 20, maxWidth: 300,
    includeFontPadding: false,
  },
});

/**
 * What we send you, and your data — BRD group N, FR-PO-217, 223 and 266.
 *
 * TWO THINGS, ON ONE SCREEN
 * -------------------------
 * Notifications and data rights are the two things a customer manages about
 * themselves rather than about one party order, so they live together and
 * away from any single booking.
 *
 * MANDATORY NOTIFICATIONS ARE SHOWN, NOT HIDDEN
 * ---------------------------------------------
 * A payment that is due, a refund that failed, a date about to be released —
 * silence on those costs the customer money or their booking, so they cannot
 * be turned off. They are listed with the switch locked and the reason said
 * once at the top. Hiding them would leave somebody who turned everything off
 * wondering why reminders still arrive.
 *
 * AN ERASURE CAN COME BACK REFUSED
 * --------------------------------
 * A tax invoice inside its statutory retention period cannot be erased. The
 * answer says so, and until when, rather than reporting success and quietly
 * doing nothing.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Switch,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import {
  type PartyDataExport,
  type PartyErasureOutcome,
  type PartyNotificationPreferences,
  erasureMessage,
  exportMyPartyData,
  getPartyNotificationPreferences,
  requestMyPartyErasure,
  setPartyNotificationPreference,
} from '../api/party';

type Props = NativeStackScreenProps<AppStackParamList, 'PartyPreferences'>;

export default function PartyPreferencesScreen({ navigation }: Props) {
  const [prefs, setPrefs] = useState<PartyNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [exported, setExported] = useState<PartyDataExport | null>(null);
  const [erasure, setErasure] = useState<PartyErasureOutcome | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPrefs(await getPartyNotificationPreferences());
    } catch (err: any) {
      setError(err.message || 'Could not load your preferences');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = useCallback(async (
    eventKey: string, channel: string, next: boolean,
  ) => {
    const id = `${eventKey}:${channel}`;
    setSaving(id);
    // Optimistic, because a switch that waits on the network feels broken.
    setPrefs((prev) => (prev ? {
      ...prev,
      events: prev.events.map((e) => (e.event_key === eventKey
        ? { ...e, channels: { ...e.channels, [channel]: next } }
        : e)),
    } : prev));
    try {
      await setPartyNotificationPreference({
        event_key: eventKey, channel: channel as any, enabled: next,
      });
    } catch (err: any) {
      // Put it back and say why. A mandatory notification refuses to be
      // turned off, and that refusal is the feature.
      setPrefs((prev) => (prev ? {
        ...prev,
        events: prev.events.map((e) => (e.event_key === eventKey
          ? { ...e, channels: { ...e.channels, [channel]: !next } }
          : e)),
      } : prev));
      Alert.alert('Not changed', err.message || 'Could not save that preference');
    } finally {
      setSaving(null);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Messages and your data" onBack={() => navigation.goBack()} />
        <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Messages and your data" onBack={() => navigation.goBack()} />
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
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {prefs ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>What we send you</Text>
              <Text style={styles.cardNote}>{prefs.note}</Text>

              <View style={styles.channelLegend}>
                {prefs.channels.map((ch) => (
                  <Text key={ch.key} style={styles.legendText}>
                    {ch.label}
                    {!ch.available ? ' (not available yet)' : ''}
                  </Text>
                ))}
              </View>
            </View>

            {prefs.events.map((e) => (
              <View key={e.event_key} style={styles.card}>
                <View style={styles.eventHead}>
                  <Text style={styles.eventLabel}>{e.label}</Text>
                  {e.mandatory ? (
                    <View style={styles.lockBadge}>
                      <Text style={styles.lockText}>always on</Text>
                    </View>
                  ) : null}
                </View>

                {prefs.channels.map((ch) => {
                  const on = e.channels[ch.key] !== false;
                  const id = `${e.event_key}:${ch.key}`;
                  return (
                    <View key={ch.key} style={styles.switchRow}>
                      <View style={styles.switchText}>
                        <Text style={styles.switchLabel}>{ch.label}</Text>
                        {!ch.available ? (
                          <Text style={styles.switchHint}>
                            Not available in this application yet — nothing is sent on it,
                            and it is recorded as such.
                          </Text>
                        ) : null}
                      </View>
                      <Switch
                        value={on}
                        disabled={e.mandatory || !ch.available || saving === id}
                        onValueChange={(v) => toggle(e.event_key, ch.key, v)}
                        trackColor={{ true: colors.primary, false: colors.border }}
                      />
                    </View>
                  );
                })}
              </View>
            ))}
          </>
        ) : null}

        {/* FR-PO-223/266 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your data</Text>
          <Text style={styles.cardNote}>
            You can take a copy of everything this restaurant holds about your party
            orders, or ask for your personal details to be erased.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setErasure(null);
              try {
                setExported(await exportMyPartyData());
              } catch (err: any) {
                Alert.alert('Could not export', err.message || 'Please try again');
              } finally { setBusy(false); }
            }}
          >
            <Text style={styles.primaryText}>Take a copy of my data</Text>
          </TouchableOpacity>

          {exported ? (
            <View style={styles.outcomeBox}>
              <Text style={styles.outcomeTitle}>Your copy is ready</Text>
              <Text style={styles.outcomeBody}>
                {exported.counts.enquiries} enquiry(ies), {exported.counts.bookings} booking(s),
                {' '}{exported.counts.payments} payment(s), {exported.counts.documents} document(s)
                {' '}and {exported.counts.messages} message(s), as at
                {' '}{String(exported.exported_at).slice(0, 10)}.
              </Text>
              <Text style={styles.outcomeHint}>
                Your documents can be downloaded one by one from each booking. Ask the
                restaurant for the full file if you need it another way.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.dangerBtn}
            disabled={busy}
            onPress={() => Alert.alert(
              'Erase my personal details?',
              'Your name, number, email, address and notes will be removed from every '
              + 'party order the restaurant is no longer required to keep. Invoices and '
              + 'payment records stay, as the law requires, and will no longer be '
              + 'attached to you. This cannot be undone.',
              [
                { text: 'Keep my data', style: 'cancel' },
                {
                  text: 'Erase',
                  style: 'destructive',
                  onPress: async () => {
                    setBusy(true);
                    setExported(null);
                    try {
                      setErasure(await requestMyPartyErasure());
                    } catch (err: any) {
                      Alert.alert('Could not erase', err.message || 'Please try again');
                    } finally { setBusy(false); }
                  },
                },
              ],
            )}
          >
            <Text style={styles.dangerText}>Erase my personal details</Text>
          </TouchableOpacity>

          {erasure ? (() => {
            const msg = erasureMessage(erasure);
            return (
              <View
                style={[
                  styles.outcomeBox,
                  msg.tone === 'warning' ? styles.outcomeWarn : styles.outcomeOk,
                ]}
              >
                <Text style={styles.outcomeTitle}>{msg.title}</Text>
                <Text style={styles.outcomeBody}>{msg.body}</Text>
              </View>
            );
          })() : null}
        </View>

        <Text style={styles.footnote}>
          The restaurant's party order terms and cancellation policy are available at any
          time from the Party Orders section.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },

  errorText: {
    fontSize: 14, fontWeight: '400', lineHeight: 20,
    color: colors.danger, includeFontPadding: false,
  },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 6,
  },
  cardTitle: {
    fontSize: 16, fontWeight: '700', lineHeight: 22,
    color: colors.text, includeFontPadding: false,
  },
  cardNote: {
    fontSize: 13, fontWeight: '400', lineHeight: 19,
    color: colors.textMuted, includeFontPadding: false,
  },

  channelLegend: { marginTop: 4, gap: 2 },
  legendText: {
    fontSize: 12, fontWeight: '400', lineHeight: 17,
    color: colors.textMuted, includeFontPadding: false,
  },

  eventHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eventLabel: {
    flex: 1,
    fontSize: 14.5, fontWeight: '600', lineHeight: 20,
    color: colors.text, includeFontPadding: false,
  },
  lockBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill,
    backgroundColor: colors.iconBg, borderWidth: 1, borderColor: colors.border,
  },
  lockText: {
    fontSize: 11, fontWeight: '600', lineHeight: 15,
    color: colors.textMuted, includeFontPadding: false,
  },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 6,
  },
  switchText: { flex: 1 },
  switchLabel: {
    fontSize: 13.5, fontWeight: '500', lineHeight: 19,
    color: colors.text, includeFontPadding: false,
  },
  switchHint: {
    fontSize: 11.5, fontWeight: '400', lineHeight: 16,
    color: colors.textMuted, includeFontPadding: false, marginTop: 1,
  },

  primaryBtn: {
    marginTop: spacing.sm,
    height: 44, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary,
  },
  primaryText: {
    fontSize: 14.5, fontWeight: '600', lineHeight: 20,
    color: colors.surface, includeFontPadding: false,
  },
  dangerBtn: {
    marginTop: spacing.sm,
    height: 44, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surface,
  },
  dangerText: {
    fontSize: 14.5, fontWeight: '600', lineHeight: 20,
    color: colors.danger, includeFontPadding: false,
  },

  outcomeBox: {
    marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.sm,
    backgroundColor: colors.iconBg, borderWidth: 1, borderColor: colors.border,
    gap: 4,
  },
  outcomeOk: { borderColor: colors.success },
  outcomeWarn: { borderColor: colors.warning },
  outcomeTitle: {
    fontSize: 14, fontWeight: '700', lineHeight: 19,
    color: colors.text, includeFontPadding: false,
  },
  outcomeBody: {
    fontSize: 13, fontWeight: '400', lineHeight: 19,
    color: colors.text, includeFontPadding: false,
  },
  outcomeHint: {
    fontSize: 12, fontWeight: '400', lineHeight: 17,
    color: colors.textMuted, includeFontPadding: false,
  },

  footnote: {
    fontSize: 12, fontWeight: '400', lineHeight: 17,
    color: colors.textMuted, includeFontPadding: false,
  },
});

/**
 * Party Orders — browse what the restaurant offers. BRD group C.
 *
 * FR-PO-034/035: a distinct Party Orders section, reachable from the main
 * navigation, where packages can be browsed WITHOUT registering or logging
 * in. Signing in is only required to submit an enquiry (FR-PO-036), so the
 * sign-in prompt appears at that point rather than at the door.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Linking, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing, statusColors } from '../theme';
import {
  type PartyCatalogue, type PartyPackage,
  fetchPartyCatalogue, formatMoney,
} from '../api/party';

type Props = NativeStackScreenProps<AppStackParamList, 'PartyPackages'>;

export default function PartyPackagesScreen({ navigation }: Props) {
  const { customer } = useAuth();

  const [catalogue, setCatalogue] = useState<PartyCatalogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCatalogue(await fetchPartyCatalogue());
    } catch (err: any) {
      setError(err.message || 'Could not load the party packages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEnquiry = (pkg?: PartyPackage) => {
    // FR-PO-036: registration or login is required before an enquiry can be
    // submitted. Sent to Login with the package remembered, so they come back
    // to the right place rather than starting over.
    if (!customer) {
      navigation.navigate('Login');
      return;
    }
    navigation.navigate('PartyEnquiryForm', { packageId: pkg?.package_id });
  };

  const renderPackage = (pkg: PartyPackage) => {
    const open = expanded === pkg.package_id;
    return (
      <View key={pkg.package_id} style={styles.card}>
        {pkg.images?.length ? (
          <Image source={{ uri: pkg.images[0] }} style={styles.cardImage} resizeMode="cover" />
        ) : null}

        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View style={styles.cardTitleBlock}>
              <Text style={styles.cardTitle}>{pkg.name}</Text>
              {pkg.tier ? <Text style={styles.cardTier}>{pkg.tier}</Text> : null}
            </View>
            <View style={styles.priceBlock}>
              <Text style={styles.price}>{formatMoney(pkg.price_per_head)}</Text>
              <Text style={styles.priceUnit}>per head</Text>
            </View>
          </View>

          <Text style={styles.guestRange}>
            {`For ${pkg.min_guests}${pkg.max_guests ? ` to ${pkg.max_guests}` : ' or more'} guests`}
          </Text>

          {pkg.description ? <Text style={styles.cardDesc}>{pkg.description}</Text> : null}

          {pkg.dietary_tags?.length ? (
            <View style={styles.tagRow}>
              {pkg.dietary_tags.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {pkg.inclusions?.length ? (
            <View style={styles.inclusions}>
              {pkg.inclusions.slice(0, open ? undefined : 4).map((inc, i) => (
                <Text key={i} style={styles.inclusionLine}>{`•  ${inc}`}</Text>
              ))}
              {!open && pkg.inclusions.length > 4 ? (
                <Text style={styles.moreLine}>{`+${pkg.inclusions.length - 4} more`}</Text>
              ) : null}
            </View>
          ) : null}

          {/* FR-PO-004/005/009: the menu, the choices, and the allergens —
              visible before an enquiry is raised, not after. */}
          {open && pkg.courses?.length ? (
            <View style={styles.courses}>
              {pkg.courses.map((course) => (
                <View key={course.course_id} style={styles.course}>
                  <Text style={styles.courseName}>
                    {course.course_name}
                    <Text style={styles.courseLimit}>
                      {course.max_select > 0
                        ? `  choose ${course.min_select === course.max_select
                          ? course.min_select
                          : `${course.min_select}–${course.max_select}`}`
                        : ''}
                    </Text>
                  </Text>
                  <Text style={styles.courseItems}>
                    {course.items.map((i) => i.item_name).join(' · ')}
                  </Text>
                  {course.items.some((i) => i.allergens?.length) ? (
                    <Text style={styles.allergenLine}>
                      {`Contains: ${[...new Set(
                        course.items.flatMap((i) => i.allergens || []),
                      )].join(', ')}`}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.cardActions}>
            {pkg.courses?.length || (pkg.inclusions?.length || 0) > 4 ? (
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => setExpanded(open ? null : pkg.package_id)}
                activeOpacity={0.75}
              >
                <Text style={styles.linkBtnText}>{open ? 'Show less' : 'See the full menu'}</Text>
              </TouchableOpacity>
            ) : <View />}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => startEnquiry(pkg)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Enquire</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Party Orders"
        onBack={() => navigation.goBack()}
        right={customer ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('PartyEnquiries')}
            activeOpacity={0.75}
          >
            <Text style={styles.headerLink}>My enquiries</Text>
          </TouchableOpacity>
        ) : undefined}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
            />
          }
        >
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.intro}>
            <Text style={styles.introTitle}>Planning something bigger?</Text>
            <Text style={styles.introBody}>
              Birthdays, weddings, corporate functions, house parties. Tell us the date, the guest
              count and what you have in mind — we will send you an itemised quotation, and you can
              ask for changes before you accept anything.
            </Text>
          </View>

          {catalogue?.packages.length ? (
            catalogue.packages.map(renderPackage)
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No party packages listed yet</Text>
              <Text style={styles.emptyBody}>
                You can still raise an enquiry and describe what you need — the restaurant will
                quote for it.
              </Text>
            </View>
          )}

          {/* FR-PO-006: add-ons, priced separately from the package. */}
          {catalogue?.addons.length ? (
            <View style={styles.card}>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Add to any package</Text>
                {catalogue.addons.map((a) => (
                  <View key={a.addon_id} style={styles.addonRow}>
                    <View style={styles.addonMain}>
                      <Text style={styles.addonName}>{a.name}</Text>
                      {a.description ? (
                        <Text style={styles.addonDesc}>{a.description}</Text>
                      ) : null}
                      {a.allergens?.length ? (
                        <Text style={styles.allergenLine}>
                          {`Contains: ${a.allergens.join(', ')}`}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.addonPrice}>
                      <Text style={styles.addonPriceText}>{formatMoney(a.price)}</Text>
                      <Text style={styles.priceUnit}>
                        {a.pricing_unit === 'PER_HEAD' ? 'per head'
                          : a.pricing_unit === 'PER_UNIT' ? 'per unit' : 'total'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* FR-PO-224: terms and the cancellation policy, readable at any
              time from within the Party Orders section. */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardBody}
              onPress={() => setShowTerms((v) => !v)}
              activeOpacity={0.75}
            >
              <Text style={styles.cardTitle}>
                {showTerms ? 'Terms and cancellation policy' : 'Terms and cancellation policy  ›'}
              </Text>
              {showTerms ? (
                <>
                  <Text style={styles.termsBody}>
                    {catalogue?.terms_text || 'The restaurant has not published its party order terms yet.'}
                  </Text>
                  <Text style={styles.termsHeading}>Cancellation</Text>
                  <Text style={styles.termsBody}>
                    {catalogue?.cancellation_policy_text
                      || 'The restaurant has not published a cancellation policy yet. Ask your contact before paying an advance.'}
                  </Text>
                  {catalogue?.min_advance_pct ? (
                    <Text style={styles.termsBody}>
                      {`A booking is confirmed once ${catalogue.min_advance_pct}% of the quoted value is paid as an advance. Until then your date is held but not committed.`}
                    </Text>
                  ) : null}
                  {catalogue?.final_headcount_hours ? (
                    <Text style={styles.termsBody}>
                      {`Your final guest count is needed ${catalogue.final_headcount_hours} hours before the event, after which it is locked for the kitchen.`}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </TouchableOpacity>
          </View>

          {/* FR-PO-080: a general number, for a customer who has not yet
              raised an enquiry and so has no assigned contact. */}
          {catalogue?.general_enquiry_number ? (
            <TouchableOpacity
              style={styles.callCard}
              activeOpacity={0.85}
              onPress={() => Linking.openURL(`tel:${catalogue.general_enquiry_number}`)}
            >
              <Text style={styles.callCardLabel}>Would rather talk it through?</Text>
              <Text style={styles.callCardNumber}>{catalogue.general_enquiry_number}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => startEnquiry()}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBtnText}>
              {customer ? 'Raise an enquiry' : 'Sign in to raise an enquiry'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  headerLink: { fontSize: 13, fontWeight: '600', color: colors.primary, includeFontPadding: false },

  intro: { gap: 6 },
  introTitle: { fontSize: 19, fontWeight: '700', color: colors.text, includeFontPadding: false },
  introBody: { fontSize: 13.5, color: colors.textMuted, lineHeight: 20, includeFontPadding: false },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: 150, backgroundColor: colors.iconBg },
  cardBody: { padding: spacing.md, gap: 8 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitleBlock: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, includeFontPadding: false },
  cardTier: { fontSize: 12, fontWeight: '600', color: colors.accent, includeFontPadding: false },
  priceBlock: { alignItems: 'flex-end' },
  price: { fontSize: 18, fontWeight: '800', color: colors.text, includeFontPadding: false },
  priceUnit: { fontSize: 11, color: colors.textMuted, includeFontPadding: false },
  guestRange: { fontSize: 12.5, fontWeight: '600', color: colors.textMuted, includeFontPadding: false },
  cardDesc: { fontSize: 13.5, color: colors.text, lineHeight: 19, includeFontPadding: false },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: radius.pill, backgroundColor: colors.iconBg,
  },
  tagText: { fontSize: 11, fontWeight: '600', color: colors.textMuted, includeFontPadding: false },

  inclusions: { gap: 3 },
  inclusionLine: { fontSize: 13, color: colors.text, lineHeight: 19, includeFontPadding: false },
  moreLine: { fontSize: 12.5, fontWeight: '600', color: colors.primary, includeFontPadding: false },

  courses: {
    gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10,
  },
  course: { gap: 3 },
  courseName: { fontSize: 13.5, fontWeight: '700', color: colors.text, includeFontPadding: false },
  courseLimit: { fontSize: 11.5, fontWeight: '500', color: colors.textMuted, includeFontPadding: false },
  courseItems: { fontSize: 12.5, color: colors.textMuted, lineHeight: 18, includeFontPadding: false },
  allergenLine: { fontSize: 11, fontWeight: '600', color: colors.warning, includeFontPadding: false },

  cardActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.sm, paddingTop: 4,
  },
  linkBtn: { paddingVertical: 4 },
  linkBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary, includeFontPadding: false },
  primaryBtn: {
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  primaryBtnText: { fontSize: 13.5, fontWeight: '700', color: colors.surface, includeFontPadding: false },

  addonRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9,
  },
  addonMain: { flex: 1, gap: 2 },
  addonName: { fontSize: 13.5, fontWeight: '600', color: colors.text, includeFontPadding: false },
  addonDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 17, includeFontPadding: false },
  addonPrice: { alignItems: 'flex-end' },
  addonPriceText: { fontSize: 14, fontWeight: '700', color: colors.text, includeFontPadding: false },

  termsHeading: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 4, includeFontPadding: false },
  termsBody: { fontSize: 12.5, color: colors.textMuted, lineHeight: 19, includeFontPadding: false },

  callCard: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    padding: spacing.md, gap: 3, alignItems: 'center',
  },
  callCardLabel: { fontSize: 12.5, color: colors.surface, opacity: 0.85, includeFontPadding: false },
  callCardNumber: { fontSize: 18, fontWeight: '800', color: colors.surface, includeFontPadding: false },

  ctaBtn: {
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingVertical: 15, alignItems: 'center',
  },
  ctaBtnText: { fontSize: 15, fontWeight: '700', color: colors.surface, includeFontPadding: false },

  errorBox: {
    backgroundColor: statusColors.CANCELLED.bg, borderRadius: radius.md, padding: spacing.sm,
  },
  errorText: { fontSize: 13, color: colors.danger, includeFontPadding: false },

  emptyBox: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, gap: 6, alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, includeFontPadding: false },
  emptyBody: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19, includeFontPadding: false },
});

/**
 * Raise a party enquiry — BRD group C (FR-PO-036..056).
 *
 * The design objective the BRD states: "a customer can describe their event
 * completely enough for the restaurant to quote WITHOUT a telephone call,
 * while still being able to call if they prefer."
 *
 * So the form checks availability for the chosen date as soon as it can
 * (FR-PO-022), shows an indicative range before submission (FR-PO-051), and
 * requires the terms to be acknowledged in the same action as submitting
 * (FR-PO-052). The restaurant's own mandatory fields are enforced server-side,
 * and any per-field error comes back and lands on the field.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing, statusColors } from '../theme';
import {
  MEAL_PERIOD_LABEL, SERVICE_MODE_LABEL,
  type EnquiryPayload, type IndicativePrice, type MealPeriod,
  type PartyAvailability, type PartyCatalogue, type PartyPackage,
  type ServiceMode,
  checkPartyAvailability, createPartyEnquiry, fetchIndicativePrice,
  fetchPartyCatalogue, formatMoney, joinPartyWaitlist,
} from '../api/party';

type Props = NativeStackScreenProps<AppStackParamList, 'PartyEnquiryForm'>;

export default function PartyEnquiryFormScreen({ navigation, route }: Props) {
  const presetPackageId = route.params?.packageId ?? null;

  const [catalogue, setCatalogue] = useState<PartyCatalogue | null>(null);
  const [loading, setLoading] = useState(true);

  const [eventType, setEventType] = useState('');
  const [eventTypeOther, setEventTypeOther] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState('');
  const [mealPeriod, setMealPeriod] = useState<MealPeriod | ''>('');
  const [guestCount, setGuestCount] = useState('');
  const [guestMin, setGuestMin] = useState('');
  const [guestMax, setGuestMax] = useState('');
  const [serviceMode, setServiceMode] = useState<ServiceMode | ''>('');
  const [address, setAddress] = useState('');
  const [packageId, setPackageId] = useState<string | null>(presetPackageId);
  const [selection, setSelection] = useState<Record<string, string[]>>({});
  const [customRequirement, setCustomRequirement] = useState('');
  const [budgetTotal, setBudgetTotal] = useState('');
  const [budgetPerHead, setBudgetPerHead] = useState('');
  const [vegCount, setVegCount] = useState('');
  const [nonVegCount, setNonVegCount] = useState('');
  const [allergenNotes, setAllergenNotes] = useState('');
  const [instructions, setInstructions] = useState('');
  const [email, setEmail] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [availability, setAvailability] = useState<PartyAvailability | null>(null);
  const [checking, setChecking] = useState(false);
  const [indicative, setIndicative] = useState<IndicativePrice | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setCatalogue(await fetchPartyCatalogue());
      } catch (err: any) {
        setError(err.message || 'Could not load the party packages');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedPackage: PartyPackage | null = useMemo(
    () => catalogue?.packages.find((p) => p.package_id === packageId) || null,
    [catalogue, packageId],
  );

  const guests = useMemo(
    () => Number(guestCount) || Number(guestMax) || Number(guestMin) || 0,
    [guestCount, guestMax, guestMin],
  );

  /* FR-PO-022: tell the customer whether the date works before they wait for
     a quotation. Debounced — it fires while they are still typing. */
  useEffect(() => {
    if (!eventDate || !guests) {
      setAvailability(null);
      return undefined;
    }
    let cancelled = false;
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const result = await checkPartyAvailability({
          event_date: eventDate,
          guest_count: guests,
          meal_period: mealPeriod || null,
          service_mode: (serviceMode || 'DINE_IN') as ServiceMode,
          package_id: packageId,
          event_start_time: startTime || null,
        });
        if (!cancelled) setAvailability(result);
      } catch {
        if (!cancelled) setAvailability(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [eventDate, guests, mealPeriod, serviceMode, packageId, startTime]);

  /* FR-PO-051: an indicative range, clearly marked as not a quotation. */
  useEffect(() => {
    if (!packageId || !guests) {
      setIndicative(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await fetchIndicativePrice({
          package_id: packageId,
          guest_count: guests,
          event_date: eventDate || undefined,
          meal_period: mealPeriod || null,
        });
        if (!cancelled) setIndicative(result);
      } catch {
        if (!cancelled) setIndicative(null);
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [packageId, guests, eventDate, mealPeriod]);

  /* FR-PO-005: the selection limits the package permits, enforced here too so
     the customer is told before the server refuses. */
  const selectionErrors = useMemo(() => {
    if (!selectedPackage) return [];
    const errs: string[] = [];
    for (const course of selectedPackage.courses || []) {
      const chosen = selection[course.course_id] || [];
      if (chosen.length < course.min_select) {
        errs.push(`${course.course_name}: choose at least ${course.min_select}`);
      }
      if (course.max_select > 0 && chosen.length > course.max_select) {
        errs.push(`${course.course_name}: choose no more than ${course.max_select}`);
      }
    }
    return errs;
  }, [selectedPackage, selection]);

  const toggleItem = (courseId: string, itemId: string, maxSelect: number) => {
    setSelection((prev) => {
      const current = prev[courseId] || [];
      if (current.includes(itemId)) {
        return { ...prev, [courseId]: current.filter((i) => i !== itemId) };
      }
      if (maxSelect === 1) return { ...prev, [courseId]: [itemId] };
      if (maxSelect > 0 && current.length >= maxSelect) {
        Alert.alert('That is the limit', `This course allows at most ${maxSelect} item(s).`);
        return prev;
      }
      return { ...prev, [courseId]: [...current, itemId] };
    });
  };

  const submit = async (asDraft: boolean) => {
    if (!asDraft && !termsAccepted) {
      setError('Please acknowledge the terms and the cancellation policy to send your enquiry.');
      return;
    }
    if (!asDraft && selectionErrors.length) {
      setError(selectionErrors.join('; '));
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const payload: EnquiryPayload = {
        event_type: eventType,
        event_type_other: eventTypeOther.trim() || null,
        event_date: eventDate,
        event_start_time: startTime,
        duration_minutes: duration.trim() ? Number(duration) : null,
        meal_period: mealPeriod || null,
        guest_count: guestCount.trim() ? Number(guestCount) : null,
        guest_count_min: guestMin.trim() ? Number(guestMin) : null,
        guest_count_max: guestMax.trim() ? Number(guestMax) : null,
        service_mode: (serviceMode || 'DINE_IN') as ServiceMode,
        event_address: address.trim() || null,
        package_id: packageId,
        package_selection: selection,
        custom_requirement: customRequirement.trim() || null,
        budget_total: budgetTotal.trim() ? Number(budgetTotal) : null,
        budget_per_head: budgetPerHead.trim() ? Number(budgetPerHead) : null,
        veg_guest_count: vegCount.trim() ? Number(vegCount) : null,
        nonveg_guest_count: nonVegCount.trim() ? Number(nonVegCount) : null,
        allergen_notes: allergenNotes.trim() || null,
        special_instructions: instructions.trim() || null,
        customer_email: email.trim() || null,
        terms_accepted: termsAccepted,
        submit: !asDraft,
      };

      const result = await createPartyEnquiry(payload);

      if (asDraft) {
        Alert.alert(
          'Draft saved',
          'Your enquiry is saved. Come back to it from My enquiries whenever you are ready.',
        );
      } else {
        Alert.alert(
          `Enquiry ${result.reference} sent`,
          `The restaurant will respond within about ${result.responseTimeHours} hour(s). `
          + 'You can track it, and talk to your named contact, under My enquiries.',
        );
      }
      navigation.replace('PartyEnquiryDetail', { enquiryId: result.enquiry.enquiry_id });
    } catch (err: any) {
      if (err.fields) setFieldErrors(err.fields);
      if (err.code === 'PARTY_OUTSIDE_SERVICE_AREA') {
        // FR-PO-045: offer to submit for manual consideration rather than
        // leaving the customer at a dead end.
        Alert.alert(
          'That address is outside our usual area',
          `${err.message}\n\nWould you like us to consider it anyway?`,
          [
            { text: 'Change the address', style: 'cancel' },
            {
              text: 'Submit anyway',
              onPress: async () => {
                try {
                  const retry = await createPartyEnquiry({
                    ...({} as EnquiryPayload),
                    event_type: eventType,
                    event_date: eventDate,
                    event_start_time: startTime,
                    service_mode: (serviceMode || 'DELIVERY') as ServiceMode,
                    guest_count: guestCount.trim() ? Number(guestCount) : null,
                    guest_count_min: guestMin.trim() ? Number(guestMin) : null,
                    guest_count_max: guestMax.trim() ? Number(guestMax) : null,
                    meal_period: mealPeriod || null,
                    event_address: address.trim() || null,
                    package_id: packageId,
                    package_selection: selection,
                    custom_requirement: customRequirement.trim() || null,
                    allergen_notes: allergenNotes.trim() || null,
                    special_instructions: instructions.trim() || null,
                    customer_email: email.trim() || null,
                    service_area_override: true,
                    terms_accepted: termsAccepted,
                    submit: true,
                  });
                  navigation.replace('PartyEnquiryDetail', {
                    enquiryId: retry.enquiry.enquiry_id,
                  });
                } catch (e: any) {
                  setError(e.message || 'Could not send the enquiry');
                }
              },
            },
          ],
        );
      } else {
        setError(err.message || 'Could not send your enquiry');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const offPremise = serviceMode === 'DELIVERY' || serviceMode === 'FULL_CATERING';

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="New enquiry" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="New party enquiry" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
        ) : null}

        {/* ---------------- the occasion ---------------- */}
        <Section title="What is the occasion?">
          <View style={styles.chipWrap}>
            {catalogue?.event_types.map((t) => (
              <TouchableOpacity
                key={t.code}
                style={[styles.chip, eventType === t.code && styles.chipOn]}
                onPress={() => setEventType(t.code)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, eventType === t.code && styles.chipTextOn]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {fieldErrors.event_type ? <FieldError text={fieldErrors.event_type} /> : null}
          {eventType === 'OTHER' ? (
            <Field
              label="Tell us what kind of event"
              value={eventTypeOther}
              onChange={setEventTypeOther}
              error={fieldErrors.event_type_other}
            />
          ) : null}
        </Section>

        {/* ---------------- date, time, guests ---------------- */}
        <Section title="When, and how many">
          <View style={styles.row}>
            <Field
              label="Date"
              value={eventDate}
              onChange={setEventDate}
              placeholder="YYYY-MM-DD"
              error={fieldErrors.event_date}
            />
            <Field
              label="Start time"
              value={startTime}
              onChange={setStartTime}
              placeholder="19:00"
              error={fieldErrors.event_start_time}
            />
          </View>

          <Text style={styles.label}>Meal period</Text>
          <View style={styles.chipWrap}>
            {(Object.keys(MEAL_PERIOD_LABEL) as MealPeriod[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, mealPeriod === m && styles.chipOn]}
                onPress={() => setMealPeriod(mealPeriod === m ? '' : m)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, mealPeriod === m && styles.chipTextOn]}>
                  {MEAL_PERIOD_LABEL[m]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            <Field
              label="Guests"
              value={guestCount}
              onChange={setGuestCount}
              keyboardType="numeric"
              placeholder="e.g. 150"
              error={fieldErrors.guest_count}
            />
            <Field label="…or from" value={guestMin} onChange={setGuestMin} keyboardType="numeric" />
            <Field label="…to" value={guestMax} onChange={setGuestMax} keyboardType="numeric" />
          </View>
          <Text style={styles.hint}>
            A rough range is fine for now. You will confirm a firm number before the event.
          </Text>
          <Field
            label="Roughly how long? (minutes)"
            value={duration}
            onChange={setDuration}
            keyboardType="numeric"
            placeholder="180"
          />
        </Section>

        {/* ---------------- availability (FR-PO-022) ---------------- */}
        {eventDate && guests ? (
          <Section title="Is that date free?">
            {checking ? (
              <Text style={styles.hint}>Checking…</Text>
            ) : availability ? (
              <>
                <View style={availability.available ? styles.okBox : styles.warnBox}>
                  <Text style={availability.available ? styles.okText : styles.warnText}>
                    {availability.message}
                  </Text>
                </View>
                {availability.reasons.map((r, i) => (
                  <Text key={i} style={styles.hint}>{r.message}</Text>
                ))}
                {/* FR-PO-030: the waiting list, offered where the date is full
                    rather than simply turning the customer away. */}
                {!availability.available ? (
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    activeOpacity={0.8}
                    onPress={async () => {
                      try {
                        await joinPartyWaitlist({
                          event_date: eventDate,
                          guest_count: guests,
                          meal_period: mealPeriod || null,
                        });
                        Alert.alert(
                          'You are on the waiting list',
                          'We will let you know if this date frees up.',
                        );
                      } catch (err: any) {
                        Alert.alert('Could not join the list', err.message || 'Please try again.');
                      }
                    }}
                  >
                    <Text style={styles.secondaryBtnText}>Join the waiting list for this date</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : null}
          </Section>
        ) : null}

        {/* ---------------- how it is served ---------------- */}
        <Section title="Where would you like it?">
          <View style={styles.chipWrap}>
            {(Object.keys(SERVICE_MODE_LABEL) as ServiceMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, serviceMode === m && styles.chipOn]}
                onPress={() => setServiceMode(m)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, serviceMode === m && styles.chipTextOn]}>
                  {SERVICE_MODE_LABEL[m]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {fieldErrors.service_mode ? <FieldError text={fieldErrors.service_mode} /> : null}

          {offPremise ? (
            <Field
              label="Event address"
              value={address}
              onChange={setAddress}
              multiline
              placeholder="Where should we deliver or cater?"
              error={fieldErrors.event_address}
            />
          ) : null}
        </Section>

        {/* ---------------- the menu ---------------- */}
        <Section title="What would you like served?">
          <View style={styles.chipWrap}>
            {catalogue?.packages.map((p) => {
              const on = packageId === p.package_id;
              const outOfRange = Boolean(
                guests && ((p.min_guests && guests < p.min_guests)
                  || (p.max_guests && guests > p.max_guests)),
              );
              return (
                <TouchableOpacity
                  key={p.package_id}
                  // FR-PO-003: a package outside its guest range cannot be chosen.
                  disabled={outOfRange}
                  style={[styles.chip, on && styles.chipOn, outOfRange && styles.chipOff]}
                  onPress={() => {
                    setPackageId(on ? null : p.package_id);
                    setSelection({});
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.chipText, on && styles.chipTextOn, outOfRange && styles.chipTextOff,
                  ]}
                  >
                    {p.tier ? `${p.name} · ${p.tier}` : p.name}
                    {outOfRange
                      ? ` · ${p.min_guests}${p.max_guests ? `–${p.max_guests}` : '+'} guests only`
                      : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* FR-PO-005/009: choose within the package, and see the allergens. */}
          {selectedPackage?.courses?.length ? (
            <View style={styles.courses}>
              {selectedPackage.courses.map((course) => {
                const chosen = selection[course.course_id] || [];
                const short = chosen.length < course.min_select;
                return (
                  <View key={course.course_id} style={styles.course}>
                    <Text style={[styles.courseName, short && styles.courseNameShort]}>
                      {course.course_name}
                      <Text style={styles.courseLimit}>
                        {`  choose ${course.min_select === course.max_select
                          ? course.min_select
                          : `${course.min_select}–${course.max_select}`} · ${chosen.length} chosen`}
                      </Text>
                    </Text>
                    <View style={styles.chipWrap}>
                      {course.items.map((item) => {
                        const on = chosen.includes(item.package_item_id);
                        return (
                          <TouchableOpacity
                            key={item.package_item_id}
                            style={[styles.itemChip, on && styles.chipOn]}
                            onPress={() => toggleItem(
                              course.course_id, item.package_item_id, course.max_select,
                            )}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.chipText, on && styles.chipTextOn]}>
                              {item.item_name}
                              {Number(item.extra_per_head) > 0
                                ? ` +${formatMoney(item.extra_per_head)}`
                                : ''}
                            </Text>
                            {item.allergens?.length ? (
                              <Text style={styles.allergenTag}>
                                {`contains ${item.allergens.join(', ')}`}
                              </Text>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {selectionErrors.length ? (
            <View style={styles.warnBox}>
              {selectionErrors.map((e, i) => (
                <Text key={i} style={styles.warnText}>{e}</Text>
              ))}
            </View>
          ) : null}

          {/* FR-PO-051 */}
          {indicative ? (
            <View style={styles.indicativeBox}>
              <Text style={styles.indicativeAmount}>
                {`${formatMoney(indicative.from)} – ${formatMoney(indicative.to)}`}
              </Text>
              <Text style={styles.indicativeNote}>{indicative.disclaimer}</Text>
              <Text style={styles.indicativeExcludes}>
                {`Excludes: ${indicative.excludes.join('; ')}`}
              </Text>
            </View>
          ) : null}

          {/* FR-PO-046: or describe it, and ask for a custom quote. */}
          <Field
            label="Or tell us what you have in mind"
            value={customRequirement}
            onChange={setCustomRequirement}
            multiline
            placeholder="Describe the menu or the style of event you want"
          />
        </Section>

        {/* ---------------- the detail ---------------- */}
        <Section title="Anything else we should know?">
          <View style={styles.row}>
            <Field
              label="Your budget (total)"
              value={budgetTotal}
              onChange={setBudgetTotal}
              keyboardType="numeric"
            />
            <Field
              label="…or per head"
              value={budgetPerHead}
              onChange={setBudgetPerHead}
              keyboardType="numeric"
            />
          </View>
          <Text style={styles.hint}>
            Telling us your budget helps us quote something you will actually want.
          </Text>

          <View style={styles.row}>
            <Field
              label="Vegetarian guests"
              value={vegCount}
              onChange={setVegCount}
              keyboardType="numeric"
            />
            <Field
              label="Non-vegetarian guests"
              value={nonVegCount}
              onChange={setNonVegCount}
              keyboardType="numeric"
            />
          </View>

          <Field
            label="Allergies and dietary restrictions"
            value={allergenNotes}
            onChange={setAllergenNotes}
            multiline
            placeholder="Anything our kitchen must avoid"
          />
          <Field
            label="Special instructions"
            value={instructions}
            onChange={setInstructions}
            multiline
          />
          <Field
            label="Email address"
            value={email}
            onChange={setEmail}
            keyboardType="email-address"
            placeholder="For your quotation and receipts"
            error={fieldErrors.customer_email}
          />
        </Section>

        {/* ---------------- terms (FR-PO-052) ---------------- */}
        <Section title="Before you send this">
          <Text style={styles.termsBody}>
            {catalogue?.terms_text
              || 'The restaurant will send you an itemised quotation. You can ask for changes, and nothing is committed until you accept it and pay the advance.'}
          </Text>
          <Text style={styles.termsHeading}>Cancellation</Text>
          <Text style={styles.termsBody}>
            {catalogue?.cancellation_policy_text
              || 'Ask your contact about the cancellation policy before paying an advance.'}
          </Text>
          <View style={styles.switchRow}>
            <Switch
              value={termsAccepted}
              onValueChange={setTermsAccepted}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
            <Text style={styles.switchLabel}>
              I have read and accept the party order terms and the cancellation policy
            </Text>
          </View>
        </Section>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.draftBtn}
          onPress={() => submit(true)}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Text style={styles.draftBtnText}>Save for later</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sendBtn, (submitting || !termsAccepted) && styles.sendBtnOff]}
          onPress={() => submit(false)}
          disabled={submitting || !termsAccepted}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <Text style={styles.sendBtnText}>Send enquiry</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Atoms                                                               */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label, value, onChange, placeholder, keyboardType, multiline, error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  multiline?: boolean;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, error && styles.inputError]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
      />
      {error ? <FieldError text={error} /> : null}
    </View>
  );
}

function FieldError({ text }: { text: string }) {
  return <Text style={styles.fieldError}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },

  section: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: 9,
  },
  sectionTitle: { fontSize: 15.5, fontWeight: '700', color: colors.text },

  field: { flexGrow: 1, flexShrink: 1, flexBasis: 120, gap: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  label: { fontSize: 11.5, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  input: {
    height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, fontSize: 14.5, color: colors.text, backgroundColor: colors.surface,
  },
  inputMultiline: {
    height: undefined, minHeight: 76, paddingTop: 11, paddingBottom: 11, textAlignVertical: 'top',
  },
  inputError: { borderColor: colors.danger },
  fieldError: { fontSize: 11.5, color: colors.danger },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.iconBg,
  },
  itemChip: {
    paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 1,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipOff: { opacity: 0.45 },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextOn: { color: colors.surface },
  chipTextOff: { color: colors.textMuted },
  allergenTag: { fontSize: 10, color: colors.warning },

  courses: { gap: 11, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  course: { gap: 5 },
  courseName: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  courseNameShort: { color: colors.warning },
  courseLimit: { fontSize: 11.5, fontWeight: '500', color: colors.textMuted },

  okBox: {
    backgroundColor: statusColors.CLOSED.bg, borderRadius: radius.sm, padding: spacing.sm,
  },
  okText: { fontSize: 13, fontWeight: '600', color: statusColors.CLOSED.fg, lineHeight: 18 },
  warnBox: {
    backgroundColor: statusColors.OPEN.bg, borderRadius: radius.sm, padding: spacing.sm, gap: 3,
  },
  warnText: { fontSize: 13, fontWeight: '600', color: statusColors.OPEN.fg, lineHeight: 18 },
  errorBox: {
    backgroundColor: statusColors.CANCELLED.bg, borderRadius: radius.md, padding: spacing.sm,
  },
  errorText: { fontSize: 13, color: statusColors.CANCELLED.fg, lineHeight: 18 },

  indicativeBox: {
    backgroundColor: colors.iconBg, borderRadius: radius.md, padding: spacing.sm, gap: 3,
  },
  indicativeAmount: { fontSize: 19, fontWeight: '800', color: colors.text },
  indicativeNote: { fontSize: 11.5, color: colors.textMuted, lineHeight: 16 },
  indicativeExcludes: { fontSize: 11, color: colors.textMuted, lineHeight: 15 },

  termsHeading: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 3 },
  termsBody: { fontSize: 12.5, color: colors.textMuted, lineHeight: 19 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: 4 },
  switchLabel: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },

  footer: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  draftBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    paddingHorizontal: 18, paddingVertical: 14, justifyContent: 'center',
  },
  draftBtnText: { fontSize: 14, fontWeight: '600', color: colors.text },
  sendBtn: {
    flex: 1, backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.5 },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: colors.surface },

  secondaryBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 11, alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 13.5, fontWeight: '700', color: colors.primary },
});

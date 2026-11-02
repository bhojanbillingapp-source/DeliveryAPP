/**
 * Party Orders — the customer side of BRD 7.35 (groups C, and the customer
 * half of E, F and G).
 *
 * Every call here reads or writes the SAME record the restaurant's staff work
 * from (BRD 4.4). There is no customer-side copy of a status, so a status
 * changed by staff is visible here within seconds with no publish step.
 */

import api from './client';

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

export type PartyStatus =
  | 'DRAFT' | 'SUBMITTED' | 'ACKNOWLEDGED' | 'QUALIFIED'
  | 'QUOTE_ISSUED' | 'UNDER_NEGOTIATION' | 'QUOTE_REVISED'
  | 'QUOTE_ACCEPTED' | 'QUOTE_DECLINED' | 'QUOTE_EXPIRED' | 'LOST';

export type ServiceMode = 'DINE_IN' | 'DELIVERY' | 'FULL_CATERING';
export type MealPeriod = 'BREAKFAST' | 'LUNCH' | 'HI_TEA' | 'DINNER';

export const SERVICE_MODE_LABEL: Record<ServiceMode, string> = {
  DINE_IN: 'At the restaurant',
  DELIVERY: 'Delivered to my address',
  FULL_CATERING: 'Full catering at my venue',
};

export const MEAL_PERIOD_LABEL: Record<MealPeriod, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  HI_TEA: 'Hi-tea',
  DINNER: 'Dinner',
};

/**
 * Which statuses are still live. Drives whether the enquiry appears under
 * "Current" or "Past" in the list.
 */
export const CLOSED_STATUSES: PartyStatus[] = [
  'QUOTE_DECLINED', 'QUOTE_EXPIRED', 'LOST',
];

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface PartyPackageItem {
  package_item_id: string;
  item_name: string;
  is_default: boolean;
  extra_per_head: number;
  dietary_tags: string[];
  allergens: string[];
}

export interface PartyPackageCourse {
  course_id: string;
  package_id: string;
  course_name: string;
  category: string | null;
  min_select: number;
  max_select: number;
  items: PartyPackageItem[];
}

export interface PartyPackage {
  package_id: string;
  name: string;
  description: string | null;
  tier: string | null;
  price_per_head: number;
  min_guests: number;
  max_guests: number | null;
  images: string[];
  inclusions: string[];
  dietary_tags: string[];
  pricing_basis: 'PER_HEAD' | 'A_LA_CARTE';
  courses: PartyPackageCourse[];
}

export interface PartyAddon {
  addon_id: string;
  name: string;
  description: string | null;
  addon_type: string;
  price: number;
  pricing_unit: 'PER_HEAD' | 'FLAT' | 'PER_UNIT';
  dietary_tags: string[];
  allergens: string[];
}

export interface PartyCatalogue {
  packages: PartyPackage[];
  addons: PartyAddon[];
  event_types: { code: string; label: string }[];
  service_modes: { code: ServiceMode; label: string }[];
  meal_periods: MealPeriod[];
  terms_text: string | null;
  cancellation_policy_text: string | null;
  general_enquiry_number: string | null;
  min_advance_pct: number;
  final_headcount_hours: number;
}

export interface PartyContact {
  contact_id: string;
  display_name: string;
  designation: string | null;
  photo_url: string | null;
  phone: string;
  email: string | null;
  working_hours: { day: number; from: string; to: string }[];
  availability: {
    available: boolean;
    hours_configured: boolean;
    until?: string;
    next_available: { day: number; from: string; to: string; days_ahead: number } | null;
  };
}

export interface PartyTimelineEntry {
  history_id: string;
  track: string;
  to_status: PartyStatus;
  label: string;
  actor_type: 'STAFF' | 'CUSTOMER' | 'SYSTEM';
  actor_name: string | null;
  changed_at: string;
}

export interface PartyActivityEntry {
  log_id: string;
  entry_type: string;
  direction: 'INBOUND' | 'OUTBOUND' | null;
  channel: string | null;
  summary: string;
  actor_type: string;
  actor_name: string | null;
  created_at: string;
}

export interface PartyQuotationSummary {
  quotation_id: string;
  quotation_no: string;
  version: number;
  status: 'ISSUED' | 'SUPERSEDED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN';
  status_label: string;
  label: string | null;
  guest_count: number;
  event_date: string;
  total_value: number;
  tax_amount: number;
  discount_amount: number;
  min_advance_amount: number;
  valid_until: string | null;
  issued_at: string | null;
  accepted_at: string | null;
  change_summary: {
    field: string; label: string;
    from?: string | number | null; to?: string | number | null;
    amount?: string; direction?: 'UP' | 'DOWN';
  }[];
}

export interface PartyQuotationLine {
  line_id: string;
  line_type: 'PACKAGE' | 'ITEM' | 'ADDON' | 'CHARGE';
  name: string;
  description: string | null;
  pricing_unit: 'PER_HEAD' | 'FLAT' | 'PER_UNIT';
  quantity: number;
  unit_price: number;
  line_gross: number;
  discount_amount: number;
  taxable_value: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  is_optional: boolean;
  allergens: string[];
  dietary_tags: string[];
  courses?: {
    course_id: string;
    course_name: string;
    min_select: number;
    max_select: number;
    selected: { package_item_id: string; item_name?: string }[];
    available: { package_item_id: string; item_name: string }[];
  }[];
}

export interface PartyNegotiationMessage {
  message_id: string;
  body: string;
  author_type: 'CUSTOMER' | 'STAFF';
  author_name: string | null;
  line_id: string | null;
  line_name?: string | null;
  created_at: string;
}

export interface PartyChangeRequest {
  request_id: string;
  general_comment: string | null;
  line_comments: { line_id: string; comment: string }[];
  proposed_guest_count: number | null;
  proposed_event_date: string | null;
  proposed_menu_note: string | null;
  status: 'OPEN' | 'REVISED' | 'DECLINED' | 'ALTERNATIVE_PROPOSED';
  response_note: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface PartyQuotation extends PartyQuotationSummary {
  enquiry_id: string;
  enquiry_no: string;
  meal_period: MealPeriod | null;
  service_mode: ServiceMode;
  venue_name: string | null;
  event_start_time: string | null;
  food_value: number;
  addon_value: number;
  charges_value: number;
  gross_value: number;
  taxable_value: number;
  payment_schedule: {
    name: string; amount: number; due_date: string | null;
    due_label: string; is_advance: boolean;
  }[];
  tax_treatment: { rate_percent: number; supply_type: string };
  lines: PartyQuotationLine[];
  /** FR-PO-238: how long the restaurant is holding the date for you. */
  date_held_until: string | null;
  assigned_contact: PartyContact | null;
  decline_reasons: { code: string; label: string }[];
  terms_text: string | null;
  cancellation_policy_text: string | null;
  fssai_licence_no: string | null;
  is_expired: boolean;
}

/**
 * The booking an enquiry became, where one exists. Reported by the backend on
 * both the list and the detail (Phase 2), so the app never has to guess at a
 * booking id.
 */
export interface PartyBookingRef {
  booking_id: string;
  booking_no: string;
  booking_status: BookingStatus;
  booking_status_label: string;
  financial_status: FinancialStatus;
  financial_status_label: string;
}

export interface PartyEnquirySummary {
  enquiry_id: string;
  enquiry_no: string;
  status: PartyStatus;
  status_label: string;
  /** Phase 2: set once an advance has confirmed the accepted quotation. */
  booking_id?: string | null;
  booking_no?: string | null;
  booking_status?: BookingStatus | null;
  booking_status_label?: string | null;
  financial_status?: FinancialStatus | null;
  financial_status_label?: string | null;
  amount_paid?: number | null;
  booking_value?: number | null;
  event_type: string | null;
  event_type_label: string | null;
  event_date: string | null;
  event_start_time: string | null;
  guest_count: number | null;
  guest_count_min: number | null;
  guest_count_max: number | null;
  service_mode: ServiceMode | null;
  package_name: string | null;
  restaurant_name: string | null;
  outlet_id: string;
  created_at: string;
  quotation_id: string | null;
  quotation_no: string | null;
  quotation_status: string | null;
  total_value: number | null;
  valid_until: string | null;
  min_advance_amount: number | null;
}

export interface PartyEnquiryDetail extends PartyEnquirySummary {
  event_type_other: string | null;
  duration_minutes: number | null;
  meal_period: MealPeriod | null;
  event_address: string | null;
  package_id: string | null;
  package_selection: Record<string, string[]>;
  custom_requirement: string | null;
  budget_total: number | null;
  budget_per_head: number | null;
  veg_guest_count: number | null;
  nonveg_guest_count: number | null;
  dietary_requirements: string[];
  allergen_notes: string | null;
  special_instructions: string | null;
  venue_name: string | null;
  customer_name: string;
  customer_mobile: string;
  customer_email: string | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
  assigned_contact: PartyContact | null;
  alternative_contact: (PartyContact & { is_escalation: boolean }) | null;
  timeline: PartyTimelineEntry[];
  quotations: PartyQuotationSummary[];
  activity: PartyActivityEntry[];
  terms_text: string | null;
  cancellation_policy_text: string | null;
  /** Phase 2: the booking this enquiry became, or null if not yet confirmed. */
  booking: PartyBookingRef | null;
}

export interface PartyAvailability {
  available: boolean;
  message: string;
  reasons: { type: string; message: string }[];
  lead_hours_required: number;
}

export interface IndicativePrice {
  is_indicative: true;
  disclaimer: string;
  price_per_head: number;
  guest_count: number;
  from: number;
  to: number;
  excludes: string[];
}

export interface EnquiryPayload {
  event_type: string;
  event_type_other?: string | null;
  event_date: string;
  event_start_time: string;
  duration_minutes?: number | null;
  meal_period?: MealPeriod | null;
  guest_count?: number | null;
  guest_count_min?: number | null;
  guest_count_max?: number | null;
  service_mode: ServiceMode;
  event_address?: string | null;
  event_latitude?: number | null;
  event_longitude?: number | null;
  service_area_override?: boolean;
  package_id?: string | null;
  package_selection?: Record<string, string[]>;
  custom_requirement?: string | null;
  budget_total?: number | null;
  budget_per_head?: number | null;
  veg_guest_count?: number | null;
  nonveg_guest_count?: number | null;
  dietary_requirements?: string[];
  allergen_notes?: string | null;
  special_instructions?: string | null;
  customer_email?: string | null;
  /** FR-PO-052: the terms must be acknowledged before submission. */
  terms_accepted: boolean;
  /** FR-PO-054: false saves a draft to come back to. */
  submit?: boolean;
  /** FR-PO-056: set when the enquiry was captured offline and queued. */
  client_submitted_at?: string;
}

/* ------------------------------------------------------------------ */
/* Errors                                                             */
/* ------------------------------------------------------------------ */

export interface PartyError extends Error {
  code?: string;
  fields?: Record<string, string>;
  detail?: Record<string, any>;
  status?: number;
}

/** Normalise an axios failure so screens can read `fields` and `code`. */
export function toPartyError(err: any): PartyError {
  const data = err?.response?.data;
  const e = new Error(data?.message || err?.message || 'Something went wrong') as PartyError;
  e.status = err?.response?.status;
  e.code = data?.code;
  e.fields = data?.fields;
  e.detail = data?.detail;
  return e;
}

async function unwrap<T>(p: Promise<{ data: any }>): Promise<T> {
  try {
    const { data } = await p;
    return data.data as T;
  } catch (err) {
    throw toPartyError(err);
  }
}

const BASE = '/customer-order/party';

/* ------------------------------------------------------------------ */
/* Browse — works without signing in (FR-PO-035)                       */
/* ------------------------------------------------------------------ */

export const fetchPartyCatalogue = (outletId?: string) =>
  unwrap<PartyCatalogue>(api.get(`${BASE}/packages`, {
    params: outletId ? { outlet_id: outletId } : undefined,
  }));

export const fetchPartyTerms = (outletId?: string) =>
  unwrap<{
    terms_text: string | null;
    cancellation_policy_text: string | null;
    general_enquiry_number: string | null;
    min_advance_pct: number;
    final_headcount_hours: number;
    guarantee_pct: number;
    fssai_licence_no: string | null;
  }>(api.get(`${BASE}/terms`, { params: outletId ? { outlet_id: outletId } : undefined }));

/** FR-PO-022: is the date available, before a quote is prepared? */
export const checkPartyAvailability = (params: {
  event_date: string;
  guest_count: number;
  meal_period?: MealPeriod | null;
  service_mode?: ServiceMode;
  package_id?: string | null;
  event_start_time?: string | null;
  outlet_id?: string;
}) => unwrap<PartyAvailability>(api.get(`${BASE}/availability`, { params }));

/** FR-PO-051: an indicative range, explicitly not a quotation. */
export const fetchIndicativePrice = (params: {
  package_id: string;
  guest_count: number;
  event_date?: string;
  meal_period?: MealPeriod | null;
  outlet_id?: string;
}) => unwrap<IndicativePrice>(api.get(`${BASE}/indicative-price`, { params }));

/* ------------------------------------------------------------------ */
/* My party orders — requires a signed-in customer (FR-PO-036)         */
/* ------------------------------------------------------------------ */

/** FR-PO-055: every enquiry, quote, booking and past event in one list. */
export const fetchMyPartyEnquiries = (allOutlets = false) =>
  unwrap<PartyEnquirySummary[]>(api.get(`${BASE}/enquiries`, {
    params: allOutlets ? { all: 'true' } : undefined,
  }));

export const fetchPartyEnquiry = (enquiryId: string) =>
  unwrap<PartyEnquiryDetail>(api.get(`${BASE}/enquiries/${enquiryId}`));

export async function createPartyEnquiry(payload: EnquiryPayload) {
  try {
    const { data } = await api.post(`${BASE}/enquiries`, payload);
    return {
      enquiry: data.data as PartyEnquiryDetail,
      reference: data.reference as string,
      responseTimeHours: data.response_time_hours as number,
      serviceArea: data.service_area as {
        within: boolean | null; distance_km?: number; radius_km?: number;
      },
    };
  } catch (err) {
    throw toPartyError(err);
  }
}

export const updatePartyEnquiry = (enquiryId: string, payload: Partial<EnquiryPayload>) =>
  unwrap<PartyEnquiryDetail>(api.put(`${BASE}/enquiries/${enquiryId}`, payload));

export const submitPartyEnquiry = (enquiryId: string, termsAccepted = true) =>
  unwrap<PartyEnquiryDetail>(api.post(`${BASE}/enquiries/${enquiryId}/submit`, {
    terms_accepted: termsAccepted,
  }));

/* ------------------------------------------------------------------ */
/* The restaurant's contact (FR-PO-071..076)                           */
/* ------------------------------------------------------------------ */

export const fetchPartyContact = (enquiryId: string) =>
  unwrap<{
    contact: PartyContact | null;
    alternative: (PartyContact & { is_escalation: boolean }) | null;
    general_enquiry_number: string | null;
    messaging_enabled: boolean;
  }>(api.get(`${BASE}/enquiries/${enquiryId}/contact`));

/**
 * FR-PO-072: the app dials the number itself; this records that the call was
 * made, so the restaurant's log of the conversation is complete.
 */
export const logPartyCall = (enquiryId: string) =>
  unwrap<{ logged: boolean }>(api.post(`${BASE}/enquiries/${enquiryId}/call`));

/** FR-PO-075: ask to be called back at a stated time. */
export const requestPartyCallback = (enquiryId: string, requestedFor: string, note?: string) =>
  unwrap<{ callback_id: string; requested_for: string }>(
    api.post(`${BASE}/enquiries/${enquiryId}/callback`, { requested_for: requestedFor, note }),
  );

/* ------------------------------------------------------------------ */
/* Quotation (FR-PO-100..112)                                          */
/* ------------------------------------------------------------------ */

/** Opening it records the first view, which the restaurant can see. */
export const fetchPartyQuotation = (quotationId: string) =>
  unwrap<PartyQuotation>(api.get(`${BASE}/quotations/${quotationId}`));

/**
 * FR-PO-108/109/110: accept, with the terms acknowledged in the same action.
 * Acceptance alone does NOT confirm the booking — the advance does.
 */
export async function acceptPartyQuotation(quotationId: string, termsAcknowledged: boolean) {
  try {
    const { data } = await api.post(`${BASE}/quotations/${quotationId}/accept`, {
      terms_acknowledged: termsAcknowledged,
    });
    return {
      quotation: data.data as {
        quotation_id: string; quotation_no: string; status: string;
        accepted_at: string; total_value: number; min_advance_amount: number;
        payment_schedule: PartyQuotation['payment_schedule'];
        date_held_until: string | null;
      },
      message: data.message as string,
    };
  } catch (err) {
    throw toPartyError(err);
  }
}

export const declinePartyQuotation = (quotationId: string, reason?: string, note?: string) =>
  unwrap<{ quotation_id: string; status: string }>(
    api.post(`${BASE}/quotations/${quotationId}/decline`, { reason, note }),
  );

/**
 * FR-PO-102/106: request changes, optionally proposing a different guest
 * count, date or menu. A proposed date is revalidated for availability before
 * the restaurant is asked to respond.
 */
export const requestPartyChanges = (quotationId: string, payload: {
  general_comment?: string;
  line_comments?: { line_id: string; comment: string }[];
  proposed_guest_count?: number | null;
  proposed_event_date?: string | null;
  proposed_meal_period?: MealPeriod | null;
  proposed_menu_note?: string | null;
}) => unwrap<PartyChangeRequest>(
  api.post(`${BASE}/quotations/${quotationId}/change-request`, payload),
);

export const postPartyMessage = (quotationId: string, body: string, lineId?: string) =>
  unwrap<PartyNegotiationMessage>(
    api.post(`${BASE}/quotations/${quotationId}/messages`, { body, line_id: lineId }),
  );

/** FR-PO-030: join the waiting list for a date that is full. */
export const joinPartyWaitlist = (payload: {
  event_date: string;
  guest_count: number;
  meal_period?: MealPeriod | null;
  enquiry_id?: string;
  outlet_id?: string;
}) => unwrap<{ waitlist_id: string }>(api.post(`${BASE}/waitlist`, payload));

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

export function formatMoney(amount: number | string | null | undefined, decimals = 0) {
  const n = Number(amount) || 0;
  return `₹${n.toFixed(decimals)}`;
}

export function formatEventWhen(e: {
  event_date?: string | null;
  event_start_time?: string | null;
  meal_period?: MealPeriod | null;
}) {
  if (!e.event_date) return 'Date not set';
  const d = new Date(`${e.event_date}T00:00:00`);
  const datePart = Number.isNaN(d.getTime())
    ? e.event_date
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const time = e.event_start_time ? String(e.event_start_time).slice(0, 5) : null;
  const slot = e.meal_period ? MEAL_PERIOD_LABEL[e.meal_period] : null;
  return [datePart, time, slot].filter(Boolean).join(' · ');
}

export function formatGuests(e: {
  guest_count?: number | null;
  guest_count_min?: number | null;
  guest_count_max?: number | null;
}) {
  if (e.guest_count) return `${e.guest_count} guests`;
  if (e.guest_count_min && e.guest_count_max) {
    return `${e.guest_count_min}–${e.guest_count_max} guests`;
  }
  const one = e.guest_count_max ?? e.guest_count_min;
  return one ? `~${one} guests` : 'Guest count not set';
}

/** "2 days left", "4 hours left" — or null once it has passed. */
export function timeLeft(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return null;
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} minutes left`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hours left`;
  return `${Math.round(hours / 24)} days left`;
}

/* ================================================================== */
/* PHASE 2 — the confirmed booking (BRD groups H, I, J)                */
/* ================================================================== */

export type BookingStatus =
  | 'CONFIRMED' | 'AWAITING_FINAL_COUNT' | 'LOCKED_FOR_PRODUCTION'
  | 'IN_PRODUCTION' | 'DISPATCHED' | 'IN_SERVICE' | 'COMPLETED' | 'CANCELLED';

export type FinancialStatus =
  | 'AWAITING_ADVANCE' | 'PART_PAID' | 'FULLY_PAID' | 'PAYMENT_OVERDUE'
  | 'SETTLEMENT_PENDING' | 'SETTLED' | 'CANCELLATION_REQUESTED'
  | 'REFUND_APPROVED' | 'REFUND_PROCESSING' | 'REFUND_COMPLETED'
  | 'CANCELLED_WITH_FORFEITURE';

export type PartyDocType =
  | 'RECEIPT_VOUCHER' | 'TAX_INVOICE' | 'CREDIT_NOTE' | 'REFUND_VOUCHER';

export interface PartyMilestone {
  milestone_id: string;
  sequence: number;
  name: string;
  amount: number;
  paid_amount: number;
  outstanding: number;
  due_date: string | null;
  due_label: string | null;
  is_advance: boolean;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';
  is_overdue: boolean;
}

export interface PartyPaymentRecord {
  payment_id: string;
  amount: number;
  mode: string;
  is_security_deposit: boolean;
  collected_at: string;
  receipt_document_id: string | null;
  receipt_number: string | null;
}

export interface PartyLedgerEntry {
  at: string;
  kind: 'RECEIPT' | 'DEPOSIT';
  description: string;
  amount: number;
  reference: string | null;
  receipt_number: string | null;
  running_balance_paid: number;
  running_outstanding: number;
}

/**
 * The paid and outstanding position.
 *
 * FR-PO-134 requires this to read IDENTICALLY here and in the restaurant's
 * own system, so the backend serves both surfaces from one function.
 */
export interface PartyPaymentPosition {
  booking_id: string;
  booking_no: string;
  order_value: number;
  amount_paid: number;
  amount_outstanding: number;
  amount_refunded: number;
  min_advance_amount: number;
  financial_status: FinancialStatus;
  financial_status_label: string;
  deposit: {
    required: number; paid: number; returned: number;
    forfeited: number; outstanding: number;
  };
  milestones: PartyMilestone[];
  next_due: {
    milestone_id: string; name: string; amount: number;
    due_date: string | null; due_label: string | null;
  } | null;
  ledger: PartyLedgerEntry[];
  payments: PartyPaymentRecord[];
  full_payment_offered?: boolean;
}

export interface PartyDocumentSummary {
  document_id: string;
  doc_type: PartyDocType;
  doc_label: string;
  doc_number: string;
  total_value: number;
  tax_amount?: number;
  issued_at: string;
}

export interface PartyDocument extends PartyDocumentSummary {
  taxable_value: number;
  tax_rate: number;
  advance_adjusted: number;
  irn: string | null;
  qr_code: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  /** The document exactly as it was issued. */
  content: Record<string, any>;
}

export interface PartyBooking {
  booking_id: string;
  booking_no: string;
  enquiry_id: string;
  enquiry_no: string;
  quotation_no: string;
  booking_status: BookingStatus;
  booking_status_label: string;
  financial_status: FinancialStatus;
  financial_status_label: string;
  confirmed_at: string;
  event: {
    type: string | null;
    date: string;
    start_time: string | null;
    meal_period: MealPeriod | null;
    service_mode: ServiceMode;
    venue: string | null;
    address: string | null;
    setup_time: string | null;
    serving_time: string | null;
    clearance_time: string | null;
  };
  venue_contact: { name: string; mobile: string | null } | null;
  /** FR-PO-121/122/123: what the customer is committed to, and by when. */
  guests: {
    quoted: number;
    guaranteed: number;
    guarantee_pct: number;
    final: number | null;
    final_count_deadline: string | null;
    final_count_confirmed_at: string | null;
    locked: boolean;
    can_still_change: boolean;
    note: string;
  };
  money: {
    order_value: number;
    amount_paid: number;
    amount_outstanding: number;
    late_increase_surcharge: number;
  };
  payment_position: PartyPaymentPosition;
  /** FR-PO-116: the confirmation document as it was issued. */
  confirmation: Record<string, any> | null;
  documents: PartyDocumentSummary[];
  timeline: PartyTimelineEntry[];
  event_order_version: number | null;
  cancellation_policy_text: string | null;
  terms_text: string | null;
}

export const BOOKING_STATUS_HINT: Partial<Record<BookingStatus, string>> = {
  CONFIRMED: 'Your date is committed. We will ask for your final guest count nearer the time.',
  AWAITING_FINAL_COUNT: 'Please confirm your final guest count.',
  LOCKED_FOR_PRODUCTION: 'Your guest count is locked and our kitchen is preparing.',
  IN_PRODUCTION: 'Your order is being prepared.',
  DISPATCHED: 'Your order has left the restaurant.',
  IN_SERVICE: 'Your event is in progress.',
  COMPLETED: 'Your event is complete.',
};

/* ---------------- Calls ---------------- */

/** FR-PO-116: the booking confirmation and everything on it. */
export const fetchPartyBooking = (bookingId: string) =>
  unwrap<PartyBooking>(api.get(`${BASE}/bookings/${bookingId}`));

/** FR-PO-134: the same paid and outstanding figures the restaurant sees. */
export const fetchBookingPayments = (bookingId: string) =>
  unwrap<PartyPaymentPosition>(api.get(`${BASE}/bookings/${bookingId}/payments`));

/**
 * FR-PO-135/136: ask for a payment link.
 *
 * Throws with code PARTY_GATEWAY_UNAVAILABLE where the restaurant has no
 * payment gateway configured — in which case there is nothing to tap, and the
 * customer should be told to contact their event contact.
 */
export async function requestPartyPaymentLink(bookingId: string, opts: {
  milestone_id?: string; pay_full?: boolean;
} = {}) {
  try {
    const { data } = await api.post(`${BASE}/bookings/${bookingId}/pay`, opts);
    return data.data as {
      link_id: string; amount: number; pay_url: string; expires_at: string;
    };
  } catch (err) {
    throw toPartyError(err);
  }
}

/**
 * FR-PO-122: revise the guest count, until the deadline.
 *
 * Throws with code PARTY_HEADCOUNT_LOCKED once the deadline has passed — only
 * the restaurant can approve an increase after that (FR-PO-124).
 */
export async function confirmPartyFinalCount(bookingId: string, count: number) {
  try {
    const { data } = await api.patch(`${BASE}/bookings/${bookingId}/final-count`, { count });
    return {
      guests: data.data as {
        final_guest_count: number; guaranteed_guest_count: number;
        billable_guest_count: number; order_value: number;
      },
      message: data.message as string,
    };
  } catch (err) {
    throw toPartyError(err);
  }
}

/** FR-PO-216: the receipts and invoice the customer may download. */
export const fetchBookingDocuments = (bookingId: string) =>
  unwrap<PartyDocumentSummary[]>(api.get(`${BASE}/bookings/${bookingId}/documents`));

export const fetchPartyDocument = (documentId: string) =>
  unwrap<PartyDocument>(api.get(`${BASE}/documents/${documentId}`));

/** Open a payment link by its token. Public — the token is the authorisation. */
export const openPartyPaymentLink = (token: string) =>
  unwrap<{
    booking_no: string; customer_name: string; milestone_name: string;
    amount: number; expires_at: string; pay_url: string | null;
  }>(api.get(`${BASE}/pay/${token}`));

/* ---------------- Display helpers ---------------- */

/**
 * The one thing the customer needs to do, if anything. Returned rather than
 * rendered so the list and the detail screen say the same thing.
 */
export function bookingNextStep(b: PartyBooking): {
  title: string; body: string; action: 'PAY' | 'CONFIRM_COUNT' | null;
} | null {
  if (b.money.amount_outstanding > 0 && b.payment_position.next_due) {
    const due = b.payment_position.next_due;
    const overdue = b.payment_position.milestones.some((m) => m.is_overdue);
    return {
      title: overdue ? 'A payment is overdue' : `${due.name} is due`,
      body: `${formatMoney(due.amount, 2)}`
        + (due.due_date ? ` by ${String(due.due_date).slice(0, 10)}` : '')
        + (due.due_label ? ` (${due.due_label})` : ''),
      action: 'PAY',
    };
  }
  if (b.guests.can_still_change && !b.guests.final_count_confirmed_at) {
    return {
      title: 'Confirm your final guest count',
      body: b.guests.final_count_deadline
        ? `By ${new Date(b.guests.final_count_deadline).toLocaleString()}. `
          + `Without it we prepare for the guaranteed ${b.guests.guaranteed}.`
        : `We will prepare for the guaranteed ${b.guests.guaranteed} until you tell us otherwise.`,
      action: 'CONFIRM_COUNT',
    };
  }
  return null;
}

/* ================================================================== */
/* GROUP K — cancelling, changing, and tracking a refund               */
/*                                                                     */
/* The customer half of FR-PO-166..179. The refund statuses below are   */
/* the SAME values the restaurant's staff see, because they come from   */
/* one status column on one row (FR-PO-178) — there is no customer      */
/* copy to drift out of step.                                          */
/* ================================================================== */

export type RefundStatus =
  | 'REQUESTED' | 'APPROVED' | 'REJECTED'
  | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type ChangeStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'AWAITING_CUSTOMER'
  | 'APPLIED' | 'REJECTED' | 'WITHDRAWN';

/**
 * One refund band, as the customer is shown it.
 *
 * The whole table is shown beside the figure on purpose: "why am I only
 * getting half back?" is answered by seeing that a week earlier would have
 * returned all of it.
 */
export interface RefundBand {
  min_days_before: number;
  max_days_before: number | null;
  refund_pct: number;
  label: string | null;
}

/**
 * What cancelling would cost, computed and explained BEFORE anything is
 * agreed (FR-PO-173).
 *
 * `explanation` is written by the server, so this screen and the
 * restaurant's screen say the same thing about the same arithmetic.
 */
export interface CancellationPreview {
  booking_no: string;
  event_date: string;
  order_value: number;
  days_to_event: number;
  amount_paid: number;
  policy_refund_pct: number;
  band: {
    min_days_before?: number;
    max_days_before?: number | null;
    refund_pct: number;
    label: string | null;
  };
  computed_refund: number;
  forfeited_amount: number;
  deposit_refund: number;
  total_returned: number;
  expected_completion_date: string;
  basis: string;
  explanation: string;
  policy_text: string | null;
  bands: RefundBand[];
  partial_cancellation_available: boolean;
  /** BRD 4.3: reducing below this saves nothing, so the screen says so. */
  guaranteed_guest_count: number;
  quoted_guest_count: number;
  final_guest_count: number | null;
  already_requested: boolean;
  /** FR-PO-171: the reasons the restaurant actually offers, not a hard-coded list. */
  reasons: { code: string; label: string }[];
}

/**
 * FR-PO-173 — see the figure before committing to anything. Writes nothing.
 */
export const previewPartyCancellation = (
  bookingId: string,
  cancelledValue?: number,
) => unwrap<CancellationPreview>(
  api.get(`${BASE}/bookings/${bookingId}/cancellation-preview`, {
    params: cancelledValue ? { cancelled_value: cancelledValue } : undefined,
  }),
);

export interface CancellationRequestResult {
  cancellation_id: string;
  cancellation_no: string;
  status: 'REQUESTED' | 'CONFIRMED' | 'REJECTED' | 'WITHDRAWN';
  status_label: string;
  computed_refund: number;
  forfeited_amount: number;
  deposit_refund: number;
  days_to_event: number;
  explanation: string;
  expected_completion_date: string;
}

/**
 * FR-PO-170 — ask to cancel.
 *
 * This records a REQUEST. The restaurant confirms it, which is what releases
 * the date and raises the refund — a customer cannot confirm their own
 * cancellation, because confirming moves money.
 */
export async function requestPartyCancellation(
  bookingId: string,
  payload: {
    reason_code: string;
    reason_note?: string;
    /** FR-PO-181: reduce the booking instead of abandoning the event. */
    cancelled_scope?: {
      cancelled_value: number;
      guest_count_from?: number;
      guest_count_to?: number;
    };
  },
) {
  try {
    const { data } = await api.post(
      `${BASE}/bookings/${bookingId}/cancellation`,
      payload,
    );
    return {
      cancellation: data.data as CancellationRequestResult,
      message: data.message as string,
    };
  } catch (err) {
    throw toPartyError(err);
  }
}

/** Changed their mind before the restaurant actioned it. */
export const withdrawPartyCancellation = (cancellationId: string) =>
  unwrap<{ status: string; status_label: string }>(
    api.post(`${BASE}/cancellations/${cancellationId}/withdraw`),
  );

/* ---------------- Refund status (FR-PO-178/179) ---------------- */

export interface RefundStep {
  status: RefundStatus;
  status_label: string;
  note: string;
  at: string;
}

export interface PartyRefund {
  refund_id: string;
  amount: number;
  /** The identical status the restaurant reads (FR-PO-178). */
  status: RefundStatus;
  status_label: string;
  customer_note: string | null;
  /** Already in plain words by the time it arrives here. */
  channel: string;
  requested_at: string;
  approved_at: string | null;
  initiated_at: string | null;
  completed_at: string | null;
  expected_completion_date: string | null;
  refund_voucher_no: string | null;
  /**
   * FR-PO-179. The BRD calls refund status "the one the customer checks most
   * often and the one most likely to generate a call" — so the app shows when
   * each step happened and when the money is expected, not one word.
   */
  timeline: RefundStep[];
}

export const getPartyRefunds = (bookingId: string) =>
  unwrap<PartyRefund[]>(api.get(`${BASE}/bookings/${bookingId}/refunds`));

/* ---------------- Changing a booking (FR-PO-166..169) ---------------- */

export interface ChangeEvaluation {
  changes: {
    field: string;
    label: string;
    from: string | number | null;
    to: string | number | null;
    note?: string;
  }[];
  permitted: boolean;
  requires_approval: boolean;
  /** Why it cannot be done, in words — never a bare refusal. */
  reasons: string[];
  previous_order_value: number;
  revised_order_value: number;
  value_delta: number;
  amount_paid: number;
  further_amount_due: number;
  credit_due: number;
  customer_confirm_required: boolean;
  /** BRD 4.3: below the guarantee nothing is saved, so say so up front. */
  reduction_below_guarantee: boolean;
  guaranteed_guest_count: number;
  summary: string;
}

/**
 * FR-PO-166/168 — what a change would cost and whether it can be made, before
 * asking for it. Writes nothing.
 */
export const evaluatePartyChange = (
  bookingId: string,
  patch: { guest_count?: number; event_date?: string; event_start_time?: string },
) => unwrap<ChangeEvaluation>(
  api.post(`${BASE}/bookings/${bookingId}/changes/evaluate`, patch),
);

export interface PartyChange {
  amendment_id: string;
  amendment_no: number;
  change_type: string;
  status: ChangeStatus;
  status_label: string;
  changes: ChangeEvaluation['changes'];
  previous_order_value: number;
  revised_order_value: number;
  value_delta: number;
  requested_at: string;
  rejection_reason: string | null;
  /** Whether the restaurant is waiting on the customer (FR-PO-169). */
  awaiting_me: boolean;
  customer_confirmed_at: string | null;
}

export async function requestPartyChange(
  bookingId: string,
  payload: {
    guest_count?: number;
    event_date?: string;
    event_start_time?: string;
    reason?: string;
  },
) {
  try {
    const { data } = await api.post(`${BASE}/bookings/${bookingId}/changes`, payload);
    return {
      change: data.data as PartyChange & { summary: string },
      message: data.message as string,
    };
  } catch (err) {
    throw toPartyError(err);
  }
}

export const getPartyChanges = (bookingId: string) =>
  unwrap<PartyChange[]>(api.get(`${BASE}/bookings/${bookingId}/changes`));

/** FR-PO-169 — agree to the revised terms, which is what lets them bind. */
export const confirmPartyChange = (amendmentId: string) =>
  unwrap<{ status: string; status_label: string }>(
    api.post(`${BASE}/changes/${amendmentId}/confirm`),
  );

/* ---------------- Display helpers ---------------- */

/**
 * How a refund reads to the person waiting for it.
 *
 * The tone matters more here than on the staff side: a customer seeing
 * "Failed" needs to know somebody is dealing with it, not just that it went
 * wrong.
 */
export function refundReassurance(r: PartyRefund): {
  title: string;
  body: string;
  tone: 'pending' | 'moving' | 'done' | 'problem';
} {
  switch (r.status) {
    case 'REQUESTED':
      return {
        title: 'We have your refund request',
        body: 'The restaurant is reviewing it. You will see it move here as it progresses.',
        tone: 'pending',
      };
    case 'APPROVED':
      return {
        title: 'Your refund is approved',
        body: r.expected_completion_date
          ? `It will be sent to ${r.channel.toLowerCase()} and should reach you by `
            + `${r.expected_completion_date}.`
          : `It will be sent to ${r.channel.toLowerCase()}.`,
        tone: 'moving',
      };
    case 'PROCESSING':
      return {
        title: 'Your refund is on its way',
        body: r.expected_completion_date
          ? `It has been sent and should reach you by ${r.expected_completion_date}. `
            + 'Banks can take a few working days to show it.'
          : 'It has been sent. Banks can take a few working days to show it.',
        tone: 'moving',
      };
    case 'COMPLETED':
      return {
        title: 'Your refund is complete',
        body: r.refund_voucher_no
          ? `Refund voucher ${r.refund_voucher_no} is available with your documents.`
          : 'The money has been returned.',
        tone: 'done',
      };
    case 'FAILED':
      return {
        title: 'Your refund could not be completed',
        body: 'The restaurant has been told and is sorting it out. You do not need '
          + 'to do anything — it will be tried again.',
        tone: 'problem',
      };
    case 'REJECTED':
    default:
      return {
        title: 'Your refund request was not approved',
        body: 'Please contact the restaurant if you would like to discuss it.',
        tone: 'problem',
      };
  }
}

/**
 * Whether the customer still has something to do about a change they asked
 * for. Returned rather than rendered so the booking screen and any list say
 * the same thing.
 */
export function changeNextStep(c: PartyChange): {
  title: string; body: string; action: 'CONFIRM' | null;
} | null {
  if (c.awaiting_me) {
    return {
      title: 'Confirm the revised terms',
      body: c.value_delta > 0
        ? `The change adds ${formatMoney(c.value_delta, 2)} to your booking. `
          + 'It takes effect once you confirm.'
        : c.value_delta < 0
          ? `The change reduces your booking by ${formatMoney(Math.abs(c.value_delta), 2)}. `
            + 'It takes effect once you confirm.'
          : 'The change takes effect once you confirm.',
      action: 'CONFIRM',
    };
  }
  if (c.status === 'PENDING_APPROVAL') {
    return {
      title: 'The restaurant is reviewing your change',
      body: 'A change this close to the event needs their approval.',
      action: null,
    };
  }
  if (c.status === 'REJECTED' && c.rejection_reason) {
    return {
      title: 'Your change could not be made',
      body: c.rejection_reason,
      action: null,
    };
  }
  return null;
}

/* ================================================================== */
/* GROUPS L and M — watching the event, the final bill, feedback        */
/*                                                                     */
/* FR-PO-197 (the stages), 200 (the statement), 201 (querying a line),  */
/* 206/207 (feedback), 209/210 (history and rebooking).                 */
/* ================================================================== */

/**
 * FR-PO-197 — where the event has got to.
 *
 * Stages, not the kitchen's instructions. The live position carries its own
 * AGE: a pin with no age shown is a pin the customer assumes is current, and
 * an hour-old one then reads as "five minutes away".
 */
export interface PartyEventStatus {
  booking_no: string;
  status: string;
  status_label: string;
  is_off_premise: boolean;
  stages: { label: string; at: string | null; done: boolean }[];
  current: string | null;
  next: string | null;
  live_location: {
    latitude: number;
    longitude: number;
    at: string;
    age_minutes: number;
    is_stale: boolean;
    eta_minutes: number | null;
  } | null;
  vehicle: {
    vehicle_no: string | null;
    driver_name: string | null;
    driver_mobile: string | null;
  } | null;
  handover: { contact_name: string; acknowledged: boolean } | null;
  /** Only incidents the restaurant marked visible (FR-PO-222). */
  incidents: {
    incident_id: string;
    incident_type: string;
    description: string;
    occurred_at: string;
    resolution: string | null;
  }[];
}

export const getPartyEventStatus = (bookingId: string) =>
  unwrap<PartyEventStatus>(api.get(`${BASE}/bookings/${bookingId}/event-status`));

/* ---------------- FR-PO-200/201 — the final bill ---------------- */

export interface StatementLine {
  key: string;
  label: string;
  detail: string | null;
  amount: number;
}

export interface StatementSection {
  key: string;
  title: string;
  lines: StatementLine[];
  subtotal: number;
}

export interface PartySettlementStatement {
  booking_no: string;
  quotation_no: string;
  event_date: string;
  customer_name: string;
  counts: {
    quoted: number;
    guaranteed: number;
    final_confirmed: number | null;
    actual: number | null;
    billable: number;
    /** Why they are billed for a number that is not the number who came. */
    basis: string;
  };
  sections: StatementSection[];
  totals: {
    taxable_value: number;
    tax_amount: number;
    final_value: number;
    already_paid: number;
    already_refunded: number;
    balance: number;
    balance_direction: 'PAYABLE' | 'REFUNDABLE' | 'NIL';
  };
  deposit: {
    paid: number; returned: number; forfeited: number;
    outstanding: number; note: string | null;
  };
  summary: string;
}

export interface PartySettlementQuery {
  dispute_id: string;
  line_label: string | null;
  query: string;
  status: 'OPEN' | 'RESPONDED' | 'RESOLVED' | 'WITHDRAWN';
  raised_at: string;
  response: string | null;
  responded_at: string | null;
  resolution: string | null;
  adjustment_amount: number;
}

export interface PartySettlement {
  settlement_id: string;
  settlement_no: string;
  status: 'PRESENTED' | 'DISPUTED' | 'AGREED' | 'SETTLED';
  status_label: string;
  presented_at: string | null;
  agreed_at: string | null;
  settled_at: string | null;
  invoice_no: string | null;
  statement: PartySettlementStatement;
  balance: number;
  balance_direction: 'PAYABLE' | 'REFUNDABLE' | 'NIL';
  final_value: number;
  queries: PartySettlementQuery[];
  can_agree: boolean;
  can_query: boolean;
}

/**
 * FR-PO-200. Returns `{ settlement: null }` while the statement is still a
 * draft: it has not been checked, and showing a customer a number that then
 * changes is worse than showing them nothing.
 */
export async function getPartySettlement(bookingId: string) {
  try {
    const { data } = await api.get(`${BASE}/bookings/${bookingId}/settlement`);
    return {
      settlement: (data.data as PartySettlement | null) ?? null,
      message: (data.message as string | undefined) ?? null,
    };
  } catch (err) {
    throw toPartyError(err);
  }
}

/** FR-PO-201 — query a line of the statement you were shown. */
export async function queryPartySettlementLine(
  settlementId: string,
  payload: { line_key?: string; query: string },
) {
  try {
    const { data } = await api.post(
      `${BASE}/settlements/${settlementId}/queries`, payload,
    );
    return {
      query: data.data as { dispute_id: string; line_label: string | null; status: string },
      message: data.message as string,
    };
  } catch (err) {
    throw toPartyError(err);
  }
}

export async function agreePartySettlement(settlementId: string) {
  try {
    const { data } = await api.post(`${BASE}/settlements/${settlementId}/agree`);
    return {
      result: data.data as {
        status: string; status_label: string;
        balance: number; balance_direction: string;
      },
      message: data.message as string,
    };
  } catch (err) {
    throw toPartyError(err);
  }
}

/* ---------------- FR-PO-206/207/213 — feedback ---------------- */

export interface PartyFeedbackState {
  submitted: boolean;
  submitted_at?: string;
  scores?: {
    food: number | null; service: number | null; timeliness: number | null;
    value: number | null; overall: number;
  };
  comment?: string | null;
  photos?: { url: string; caption?: string }[];
  photo_consent?: boolean;
}

export interface FeedbackDimension {
  key: 'food' | 'service' | 'timeliness' | 'value' | 'overall';
  label: string;
  required?: boolean;
}

/**
 * The dimensions come from the server rather than being hard-coded, so the
 * five FR-PO-206 names stay in one place.
 */
export async function getPartyFeedback(bookingId: string) {
  try {
    const { data } = await api.get(`${BASE}/bookings/${bookingId}/feedback`);
    return {
      feedback: data.data as PartyFeedbackState,
      dimensions: data.dimensions as FeedbackDimension[],
    };
  } catch (err) {
    throw toPartyError(err);
  }
}

/**
 * FR-PO-206/207. Submitted once — the scores and the comment are then the
 * customer's own words and immutable, which the database enforces.
 *
 * FR-PO-213: a satisfied customer may be offered a public review, and the
 * channel comes back with the response rather than being assumed.
 */
export async function submitPartyFeedback(
  bookingId: string,
  payload: {
    scores: {
      overall: number;
      food?: number; service?: number; timeliness?: number; value?: number;
    };
    comment?: string;
    photos?: { url: string; caption?: string }[];
    photo_consent?: boolean;
  },
) {
  try {
    const { data } = await api.post(`${BASE}/bookings/${bookingId}/feedback`, payload);
    return {
      submitted: data.data as { submitted_at: string; score_overall: number },
      review_request: (data.review_request as { channel: string; url: string | null } | null) ?? null,
      message: data.message as string,
    };
  } catch (err) {
    throw toPartyError(err);
  }
}

/* ---------------- FR-PO-209/210 — history and rebooking ---------------- */

export interface PartyHistoryEvent {
  booking_id: string;
  booking_no: string;
  event_date: string;
  event_type: string | null;
  guests: number;
  packages: string | null;
  value: number;
  status: string;
  my_score: number | null;
}

export async function getMyPartyHistory() {
  try {
    const { data } = await api.get(`${BASE}/history`);
    return data.data as {
      events: PartyHistoryEvent[];
      events_count: number;
      first_event: string | null;
      last_event: string | null;
    };
  } catch (err) {
    throw toPartyError(err);
  }
}

export interface PartyRebookPrefill {
  source_booking_no: string;
  source_event_date: string;
  enquiry: Record<string, unknown>;
  packages: { package_id: string; name: string }[];
  addons: { addon_id: string; name: string; quantity: number }[];
  note: string;
}

/**
 * FR-PO-210 — the same again. A PREFILL, not a created enquiry: the date is
 * still the customer's to choose, and an abandoned enquiry is a phantom in the
 * restaurant's pipeline.
 */
export const getPartyRebookPrefill = (bookingId: string) =>
  unwrap<PartyRebookPrefill>(api.get(`${BASE}/bookings/${bookingId}/rebook`));

/* ---------------- Display helpers ---------------- */

/**
 * What the event status means to someone waiting for it.
 *
 * The tone matters: a customer whose food is late wants to know somebody knows
 * where it is, not a status code.
 */
export function eventStatusHeadline(s: PartyEventStatus): {
  title: string; body: string;
} {
  if (s.live_location && !s.live_location.is_stale) {
    return {
      title: s.current || 'On the way to you',
      body: s.live_location.eta_minutes
        ? `About ${s.live_location.eta_minutes} minutes away.`
        : `Last seen ${s.live_location.age_minutes} minute(s) ago.`,
    };
  }
  if (s.live_location?.is_stale) {
    return {
      title: s.current || 'On the way to you',
      body: `The last position we have is ${s.live_location.age_minutes} minutes `
        + 'old. Call us if you need a firmer time.',
    };
  }
  if (s.current && s.next) {
    return { title: s.current, body: `Next: ${s.next.toLowerCase()}.` };
  }
  if (s.current) return { title: s.current, body: 'Everything is on track.' };
  return {
    title: s.status_label,
    body: s.next ? `Next: ${s.next.toLowerCase()}.` : 'We will keep this updated.',
  };
}

/**
 * Whether the customer has something to do about their final bill.
 *
 * Returned rather than rendered so the booking screen and the settlement
 * screen say the same thing.
 */
export function settlementNextStep(s: PartySettlement): {
  title: string; body: string; action: 'AGREE' | 'PAY' | null;
} | null {
  if (s.status === 'SETTLED') return null;
  if (s.status === 'DISPUTED') {
    return {
      title: 'We are looking into your query',
      body: 'Nothing will be collected while it is open.',
      action: null,
    };
  }
  if (s.status === 'PRESENTED') {
    return {
      title: 'Your final bill is ready',
      body: s.statement.summary,
      action: 'AGREE',
    };
  }
  if (s.status === 'AGREED' && s.balance > 0) {
    return {
      title: `${formatMoney(s.balance, 2)} to pay`,
      body: 'You can pay it here, the same way as your earlier payments.',
      action: 'PAY',
    };
  }
  if (s.status === 'AGREED' && s.balance < 0) {
    return {
      title: `${formatMoney(Math.abs(s.balance), 2)} coming back to you`,
      body: 'The restaurant is processing your refund.',
      action: null,
    };
  }
  return null;
}

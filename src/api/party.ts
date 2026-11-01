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

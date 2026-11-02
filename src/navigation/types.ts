import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  MyOrders: undefined;
  More: undefined;
  Categories: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  CategoryItems: { title: string; items: import('../types').MenuItem[] };
  Cart: { selectedAddressId?: number } | undefined;
  OrderDetail: { orderId: number };
  AddressList: { selectMode?: boolean } | undefined;
  AddressForm: {
    address?: import('../types').Address;
    pickedCoords?: { latitude: number; longitude: number };
  } | undefined;
  MapPicker: { initialCoords?: { latitude: number; longitude: number } } | undefined;
  TrackOrder: { orderId: number };
  DeliveryChat: { orderId: number };
  Profile: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  Notifications: undefined;
  SelectOutlet: undefined;

  // 7.35 Party Order Management — the customer surface (BRD group C, and the
  // customer half of E, F and G).
  PartyPackages: undefined;
  // `enquiryId` edits an existing enquiry; `packageId` pre-selects a package
  // the customer tapped "Enquire" on.
  PartyEnquiryForm: {
    packageId?: string;
    enquiryId?: string;
    /** FR-PO-210: start from a past event, menu and preferences carried. */
    rebookFromBookingId?: string;
  } | undefined;
  PartyEnquiries: undefined;
  PartyEnquiryDetail: { enquiryId: string };
  PartyQuotation: { quotationId: string };
  // Phase 2 — the confirmed booking and its statutory documents.
  PartyBooking: { bookingId: string };
  PartyDocument: { documentId: string };
  /**
   * Group K (FR-PO-170..179). Its own route rather than a modal on the
   * booking, because FR-PO-173 requires the refund computation to be shown
   * before the cancellation is agreed — and because a customer comes back to
   * it afterwards to see where the money is.
   */
  PartyCancel: { bookingId: string };
  /**
   * Groups L and M. Both are their own route because both are opened
   * repeatedly in the days around an event — watching it happen, and then
   * settling it.
   */
  PartyEvent: { bookingId: string };
  PartySettlement: { bookingId: string };
};

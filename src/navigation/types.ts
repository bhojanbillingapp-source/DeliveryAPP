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
  PartyEnquiryForm: { packageId?: string; enquiryId?: string } | undefined;
  PartyEnquiries: undefined;
  PartyEnquiryDetail: { enquiryId: string };
  PartyQuotation: { quotationId: string };
};

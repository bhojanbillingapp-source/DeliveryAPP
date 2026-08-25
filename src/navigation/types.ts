import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  MyOrders: undefined;
  More: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Categories: undefined;
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
  Profile: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  Notifications: undefined;
  SelectOutlet: undefined;
};

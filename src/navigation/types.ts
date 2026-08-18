export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

export type AppStackParamList = {
  Menu: undefined;
  Cart: { selectedAddressId?: number } | undefined;
  Orders: undefined;
  OrderDetail: { orderId: number };
  AddressList: { selectMode?: boolean } | undefined;
  AddressForm: {
    address?: import('../types').Address;
    pickedCoords?: { latitude: number; longitude: number };
  } | undefined;
  MapPicker: { initialCoords?: { latitude: number; longitude: number } } | undefined;
  TrackOrder: { orderId: number };
  Profile: undefined;
};

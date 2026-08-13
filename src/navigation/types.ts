export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type AppStackParamList = {
  Menu: undefined;
  Cart: undefined;
  Orders: undefined;
  OrderDetail: { orderId: number };
};

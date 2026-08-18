export type MenuItemVariant = {
  label: string;
  price: number;
  sufficient_for: number | null;
};

export type MenuItem = {
  id: number;
  name: string;
  item_name: string;
  category_name: string | null;
  item_type: string | null;
  price: number | null;
  is_active: boolean;
  variants?: MenuItemVariant[];
};

// cart_key is `${item_id}::${variant_label ?? 'default'}` — an item ordered
// in two different variants (e.g. Full vs Half) needs two distinct lines, so
// item_id alone can't key the cart once variants are involved.
export type CartLine = {
  cart_key: string;
  item_id: number;
  item_name: string;
  price: number;
  quantity: number;
  variant_label?: string;
  note?: string;
};

export type Customer = {
  customer_id: number;
  name: string;
  mobile: string;
  outlet_id: string;
};

export type OrderSummary = {
  order_id: number;
  daily_order_no: number;
  status: string;
  total_amount: string;
  payment_status: string;
  payment_method: string;
  created_at: string;
};

export type Address = {
  address_id: number;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pin_code: string | null;
  landmark: string | null;
  latitude: number;
  longitude: number;
  is_default: boolean;
};

export type OrderItem = {
  order_item_id: number;
  item_id: number;
  item_name: string;
  quantity: number;
  price: string;
  status: string;
};

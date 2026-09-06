import api from './client';
import type { CartLine } from '../types';

export type CartItemAvailability = {
  item_id: number;
  variant_label: string | null;
  available: boolean;
  price: number | null;
};

export async function validateCart(outletId: string, lines: CartLine[]): Promise<CartItemAvailability[]> {
  const { data } = await api.post('/customer-order/cart/validate', {
    outlet_id: outletId,
    items: lines.map(l => ({
      item_id: l.item_id,
      variant_label: l.variant_label,
    })),
  });
  return data.items;
}

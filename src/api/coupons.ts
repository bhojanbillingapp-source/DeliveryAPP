import api from './client';
import type { CartLine } from '../types';

export type Coupon = {
  campaign_id: number;
  campaign_code: string;
  campaign_name: string;
  reward_target: string;
  requires_code: boolean;
  discount_amount: number;
  is_auto_applied: boolean;
  is_discoverable: boolean;
};

export type CouponPreview = {
  subtotal: number;
  coupons: Coupon[];
  auto_applied: Coupon | null;
  code_error: 'NOT_FOUND' | 'NOT_ELIGIBLE' | null;
};

export async function previewCoupons(outletId: string, lines: CartLine[], code?: string): Promise<CouponPreview> {
  const { data } = await api.post('/customer-order/coupons/preview', {
    outlet_id: outletId,
    items: lines.map(l => ({ item_id: l.item_id, quantity: l.quantity, variant_label: l.variant_label })),
    code,
  });
  return data;
}

import api from './client';
import type { AddOn } from '../types';

export async function getItemAddOns(outletId: string, itemId: number): Promise<AddOn[]> {
  const { data } = await api.get(`/ordermenu/${itemId}/add-ons`, { params: { outlet_id: outletId } });
  return data;
}

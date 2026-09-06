import api from './client';

export type TrackingLocation = {
  latitude: number;
  longitude: number;
  recorded_at: string;
};

export type TrackingHistoryEntry = {
  status: string;
  created_at: string;
};

export type TrackingInfo = {
  status: string | null;
  delivery_boy_name: string | null;
  delivery_boy_phone: string | null;
  location: TrackingLocation | null;
  history: TrackingHistoryEntry[];
};

export async function trackOrder(orderId: number): Promise<TrackingInfo> {
  const { data } = await api.get(`/customer-order/orders/${orderId}/track`);
  return {
    status: data.status,
    delivery_boy_name: data.delivery_boy_name,
    delivery_boy_phone: data.delivery_boy_phone,
    location: data.location,
    history: data.history || [],
  };
}

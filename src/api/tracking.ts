import api from './client';

export type TrackingLocation = {
  latitude: number;
  longitude: number;
  recorded_at: string;
};

export type TrackingInfo = {
  status: string | null;
  delivery_boy_name: string | null;
  location: TrackingLocation | null;
};

export async function trackOrder(orderId: number): Promise<TrackingInfo> {
  const { data } = await api.get(`/customer-orders/orders/${orderId}/track`);
  return { status: data.status, delivery_boy_name: data.delivery_boy_name, location: data.location };
}

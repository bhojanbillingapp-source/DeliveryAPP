import api from './client';

export type LatLng = { latitude: number; longitude: number };

export type TrackingLocation = {
  latitude: number;
  longitude: number;
  recorded_at: string;
};

export type TrackingInfo = {
  status: string | null;
  statusLabel: string | null;
  location: TrackingLocation | null;
  destination: LatLng | null;
  origin: LatLng | null;
  routePolyline: string | null;
  routeDistanceKm: number | null;
  isStale: boolean;
  lastRecordedAt: string | null;
  partnerFirstName: string | null;
  partnerPhoneMasked: string | null;
};

function coord(v: any): LatLng | null {
  return v ? { latitude: Number(v.latitude), longitude: Number(v.longitude) } : null;
}

/**
 * Poll an order's delivery tracking. Pass `since` (the previous response's
 * lastRecordedAt / status change time) — the backend returns
 * `{ changed: false }` when nothing moved, so this stays cheap on a 12s loop.
 * Returns null when nothing changed.
 */
export async function trackOrder(orderId: number, since?: string | null): Promise<TrackingInfo | null> {
  const { data } = await api.get(`/customer-order/orders/${orderId}/track`, {
    params: since ? { since } : undefined,
  });
  if (data && data.changed === false) return null;

  return {
    status: data.status ?? null,
    statusLabel: data.status_label ?? null,
    location: data.location
      ? {
          latitude: Number(data.location.latitude),
          longitude: Number(data.location.longitude),
          recorded_at: data.location.recorded_at,
        }
      : null,
    destination: coord(data.destination),
    origin: coord(data.origin),
    routePolyline: data.route_polyline ?? null,
    routeDistanceKm: data.route_distance_km != null ? Number(data.route_distance_km) : null,
    isStale: !!data.is_stale,
    lastRecordedAt: data.last_recorded_at ?? null,
    partnerFirstName: data.delivery_partner_first_name ?? null,
    partnerPhoneMasked: data.delivery_partner_phone_masked ?? null,
  };
}

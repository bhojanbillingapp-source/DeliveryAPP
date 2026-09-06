import api from './client';

/** Reverse-geocode a dropped map pin to a readable address (best-effort, null on failure). */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  try {
    const { data } = await api.get('/customer-order/geo/reverse', {
      params: { lat: latitude, lng: longitude },
    });
    return data?.address?.formatted_address ?? null;
  } catch {
    return null;
  }
}

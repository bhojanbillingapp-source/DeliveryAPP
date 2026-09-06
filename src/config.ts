// This app instance is pinned to one restaurant brand (all its outlets) —
// set CLIENT_GROUP_ID in .env to that brand's bbs.clients.client_group_id
// before building. Customers pick which outlet within the group to order
// from at runtime (see context/OutletContext.tsx) and can switch freely.
import { CLIENT_GROUP_ID as ENV_CLIENT_GROUP_ID, API_HOST as ENV_API_HOST } from '@env';
export const CLIENT_GROUP_ID: string = ENV_CLIENT_GROUP_ID;

// 10.0.2.2 (the Android emulator's alias for the host machine's localhost) is
// only reachable from the emulator. Set API_HOST in .env to your machine's LAN
// IP (e.g. http://192.168.1.5:8080) when running on a physical device, then rebuild.
const API_HOST = ENV_API_HOST || 'http://10.0.2.2:8080';
export const API_BASE_URL = `${API_HOST}/api`;

// Menu item photos come back from /ordermenu as paths like "/uploads/xyz.jpg"
// (relative to the API host, not the /api prefix) — resolve to a full URL.
export function resolveImageUri(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_HOST}${path.startsWith('/') ? path : `/${path}`}`;
}

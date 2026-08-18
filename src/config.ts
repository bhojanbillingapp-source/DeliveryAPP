// This app instance is pinned to one restaurant outlet, matching the
// per-restaurant deployment model — set OUTLET_ID in .env to that
// restaurant's bbs.clients.client_id before building for a given outlet.
import { OUTLET_ID as ENV_OUTLET_ID, API_HOST as ENV_API_HOST } from '@env';
export const OUTLET_ID: string = ENV_OUTLET_ID;

// 10.0.2.2 (the Android emulator's alias for the host machine's localhost) is
// only reachable from the emulator. Set API_HOST in .env to your machine's LAN
// IP (e.g. http://192.168.1.5:8080) when running on a physical device, then rebuild.
const API_HOST = ENV_API_HOST || 'http://10.0.2.2:8080';
export const API_BASE_URL = `${API_HOST}/api`;

// This app instance is pinned to one restaurant outlet, matching the
// per-restaurant deployment model — set OUTLET_ID in .env to that
// restaurant's bbs.clients.client_id before building for a given outlet.
import { OUTLET_ID } from '@env';
export { OUTLET_ID };

// 10.0.2.2 is the Android emulator's alias for the host machine's localhost.
// Point this at your machine's LAN IP (e.g. http://192.168.1.5:8080) when
// running on a physical device instead of the emulator.
export const API_BASE_URL = 'http://10.0.2.2:8080/api';

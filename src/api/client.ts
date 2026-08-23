import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { getSelectedOutletId } from '../utils/outletStore';

export const TOKEN_STORAGE_KEY = 'customer_access_token';
export const CUSTOMER_STORAGE_KEY = 'customer_profile';

const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });

api.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Attach the app-wide selected outlet (from the outlet-switcher) so every
  // call resolves against whichever outlet the customer is currently
  // ordering from. Respect a caller-set header instead of clobbering it.
  const outletId = getSelectedOutletId();
  if (outletId && !config.headers['X-Selected-Outlet-Id']) {
    config.headers['X-Selected-Outlet-Id'] = outletId;
  }

  return config;
});

// Access tokens expire (15m by default) and there's no refresh-token flow —
// AuthProvider registers a handler here so a 401 anywhere clears the stale
// session and drops the user back to the login screen instead of leaving
// them stuck looking at a raw "Invalid or expired token" error.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  response => response,
  error => {
    if (error?.response?.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default api;

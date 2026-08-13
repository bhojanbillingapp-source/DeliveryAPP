import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

export const TOKEN_STORAGE_KEY = 'customer_access_token';
export const CUSTOMER_STORAGE_KEY = 'customer_profile';

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

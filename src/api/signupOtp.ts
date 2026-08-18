import api from './client';
import { OUTLET_ID } from '../config';

export async function requestSignupOtp(mobile: string): Promise<{ dev_otp?: string }> {
  const { data } = await api.post('/customer-orders/auth/signup/request-otp', { outlet_id: OUTLET_ID, mobile });
  return data;
}

export async function verifySignupOtp(mobile: string, otp: string): Promise<void> {
  await api.post('/customer-orders/auth/signup/verify-otp', { mobile, otp });
}

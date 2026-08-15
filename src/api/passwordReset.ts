import api from './client';
import { OUTLET_ID } from '../config';

export async function sendResetOtp(mobile: string): Promise<{ dev_otp?: string }> {
  const { data } = await api.post('/customer-orders/auth/forgot-password', { outlet_id: OUTLET_ID, mobile });
  return data;
}

export async function verifyResetOtp(mobile: string, otp: string): Promise<void> {
  await api.post('/customer-orders/auth/verify-reset-otp', { outlet_id: OUTLET_ID, mobile, otp });
}

export async function resetPassword(mobile: string, otp: string, newPassword: string): Promise<void> {
  await api.post('/customer-orders/auth/reset-password', { outlet_id: OUTLET_ID, mobile, otp, new_password: newPassword });
}

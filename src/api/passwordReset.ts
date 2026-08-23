import api from './client';
import { CLIENT_GROUP_ID } from '../config';

export async function sendResetOtp(mobile: string): Promise<{ dev_otp?: string }> {
  const { data } = await api.post('/customer-order/auth/forgot-password', { client_group_id: CLIENT_GROUP_ID, mobile });
  return data;
}

export async function verifyResetOtp(mobile: string, otp: string): Promise<void> {
  await api.post('/customer-order/auth/verify-reset-otp', { client_group_id: CLIENT_GROUP_ID, mobile, otp });
}

export async function resetPassword(mobile: string, otp: string, newPassword: string): Promise<void> {
  await api.post('/customer-order/auth/reset-password', { client_group_id: CLIENT_GROUP_ID, mobile, otp, new_password: newPassword });
}

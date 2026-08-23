import api from './client';
import { CLIENT_GROUP_ID } from '../config';

export async function requestSignupOtp(mobile: string): Promise<{ dev_otp?: string }> {
  const { data } = await api.post('/customer-order/auth/signup/request-otp', { client_group_id: CLIENT_GROUP_ID, mobile });
  return data;
}

export async function verifySignupOtp(mobile: string, otp: string): Promise<void> {
  await api.post('/customer-order/auth/signup/verify-otp', { mobile, otp });
}

import api from './client';
import type { Customer } from '../types';

export async function getProfile(): Promise<Customer> {
  const { data } = await api.get('/customer-order/profile');
  return data.customer;
}

export async function updateName(name: string): Promise<Customer> {
  const { data } = await api.put('/customer-order/profile', { name });
  return data.customer;
}

export async function requestMobileChangeOtp(newMobile: string): Promise<{ dev_otp?: string }> {
  const { data } = await api.post('/customer-order/profile/mobile/request-otp', { new_mobile: newMobile });
  return data;
}

export async function confirmMobileChange(newMobile: string, otp: string): Promise<Customer> {
  const { data } = await api.post('/customer-order/profile/mobile/confirm', { new_mobile: newMobile, otp });
  return data.customer;
}

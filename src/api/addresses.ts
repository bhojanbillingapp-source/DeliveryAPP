import api from './client';
import type { Address } from '../types';

export type AddressInput = {
  label: string;
  address_line1: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  is_default?: boolean;
};

export async function listAddresses(): Promise<Address[]> {
  const { data } = await api.get('/customer-orders/addresses');
  return data.addresses;
}

export async function createAddress(input: AddressInput): Promise<Address> {
  const { data } = await api.post('/customer-orders/addresses', input);
  return data.address;
}

export async function updateAddress(addressId: number, input: Partial<AddressInput>): Promise<Address> {
  const { data } = await api.put(`/customer-orders/addresses/${addressId}`, input);
  return data.address;
}

export async function deleteAddress(addressId: number): Promise<void> {
  await api.delete(`/customer-orders/addresses/${addressId}`);
}

export async function setDefaultAddress(addressId: number): Promise<Address> {
  const { data } = await api.put(`/customer-orders/addresses/${addressId}/default`);
  return data.address;
}

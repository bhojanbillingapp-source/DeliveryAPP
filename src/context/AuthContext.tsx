import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { CUSTOMER_STORAGE_KEY, TOKEN_STORAGE_KEY } from '../api/client';
import { OUTLET_ID } from '../config';
import type { Customer } from '../types';

type AuthContextValue = {
  customer: Customer | null;
  isLoading: boolean;
  login: (mobile: string, password: string) => Promise<void>;
  signup: (name: string, mobile: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateCustomer: (customer: Customer) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(CUSTOMER_STORAGE_KEY);
        const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
        if (stored && token) {
          setCustomer(JSON.parse(stored));
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function persistSession(nextCustomer: Customer, accessToken: string) {
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    await AsyncStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(nextCustomer));
    setCustomer(nextCustomer);
  }

  async function login(mobile: string, password: string) {
    const { data } = await api.post('/customer-orders/auth/login', {
      outlet_id: OUTLET_ID,
      mobile,
      password,
    });
    await persistSession(data.customer, data.accessToken);
  }

  async function signup(name: string, mobile: string, password: string) {
    const { data } = await api.post('/customer-orders/auth/signup', {
      outlet_id: OUTLET_ID,
      name,
      mobile,
      password,
    });
    await persistSession(data.customer, data.accessToken);
  }

  async function logout() {
    await AsyncStorage.removeMany([TOKEN_STORAGE_KEY, CUSTOMER_STORAGE_KEY]);
    setCustomer(null);
  }

  async function updateCustomer(nextCustomer: Customer) {
    await AsyncStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(nextCustomer));
    setCustomer(nextCustomer);
  }

  return (
    <AuthContext.Provider value={{ customer, isLoading, login, signup, logout, updateCustomer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type OrderType = 'delivery' | 'pickup';

const ORDER_TYPE_STORAGE_KEY = 'selected_order_type';

type OrderTypeContextValue = {
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
};

const OrderTypeContext = createContext<OrderTypeContextValue | undefined>(undefined);

export function OrderTypeProvider({ children }: { children: React.ReactNode }) {
  const [orderType, setOrderTypeState] = useState<OrderType>('delivery');

  useEffect(() => {
    AsyncStorage.getItem(ORDER_TYPE_STORAGE_KEY).then(stored => {
      if (stored === 'delivery' || stored === 'pickup') setOrderTypeState(stored);
    });
  }, []);

  function setOrderType(type: OrderType) {
    setOrderTypeState(type);
    AsyncStorage.setItem(ORDER_TYPE_STORAGE_KEY, type).catch(() => {});
  }

  return (
    <OrderTypeContext.Provider value={{ orderType, setOrderType }}>
      {children}
    </OrderTypeContext.Provider>
  );
}

export function useOrderType() {
  const ctx = useContext(OrderTypeContext);
  if (!ctx) throw new Error('useOrderType must be used within OrderTypeProvider');
  return ctx;
}

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/client';
import { CLIENT_GROUP_ID } from '../config';
import { setSelectedOutletGlobal } from '../utils/outletStore';

export type Outlet = {
  outlet_id: string;
  restaurant_brand_name?: string;
  legal_business_name?: string;
  is_parent?: boolean;
};

type OutletContextValue = {
  outlets: Outlet[];
  selectedOutlet: Outlet | null;
  setSelectedOutlet: (outlet: Outlet) => void;
  outletsLoading: boolean;
};

const OUTLET_STORAGE_KEY = 'selected_outlet';

const OutletContext = createContext<OutletContextValue | undefined>(undefined);

export function OutletProvider({ children }: { children: React.ReactNode }) {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutlet, setSelectedOutletState] = useState<Outlet | null>(null);
  const [outletsLoading, setOutletsLoading] = useState(true);
  const initDone = useRef(false);

  const setSelectedOutlet = useCallback((outlet: Outlet) => {
    setSelectedOutletGlobal(outlet);
    setSelectedOutletState(outlet);
    AsyncStorage.setItem(OUTLET_STORAGE_KEY, JSON.stringify(outlet)).catch(() => {});
  }, []);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    (async () => {
      let stored: Outlet | null = null;
      try {
        const raw = await AsyncStorage.getItem(OUTLET_STORAGE_KEY);
        if (raw) {
          stored = JSON.parse(raw) as Outlet;
          setSelectedOutletGlobal(stored);
          setSelectedOutletState(stored);
        }
      } catch {
        // ignore — falls through to the default-outlet selection below
      }

      try {
        const { data } = await api.get('/customer-order/outlets', {
          params: { client_group_id: CLIENT_GROUP_ID },
        });
        const list: Outlet[] = data.outlets || [];
        setOutlets(list);

        const stillExists = stored && list.some(o => o.outlet_id === stored!.outlet_id);
        if (!stillExists) {
          const fallback = list.find(o => o.is_parent) || list[0] || null;
          if (fallback) setSelectedOutlet(fallback);
        }
      } catch (err) {
        console.error('[OutletContext] Failed to fetch outlets:', err);
      } finally {
        setOutletsLoading(false);
      }
    })();
  }, [setSelectedOutlet]);

  return (
    <OutletContext.Provider value={{ outlets, selectedOutlet, setSelectedOutlet, outletsLoading }}>
      {children}
    </OutletContext.Provider>
  );
}

export function useOutlet() {
  const ctx = useContext(OutletContext);
  if (!ctx) throw new Error('useOutlet must be used within OutletProvider');
  return ctx;
}

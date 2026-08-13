import React, { createContext, useContext, useMemo, useState } from 'react';
import type { CartLine, MenuItem } from '../types';

type CartContextValue = {
  lines: CartLine[];
  addItem: (item: MenuItem) => void;
  incrementItem: (itemId: number) => void;
  decrementItem: (itemId: number) => void;
  removeItem: (itemId: number) => void;
  clear: () => void;
  total: number;
  itemCount: number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  function addItem(item: MenuItem) {
    if (item.price == null) return;
    setLines(prev => {
      const existing = prev.find(l => l.item_id === item.id);
      if (existing) {
        return prev.map(l => (l.item_id === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { item_id: item.id, item_name: item.item_name, price: item.price as number, quantity: 1 }];
    });
  }

  function incrementItem(itemId: number) {
    setLines(prev => prev.map(l => (l.item_id === itemId ? { ...l, quantity: l.quantity + 1 } : l)));
  }

  function decrementItem(itemId: number) {
    setLines(prev =>
      prev
        .map(l => (l.item_id === itemId ? { ...l, quantity: l.quantity - 1 } : l))
        .filter(l => l.quantity > 0)
    );
  }

  function removeItem(itemId: number) {
    setLines(prev => prev.filter(l => l.item_id !== itemId));
  }

  function clear() {
    setLines([]);
  }

  const total = useMemo(() => lines.reduce((sum, l) => sum + l.price * l.quantity, 0), [lines]);
  const itemCount = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);

  return (
    <CartContext.Provider value={{ lines, addItem, incrementItem, decrementItem, removeItem, clear, total, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

import React, { createContext, useContext, useMemo, useState } from 'react';
import type { AddOn, CartLine, MenuItem, MenuItemVariant } from '../types';

type CartContextValue = {
  lines: CartLine[];
  addItem: (item: MenuItem, note?: string, variant?: MenuItemVariant, addOns?: AddOn[]) => void;
  incrementLine: (cartKey: string) => void;
  decrementLine: (cartKey: string) => void;
  removeLine: (cartKey: string) => void;
  updateLineNote: (cartKey: string, note: string) => void;
  clear: () => void;
  total: number;
  itemCount: number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  function addItem(item: MenuItem, note = '', variant?: MenuItemVariant, addOns?: AddOn[]) {
    const basePrice = variant?.price ?? item.price;
    if (basePrice == null) return;
    const addOnsPrice = (addOns ?? []).reduce((sum, a) => sum + (a.is_free ? 0 : Number(a.price)), 0);
    const price = basePrice + addOnsPrice;
    const addOnKey = (addOns ?? []).map(a => a.id).sort((a, b) => a - b).join(',');
    const cartKey = `${item.id}::${variant?.label ?? 'default'}::${addOnKey}`;
    setLines(prev => {
      const existing = prev.find(l => l.cart_key === cartKey);
      if (existing) {
        return prev.map(l => (l.cart_key === cartKey ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          cart_key: cartKey,
          item_id: item.id,
          item_name: item.item_name,
          price,
          quantity: 1,
          variant_label: variant?.label,
          note: note.trim() || undefined,
          add_ons: addOns && addOns.length ? addOns : undefined,
        },
      ];
    });
  }

  function incrementLine(cartKey: string) {
    setLines(prev => prev.map(l => (l.cart_key === cartKey ? { ...l, quantity: l.quantity + 1 } : l)));
  }

  function decrementLine(cartKey: string) {
    setLines(prev =>
      prev
        .map(l => (l.cart_key === cartKey ? { ...l, quantity: l.quantity - 1 } : l))
        .filter(l => l.quantity > 0)
    );
  }

  function removeLine(cartKey: string) {
    setLines(prev => prev.filter(l => l.cart_key !== cartKey));
  }

  function updateLineNote(cartKey: string, note: string) {
    setLines(prev => prev.map(l => (l.cart_key === cartKey ? { ...l, note: note.trim() || undefined } : l)));
  }

  function clear() {
    setLines([]);
  }

  const total = useMemo(() => lines.reduce((sum, l) => sum + l.price * l.quantity, 0), [lines]);
  const itemCount = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);

  return (
    <CartContext.Provider
      value={{ lines, addItem, incrementLine, decrementLine, removeLine, updateLineNote, clear, total, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

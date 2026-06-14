import { createContext, useContext, useState, ReactNode } from 'react';
import { CartItem, Product } from '../types';
import { stockAt } from '../utils/format';

interface CartContextValue {
  items: CartItem[];
  // Returns true if the requested quantity was added in full; false if it was
  // capped at the available SHOP stock (so callers can warn the customer).
  addItem: (product: Product, quantity?: number, color?: string) => boolean;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  totalCents: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // You can never hold more units in the cart than exist in the shop.
  // Stock isn't tracked per colour, so a line is still keyed by product; the most
  // recently chosen colour wins (re-adding the same model updates its colour).
  function addItem(product: Product, quantity = 1, color?: string): boolean {
    const available = stockAt(product, 'SHOP');
    let addedInFull = true;
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      const current = existing?.quantity ?? 0;
      const next = Math.min(current + quantity, available);
      addedInFull = next === current + quantity;
      if (next <= 0) return prev;
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: next, color: color ?? i.color } : i,
        );
      }
      return [...prev, { product, quantity: next, color }];
    });
    return addedInFull;
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }

  function setQuantity(productId: string, quantity: number) {
    if (quantity <= 0) return removeItem(productId);
    setItems((prev) =>
      prev.map((i) =>
        i.product.id === productId
          ? { ...i, quantity: Math.min(quantity, stockAt(i.product, 'SHOP')) }
          : i,
      ),
    );
  }

  function clear() {
    setItems([]);
  }

  const totalCents = items.reduce((sum, i) => sum + i.product.priceCents * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, setQuantity, clear, totalCents }}>
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

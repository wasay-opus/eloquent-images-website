import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const CART_STORAGE_KEY = 'eloquent_cart_v1';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Unable to save cart to localStorage:', error);
    }
  }, [items]);

  const addItem = useCallback(({ product, variant, design, quantity = 1 }) => {
    setItems((prev) => {
      const itemKey = `${variant.variantId}_${design.src}`;
      const existingIndex = prev.findIndex((i) => i.key === itemKey);

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: (updated[existingIndex].quantity || 1) + quantity,
        };
        return updated;
      }

      const newItem = {
        key: itemKey,
        product,
        variant,
        design,
        quantity,
        addedAt: Date.now(),
      };
      return [...prev, newItem];
    });
  }, []);

  const removeItem = useCallback((itemKey) => {
    setItems((prev) => prev.filter((i) => i.key !== itemKey));
  }, []);

  const updateQuantity = useCallback((itemKey, quantity) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.key !== itemKey));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.key === itemKey ? { ...i, quantity } : i)),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const count = useMemo(
    () => items.reduce((sum, item) => sum + (item.quantity || 1), 0),
    [items],
  );

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + (Number(item.variant?.price) || 0) * (item.quantity || 1),
        0,
      ),
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      count,
      subtotal,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
    }),
    [items, count, subtotal, addItem, removeItem, updateQuantity, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

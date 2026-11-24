import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth-context';
import type { Cart, Currency, ExchangeRatePayload, Product } from './types';

interface StoreContextValue {
  currency: Currency;
  setCurrency: (next: Currency) => void;
  exchangeRate: number;
  refreshExchangeRate: () => Promise<void>;
  formatPrimaryPrice: (usd: number | string) => string;
  formatSecondaryPrice: (usd: number | string) => string;
  cart: Cart | null;
  cartCount: number;
  cartSubtotalUsd: number;
  refreshCart: () => Promise<void>;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  wishlistIds: string[];
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  compareProducts: Product[];
  toggleCompare: (product: Product) => void;
  removeCompare: (productId: string) => void;
  clearCompare: () => void;
  isCompareOpen: boolean;
  setCompareOpen: (open: boolean) => void;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

const WISHLIST_KEY = 'zandogo_wishlist_ids';
const CURRENCY_KEY = 'zandogo_currency';

function safeGetStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage access restrictions
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = safeGetStorage(CURRENCY_KEY);
    return saved === 'CDF' ? 'CDF' : 'USD';
  });
  const [exchangeRate, setExchangeRate] = useState<number>(2850);
  const [cart, setCart] = useState<Cart | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    try {
      const raw = safeGetStorage(WISHLIST_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [compareProducts, setCompareProducts] = useState<Product[]>([]);
  const [isCompareOpen, setCompareOpen] = useState(false);

  const refreshExchangeRate = useCallback(async () => {
    try {
      const { data } = await api.get<ExchangeRatePayload>('/finance/exchange-rates');
      if (data && Number(data.rate) > 0) {
        setExchangeRate(Number(data.rate));
      }
    } catch {
      // keep existing exchangeRate
    }
  }, []);

  const refreshCart = useCallback(async () => {
    if (!user) {
      setCart(null);
      return;
    }
    try {
      const { data } = await api.get<Cart>('/cart');
      setCart(data);
    } catch {
      // keep existing cart
    }
  }, [user]);

  useEffect(() => {
    void refreshExchangeRate();
  }, [refreshExchangeRate]);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  useEffect(() => {
    if (user?.preferredCurrency && (user.preferredCurrency === 'USD' || user.preferredCurrency === 'CDF')) {
      setCurrencyState(user.preferredCurrency);
      safeSetStorage(CURRENCY_KEY, user.preferredCurrency);
    }
  }, [user?.preferredCurrency]);

  function setCurrency(next: Currency) {
    setCurrencyState(next);
    safeSetStorage(CURRENCY_KEY, next);
    if (user) {
      api.patch('/users/me/currency', { currency: next }).catch(() => {});
    }
  }

  function formatPrimaryPrice(usd: number | string): string {
    const val = Number(usd) || 0;
    if (currency === 'CDF') {
      return `${Math.round(val * exchangeRate).toLocaleString('fr-FR')} CDF`;
    }
    return `$${val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatSecondaryPrice(usd: number | string): string {
    const val = Number(usd) || 0;
    if (currency === 'CDF') {
      return `≈ $${val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
    }
    return `≈ ${Math.round(val * exchangeRate).toLocaleString('fr-FR')} CDF`;
  }

  function toggleWishlist(productId: string) {
    setWishlistIds((prev) => {
      const next = prev.includes(productId) ? prev.filter((id) => id !== productId) : [productId, ...prev];
      safeSetStorage(WISHLIST_KEY, JSON.stringify(next));
      return next;
    });
  }

  function isWishlisted(productId: string) {
    return wishlistIds.includes(productId);
  }

  function toggleCompare(product: Product) {
    setCompareProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) return prev.filter((p) => p.id !== product.id);
      if (prev.length >= 3) return [...prev.slice(1), product];
      return [...prev, product];
    });
  }

  function removeCompare(productId: string) {
    setCompareProducts((prev) => prev.filter((p) => p.id !== productId));
  }

  function clearCompare() {
    setCompareProducts([]);
    setCompareOpen(false);
  }

  const cartItems = cart?.items ?? [];
  const cartCount = cartItems.reduce((sum, it) => sum + (it.quantity || 1), 0);
  const cartSubtotalUsd = cartItems.reduce(
    (sum, it) => sum + Number(it.unitPriceSnapshot || 0) * (it.quantity || 1),
    0,
  );

  return (
    <StoreContext.Provider
      value={{
        currency,
        setCurrency,
        exchangeRate,
        refreshExchangeRate,
        formatPrimaryPrice,
        formatSecondaryPrice,
        cart,
        cartCount,
        cartSubtotalUsd,
        refreshCart,
        isCartOpen,
        openCart: () => setIsCartOpen(true),
        closeCart: () => setIsCartOpen(false),
        wishlistIds,
        toggleWishlist,
        isWishlisted,
        compareProducts,
        toggleCompare,
        removeCompare,
        clearCompare,
        isCompareOpen,
        setCompareOpen,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

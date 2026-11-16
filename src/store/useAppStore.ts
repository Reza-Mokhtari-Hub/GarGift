import { create } from 'zustand';

export interface CartItem {
  key: string; // `${productId}:${variantId}:${JSON.stringify(customFields)}`
  productId: number;
  productSlug: string;
  productTitle: string;
  brand: string;
  region: string;
  variantId: number;
  variantTitle: string;
  unitPriceToman: number;
  usdPriceCents: number;
  qty: number;
  maxQty: number;
  deliveryType: string;
  customFields: Record<string, string>;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface AppStoreState {
  // Bootstrap state
  isLoaded: boolean;
  user: any | null;
  favorites: number[];
  unreadNotifications: number;
  settings: any;
  categories: any[];
  menus: any[];
  banners: any[];
  faqs: any[];
  posts: any[];
  reviews: any[];

  // Theme
  themeMode: 'dark' | 'light';
  toggleTheme: () => void;
  setThemeMode: (mode: 'dark' | 'light') => void;

  // Cart
  cart: CartItem[];
  isCartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  addToCart: (item: Omit<CartItem, 'key'>) => void;
  updateCartQty: (key: string, qty: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;

  // Toasts
  toasts: ToastMessage[];
  addToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  // Bootstrap fetcher
  fetchBootstrap: () => Promise<void>;
  setUser: (user: any | null) => void;
  toggleFavorite: (productId: number) => Promise<void>;
}

function loadSavedCart(): CartItem[] {
  try {
    const raw = localStorage.getItem('gargift_cart');
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore storage errors in restricted iframes
  }
  return [];
}

function saveCart(cart: CartItem[]) {
  try {
    localStorage.setItem('gargift_cart', JSON.stringify(cart));
  } catch {
    // ignore
  }
}

function loadSavedTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem('gargift_theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore
  }
  return 'dark';
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  isLoaded: false,
  user: null,
  favorites: [],
  unreadNotifications: 0,
  settings: {
    general: {
      siteName: 'گرگیفت+',
      siteNameLatin: 'GarGift+',
      slogan: 'گیفت‌کارت، اشتراک و شارژ بازی؛ سریع، مطمئن، ارزان',
      usePersianDigits: true,
      showUsdPrice: true,
    },
    theme: {
      defaultMode: 'dark',
      primaryColor: '#6366f1',
      accentColor: '#06b6d4',
    },
    pricing: {
      globalUsdRate: 69000,
    },
    payment: {},
    homepageLayout: { sections: [] },
  },
  categories: [],
  menus: [],
  banners: [],
  faqs: [],
  posts: [],
  reviews: [],

  themeMode: loadSavedTheme(),
  toggleTheme: () => {
    const next = get().themeMode === 'dark' ? 'light' : 'dark';
    get().setThemeMode(next);
  },
  setThemeMode: (mode) => {
    set({ themeMode: mode });
    try {
      localStorage.setItem('gargift_theme', mode);
    } catch {
      // ignore
    }
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', mode === 'dark');
    }
  },

  cart: loadSavedCart(),
  isCartDrawerOpen: false,
  setCartDrawerOpen: (open) => set({ isCartDrawerOpen: open }),

  addToCart: (item) => {
    const key = `${item.productId}:${item.variantId}:${JSON.stringify(item.customFields || {})}`;
    const current = [...get().cart];
    const existingIdx = current.findIndex((c) => c.key === key);
    if (existingIdx >= 0) {
      const nextQty = Math.min(current[existingIdx].maxQty, current[existingIdx].qty + item.qty);
      current[existingIdx] = {
        ...current[existingIdx],
        qty: nextQty,
        unitPriceToman: item.unitPriceToman,
      };
    } else {
      current.push({ ...item, key });
    }
    saveCart(current);
    set({ cart: current });
    get().addToast(`«${item.productTitle} (${item.variantTitle})» به سبد خرید اضافه شد.`, 'success');
  },

  updateCartQty: (key, qty) => {
    if (qty <= 0) {
      get().removeFromCart(key);
      return;
    }
    const current = get().cart.map((c) =>
      c.key === key ? { ...c, qty: Math.min(c.maxQty, qty) } : c
    );
    saveCart(current);
    set({ cart: current });
  },

  removeFromCart: (key) => {
    const current = get().cart.filter((c) => c.key !== key);
    saveCart(current);
    set({ cart: current });
  },

  clearCart: () => {
    saveCart([]);
    set({ cart: [] });
  },

  toasts: [],
  addToast: (text, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    set((s) => ({ toasts: [...s.toasts, { id, text, type }] }));
    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  fetchBootstrap: async () => {
    try {
      const res = await fetch('/api/bootstrap', { credentials: 'include' });
      const json = await res.json();
      if (json.ok && json.data) {
        const d = json.data;
        set({
          isLoaded: true,
          user: d.user,
          favorites: d.favorites || [],
          unreadNotifications: d.unreadNotifications || 0,
          settings: d.settings || get().settings,
          categories: d.categories || [],
          menus: d.menus || [],
          banners: d.banners || [],
          faqs: d.faqs || [],
          posts: d.posts || [],
          reviews: d.reviews || [],
        });

        // Apply CSS variables from theme settings
        if (typeof document !== 'undefined' && d.settings?.theme) {
          const root = document.documentElement;
          if (d.settings.theme.primaryColor) {
            root.style.setProperty('--color-primary', d.settings.theme.primaryColor);
          }
          if (d.settings.theme.accentColor) {
            root.style.setProperty('--color-accent', d.settings.theme.accentColor);
          }
        }
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  setUser: (user) => set({ user }),

  toggleFavorite: async (productId) => {
    const { user, addToast } = get();
    if (!user) {
      addToast('لطفاً برای افزودن به علاقه‌مندی‌ها وارد حساب خود شوید.', 'info');
      return;
    }
    try {
      const res = await fetch(`/api/account/favorites/${productId}`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.ok) {
        set({ favorites: json.data });
        addToast('فهرست علاقه‌مندی‌های شما به‌روزرسانی شد.', 'success');
      }
    } catch {
      addToast('خطا در تغییر علاقه‌مندی', 'error');
    }
  },
}));

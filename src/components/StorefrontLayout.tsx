import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingBag,
  User,
  Trash2,
  Plus,
  Minus,
  X,
  MessageCircle,
  Phone,
  Send,
  Sun,
  Moon,
  Search,
  ShieldCheck,
  Menu,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { GarGiftLogo } from './ui/Common';
import { formatToman, toPersianDigits } from '../utils/format';

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const {
    user,
    settings,
    menus,
    cart,
    isCartDrawerOpen,
    setCartDrawerOpen,
    updateCartQty,
    removeFromCart,
    themeMode,
    toggleTheme,
  } = useAppStore();

  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [contactOpen, setContactOpen] = React.useState(false);
  const [bannerDismissed, setBannerDismissed] = React.useState(false);
  const [quickSearch, setQuickSearch] = React.useState('');

  const usePersian = settings?.general?.usePersianDigits !== false;
  const headerMenus = (menus || [])
    .filter((m: any) => m.location === 'header' && m.is_active)
    .slice(0, 5);
  const footerMenus = (menus || []).filter((m: any) => m.location === 'footer' && m.is_active);

  const totalItems = cart.reduce((acc, item) => acc + item.qty, 0);
  const subtotalToman = cart.reduce((acc, item) => acc + item.unitPriceToman * item.qty, 0);

  // Maintenance mode check for non-admins
  const isMaintenance =
    settings?.general?.maintenanceMode &&
    user?.role !== 'super_admin' &&
    user?.role !== 'admin' &&
    !location.pathname.startsWith('/auth');

  if (isMaintenance) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
        <div className="max-w-lg w-full rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center">
          <div className="flex justify-center mb-5">
            <GarGiftLogo />
          </div>
          <h1 className="text-xl font-bold mb-3">فروشگاه در حال به‌روزرسانی است</h1>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            {settings?.general?.maintenanceMessage ||
              'در حال ارتقای سرویس‌ها هستیم. لطفاً دقایقی دیگر مراجعه فرمایید.'}
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
          >
            ورود مدیران سیستم
          </Link>
        </div>
      </div>
    );
  }

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      navigate(`/products?search=${encodeURIComponent(quickSearch.trim())}`);
    } else {
      navigate('/products');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Optional Slim Dismissible Top Announcement Bar (<= 40px) */}
      {settings?.general?.announcementBarActive && !bannerDismissed && (
        <div className="h-9 bg-indigo-950 text-indigo-100 border-b border-indigo-900/60 px-4 flex items-center justify-between text-xs">
          <div className="container mx-auto max-w-7xl flex items-center justify-between gap-4">
            <Link
              to={settings?.general?.announcementBarLink || '/products'}
              className="truncate hover:underline font-medium"
            >
              {settings?.general?.announcementBarText}
            </Link>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="بستن اعلان"
              className="text-indigo-300 hover:text-white shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link to="/" className="whitespace-nowrap shrink-0">
            <GarGiftLogo />
          </Link>

          {/* Zone 2: 4–5 Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            {(headerMenus.length > 0
              ? headerMenus
              : [
                  { id: 1, title: 'صفحه اصلی', url: '/' },
                  { id: 2, title: 'گیفت‌کارت‌ها', url: '/products?category=gift-cards' },
                  { id: 3, title: 'اشتراک هوش مصنوعی', url: '/products?category=ai-subscriptions' },
                  { id: 4, title: 'شارژ بازی‌ها', url: '/products?category=game-topup' },
                  { id: 5, title: 'راهنمای خرید', url: '/page/buying-guide' },
                ]
            ).map((item: any) => (
              <Link
                key={item.id}
                to={item.url}
                className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-indigo-500"
              >
                {item.title}
              </Link>
            ))}
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>سبد خرید</span>
              <span className="tabular-nums">
                ({toPersianDigits(totalItems, usePersian)})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="منوی موبایل"
              className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Workspace Utility Strip (Search, Account, Admin Link, Theme Switch, Live USD Rate) */}
      <div className="bg-slate-100/80 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800/60">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Live Search Form */}
          <form onSubmit={handleQuickSearchSubmit} className="relative flex-1 max-w-md min-w-[210px]">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="جستجوی گیفت‌کارت، ChatGPT، یوسی پابجی..."
              aria-label="جستجوی محصولات"
              className="w-full ps-9 pe-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </form>

          {/* Utility Controls */}
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="hidden lg:inline text-slate-500 dark:text-slate-400 tabular-nums">
              نرخ محاسبه ارزی: {formatToman(settings?.pricing?.globalUsdRate || 69000, usePersian)}
            </span>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={themeMode === 'dark' ? 'حالت روشن' : 'حالت تیره'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-500 whitespace-nowrap shrink-0"
            >
              {themeMode === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>حالت روشن</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>حالت تیره</span>
                </>
              )}
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                {(user.role === 'super_admin' || user.role === 'admin') && (
                  <Link
                    to="/admin"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-semibold hover:bg-amber-500/25 whitespace-nowrap shrink-0"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>پنل مدیریت</span>
                  </Link>
                )}
                <Link
                  to="/account"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-500 whitespace-nowrap shrink-0"
                >
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{user.name}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 tabular-nums hidden sm:inline">
                    ({formatToman(user.wallet_balance || 0, usePersian)})
                  </span>
                </Link>
              </div>
            ) : (
              <Link
                to="/auth"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-500 font-semibold whitespace-nowrap shrink-0"
              >
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span>ورود / ثبت‌نام</span>
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 flex flex-col gap-2">
            {(headerMenus.length > 0
              ? headerMenus
              : [
                  { id: 1, title: 'صفحه اصلی', url: '/' },
                  { id: 2, title: 'گیفت‌کارت‌ها', url: '/products?category=gift-cards' },
                  { id: 3, title: 'اشتراک هوش مصنوعی', url: '/products?category=ai-subscriptions' },
                  { id: 4, title: 'شارژ بازی‌ها', url: '/products?category=game-topup' },
                  { id: 5, title: 'راهنمای خرید', url: '/page/buying-guide' },
                ]
            ).map((item: any) => (
              <Link
                key={item.id}
                to={item.url}
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-500"
              >
                {item.title}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Slide-over Cart Drawer */}
      {isCartDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="سبد خرید"
        >
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col justify-between border-s border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-500" />
                <h2 className="text-base font-bold">
                  سبد خرید شما ({toPersianDigits(totalItems, usePersian)})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCartDrawerOpen(false)}
                aria-label="بستن سبد خرید"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingBag className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    سبد خرید شما در حال حاضر خالی است.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCartDrawerOpen(false);
                      navigate('/products');
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500"
                  >
                    مشاهده محصولات فروشگاه
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.key}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.productTitle}
                        </h3>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                          {item.variantTitle}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.key)}
                        aria-label={`حذف ${item.productTitle}`}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {Object.keys(item.customFields || {}).length > 0 && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2.5 py-1.5 rounded-lg">
                        {Object.entries(item.customFields).map(([k, v]) => (
                          <div key={k} className="truncate">
                            <span className="font-semibold">{k}:</span>{' '}
                            <span dir="ltr" className="font-mono">
                              {v}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <div className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.key, item.qty + 1)}
                          aria-label="افزایش تعداد"
                          className="text-slate-600 dark:text-slate-300 hover:text-indigo-500"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold w-6 text-center tabular-nums">
                          {toPersianDigits(item.qty, usePersian)}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.key, item.qty - 1)}
                          aria-label="کاهش تعداد"
                          className="text-slate-600 dark:text-slate-300 hover:text-rose-500"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-sm font-extrabold tabular-nums">
                        {formatToman(item.unitPriceToman * item.qty, usePersian)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">جمع کل سبد خرید:</span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {formatToman(subtotalToman, usePersian)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCartDrawerOpen(false);
                      navigate('/cart');
                    }}
                    className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    مشاهده سبد و کد تخفیف
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCartDrawerOpen(false);
                      navigate('/checkout');
                    }}
                    className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                  >
                    ادامه و تسویه‌حساب
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/80 mt-16">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2 space-y-3">
              <GarGiftLogo />
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
                {settings?.general?.slogan ||
                  'گیفت‌کارت، اشتراک و شارژ بازی؛ سریع، مطمئن، ارزان'}
              </p>
              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 pt-2">
                <div>تلفن پشتیبانی: {settings?.general?.supportPhone || '۰۲۱-۹۱۰۰۱۲۳۴'}</div>
                <div>
                  ساعت پاسخگویی:{' '}
                  {settings?.general?.workingHours ||
                    'همه‌روزه حتی ایام تعطیل، ۹ صبح تا ۱۲ شب'}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                دسترسی سریع
              </h3>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li>
                  <Link to="/products?category=gift-cards" className="hover:text-indigo-500">
                    خرید گیفت‌کارت اورجینال
                  </Link>
                </li>
                <li>
                  <Link to="/products?category=ai-subscriptions" className="hover:text-indigo-500">
                    اشتراک‌های هوش مصنوعی
                  </Link>
                </li>
                <li>
                  <Link to="/products?category=game-topup" className="hover:text-indigo-500">
                    شارژ یوسی پابجی و سی‌پی کالاف
                  </Link>
                </li>
                <li>
                  <Link to="/blog" className="hover:text-indigo-500">
                    مقالات و آموزش‌های گرگیفت+
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                راهنما و قوانین
              </h3>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                {(footerMenus.length > 0
                  ? footerMenus
                  : [
                      { id: 10, title: 'درباره گرگیفت+', url: '/page/about-us' },
                      { id: 11, title: 'تماس با ما', url: '/page/contact-us' },
                      { id: 12, title: 'قوانین و مقررات', url: '/page/terms' },
                      { id: 13, title: 'سیاست بازگشت وجه', url: '/page/refund-policy' },
                      { id: 14, title: 'حریم خصوصی', url: '/page/privacy' },
                    ]
                ).map((m: any) => (
                  <li key={m.id}>
                    <Link to={m.url} className="hover:text-indigo-500">
                      {m.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <p>{settings?.general?.footerText}</p>
            <div className="flex items-center gap-4">
              <span>تحویل آنی با رمزنگاری AES-256</span>
              <span aria-hidden="true">·</span>
              <span>پشتیبانی ۷ روز هفته</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Support Widget */}
      <div className="fixed bottom-5 end-5 z-40">
        {contactOpen && (
          <div className="mb-3 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-xl space-y-2.5 text-xs">
            <div className="font-bold text-slate-900 dark:text-white mb-1">
              ارتباط سریع با پشتیبانی گرگیفت+
            </div>
            <a
              href={settings?.general?.telegramUrl || 'https://t.me/gargift_plus'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <Send className="w-4 h-4 text-sky-500" />
              <span>پشتیبانی تلگرام</span>
            </a>
            <a
              href={settings?.general?.whatsappUrl || 'https://wa.me/989120000000'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <MessageCircle className="w-4 h-4 text-emerald-500" />
              <span>گفتگوی واتساپ</span>
            </a>
            <Link
              to="/account/tickets"
              onClick={() => setContactOpen(false)}
              className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <Phone className="w-4 h-4 text-indigo-500" />
              <span>ثبت تیکت پشتیبانی</span>
            </Link>
          </div>
        )}
        <button
          type="button"
          onClick={() => setContactOpen((v) => !v)}
          aria-label="پشتیبانی آنلاین"
          className="h-12 px-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg flex items-center gap-2 text-xs font-bold transition-transform hover:scale-105"
        >
          <MessageCircle className="w-4 h-4" />
          <span>پشتیبانی</span>
        </button>
      </div>
    </div>
  );
}

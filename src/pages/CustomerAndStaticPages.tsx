import React from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import {
  User,
  Lock,
  ShoppingBag,
  Wallet,
  MessageSquare,
  Heart,
  Bell,
  LogOut,
  CheckCircle2,
  Clock,
  Printer,
  Plus,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { useAppStore } from '../store/useAppStore';
import { CopyButton, ProductCard } from '../components/ui/Common';
import { formatToman, formatJalaliDate, toPersianDigits } from '../utils/format';

/**
 * Auth Page (/auth) - Login & Register with Quick Demo Fillers for QA testing
 */
export function AuthPage() {
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [referralCode, setReferralCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const { fetchBootstrap, addToast } = useAppStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier, password }),
      });
      const json = await res.json();
      if (json.ok) {
        await fetchBootstrap();
        addToast(`خوش آمدید، ${json.data.user.name}!`, 'success');
        if (
          redirect === '/' &&
          (json.data.user.role === 'super_admin' || json.data.user.role === 'admin')
        ) {
          navigate('/admin');
        } else {
          navigate(redirect);
        }
      } else {
        setError(json.error || 'خطا در ورود به حساب');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, phone, email, password, referralCode }),
      });
      const json = await res.json();
      if (json.ok) {
        await fetchBootstrap();
        addToast('ثبت‌نام با موفقیت انجام شد!', 'success');
        navigate(redirect);
      } else {
        setError(json.error || 'خطا در ثبت‌نام');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
        <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              mode === 'login' ? 'bg-indigo-600 text-white' : 'text-slate-500'
            }`}
          >
            ورود به حساب
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              mode === 'register' ? 'bg-indigo-600 text-white' : 'text-slate-500'
            }`}
          >
            ثبت‌نام کاربر جدید
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 font-semibold">
            {error}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-id" className="block text-xs font-semibold mb-1.5">
                شماره موبایل یا ایمیل
              </label>
              <input
                id="login-id"
                type="text"
                dir="ltr"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="09121112233"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
              />
            </div>

            <div>
              <label htmlFor="login-pass" className="block text-xs font-semibold mb-1.5">
                رمز عبور
              </label>
              <input
                id="login-pass"
                type="password"
                dir="ltr"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold"
            >
              {loading ? 'در حال بررسی...' : 'ورود به گرگیفت+'}
            </button>

            {/* Quick Login Helpers for Testing Customer & Super Admin */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-[11px] text-slate-400 text-center">
                ورود سریع با حساب‌های آماده تست:
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier('09121112233');
                    setPassword('User@123456');
                  }}
                  className="py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                >
                  مشتری (با ۲.۵ میلیون شارژ)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier('admin@gargift.ir');
                    setPassword('Admin@123456');
                  }}
                  className="py-2 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-[11px] font-semibold text-amber-600 dark:text-amber-300 border border-amber-500/30"
                >
                  مدیرکل (Super Admin)
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">نام و نام خانوادگی</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً سارا رضایی"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">شماره موبایل (۱۱ رقم)</label>
              <input
                type="text"
                dir="ltr"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09123456789"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">ایمیل (اختیاری)</label>
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">رمز عبور (حداقل ۶ کاراکتر)</label>
              <input
                type="password"
                dir="ltr"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">کد معرف (اختیاری)</label>
              <input
                type="text"
                dir="ltr"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="ALI2026"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold"
            >
              {loading ? 'در حال ساخت حساب...' : 'ایجاد حساب کاربری'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Customer Account Panel (/account/*)
 */
const ORDER_STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending_payment: { text: 'در انتظار پرداخت', color: 'text-amber-500' },
  pending_verification: { text: 'در انتظار تأیید رسید', color: 'text-sky-500' },
  processing: { text: 'در حال پردازش و انجام', color: 'text-indigo-400' },
  waiting_stock: { text: 'در انتظار تأمین موجودی کد', color: 'text-amber-400' },
  delivered: { text: 'تحویل‌شده و تکمیل', color: 'text-emerald-500' },
  cancelled: { text: 'لغوشده', color: 'text-slate-400' },
  failed: { text: 'ناموفق / ردشده', color: 'text-rose-500' },
  refunded: { text: 'مرجوع‌شده به کیف پول', color: 'text-purple-400' },
};

export function CustomerAccountPage() {
  const { tab: routeTab } = useParams();
  const navigate = useNavigate();
  const { user, settings, favorites, fetchBootstrap, setUser, addToast } = useAppStore();
  const usePersian = settings?.general?.usePersianDigits !== false;

  const activeTab = routeTab || 'orders';

  const [orders, setOrders] = React.useState<any[]>([]);
  const [walletData, setWalletData] = React.useState<{
    balance: number;
    transactions: any[];
    pendingDeposits: any[];
  }>({ balance: 0, transactions: [], pendingDeposits: [] });
  const [tickets, setTickets] = React.useState<any[]>([]);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [allProducts, setAllProducts] = React.useState<any[]>([]);

  // Deposit form
  const [depositAmount, setDepositAmount] = React.useState('500000');
  const [depositMethod, setDepositMethod] = React.useState<'gateway' | 'card_to_card'>('gateway');
  const [depositTracking, setDepositTracking] = React.useState('');

  // New Ticket form
  const [ticketSubject, setTicketSubject] = React.useState('');
  const [ticketMessage, setTicketMessage] = React.useState('');
  const [selectedTicketId, setSelectedTicketId] = React.useState<number | null>(null);
  const [replyText, setReplyText] = React.useState('');

  // Profile form
  const [profileName, setProfileName] = React.useState(user?.name || '');
  const [profileEmail, setProfileEmail] = React.useState(user?.email || '');
  const [newPassword, setNewPassword] = React.useState('');

  const loadAccountData = React.useCallback(() => {
    if (!user) return;
    fetch('/api/account/orders', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setOrders(j.data || []);
      });
    fetch('/api/account/wallet', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setWalletData(j.data);
      });
    fetch('/api/account/tickets', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setTickets(j.data || []);
      });
    fetch('/api/account/notifications', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setNotifications(j.data || []);
      });
    fetch('/api/products')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setAllProducts(j.data || []);
      });
  }, [user]);

  React.useEffect(() => {
    loadAccountData();
  }, [loadAccountData]);

  if (!user) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 text-center space-y-4">
        <p className="text-sm text-slate-400">لطفاً ابتدا وارد حساب کاربری خود شوید.</p>
        <Link
          to="/auth?redirect=/account"
          className="inline-flex px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
        >
          ورود به حساب کاربری
        </Link>
      </div>
    );
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    navigate('/');
  };

  const handleWalletDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/account/wallet/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        amount: depositAmount,
        method: depositMethod,
        trackingCode: depositTracking,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      addToast(
        depositMethod === 'gateway'
          ? 'کیف پول شما به صورت آنی شارژ شد!'
          : 'رسید شارژ ثبت شد و پس از تأیید اعمال می‌گردد.',
        'success'
      );
      await fetchBootstrap();
      loadAccountData();
      setDepositTracking('');
    } else {
      addToast(json.error || 'خطا در شارژ کیف پول', 'error');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/account/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ subject: ticketSubject, message: ticketMessage }),
    });
    const json = await res.json();
    if (json.ok) {
      addToast('تیکت پشتیبانی با موفقیت ثبت شد.', 'success');
      setTicketSubject('');
      setTicketMessage('');
      loadAccountData();
    } else {
      addToast(json.error || 'خطا در ثبت تیکت', 'error');
    }
  };

  const handleReplyTicket = async (ticketId: number) => {
    if (!replyText.trim()) return;
    const res = await fetch(`/api/account/tickets/${ticketId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message: replyText }),
    });
    const json = await res.json();
    if (json.ok) {
      addToast('پاسخ شما ارسال شد.', 'success');
      setReplyText('');
      loadAccountData();
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/account/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: profileName, email: profileEmail, newPassword }),
    });
    const json = await res.json();
    if (json.ok) {
      setUser(json.data.user);
      setNewPassword('');
      addToast('اطلاعات پروفایل ذخیره شد.', 'success');
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Account Sidebar */}
        <aside className="lg:col-span-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="text-base font-extrabold text-slate-900 dark:text-white">
              {user.name}
            </div>
            <div dir="ltr" className="text-xs font-mono text-slate-400 mt-0.5 text-end">
              {user.phone}
            </div>
            <div className="mt-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-300">موجودی کیف پول:</span>
              <span className="font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {formatToman(user.wallet_balance || 0, usePersian)}
              </span>
            </div>
          </div>

          <nav className="space-y-1 text-xs font-semibold">
            {[
              { key: 'orders', label: 'سفارش‌ها و کدهای من', icon: ShoppingBag },
              { key: 'wallet', label: 'کیف پول و تراکنش‌ها', icon: Wallet },
              { key: 'tickets', label: 'تیکت‌های پشتیبانی', icon: MessageSquare },
              { key: 'favorites', label: 'محصولات مورد علاقه', icon: Heart },
              { key: 'notifications', label: 'اعلان‌ها و پیام‌ها', icon: Bell },
              { key: 'profile', label: 'پروفایل و کد معرف', icon: User },
            ].map((item) => (
              <Link
                key={item.key}
                to={`/account/${item.key}`}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors ${
                  activeTab === item.key
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            ))}

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors mt-4"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج از حساب کاربری</span>
            </button>
          </nav>
        </aside>

        {/* Account Content Area */}
        <div className="lg:col-span-9 space-y-6">
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                سفارش‌ها و کدهای تحویل‌شده
              </h1>

              {orders.length === 0 ? (
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
                  <p className="text-sm text-slate-500">هنوز سفارشی ثبت نکرده‌اید.</p>
                  <Link
                    to="/products"
                    className="inline-flex px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                  >
                    شروع خرید
                  </Link>
                </div>
              ) : (
                orders.map((ord) => {
                  const st = ORDER_STATUS_LABELS[ord.status] || {
                    text: ord.status,
                    color: 'text-slate-400',
                  };
                  return (
                    <div
                      key={ord.id}
                      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                          <span
                            dir="ltr"
                            className="font-mono text-sm font-extrabold text-slate-900 dark:text-white"
                          >
                            {ord.order_number}
                          </span>
                          <span aria-hidden="true" className="text-slate-400">
                            ·
                          </span>
                          <span className={`text-xs font-bold ${st.color}`}>{st.text}</span>
                          <span aria-hidden="true" className="text-slate-400">
                            ·
                          </span>
                          <span className="text-xs text-slate-500 tabular-nums">
                            {formatJalaliDate(ord.created_at, true, usePersian)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                            {formatToman(ord.final_toman, usePersian)}
                          </span>
                          <button
                            type="button"
                            onClick={() => window.print()}
                            aria-label="چاپ فاکتور"
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-indigo-500"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Order Items & Delivered Codes */}
                      <div className="space-y-3">
                        {(ord.items || []).map((it: any) => (
                          <div
                            key={it.id}
                            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {it.product_title_snapshot}
                                </span>{' '}
                                <span className="text-indigo-500 font-semibold">
                                  ({it.variant_title_snapshot} × {toPersianDigits(it.qty, usePersian)})
                                </span>
                              </div>
                              <span className="font-bold tabular-nums">
                                {formatToman(it.total_price_toman, usePersian)}
                              </span>
                            </div>

                            {Object.keys(it.custom_fields || {}).length > 0 && (
                              <div className="text-xs text-slate-500 flex flex-wrap gap-4">
                                {Object.entries(it.custom_fields).map(([k, v]) => (
                                  <span key={k}>
                                    <strong>{k}:</strong>{' '}
                                    <span dir="ltr" className="font-mono">
                                      {String(v)}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Delivered Gift Codes Box */}
                            {it.delivered_codes && it.delivered_codes.length > 0 && (
                              <div className="pt-2 space-y-2">
                                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>کدهای اورجینال تحویل‌شده به شما:</span>
                                </div>
                                {it.delivered_codes.map((codeStr: string, idx: number) => (
                                  <div
                                    key={idx}
                                    className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between gap-3"
                                  >
                                    <span
                                      dir="ltr"
                                      className="font-mono text-sm font-extrabold tracking-wider text-emerald-400 select-all"
                                    >
                                      {codeStr}
                                    </span>
                                    <CopyButton text={codeStr} label="کپی کد" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {ord.delivery_result_text && (
                        <div className="text-xs text-slate-600 dark:text-slate-300 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-2.5 rounded-xl">
                          <strong>نتیجه تحویل:</strong> {ord.delivery_result_text}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'wallet' && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  افزایش موجودی کیف پول
                </h2>
                <form onSubmit={handleWalletDeposit} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">مبلغ شارژ (تومان)</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">روش شارژ</label>
                    <select
                      value={depositMethod}
                      onChange={(e) => setDepositMethod(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <option value="gateway">درگاه آنلاین (شارژ آنی)</option>
                      <option value="card_to_card">کارت‌به‌کارت (ثبت شماره پیگیری)</option>
                    </select>
                  </div>
                  {depositMethod === 'card_to_card' && (
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">شماره پیگیری واریز</label>
                      <input
                        type="text"
                        dir="ltr"
                        required
                        value={depositTracking}
                        onChange={(e) => setDepositTracking(e.target.value)}
                        placeholder="TRK-123456"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                      />
                    </div>
                  )}
                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                  >
                    شارژ کیف پول
                  </button>
                </form>
              </div>

              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  تاریخچه تراکنش‌های کیف پول
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2.5 text-start">شرح تراکنش</th>
                        <th className="py-2.5 text-start">مبلغ</th>
                        <th className="py-2.5 text-start">موجودی پس از تراکنش</th>
                        <th className="py-2.5 text-start">زمان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                      {walletData.transactions.map((tx: any) => (
                        <tr key={tx.id}>
                          <td className="py-3 font-medium">{tx.description}</td>
                          <td
                            className={`py-3 font-bold ${
                              tx.amount_toman >= 0 ? 'text-emerald-500' : 'text-rose-500'
                            }`}
                          >
                            {tx.amount_toman >= 0 ? '+' : ''}
                            {formatToman(tx.amount_toman, usePersian)}
                          </td>
                          <td className="py-3">{formatToman(tx.balance_after_toman, usePersian)}</td>
                          <td className="py-3 text-slate-400">
                            {formatJalaliDate(tx.created_at, true, usePersian)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="space-y-6">
              <form
                onSubmit={handleCreateTicket}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
              >
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  ارسال تیکت پشتیبانی جدید
                </h2>
                <input
                  type="text"
                  required
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="موضوع تیکت (مثلاً پیگیری سفارش یا سوال فنی)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <textarea
                  rows={3}
                  required
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder="متن پیام خود را بنویسید..."
                  className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  ثبت و ارسال تیکت
                </button>
              </form>

              <div className="space-y-4">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        {t.subject}
                      </div>
                      <span className="text-xs text-indigo-500 font-semibold">
                        وضعیت: {t.status === 'answered' ? 'پاسخ داده‌شده' : t.status === 'closed' ? 'بسته‌شده' : 'در انتظار پاسخ'}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {(t.messages || []).map((m: any) => (
                        <div
                          key={m.id}
                          className={`p-3.5 rounded-xl text-xs ${
                            m.is_admin
                              ? 'bg-indigo-500/10 border border-indigo-500/30'
                              : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div className="font-bold mb-1">
                            {m.is_admin ? 'پشتیبانی گرگیفت+' : m.sender_name}:
                          </div>
                          <div>{m.message}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={selectedTicketId === t.id ? replyText : ''}
                        onFocus={() => setSelectedTicketId(t.id)}
                        onChange={(e) => {
                          setSelectedTicketId(t.id);
                          setReplyText(e.target.value);
                        }}
                        placeholder="پاسخ جدید به این تیکت..."
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleReplyTicket(t.id)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                      >
                        ارسال پاسخ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'favorites' && (
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold">محصولات مورد علاقه من</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {allProducts
                  .filter((p) => favorites.includes(p.id))
                  .map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
              <h2 className="text-base font-extrabold">اعلان‌های حساب کاربری</h2>
              {notifications.map((n: any) => (
                <div
                  key={n.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                >
                  <div className="font-bold text-slate-900 dark:text-white">{n.title}</div>
                  <div className="text-slate-500">{n.body}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <form
                onSubmit={handleSaveProfile}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
              >
                <h2 className="text-base font-extrabold">ویرایش مشخصات و رمز عبور</h2>
                <div>
                  <label className="block text-xs font-semibold mb-1">نام و نام خانوادگی</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">ایمیل</label>
                  <input
                    type="email"
                    dir="ltr"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    رمز عبور جدید (در صورت تمایل به تغییر)
                  </label>
                  <input
                    type="password"
                    dir="ltr"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="حداقل ۶ کاراکتر"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                >
                  ذخیره تغییرات پروفایل
                </button>
              </form>

              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h2 className="text-base font-extrabold">کد معرف و پاداش دعوت دوستان</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  با اشتراک‌گذاری کد معرف اختصاصی خود با دوستانتان، در ازای اولین خرید آن‌ها پاداش نقدی به کیف پول شما واریز می‌گردد.
                </p>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span dir="ltr" className="font-mono text-base font-extrabold text-indigo-500">
                    {user.referral_code || 'GARGIFT'}
                  </span>
                  <CopyButton text={user.referral_code || 'GARGIFT'} label="کپی کد معرف" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Static CMS Page (/page/:slug) & Blog Pages (/blog, /blog/:slug)
 */
export function StaticCmsPage() {
  const { slug } = useParams();
  const [page, setPage] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/pages/${slug}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setPage(j.data);
        else setPage(null);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div className="container mx-auto max-w-4xl px-4 py-12 h-64 animate-pulse" />;
  }

  if (!page) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
        <h1 className="text-xl font-bold">صفحه مورد نظر یافت نشد</h1>
        <Link to="/" className="inline-flex px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold">
          بازگشت به صفحه اصلی
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-10 space-y-6">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-4">
          {page.title}
        </h1>
        <div
          className="prose dark:prose-invert max-w-none text-sm leading-loose text-slate-700 dark:text-slate-300 space-y-4"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content_html) }}
        />
      </div>
    </div>
  );
}

export function BlogPage() {
  const { slug } = useParams();
  const [posts, setPosts] = React.useState<any[]>([]);
  const [singlePost, setSinglePost] = React.useState<any | null>(null);

  React.useEffect(() => {
    if (slug) {
      fetch(`/api/posts/${slug}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.ok) setSinglePost(j.data);
        });
    } else {
      fetch('/api/posts')
        .then((r) => r.json())
        .then((j) => {
          if (j.ok) setPosts(j.data || []);
        });
    }
  }, [slug]);

  if (slug && singlePost) {
    return (
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-10">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-10 space-y-6">
          <Link to="/blog" className="text-xs text-indigo-500 hover:underline">
            ← بازگشت به مقالات آموزشی
          </Link>
          <h1 className="text-2xl font-extrabold">{singlePost.title}</h1>
          <div
            className="prose dark:prose-invert max-w-none text-sm leading-loose"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(singlePost.content_html) }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-6">
      <h1 className="text-2xl font-extrabold">مجله و مقالات آموزشی گرگیفت+</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {posts.map((post) => (
          <Link
            key={post.id}
            to={`/blog/${post.slug}`}
            className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition-colors space-y-2"
          >
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{post.title}</h2>
            <p className="text-xs text-slate-500 leading-relaxed">{post.excerpt}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

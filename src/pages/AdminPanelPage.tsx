import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  KeyRound,
  FolderTree,
  Users,
  Wallet,
  CreditCard,
  DollarSign,
  Tag,
  MessageSquare,
  Star,
  FileText,
  Palette,
  Settings,
  ShieldAlert,
  BarChart3,
  Plus,
  Trash2,
  Eye,
  Download,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { GarGiftLogo, ConfirmModal, CopyButton } from '../components/ui/Common';
import { formatToman, formatJalaliDate, toPersianDigits } from '../utils/format';

const ADMIN_MODULES = [
  { key: 'dashboard', label: '۱. داشبورد و نمای کلی', icon: LayoutDashboard },
  { key: 'orders', label: '۲. مدیریت سفارش‌ها', icon: ShoppingBag },
  { key: 'products', label: '۳. محصولات و واریانت‌ها', icon: Package },
  { key: 'codes', label: '۴. انبار کد رمزنگاری‌شده', icon: KeyRound },
  { key: 'categories', label: '۵. دسته‌ها و برندها', icon: FolderTree },
  { key: 'customers', label: '۶. مشتریان و کاربران', icon: Users },
  { key: 'wallet', label: '۷. کیف پول و تراکنش‌ها', icon: Wallet },
  { key: 'payments', label: '۸. درگاه‌ها و کارت‌ها', icon: CreditCard },
  { key: 'pricing', label: '۹. نرخ دلار و قیمت‌گذاری', icon: DollarSign },
  { key: 'coupons', label: '۱۰. کدهای تخفیف و کمپین', icon: Tag },
  { key: 'reviews', label: '۱۱. نظرات خریداران', icon: Star },
  { key: 'tickets', label: '۱۲. پشتیبانی و تیکت‌ها', icon: MessageSquare },
  { key: 'content', label: '۱۳. مدیریت محتوا و منو', icon: FileText },
  { key: 'theme', label: '۱۴. ظاهر، رنگ و تم', icon: Palette },
  { key: 'settings', label: '۱۵. تنظیمات عمومی و سئو', icon: Settings },
  { key: 'roles', label: '۱۶. مدیران، نقش‌ها و لاگ', icon: ShieldAlert },
  { key: 'reports', label: '۱۷. گزارش‌ها و پشتیبان‌گیری', icon: BarChart3 },
];

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const csvContent =
    '\uFEFF' +
    [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join(
      '\n'
    );
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function AdminPanelPage() {
  const { module: routeModule } = useParams();
  const navigate = useNavigate();
  const { user, settings, fetchBootstrap, addToast } = useAppStore();
  const usePersian = settings?.general?.usePersianDigits !== false;

  const activeModule = routeModule || 'dashboard';

  // Data states
  const [overview, setOverview] = React.useState<any | null>(null);
  const [orders, setOrders] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  const [categories, setCategories] = React.useState<any[]>([]);
  const [codes, setCodes] = React.useState<any[]>([]);
  const [usersList, setUsersList] = React.useState<any[]>([]);
  const [walletAdmin, setWalletAdmin] = React.useState<{
    transactions: any[];
    pendingPayments: any[];
  }>({ transactions: [], pendingPayments: [] });
  const [coupons, setCoupons] = React.useState<any[]>([]);
  const [reviews, setReviews] = React.useState<any[]>([]);
  const [tickets, setTickets] = React.useState<any[]>([]);
  const [contentData, setContentData] = React.useState<any>({
    banners: [],
    menus: [],
    pages: [],
    faqs: [],
    posts: [],
  });
  const [rateHistory, setRateHistory] = React.useState<any[]>([]);
  const [rolesAndLogs, setRolesAndLogs] = React.useState<{ roles: any[]; logs: any[] }>({
    roles: [],
    logs: [],
  });
  const [allSettings, setAllSettings] = React.useState<any>(settings);

  // Quick USD Rate input
  const [usdRateInput, setUsdRateInput] = React.useState(
    String(settings?.pricing?.globalUsdRate || 69000)
  );
  const [marginInput, setMarginInput] = React.useState(
    String(settings?.pricing?.globalMarginPercent ?? 6)
  );

  // Filters & Modals
  const [orderStatusFilter, setOrderStatusFilter] = React.useState('');
  const [selectedOrder, setSelectedOrder] = React.useState<any | null>(null);
  const [deliveryResultInput, setDeliveryResultInput] = React.useState('');

  // Code import state
  const [selectedCodeVariantId, setSelectedCodeVariantId] = React.useState<number>(0);
  const [codesBulkText, setCodesBulkText] = React.useState('');
  const [revealedCodesMap, setRevealedCodesMap] = React.useState<Record<number, string>>({});

  // New Product Modal State
  const [productModalOpen, setProductModalOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<any | null>(null);

  // Confirm modal
  const [confirmState, setConfirmState] = React.useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const loadModuleData = React.useCallback(async () => {
    if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) return;
    try {
      const ovRes = await fetch('/api/admin/overview', { credentials: 'include' });
      const ovJson = await ovRes.json();
      if (ovJson.ok) {
        setOverview(ovJson.data);
        if (ovJson.data?.pricing?.globalUsdRate) {
          setUsdRateInput(String(ovJson.data.pricing.globalUsdRate));
        }
      }

      if (activeModule === 'orders' || activeModule === 'reports') {
        const q = orderStatusFilter ? `?status=${orderStatusFilter}` : '';
        const r = await fetch(`/api/admin/orders${q}`, { credentials: 'include' });
        const j = await r.json();
        if (j.ok) setOrders(j.data || []);
      }

      if (
        activeModule === 'products' ||
        activeModule === 'codes' ||
        activeModule === 'categories'
      ) {
        const [pRes, cRes] = await Promise.all([
          fetch('/api/admin/products', { credentials: 'include' }),
          fetch('/api/admin/categories', { credentials: 'include' }),
        ]);
        const pJ = await pRes.json();
        const cJ = await cRes.json();
        if (pJ.ok) {
          setProducts(pJ.data || []);
          const firstVar = pJ.data?.[0]?.variants?.[0];
          if (firstVar && !selectedCodeVariantId) setSelectedCodeVariantId(firstVar.id);
        }
        if (cJ.ok) setCategories(cJ.data || []);
      }

      if (activeModule === 'codes') {
        const q = selectedCodeVariantId ? `?variantId=${selectedCodeVariantId}` : '';
        const r = await fetch(`/api/admin/codes${q}`, { credentials: 'include' });
        const j = await r.json();
        if (j.ok) setCodes(j.data || []);
      }

      if (activeModule === 'customers') {
        const r = await fetch('/api/admin/users', { credentials: 'include' });
        const j = await r.json();
        if (j.ok) setUsersList(j.data || []);
      }

      if (activeModule === 'wallet') {
        const r = await fetch('/api/admin/wallet-transactions', { credentials: 'include' });
        const j = await r.json();
        if (j.ok) setWalletAdmin(j.data);
      }

      if (activeModule === 'pricing') {
        const r = await fetch('/api/admin/pricing/history', { credentials: 'include' });
        const j = await r.json();
        if (j.ok) setRateHistory(j.data || []);
      }

      if (activeModule === 'coupons') {
        const r = await fetch('/api/admin/coupons', { credentials: 'include' });
        const j = await r.json();
        if (j.ok) setCoupons(j.data || []);
      }

      if (activeModule === 'reviews') {
        const r = await fetch('/api/admin/reviews', { credentials: 'include' });
        const j = await r.json();
        if (j.ok) setReviews(j.data || []);
      }

      if (activeModule === 'tickets') {
        const r = await fetch('/api/admin/tickets', { credentials: 'include' });
        const j = await r.json();
        if (j.ok) setTickets(j.data || []);
      }

      if (activeModule === 'content') {
        const r = await fetch('/api/admin/content', { credentials: 'include' });
        const j = await r.json();
        if (j.ok) setContentData(j.data);
      }

      if (
        activeModule === 'payments' ||
        activeModule === 'theme' ||
        activeModule === 'settings'
      ) {
        const r = await fetch('/api/admin/settings', { credentials: 'include' });
        const j = await r.json();
        if (j.ok) setAllSettings(j.data);
      }

      if (activeModule === 'roles') {
        const r = await fetch('/api/admin/roles-and-logs', { credentials: 'include' });
        const j = await r.json();
        if (j.ok) setRolesAndLogs(j.data);
      }
    } catch {
      // ignore
    }
  }, [user, activeModule, orderStatusFilter, selectedCodeVariantId]);

  React.useEffect(() => {
    loadModuleData();
  }, [loadModuleData]);

  // Live 15-second polling for admin notifications & overview
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (user?.role === 'super_admin' || user?.role === 'admin') {
        fetch('/api/admin/overview', { credentials: 'include' })
          .then((r) => r.json())
          .then((j) => {
            if (j.ok) setOverview(j.data);
          })
          .catch(() => {});
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [user]);

  if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
        <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
          <h1 className="text-xl font-bold">دسترسی محدود به مدیران سیستم</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            برای مشاهده و مدیریت پنل ادمین گرگیفت+، لطفاً با حساب مدیرکل وارد شوید.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/auth?redirect=/admin"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
            >
              ورود با حساب مدیرکل
            </Link>
            <Link
              to="/"
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
            >
              بازگشت به ویترین
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleUpdateUsdRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/pricing/usd-rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        usdRate: usdRateInput,
        marginPercent: marginInput,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      addToast('نرخ دلار سراسری به‌روزرسانی شد و تمامی قیمت‌های پویا محاسبه مجدد شدند.', 'success');
      await fetchBootstrap();
      loadModuleData();
    } else {
      addToast(json.error || 'خطا در تغییر نرخ دلار', 'error');
    }
  };

  const handleOrderAction = async (orderId: number, payload: any) => {
    const res = await fetch(`/api/admin/orders/${orderId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.ok) {
      addToast('عملیات سفارش با موفقیت انجام شد.', 'success');
      setSelectedOrder(json.data);
      loadModuleData();
    } else {
      addToast(json.error || 'خطا در عملیات سفارش', 'error');
    }
  };

  const handleImportCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/codes/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        variantId: selectedCodeVariantId,
        codesText: codesBulkText,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      addToast(
        `${toPersianDigits(json.data.inserted, usePersian)} کد جدید با رمزنگاری AES-256 ذخیره شد (${toPersianDigits(json.data.duplicates, usePersian)} کد تکراری نادیده گرفته شد).`,
        'success'
      );
      setCodesBulkText('');
      loadModuleData();
    } else {
      addToast(json.error || 'خطا در افزودن کدها', 'error');
    }
  };

  const handleRevealCode = async (codeId: number) => {
    const res = await fetch(`/api/admin/codes/${codeId}/reveal`, {
      method: 'POST',
      credentials: 'include',
    });
    const json = await res.json();
    if (json.ok) {
      setRevealedCodesMap((prev) => ({ ...prev, [codeId]: json.data.code }));
      addToast('کد رمزگشایی شد و در لاگ امنیتی ثبت گردید.', 'info');
    } else {
      addToast(json.error || 'عدم دسترسی به مشاهده کد', 'error');
    }
  };

  const handleSaveSettingSection = async (key: string, value: any) => {
    const res = await fetch(`/api/admin/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(value),
    });
    const json = await res.json();
    if (json.ok) {
      addToast('تنظیمات با موفقیت در پایگاه داده ذخیره شد.', 'success');
      await fetchBootstrap();
      loadModuleData();
    } else {
      addToast(json.error || 'خطا در ذخیره تنظیمات', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Admin Sidebar (260px) */}
      <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-800 hidden lg:flex flex-col justify-between">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <GarGiftLogo />
          <span className="text-[11px] font-bold text-indigo-500">پنل مدیریت</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-xs font-semibold">
          {ADMIN_MODULES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => navigate(`/admin/${m.key}`)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors text-start ${
                activeModule === m.key
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <m.icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{m.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <Link
            to="/"
            className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>مشاهده ویترین فروشگاه</span>
          </Link>
        </div>
      </aside>

      {/* Main Workspace Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract for SaaS Dashboard */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <select
              value={activeModule}
              onChange={(e) => navigate(`/admin/${e.target.value}`)}
              aria-label="انتخاب ماژول مدیریت"
              className="lg:hidden px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold"
            >
              {ADMIN_MODULES.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <div className="text-sm font-extrabold truncate">
              پنل مدیریت گرگیفت+ /{' '}
              <span className="text-indigo-500">
                {ADMIN_MODULES.find((m) => m.key === activeModule)?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={loadModuleData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>به‌روزرسانی</span>
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold whitespace-nowrap shrink-0"
            >
              <span>ویترین سایت</span>
            </Link>
          </div>
        </header>

        {/* Module Body */}
        <main className="p-6 space-y-6 overflow-y-auto">
          {/* MODULE 1: DASHBOARD */}
          {activeModule === 'dashboard' && overview && (
            <div className="space-y-6">
              {/* Sample USD Rate Warning Banner */}
              {overview.pricing?.isSampleRateWarning && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-300 font-semibold">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>
                      توجه مدیرکل: نرخ دلار فعلی ({formatToman(overview.pricing.globalUsdRate, usePersian)}) مقدار نمونه اولیه (Seed) است. لطفاً پیش از بهره‌برداری نهایی نرخ روز را در کادر زیر ثبت کنید.
                    </span>
                  </div>
                </div>
              )}

              {/* KPI Strip + Quick USD Rate Updater */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500">مجموع فروش قطعی</div>
                  <div className="text-xl font-extrabold mt-1 tabular-nums text-emerald-500">
                    {formatToman(overview.totalSalesToman, usePersian)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    از {toPersianDigits(overview.paidOrdersCount, usePersian)} سفارش موفق
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500">سود خالص سفارش‌های تحویل‌شده</div>
                  <div className="text-xl font-extrabold mt-1 tabular-nums text-indigo-500">
                    {formatToman(overview.totalProfitToman, usePersian)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    بر اساس مابه‌التفاوت قیمت خرید و فروش
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500">موارد نیازمند اقدام فوری</div>
                  <div className="flex items-center gap-4 mt-2 text-xs font-bold tabular-nums">
                    <button
                      type="button"
                      onClick={() => navigate('/admin/orders')}
                      className="text-amber-500 hover:underline"
                    >
                      {toPersianDigits(overview.actionRequired.pendingReceipts, usePersian)} رسید جدید
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => navigate('/admin/orders')}
                      className="text-rose-500 hover:underline"
                    >
                      {toPersianDigits(overview.actionRequired.waitingStockOrders, usePersian)} منتظر موجودی
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => navigate('/admin/tickets')}
                      className="text-cyan-500 hover:underline"
                    >
                      {toPersianDigits(overview.actionRequired.openTickets, usePersian)} تیکت باز
                    </button>
                  </div>
                </div>

                {/* Quick USD Rate Form */}
                <form
                  onSubmit={handleUpdateUsdRate}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-indigo-500/40 space-y-2"
                >
                  <label className="block text-xs font-bold text-indigo-500">
                    به‌روزرسانی آنی نرخ دلار (تومان)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      dir="ltr"
                      value={usdRateInput}
                      onChange={(e) => setUsdRateInput(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold whitespace-nowrap shrink-0"
                    >
                      اعمال فوری
                    </button>
                  </div>
                </form>
              </div>

              {/* Sales Chart & Low Stock Alerts */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="text-sm font-bold">روند فروش و سود ۷ روز اخیر (تومان)</div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={overview.salesChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                        <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={11}
                          tickFormatter={(v) => `${Math.round(Number(v) / 1000000)}M`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '0.75rem',
                            color: '#f8fafc',
                            fontSize: '12px',
                          }}
                          formatter={(value: any) => [
                            formatToman(Number(value), usePersian),
                            '',
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="sales"
                          name="فروش کل"
                          stroke="#6366f1"
                          fill="#6366f1"
                          fillOpacity={0.2}
                        />
                        <Area
                          type="monotone"
                          dataKey="profit"
                          name="سود خالص"
                          stroke="#06b6d4"
                          fill="#06b6d4"
                          fillOpacity={0.2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-4 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="text-sm font-bold flex items-center justify-between">
                    <span>هشدار موجودی کم انبار کد</span>
                    <button
                      type="button"
                      onClick={() => navigate('/admin/codes')}
                      className="text-xs text-indigo-500 hover:underline"
                    >
                      مدیریت انبار کد
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {overview.lowStockVariants.length === 0 ? (
                      <p className="text-xs text-slate-400">موجودی تمام واریانت‌ها کافی است.</p>
                    ) : (
                      overview.lowStockVariants.map((v: any) => (
                        <div
                          key={v.variantId}
                          className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div className="truncate pe-2">
                            <div className="font-bold truncate">{v.productTitle}</div>
                            <div className="text-slate-400">{v.variantTitle}</div>
                          </div>
                          <span className="font-extrabold text-amber-500 tabular-nums shrink-0">
                            {toPersianDigits(v.availableStock, usePersian)} عدد
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 2: ORDERS MANAGEMENT */}
          {activeModule === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { k: '', l: 'همه سفارش‌ها' },
                    { k: 'pending_verification', l: 'در انتظار تأیید رسید' },
                    { k: 'processing', l: 'در حال پردازش (دستی)' },
                    { k: 'waiting_stock', l: 'در انتظار موجودی کد' },
                    { k: 'delivered', l: 'تحویل‌شده' },
                  ].map((f) => (
                    <button
                      key={f.k}
                      type="button"
                      onClick={() => setOrderStatusFilter(f.k)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        orderStatusFilter === f.k
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {f.l}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      'orders.csv',
                      ['OrderNumber', 'User', 'Phone', 'Status', 'Method', 'TotalToman', 'CreatedAt'],
                      orders.map((o) => [
                        o.order_number,
                        o.user_name,
                        o.user_phone,
                        o.status,
                        o.payment_method,
                        o.final_toman,
                        o.created_at,
                      ])
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>خروجی CSV سفارش‌ها</span>
                </button>
              </div>

              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="p-3.5 text-start">شماره سفارش</th>
                      <th className="p-3.5 text-start">مشتری</th>
                      <th className="p-3.5 text-start">اقلام</th>
                      <th className="p-3.5 text-start">مبلغ نهایی</th>
                      <th className="p-3.5 text-start">روش پرداخت</th>
                      <th className="p-3.5 text-start">وضعیت</th>
                      <th className="p-3.5 text-start">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td dir="ltr" className="p-3.5 font-mono font-bold text-end">
                          {o.order_number}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold">{o.user_name}</div>
                          <div dir="ltr" className="font-mono text-slate-400 text-end">
                            {o.user_phone}
                          </div>
                        </td>
                        <td className="p-3.5">
                          {(o.items || []).map((it: any) => (
                            <div key={it.id}>
                              {it.product_title_snapshot} ({it.variant_title_snapshot})
                            </div>
                          ))}
                        </td>
                        <td className="p-3.5 font-extrabold">
                          {formatToman(o.final_toman, usePersian)}
                        </td>
                        <td className="p-3.5">{o.payment_method}</td>
                        <td className="p-3.5 font-bold text-indigo-500">{o.status}</td>
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrder(o);
                              setDeliveryResultInput(o.delivery_result_text || '');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold"
                          >
                            مدیریت و تحویل
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Order Details & Fulfillment Modal */}
              {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                  <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                      <h3 className="text-base font-extrabold">
                        مدیریت سفارش <span dir="ltr" className="font-mono">{selectedOrder.order_number}</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Items & Custom Player ID / Email Fields */}
                    <div className="space-y-3">
                      {(selectedOrder.items || []).map((it: any) => (
                        <div
                          key={it.id}
                          className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2"
                        >
                          <div className="font-bold">
                            {it.product_title_snapshot} - {it.variant_title_snapshot} (×{it.qty})
                          </div>
                          {Object.keys(it.custom_fields || {}).length > 0 && (
                            <div className="text-indigo-400">
                              {Object.entries(it.custom_fields).map(([k, v]) => (
                                <div key={k}>
                                  <strong>{k}:</strong> <span dir="ltr" className="font-mono">{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {it.delivered_codes?.length > 0 && (
                            <div dir="ltr" className="font-mono text-emerald-400">
                              Codes: {it.delivered_codes.join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Payment Verification Section */}
                    {selectedOrder.status === 'pending_verification' && (
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-xs">
                        <div className="font-bold text-amber-400">
                          رسید پرداخت ثبت‌شده در انتظار تأیید مالی:
                        </div>
                        {selectedOrder.payments?.[0] && (
                          <div>
                            کد پیگیری:{' '}
                            <span dir="ltr" className="font-mono font-bold">
                              {selectedOrder.payments[0].tracking_code}
                            </span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleOrderAction(selectedOrder.id, { action: 'approve_payment' })
                            }
                            className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold"
                          >
                            تأیید پرداخت و تحویل خودکار کد
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleOrderAction(selectedOrder.id, {
                                action: 'reject_payment',
                                rejectReason: 'عدم تطابق رسید بانکی',
                              })
                            }
                            className="px-4 py-2 rounded-lg bg-rose-600 text-white font-bold"
                          >
                            رد رسید پرداخت
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Manual Delivery Result Form */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold">
                        ثبت نتیجه تحویل دستی (شارژ Player ID یا فعال‌سازی اشتراک هوش مصنوعی):
                      </label>
                      <textarea
                        rows={2}
                        value={deliveryResultInput}
                        onChange={(e) => setDeliveryResultInput(e.target.value)}
                        placeholder="مثلاً: ۶۶۰ یوسی روی آیدی 5192837465 با موفقیت شارژ شد..."
                        className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleOrderAction(selectedOrder.id, {
                              action: 'deliver_manual',
                              deliveryResultText: deliveryResultInput,
                            })
                          }
                          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                        >
                          ثبت تحویل و تغییر وضعیت به «تحویل‌شده»
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleOrderAction(selectedOrder.id, { action: 'refund_to_wallet' })
                          }
                          className="px-4 py-2 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30 text-xs font-bold"
                        >
                          لغو و بازگشت وجه به کیف پول مشتری
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODULE 3: PRODUCTS & VARIANTS */}
          {activeModule === 'products' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold">
                  مدیریت محصولات و واریانت‌ها ({toPersianDigits(products.length, usePersian)} محصول)
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct({
                      title: '',
                      slug: '',
                      category_id: categories[0]?.id || 1,
                      brand: 'Google Play',
                      region: 'آمریکا (USA)',
                      short_description: '',
                      delivery_type: 'auto_code',
                      delivery_time_text: 'تحویل آنی و خودکار',
                      is_featured: 1,
                      variants: [
                        {
                          title: '۱۰ دلاری',
                          pricing_mode: 'dynamic',
                          usd_price_cents: 1000,
                          cost_price_toman: 650000,
                          discount_percent: 0,
                          stock_mode: 'code_pool',
                          stock_qty: 5,
                        },
                      ],
                    });
                    setProductModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                >
                  <Plus className="w-4 h-4" />
                  <span>افزودن محصول جدید</span>
                </button>
              </div>

              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="p-3.5 text-start">عنوان محصول</th>
                      <th className="p-3.5 text-start">دسته‌بندی / برند</th>
                      <th className="p-3.5 text-start">نوع تحویل</th>
                      <th className="p-3.5 text-start">تعداد واریانت</th>
                      <th className="p-3.5 text-start">شروع قیمت محاسبه‌شده</th>
                      <th className="p-3.5 text-start">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td className="p-3.5 font-bold">
                          {p.title}
                          {p.is_sample ? (
                            <span className="ms-2 text-[10px] text-amber-500 font-normal">
                              (داده نمونه)
                            </span>
                          ) : null}
                        </td>
                        <td className="p-3.5">
                          {p.category_name} · {p.brand}
                        </td>
                        <td className="p-3.5">{p.delivery_type}</td>
                        <td className="p-3.5">{toPersianDigits(p.variants?.length || 0, usePersian)}</td>
                        <td className="p-3.5 font-extrabold text-indigo-500">
                          {formatToman(p.starting_price_toman, usePersian)}
                        </td>
                        <td className="p-3.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(p);
                              setProductModalOpen(true);
                            }}
                            className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold"
                          >
                            ویرایش
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmState({
                                open: true,
                                title: 'حذف محصول',
                                message: `آیا از حذف «${p.title}» مطمئن هستید؟`,
                                onConfirm: async () => {
                                  await fetch(`/api/admin/products/${p.id}`, {
                                    method: 'DELETE',
                                    credentials: 'include',
                                  });
                                  setConfirmState((s) => ({ ...s, open: false }));
                                  loadModuleData();
                                },
                              })
                            }
                            className="text-rose-500 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Create / Edit Product Modal */}
              {productModalOpen && editingProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                  <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                      <h3 className="text-base font-extrabold">
                        {editingProduct.id ? 'ویرایش محصول' : 'ایجاد محصول جدید'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setProductModalOpen(false)}
                        className="text-slate-400"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block font-semibold mb-1">عنوان محصول</label>
                        <input
                          type="text"
                          value={editingProduct.title}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, title: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">اسلاگ (URL)</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={editingProduct.slug}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, slug: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">برند</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={editingProduct.brand}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, brand: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">ریجن</label>
                        <input
                          type="text"
                          value={editingProduct.region}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, region: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setProductModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
                      >
                        انصراف
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const url = editingProduct.id
                            ? `/api/admin/products/${editingProduct.id}`
                            : '/api/admin/products';
                          const method = editingProduct.id ? 'PUT' : 'POST';
                          const r = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify(editingProduct),
                          });
                          const j = await r.json();
                          if (j.ok) {
                            addToast('محصول با موفقیت ذخیره شد.', 'success');
                            setProductModalOpen(false);
                            loadModuleData();
                          } else {
                            addToast(j.error || 'خطا در ذخیره محصول', 'error');
                          }
                        }}
                        className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                      >
                        ذخیره محصول
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODULE 4: ENCRYPTED CODE WAREHOUSE */}
          {activeModule === 'codes' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleImportCodes}
                className="lg:col-span-4 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
              >
                <h2 className="text-sm font-extrabold">افزودن گروهی کد گیفت‌کارت (AES-256-GCM)</h2>
                <div>
                  <label className="block text-xs font-semibold mb-1">انتخاب محصول و واریانت:</label>
                  <select
                    value={selectedCodeVariantId}
                    onChange={(e) => setSelectedCodeVariantId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    {products.flatMap((p) =>
                      (p.variants || []).map((v: any) => (
                        <option key={v.id} value={v.id}>
                          {p.title} — {v.title} (موجودی: {v.available_stock})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    لیست کدها (هر کد در یک خط - تشخیص خودکار تکراری):
                  </label>
                  <textarea
                    rows={5}
                    dir="ltr"
                    required
                    value={codesBulkText}
                    onChange={(e) => setCodesBulkText(e.target.value)}
                    placeholder={'GPLAY-XXXX-YYYY-1001\nGPLAY-XXXX-YYYY-1002'}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  رمزنگاری و افزودن به انبار کد
                </button>
              </form>

              <div className="lg:col-span-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold">
                    فهرست کدهای موجود و فروخته‌شده واریانت انتخابی
                  </h2>
                  <span className="text-xs text-slate-400">
                    کدها به صورت ماسک‌شده نمایش داده می‌شوند
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2.5 text-start">واریانت</th>
                        <th className="py-2.5 text-start">کد (ماسک‌شده / کامل)</th>
                        <th className="py-2.5 text-start">وضعیت</th>
                        <th className="py-2.5 text-start">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {codes.map((c) => (
                        <tr key={c.id}>
                          <td className="py-2.5">
                            {c.product_title} ({c.variant_title})
                          </td>
                          <td dir="ltr" className="py-2.5 font-mono font-bold text-end">
                            {revealedCodesMap[c.id] ? (
                              <span className="text-emerald-400">{revealedCodesMap[c.id]}</span>
                            ) : (
                              c.code_masked
                            )}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={
                                c.status === 'available'
                                  ? 'text-emerald-500 font-bold'
                                  : 'text-slate-400'
                              }
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="py-2.5 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleRevealCode(c.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold"
                            >
                              <Eye className="w-3 h-3" />
                              <span>نمایش کد</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 5: CATEGORIES */}
          {activeModule === 'categories' && (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <h2 className="text-base font-extrabold">دسته‌بندی‌های فروشگاه</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                  >
                    <div className="text-sm font-bold">{cat.name}</div>
                    <div dir="ltr" className="font-mono text-slate-400">
                      /{cat.slug}
                    </div>
                    <p className="text-slate-500">{cat.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODULE 6: CUSTOMERS */}
          {activeModule === 'customers' && (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <h2 className="text-base font-extrabold">مدیریت مشتریان و کیف پول</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2.5 text-start">نام کاربر</th>
                      <th className="py-2.5 text-start">موبایل / ایمیل</th>
                      <th className="py-2.5 text-start">نقش</th>
                      <th className="py-2.5 text-start">موجودی کیف پول</th>
                      <th className="py-2.5 text-start">وضعیت</th>
                      <th className="py-2.5 text-start">عملیات سریع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                    {usersList.map((u) => (
                      <tr key={u.id}>
                        <td className="py-3 font-bold">{u.name}</td>
                        <td dir="ltr" className="py-3 font-mono text-end">
                          {u.phone}
                        </td>
                        <td className="py-3">{u.role}</td>
                        <td className="py-3 font-bold text-emerald-500">
                          {formatToman(u.wallet_balance, usePersian)}
                        </td>
                        <td className="py-3">{u.status}</td>
                        <td className="py-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/admin/users/${u.id}/wallet`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                  amount: 100000,
                                  description: 'شارژ هدیه مدیریتی',
                                }),
                              });
                              addToast('۱۰۰,۰۰۰ تومان به کیف پول کاربر افزوده شد.', 'success');
                              loadModuleData();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 font-semibold"
                          >
                            +۱۰۰ هزار تومان
                          </button>
                          {u.role !== 'super_admin' && (
                            <button
                              type="button"
                              onClick={async () => {
                                const nextSt = u.status === 'active' ? 'banned' : 'active';
                                await fetch(`/api/admin/users/${u.id}/status`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({
                                    status: nextSt,
                                    banReason: 'مسدودسازی توسط مدیر',
                                  }),
                                });
                                loadModuleData();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-600/20 text-rose-400 font-semibold"
                            >
                              {u.status === 'active' ? 'مسدود کردن' : 'رفع مسدودی'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODULE 7: WALLET & TRANSACTIONS */}
          {activeModule === 'wallet' && (
            <div className="space-y-6">
              {walletAdmin.pendingPayments.length > 0 && (
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-amber-500/40 p-5 space-y-3">
                  <h3 className="text-sm font-bold text-amber-500">
                    صف شارژهای کارت‌به‌کارت در انتظار تأیید
                  </h3>
                  {walletAdmin.pendingPayments.map((p: any) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs"
                    >
                      <div>
                        <strong>{p.user_name}</strong> — مبلغ:{' '}
                        {formatToman(p.amount_toman, usePersian)} — کد پیگیری:{' '}
                        <span dir="ltr" className="font-mono">
                          {p.tracking_code}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/wallet-payments/${p.id}/verify`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ approve: true }),
                            });
                            addToast('شارژ کیف پول تأیید شد.', 'success');
                            loadModuleData();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
                        >
                          تأیید و شارژ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h2 className="text-base font-extrabold">کلیه تراکنش‌های کیف پول</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2.5 text-start">کاربر</th>
                        <th className="py-2.5 text-start">شرح</th>
                        <th className="py-2.5 text-start">مبلغ</th>
                        <th className="py-2.5 text-start">مانده</th>
                        <th className="py-2.5 text-start">زمان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                      {walletAdmin.transactions.map((t: any) => (
                        <tr key={t.id}>
                          <td className="py-2.5 font-bold">{t.user_name}</td>
                          <td className="py-2.5">{t.description}</td>
                          <td
                            className={`py-2.5 font-bold ${
                              t.amount_toman >= 0 ? 'text-emerald-500' : 'text-rose-500'
                            }`}
                          >
                            {formatToman(t.amount_toman, usePersian)}
                          </td>
                          <td className="py-2.5">{formatToman(t.balance_after_toman, usePersian)}</td>
                          <td className="py-2.5 text-slate-400">
                            {formatJalaliDate(t.created_at, true, usePersian)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 8: PAYMENTS SETTINGS */}
          {activeModule === 'payments' && allSettings?.payment && (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 max-w-3xl">
              <h2 className="text-base font-extrabold">تنظیمات درگاه‌های پرداخت و کارت‌به‌کارت</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="font-bold">پرداخت با کیف پول</span>
                  <input
                    type="checkbox"
                    checked={allSettings.payment.walletEnabled !== false}
                    onChange={(e) =>
                      setAllSettings({
                        ...allSettings,
                        payment: { ...allSettings.payment, walletEnabled: e.target.checked },
                      })
                    }
                  />
                </label>
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="font-bold">کارت‌به‌کارت بانکی</span>
                  <input
                    type="checkbox"
                    checked={allSettings.payment.cardToCardEnabled !== false}
                    onChange={(e) =>
                      setAllSettings({
                        ...allSettings,
                        payment: { ...allSettings.payment, cardToCardEnabled: e.target.checked },
                      })
                    }
                  />
                </label>
                <div>
                  <label className="block font-semibold mb-1">مرچنت کد زرین‌پال</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={allSettings.payment.zarinpalMerchantId || ''}
                    onChange={(e) =>
                      setAllSettings({
                        ...allSettings,
                        payment: { ...allSettings.payment, zarinpalMerchantId: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">مرچنت کد زیبال</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={allSettings.payment.zibalMerchantId || ''}
                    onChange={(e) =>
                      setAllSettings({
                        ...allSettings,
                        payment: { ...allSettings.payment, zibalMerchantId: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">آدرس والت تتر (TRC20)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={allSettings.payment.cryptoWalletAddress || ''}
                    onChange={(e) =>
                      setAllSettings({
                        ...allSettings,
                        payment: { ...allSettings.payment, cryptoWalletAddress: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSettingSection('payment', allSettings.payment)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                ذخیره تنظیمات پرداخت
              </button>
            </div>
          )}

          {/* MODULE 9: PRICING & USD RATE HISTORY */}
          {activeModule === 'pricing' && (
            <div className="space-y-6">
              <form
                onSubmit={handleUpdateUsdRate}
                className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-2xl space-y-4"
              >
                <h2 className="text-base font-extrabold">تنظیم نرخ دلار سراسری و حاشیه سود پایه</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">نرخ دلار فروشگاه (تومان)</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={usdRateInput}
                      onChange={(e) => setUsdRateInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">درصد سود پایه (Margin %)</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={marginInput}
                      onChange={(e) => setMarginInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                >
                  به‌روزرسانی آنی تمام قیمت‌ها
                </button>
              </form>

              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
                <h3 className="text-sm font-bold">تاریخچه تغییرات نرخ دلار</h3>
                <div className="space-y-2 text-xs tabular-nums">
                  {rateHistory.map((h) => (
                    <div
                      key={h.id}
                      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 flex items-center justify-between"
                    >
                      <span>
                        تغییر از {formatToman(h.old_rate, usePersian)} به{' '}
                        <strong className="text-indigo-500">
                          {formatToman(h.new_rate, usePersian)}
                        </strong>{' '}
                        ({h.note})
                      </span>
                      <span className="text-slate-400">
                        {formatJalaliDate(h.created_at, true, usePersian)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODULE 10: COUPONS */}
          {activeModule === 'coupons' && (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <h2 className="text-base font-extrabold">کدهای تخفیف فعال</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {coupons.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span dir="ltr" className="font-mono text-sm font-extrabold text-indigo-500">
                        {c.code}
                      </span>
                      <span className="text-slate-400">
                        استفاده: {toPersianDigits(c.used_count, usePersian)} /{' '}
                        {toPersianDigits(c.usage_limit, usePersian)}
                      </span>
                    </div>
                    <div className="font-bold">{c.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODULE 11: REVIEWS */}
          {activeModule === 'reviews' && (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <h2 className="text-base font-extrabold">مدیریت دیدگاه‌های مشتریان</h2>
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="font-bold">
                        {r.user_name} — <span className="text-indigo-500">{r.product_title}</span> (امتیاز: {r.rating})
                      </div>
                      <p className="text-slate-500">{r.comment}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/admin/reviews/${r.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                              status: 'approved',
                              admin_reply: r.admin_reply || 'سپاس از ثبت نظر شما در گرگیفت+.',
                            }),
                          });
                          addToast('دیدگاه تأیید شد.', 'success');
                          loadModuleData();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
                      >
                        تأیید و انتشار
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODULE 12: TICKETS */}
          {activeModule === 'tickets' && (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <h2 className="text-base font-extrabold">تیکت‌های پشتیبانی مشتریان</h2>
              <div className="space-y-4">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>
                        {t.subject} — کاربر: {t.user_name} ({t.user_phone})
                      </span>
                      <span className="text-indigo-500">{t.status}</span>
                    </div>
                    <div className="space-y-2">
                      {(t.messages || []).map((m: any) => (
                        <div key={m.id} className="p-2.5 rounded-lg bg-white dark:bg-slate-900">
                          <strong>{m.is_admin ? 'پشتیبانی:' : `${m.sender_name}:`}</strong>{' '}
                          {m.message}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/admin/tickets/${t.id}/reply`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({
                            message: 'همکار گرامی، مورد شما بررسی و انجام گردید. در صورت نیاز مجدد پیام دهید.',
                            status: 'answered',
                          }),
                        });
                        addToast('پاسخ آماده پشتیبانی ارسال شد.', 'success');
                        loadModuleData();
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white font-bold"
                    >
                      ارسال پاسخ سریع پشتیبانی
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODULE 13: CONTENT MANAGEMENT */}
          {activeModule === 'content' && (
            <div className="space-y-6">
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h2 className="text-base font-extrabold">بنرهای صفحه اصلی و پروموشن</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(contentData.banners || []).map((b: any) => (
                    <div
                      key={b.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1 text-xs"
                    >
                      <div className="font-bold text-slate-900 dark:text-white">{b.title}</div>
                      <div className="text-slate-500">{b.subtitle}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h2 className="text-base font-extrabold">صفحات ثابت (CMS)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {(contentData.pages || []).map((pg: any) => (
                    <Link
                      key={pg.id}
                      to={`/page/${pg.slug}`}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold hover:border-indigo-500"
                    >
                      {pg.title} (/{pg.slug})
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODULE 14: THEME & APPEARANCE */}
          {activeModule === 'theme' && allSettings?.theme && (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 max-w-2xl">
              <h2 className="text-base font-extrabold">شخصی‌سازی ظاهر، رنگ‌ها و تم</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1">رنگ اصلی برند (Primary Hex)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={allSettings.theme.primaryColor || '#6366f1'}
                    onChange={(e) =>
                      setAllSettings({
                        ...allSettings,
                        theme: { ...allSettings.theme, primaryColor: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">رنگ تأکیدی (Accent Hex)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={allSettings.theme.accentColor || '#06b6d4'}
                    onChange={(e) =>
                      setAllSettings({
                        ...allSettings,
                        theme: { ...allSettings.theme, accentColor: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSettingSection('theme', allSettings.theme)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                ذخیره و اعمال آنی تم
              </button>
            </div>
          )}

          {/* MODULE 15: GENERAL SETTINGS & MAINTENANCE MODE */}
          {activeModule === 'settings' && allSettings?.general && (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 max-w-3xl">
              <h2 className="text-base font-extrabold">تنظیمات عمومی، ارقام فارسی و حالت تعمیر</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1">نام فارسی فروشگاه</label>
                  <input
                    type="text"
                    value={allSettings.general.siteName || ''}
                    onChange={(e) =>
                      setAllSettings({
                        ...allSettings,
                        general: { ...allSettings.general, siteName: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">شعار فروشگاه</label>
                  <input
                    type="text"
                    value={allSettings.general.slogan || ''}
                    onChange={(e) =>
                      setAllSettings({
                        ...allSettings,
                        general: { ...allSettings.general, slogan: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />
                </div>
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="font-bold">نمایش ارقام به صورت فارسی</span>
                  <input
                    type="checkbox"
                    checked={allSettings.general.usePersianDigits !== false}
                    onChange={(e) =>
                      setAllSettings({
                        ...allSettings,
                        general: { ...allSettings.general, usePersianDigits: e.target.checked },
                      })
                    }
                  />
                </label>
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="font-bold">فعال‌سازی حالت تعمیر (Maintenance)</span>
                  <input
                    type="checkbox"
                    checked={!!allSettings.general.maintenanceMode}
                    onChange={(e) =>
                      setAllSettings({
                        ...allSettings,
                        general: { ...allSettings.general, maintenanceMode: e.target.checked },
                      })
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSettingSection('general', allSettings.general)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                ذخیره تنظیمات عمومی
              </button>
            </div>
          )}

          {/* MODULE 16: ROLES & AUDIT LOGS */}
          {activeModule === 'roles' && (
            <div className="space-y-6">
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
                <h2 className="text-base font-extrabold">نقش‌های مدیریتی و مجوزهای ریز (RBAC)</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {rolesAndLogs.roles.map((r: any) => (
                    <div
                      key={r.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5"
                    >
                      <div className="font-bold text-sm">{r.name}</div>
                      <div dir="ltr" className="font-mono text-slate-400">
                        {r.permissions.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
                <h2 className="text-base font-extrabold">لاگ فعالیت‌های حساس مدیران (Audit Logs)</h2>
                <div className="space-y-2 text-xs max-h-96 overflow-y-auto">
                  {rolesAndLogs.logs.map((l: any) => (
                    <div
                      key={l.id}
                      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-indigo-500">{l.action}</span> توسط{' '}
                        <strong>{l.admin_name}</strong> روی {l.entity_type} ({l.entity_id || '-'})
                      </div>
                      <span className="text-slate-400 tabular-nums">
                        {formatJalaliDate(l.created_at, true, usePersian)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODULE 17: REPORTS, BACKUP & CLEAR SAMPLES */}
          {activeModule === 'reports' && (
            <div className="space-y-6">
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h2 className="text-base font-extrabold">پشتیبان‌گیری دیتابیس و ابزارهای سیستم</h2>
                <p className="text-xs text-slate-500">
                  علاوه بر پشتیبان‌گیری خودکار شبانه (ساعت ۰۳:۰۰ بامداد با نگهداری ۷ نسخه آخر)، می‌توانید در هر لحظه یک فایل پشتیبان دستی ایجاد کنید.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await fetch('/api/admin/tools/backup', {
                        method: 'POST',
                        credentials: 'include',
                      });
                      const j = await r.json();
                      if (j.ok) {
                        addToast(`فایل پشتیبان ${j.data.fileName} با موفقیت ذخیره شد.`, 'success');
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                  >
                    ایجاد نسخه پشتیبان فوری دیتابیس (SQLite Backup)
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setConfirmState({
                        open: true,
                        title: 'پاک‌سازی محصولات نمونه (Seed)',
                        message:
                          'آیا مطمئن هستید که می‌خواهید محصولات دارای برچسب «نمونه» را پاک کنید؟',
                        onConfirm: async () => {
                          await fetch('/api/admin/tools/clear-samples', {
                            method: 'POST',
                            credentials: 'include',
                          });
                          setConfirmState((s) => ({ ...s, open: false }));
                          addToast('محصولات نمونه پاک شدند.', 'info');
                          loadModuleData();
                        },
                      })
                    }
                    className="px-5 py-2.5 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30 text-xs font-bold"
                  >
                    پاک‌کردن محصولات نمونه اولیه
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        danger
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}

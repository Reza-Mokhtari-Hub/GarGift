import React from 'react';
import { Link } from 'react-router-dom';
import { Gift, Cpu, Gamepad2, ShieldCheck, Zap, Copy, Check, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatToman, formatUsdCents, toPersianDigits } from '../../utils/format';

/**
 * SVG Logotype for GarGift+ (گرگیفت+)
 */
export function GarGiftLogo({ className = '' }: { className?: string }) {
  const settings = useAppStore((s) => s.settings);
  const logoUrl = settings?.general?.logoUrl;
  const siteName = settings?.general?.siteName || 'گرگیفت+';

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={siteName}
        referrerPolicy="no-referrer"
        className={`h-9 w-auto object-contain ${className}`}
      />
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 select-none whitespace-nowrap shrink-0 ${className}`}>
      <svg
        width="34"
        height="34"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <rect width="40" height="40" rx="11" fill="url(#gargift_grad)" />
        <path
          d="M20 11V29M11 20H29"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="28" cy="12" r="3" fill="#22D3EE" />
        <defs>
          <linearGradient
            id="gargift_grad"
            x1="0"
            y1="0"
            x2="40"
            y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#4F46E5" />
            <stop offset="1" stopColor="#0891B2" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {siteName}
      </span>
    </span>
  );
}

/**
 * Brand Tile Placeholder (No external hotlinked brand images; clean gradient + brand badge)
 */
const BRAND_STYLES: Record<string, { bg: string; label: string }> = {
  'Google Play': { bg: 'from-emerald-600 via-teal-600 to-cyan-700', label: 'GP' },
  Apple: { bg: 'from-slate-700 via-slate-800 to-zinc-900', label: 'iOS' },
  Steam: { bg: 'from-blue-800 via-indigo-900 to-slate-900', label: 'STM' },
  PlayStation: { bg: 'from-blue-600 via-indigo-700 to-blue-900', label: 'PSN' },
  Amazon: { bg: 'from-amber-500 via-orange-600 to-amber-700', label: 'AMZ' },
  Xbox: { bg: 'from-green-600 via-emerald-700 to-green-900', label: 'XBX' },
  Spotify: { bg: 'from-emerald-500 via-green-600 to-teal-800', label: 'SPT' },
  Netflix: { bg: 'from-red-600 via-rose-700 to-zinc-900', label: 'NFX' },
  Roblox: { bg: 'from-rose-500 via-red-600 to-orange-700', label: 'RBX' },
  OpenAI: { bg: 'from-teal-600 via-emerald-700 to-slate-900', label: 'GPT' },
  Anthropic: { bg: 'from-amber-700 via-orange-800 to-stone-900', label: 'CLD' },
  Cursor: { bg: 'from-indigo-600 via-violet-700 to-slate-900', label: 'CRS' },
  'Google AI': { bg: 'from-blue-600 via-violet-600 to-cyan-600', label: 'GEM' },
  Midjourney: { bg: 'from-purple-700 via-indigo-800 to-slate-900', label: 'MJ' },
  'Perplexity / GitHub': { bg: 'from-cyan-700 via-slate-800 to-zinc-900', label: 'AI+' },
  'PUBG Mobile': { bg: 'from-amber-600 via-yellow-700 to-stone-900', label: 'UC' },
  'Call of Duty': { bg: 'from-zinc-700 via-neutral-800 to-black', label: 'CP' },
  'Free Fire': { bg: 'from-orange-500 via-red-600 to-rose-800', label: 'FF' },
  Valorant: { bg: 'from-rose-600 via-red-700 to-slate-900', label: 'VP' },
  'Genshin Impact': { bg: 'from-sky-500 via-indigo-600 to-violet-800', label: 'GI' },
  Fortnite: { bg: 'from-violet-600 via-purple-700 to-indigo-900', label: 'VB' },
};

export function ProductBrandArt({
  brand,
  categorySlug,
  imageUrl,
  title,
  region,
  className = 'h-44',
}: {
  brand: string;
  categorySlug?: string;
  imageUrl?: string;
  title: string;
  region?: string;
  className?: string;
}) {
  const [imgError, setImgError] = React.useState(false);
  const style = BRAND_STYLES[brand] || {
    bg: 'from-indigo-600 via-violet-700 to-slate-900',
    label: (brand || 'GG').slice(0, 3).toUpperCase(),
  };

  if (imageUrl && !imgError) {
    return (
      <div className={`relative overflow-hidden bg-slate-900 ${className}`}>
        <img
          src={imageUrl}
          alt={title}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const IconComp =
    categorySlug === 'ai-subscriptions'
      ? Cpu
      : categorySlug === 'game-topup'
      ? Gamepad2
      : Gift;

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${style.bg} p-5 flex flex-col justify-between text-white select-none ${className}`}
    >
      <div className="flex items-center justify-between gap-2 z-10">
        <span
          dir="ltr"
          className="font-mono text-xs font-semibold tracking-wider text-white/90 bg-black/25 px-2.5 py-1 rounded-md"
        >
          {brand}
        </span>
        {region && (
          <span className="text-xs text-white/80 font-medium truncate max-w-[120px]">
            {region}
          </span>
        )}
      </div>

      <div className="my-auto flex items-center justify-between z-10">
        <div>
          <div
            dir="ltr"
            className="text-3xl font-extrabold font-mono tracking-tight text-white/95"
          >
            {style.label}
          </div>
          <div className="text-xs text-white/75 mt-0.5 line-clamp-1">{title}</div>
        </div>
        <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center border border-white/20">
          <IconComp className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Decorative subtle pattern */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-white/10 blur-xl"
      />
    </div>
  );
}

/**
 * Product Card following strict E-Commerce & Zero-Pill Metadata rules
 */
export function ProductCard({ product }: { product: any }) {
  const settings = useAppStore((s) => s.settings);
  const usePersian = settings?.general?.usePersianDigits !== false;
  const showUsd = settings?.general?.showUsdPrice !== false;
  const firstVariant = product.variants?.[0];

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:border-indigo-500/60 dark:hover:border-indigo-500/60"
    >
      <ProductBrandArt
        brand={product.brand}
        categorySlug={product.category_slug}
        imageUrl={product.images?.[0]}
        title={product.title}
        region={product.region}
        className="h-44"
      />

      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          {/* Unboxed clean metadata with middle dot separator */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>{product.category_name || product.brand}</span>
            <span aria-hidden="true">·</span>
            <span>{product.region}</span>
            {product.max_discount_percent > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {toPersianDigits(product.max_discount_percent, usePersian)}٪ تخفیف
                </span>
              </>
            )}
          </div>

          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
            {product.title}
          </h3>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
            {product.delivery_time_text} · {toPersianDigits(product.variants?.length || 1, usePersian)} واریانت
          </p>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-baseline justify-between gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">شروع قیمت از</span>
          <div className="text-end tabular-nums">
            {firstVariant && showUsd && firstVariant.usd_price_cents > 0 && (
              <span
                dir="ltr"
                className="text-xs font-mono text-slate-400 dark:text-slate-500 me-2"
              >
                ({formatUsdCents(firstVariant.usd_price_cents, false)})
              </span>
            )}
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
              {formatToman(product.starting_price_toman, usePersian)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Copy Button with navigator.clipboard and document.execCommand fallback for iframe environments
 */
export function CopyButton({
  text,
  label = 'کپی کد',
  className = '',
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const addToast = useAppStore((s) => s.addToast);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch {
        // ignore
      }
      document.body.removeChild(textarea);
    }
    setCopied(true);
    addToast('در حافظه کلیپ‌بورد کپی شد.', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
        copied
          ? 'bg-emerald-600 text-white'
          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
      } ${className}`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      <span>{copied ? 'کپی شد' : label}</span>
    </button>
  );
}

/**
 * Custom Confirm Modal (No window.confirm / window.alert)
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'تأیید و انجام',
  cancelLabel = 'انصراف',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="بستن"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
          {message}
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${
              danger
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Toast Notifications Container
 */
export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 start-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-lg transition-all ${
            t.type === 'error'
              ? 'bg-rose-950/95 border-rose-700 text-rose-100'
              : t.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-700 text-emerald-100'
              : 'bg-slate-900/95 border-slate-700 text-slate-100'
          }`}
        >
          <span>{t.text}</span>
          <button
            type="button"
            onClick={() => removeToast(t.id)}
            aria-label="بستن پیام"
            className="text-white/70 hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Global Error Boundary
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6 text-center">
          <div className="max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-8">
            <h1 className="text-xl font-bold mb-2">خطایی در نمایش صفحه رخ داد</h1>
            <p className="text-sm text-slate-400 mb-6">
              متأسفانه خطای غیرمنتظره‌ای رخ داده است. لطفاً صفحه را بازخوانی کنید.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
            >
              تلاش دوباره و بازخوانی
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

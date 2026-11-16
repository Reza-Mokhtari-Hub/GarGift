import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Wallet,
  CreditCard,
  Globe,
  Coins,
  CheckCircle2,
  Tag,
  Lock,
  Upload,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { CopyButton } from '../components/ui/Common';
import { formatToman, toPersianDigits } from '../utils/format';

/**
 * Cart & Checkout Page (/cart and /checkout)
 */
export function CartAndCheckoutPage() {
  const {
    cart,
    updateCartQty,
    removeFromCart,
    clearCart,
    user,
    settings,
    addToast,
    fetchBootstrap,
  } = useAppStore();
  const navigate = useNavigate();

  const usePersian = settings?.general?.usePersianDigits !== false;
  const paymentSettings = settings?.payment || {};

  const [couponInput, setCouponInput] = React.useState('');
  const [appliedCoupon, setAppliedCoupon] = React.useState<{
    code: string;
    title: string;
    discountToman: number;
  } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = React.useState(false);

  const [paymentMethod, setPaymentMethod] = React.useState<
    'wallet' | 'card_to_card' | 'zarinpal' | 'zibal' | 'crypto'
  >('wallet');
  const [customerNote, setCustomerNote] = React.useState('');
  const [acceptedTerms, setAcceptedTerms] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [idempotencyKey] = React.useState(() => `ORD-${Date.now()}-${Math.random()}`);

  // Post-order state for pending_payment (Card-to-card / Crypto / Gateway)
  const [createdOrder, setCreatedOrder] = React.useState<any | null>(null);
  const [trackingCode, setTrackingCode] = React.useState('');
  const [receiptUrl, setReceiptUrl] = React.useState('');
  const [uploadingReceipt, setUploadingReceipt] = React.useState(false);

  const subtotalToman = cart.reduce((acc, item) => acc + item.unitPriceToman * item.qty, 0);
  const discountToman = appliedCoupon ? Math.min(subtotalToman, appliedCoupon.discountToman) : 0;
  const afterDiscount = Math.max(0, subtotalToman - discountToman);
  const feePercent =
    paymentMethod === 'zarinpal' || paymentMethod === 'zibal'
      ? Number(paymentSettings.gatewayFeePercent || 0)
      : 0;
  const gatewayFee = Math.round((afterDiscount * feePercent) / 100);
  const finalToman = afterDiscount + gatewayFee;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      addToast('برای اعمال کد تخفیف ابتدا وارد حساب کاربری شوید.', 'info');
      return;
    }
    if (!couponInput.trim()) return;
    setValidatingCoupon(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: couponInput.trim(), subtotal: subtotalToman }),
      });
      const json = await res.json();
      if (json.ok) {
        setAppliedCoupon(json.data);
        addToast(`کد تخفیف «${json.data.title}» اعمال شد.`, 'success');
      } else {
        addToast(json.error || 'کد تخفیف نامعتبر است', 'error');
      }
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      addToast('لطفاً برای تکمیل خرید وارد حساب کاربری خود شوید.', 'info');
      navigate('/auth?redirect=/checkout');
      return;
    }
    if (!acceptedTerms) {
      addToast('لطفاً قوانین و مقررات فروشگاه را تأیید نمایید.', 'error');
      return;
    }
    if (cart.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: cart.map((c) => ({
            productId: c.productId,
            variantId: c.variantId,
            qty: c.qty,
            customFields: c.customFields,
          })),
          paymentMethod,
          couponCode: appliedCoupon?.code,
          customerNote,
          idempotencyKey,
        }),
      });
      const json = await res.json();
      if (json.ok && json.data?.order) {
        clearCart();
        await fetchBootstrap();
        const ord = json.data.order;
        if (ord.status === 'delivered' || ord.status === 'processing' || ord.status === 'waiting_stock') {
          addToast(`سفارش ${ord.order_number} با موفقیت ثبت و پرداخت شد!`, 'success');
          navigate(`/account/orders?highlight=${ord.order_number}`);
        } else {
          setCreatedOrder(ord);
        }
      } else {
        addToast(json.error || 'خطا در ثبت سفارش', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const json = await res.json();
      if (json.ok) {
        setReceiptUrl(json.data.url);
        addToast('تصویر رسید با موفقیت بارگذاری شد.', 'success');
      } else {
        addToast(json.error || 'خطا در آپلود رسید', 'error');
      }
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdOrder) return;
    setSubmitting(true);
    try {
      const destCard = paymentSettings.cards?.[0]?.cardNumber || '';
      const res = await fetch(`/api/orders/${createdOrder.id}/submit-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          trackingCode,
          receiptImageUrl: receiptUrl,
          destinationCard: destCard,
          cryptoTxId: createdOrder.payment_method === 'crypto' ? trackingCode : undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        addToast('رسید پرداخت ثبت شد و پس از بررسی ادمین تحویل می‌شود.', 'success');
        navigate(`/account/orders?highlight=${createdOrder.order_number}`);
      } else {
        addToast(json.error || 'خطا در ثبت رسید', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteSandboxGateway = async () => {
    if (!createdOrder) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${createdOrder.id}/pay-gateway`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.ok) {
        addToast('پرداخت درگاه بانکی با موفقیت تأیید و سفارش تحویل شد!', 'success');
        navigate(`/account/orders?highlight=${createdOrder.order_number}`);
      } else {
        addToast(json.error || 'خطا در تأیید درگاه', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // If order was created and needs Gateway / Card-to-Card / Crypto completion
  if (createdOrder) {
    const activeCard = paymentSettings.cards?.[0] || {
      bankName: 'بانک سامان (نمونه)',
      cardNumber: '6219-8610-0000-0000',
      ownerName: 'شرکت گرگیفت پلاس',
    };

    return (
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
                تکمیل پرداخت سفارش <span dir="ltr" className="font-mono">{createdOrder.order_number}</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                مبلغ قابل پرداخت: {formatToman(createdOrder.final_toman, usePersian)}
              </p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-indigo-500" />
          </div>

          {(createdOrder.payment_method === 'zarinpal' ||
            createdOrder.payment_method === 'zibal') && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs leading-relaxed">
                شما به شبیه‌ساز درگاه پرداخت آنلاین{' '}
                <strong>
                  {createdOrder.payment_method === 'zarinpal' ? 'زرین‌پال (Sandbox)' : 'زیبال (Sandbox)'}
                </strong>{' '}
                متصل شده‌اید. با کلیک روی دکمه زیر، تراکنش بانکی موفق شبیه‌سازی شده و کدهای گیفت‌کارت بلافاصله تحویل داده می‌شوند.
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={handleCompleteSandboxGateway}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
              >
                {submitting
                  ? 'در حال تأیید تراکنش و استخراج کد...'
                  : 'تأیید پرداخت آزمایشی درگاه و دریافت آنی سفارش'}
              </button>
            </div>
          )}

          {createdOrder.payment_method === 'card_to_card' && (
            <form onSubmit={handleSubmitReceipt} className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="font-bold text-slate-900 dark:text-white">
                  مشخصات کارت مقصد جهت واریز:
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">نام بانک و صاحب حساب:</span>
                  <span className="font-semibold">
                    {activeCard.bankName} - {activeCard.ownerName}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500">شماره کارت:</span>
                  <div className="flex items-center gap-2">
                    <span dir="ltr" className="font-mono text-sm font-bold text-indigo-500">
                      {activeCard.cardNumber}
                    </span>
                    <CopyButton text={activeCard.cardNumber} label="کپی کارت" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  شماره پیگیری / ارجاع بانکی <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="مثلاً 123456789"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  تصویر رسید واریزی (اختیاری)
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium">
                    <Upload className="w-4 h-4" />
                    <span>{uploadingReceipt ? 'در حال آپلود...' : 'انتخاب تصویر رسید'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadReceiptFile}
                      className="hidden"
                    />
                  </label>
                  {receiptUrl && (
                    <span className="text-xs text-emerald-500 font-semibold">
                      تصویر بارگذاری شد
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold"
              >
                {submitting ? 'در حال ثبت...' : 'ثبت نهایی رسید پرداخت'}
              </button>
            </form>
          )}

          {createdOrder.payment_method === 'crypto' && (
            <form onSubmit={handleSubmitReceipt} className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="font-bold">
                  آدرس والت تتر ({paymentSettings.cryptoNetwork || 'TRC20'}):
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span dir="ltr" className="font-mono text-indigo-500 truncate">
                    {paymentSettings.cryptoWalletAddress || 'TTestWalletAddressGarGiftPlus000000000'}
                  </span>
                  <CopyButton
                    text={
                      paymentSettings.cryptoWalletAddress || 'TTestWalletAddressGarGiftPlus000000000'
                    }
                    label="کپی آدرس"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  شناسه تراکنش (TxID / Hash) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="TxID..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold"
              >
                ثبت شناسه تراکنش ارز دیجیتال
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
        <ShoppingBag className="w-14 h-14 text-slate-400 mx-auto opacity-60" />
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
          سبد خرید شما خالی است
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          محصول دلخواه خود را از دسته‌بندی گیفت‌کارت‌ها، هوش مصنوعی یا بازی‌ها انتخاب کنید.
        </p>
        <Link
          to="/products"
          className="inline-flex px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold"
        >
          مشاهده کاتالوگ محصولات
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-6">
        سبد خرید و تسویه‌حساب آنی
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Right Column: Cart Items + Payment Method Selection */}
        <div className="lg:col-span-7 space-y-6">
          {/* Items List */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              اقلام سفارش شما ({toPersianDigits(cart.length, usePersian)} ردیف)
            </h2>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {cart.map((item) => (
                <div key={item.key} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        to={`/product/${item.productSlug}`}
                        className="text-sm font-bold text-slate-900 dark:text-white hover:text-indigo-500"
                      >
                        {item.productTitle}
                      </Link>
                      <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                        {item.variantTitle} · ریجن {item.region}
                      </div>
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
                    <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-lg">
                      {Object.entries(item.customFields).map(([k, v]) => (
                        <div key={k}>
                          <span className="font-semibold">{k}:</span>{' '}
                          <span dir="ltr" className="font-mono">
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <div className="inline-flex items-center gap-2.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.key, item.qty + 1)}
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
              ))}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              انتخاب روش پرداخت
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {paymentSettings.walletEnabled !== false && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('wallet')}
                  className={`p-4 rounded-xl border text-start transition-all flex items-start gap-3 ${
                    paymentMethod === 'wallet'
                      ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <Wallet className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs sm:text-sm font-bold">پرداخت آنی از کیف پول</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      موجودی فعلی: {formatToman(user?.wallet_balance || 0, usePersian)}
                    </div>
                  </div>
                </button>
              )}

              {paymentSettings.zarinpalEnabled !== false && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('zarinpal')}
                  className={`p-4 rounded-xl border text-start transition-all flex items-start gap-3 ${
                    paymentMethod === 'zarinpal'
                      ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <Globe className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs sm:text-sm font-bold">درگاه آنلاین زرین‌پال</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      پرداخت با کلیه کارت‌های عضو شتاب
                    </div>
                  </div>
                </button>
              )}

              {paymentSettings.zibalEnabled !== false && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('zibal')}
                  className={`p-4 rounded-xl border text-start transition-all flex items-start gap-3 ${
                    paymentMethod === 'zibal'
                      ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <Globe className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs sm:text-sm font-bold">درگاه آنلاین زیبال</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      تحویل اتوماتیک پس از بازگشت از درگاه
                    </div>
                  </div>
                </button>
              )}

              {paymentSettings.cardToCardEnabled !== false && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card_to_card')}
                  className={`p-4 rounded-xl border text-start transition-all flex items-start gap-3 ${
                    paymentMethod === 'card_to_card'
                      ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs sm:text-sm font-bold">کارت‌به‌کارت بانکی (با رسید)</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      واریز به کارت و ثبت شماره پیگیری
                    </div>
                  </div>
                </button>
              )}

              {paymentSettings.cryptoEnabled !== false && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('crypto')}
                  className={`p-4 rounded-xl border text-start transition-all flex items-start gap-3 ${
                    paymentMethod === 'crypto'
                      ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <Coins className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs sm:text-sm font-bold">ارز دیجیتال (تتر TRC20)</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      ثبت کد TxID و تأیید اپراتور
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Left Column: Coupon & Order Summary */}
        <div className="lg:col-span-5 space-y-6">
          {/* Coupon Box */}
          <form
            onSubmit={handleApplyCoupon}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3"
          >
            <label className="text-xs font-bold flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-indigo-500" />
              <span>کد تخفیف دارید؟ (کد نمونه: GARGIFT5)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                dir="ltr"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="GARGIFT5"
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono uppercase"
              />
              <button
                type="submit"
                disabled={validatingCoupon}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-indigo-600 text-white text-xs font-bold transition-colors"
              >
                {validatingCoupon ? '...' : 'اعمال کد'}
              </button>
            </div>
          </form>

          {/* Invoice Summary & Submit */}
          <form
            onSubmit={handlePlaceOrder}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              خلاصه صورت‌حساب
            </h2>

            <div className="space-y-2.5 text-xs sm:text-sm tabular-nums">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>جمع جزء اقلام:</span>
                <span>{formatToman(subtotalToman, usePersian)}</span>
              </div>
              {discountToman > 0 && (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>تخفیف کوپن ({appliedCoupon?.code}):</span>
                  <span>- {formatToman(discountToman, usePersian)}</span>
                </div>
              )}
              {gatewayFee > 0 && (
                <div className="flex items-center justify-between text-slate-500">
                  <span>کارمزد درگاه:</span>
                  <span>{formatToman(gatewayFee, usePersian)}</span>
                </div>
              )}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-base font-extrabold text-slate-900 dark:text-white">
                <span>مبلغ قابل پرداخت:</span>
                <span className="text-indigo-600 dark:text-indigo-400">
                  {formatToman(finalToman, usePersian)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                توضیحات سفارش (اختیاری):
              </label>
              <input
                type="text"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="یادداشت برای اپراتور تحویل..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              <span>
                <Link to="/page/terms" className="text-indigo-500 hover:underline">
                  قوانین و مقررات
                </Link>{' '}
                فروشگاه گرگیفت+ و شرایط ریجن محصولات را می‌پذیرم.
              </span>
            </label>

            {!user && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-600 dark:text-amber-300">
                برای ثبت نهایی سفارش لازم است وارد حساب کاربری شوید. (اکانت مشتری آماده تست با موجودی کیف پول در صفحه ورود قرار دارد).
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Lock className="w-4 h-4" />
              <span>
                {submitting
                  ? 'در حال پردازش و ثبت سفارش...'
                  : user
                  ? 'ثبت سفارش و پرداخت امن'
                  : 'ورود به حساب و ادامه خرید'}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { useSearchParams, useParams, useNavigate, Link } from 'react-router-dom';
import {
  Search,
  Filter,
  ShoppingBag,
  Zap,
  Heart,
  Share2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Star,
  Plus,
  Minus,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { useAppStore } from '../store/useAppStore';
import { ProductCard, ProductBrandArt } from '../components/ui/Common';
import { formatToman, formatUsdCents, toPersianDigits } from '../utils/format';

/**
 * Product Catalog & Filtering Page (/products)
 */
export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories, settings } = useAppStore();
  const usePersian = settings?.general?.usePersianDigits !== false;

  const [products, setProducts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const category = searchParams.get('category') || '';
  const search = searchParams.get('search') || '';
  const brand = searchParams.get('brand') || '';
  const sort = searchParams.get('sort') || 'featured';
  const onlyInStock = searchParams.get('inStock') === 'true';
  const onlyDiscounted = searchParams.get('discounted') === 'true';

  const loadProducts = React.useCallback(() => {
    setLoading(true);
    setError('');
    const qs = new URLSearchParams();
    if (category) qs.set('category', category);
    if (search) qs.set('search', search);
    if (brand) qs.set('brand', brand);
    if (sort) qs.set('sort', sort);
    if (onlyInStock) qs.set('inStock', 'true');
    if (onlyDiscounted) qs.set('discounted', 'true');

    fetch(`/api/products?${qs.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setProducts(json.data || []);
        } else {
          setError(json.error || 'خطا در دریافت محصولات');
        }
      })
      .catch(() => setError('خطا در برقراری ارتباط با سرور'))
      .finally(() => setLoading(false));
  }, [category, search, brand, sort, onlyInStock, onlyDiscounted]);

  React.useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            کاتالوگ محصولات دیجیتال گرگیفت+
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            نمایش {toPersianDigits(products.length, usePersian)} محصول آماده تحویل
          </p>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-3">
          <label htmlFor="sort-select" className="text-xs font-medium text-slate-500">
            مرتب‌سازی:
          </label>
          <select
            id="sort-select"
            value={sort}
            onChange={(e) => updateParam('sort', e.target.value)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            <option value="featured">پیشنهاد ویژه</option>
            <option value="price_asc">ارزان‌ترین به گران‌ترین</option>
            <option value="price_desc">گران‌ترین به ارزان‌ترین</option>
            <option value="newest">جدیدترین‌ها</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar Filters */}
        <aside className="lg:col-span-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-500" />
              <span>فیلتر محصولات</span>
            </span>
            {(category || search || brand || onlyInStock || onlyDiscounted) && (
              <button
                type="button"
                onClick={() => setSearchParams(new URLSearchParams())}
                className="text-xs text-rose-500 hover:underline font-medium"
              >
                پاک‌کردن فیلترها
              </button>
            )}
          </div>

          {/* Search box */}
          <div className="space-y-1.5">
            <label htmlFor="catalog-search" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              جستجوی نام یا برند
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                id="catalog-search"
                type="search"
                value={search}
                onChange={(e) => updateParam('search', e.target.value)}
                placeholder="مثلاً Google Play یا UC..."
                className="w-full ps-9 pe-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              دسته‌بندی‌ها
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => updateParam('category', '')}
                className={`w-full text-start px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  !category
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                همه دسته‌بندی‌ها
              </button>
              {categories.map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => updateParam('category', c.slug)}
                  className={`w-full text-start px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    category === c.slug
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-center justify-between text-xs font-medium cursor-pointer">
              <span>فقط کالاهای موجود</span>
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => updateParam('inStock', e.target.checked ? 'true' : '')}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
            <label className="flex items-center justify-between text-xs font-medium cursor-pointer">
              <span>فقط تخفیف‌دارها</span>
              <input
                type="checkbox"
                checked={onlyDiscounted}
                onChange={(e) => updateParam('discounted', e.target.checked ? 'true' : '')}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>
        </aside>

        {/* Products Grid */}
        <div className="lg:col-span-9">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="h-72 rounded-xl bg-slate-200/60 dark:bg-slate-900 animate-pulse border border-slate-200 dark:border-slate-800"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center space-y-4">
              <p className="text-sm text-rose-500 font-semibold">{error}</p>
              <button
                type="button"
                onClick={loadProducts}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                تلاش دوباره
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                محصولی با فیلترهای انتخاب‌شده یافت نشد.
              </p>
              <button
                type="button"
                onClick={() => setSearchParams(new URLSearchParams())}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                نمایش همه محصولات
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Product Detail Page (/product/:slug) with Contiguous Purchase Module
 */
export function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { settings, addToCart, favorites, toggleFavorite, addToast, user } = useAppStore();
  const usePersian = settings?.general?.usePersianDigits !== false;
  const showUsd = settings?.general?.showUsdPrice !== false;

  const [data, setData] = React.useState<{
    product: any;
    reviews: any[];
    related: any[];
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const [selectedVariantId, setSelectedVariantId] = React.useState<number>(0);
  const [qty, setQty] = React.useState<number>(1);
  const [customFields, setCustomFields] = React.useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = React.useState<'desc' | 'usage' | 'faq' | 'reviews'>('desc');

  // Review form
  const [reviewRating, setReviewRating] = React.useState(5);
  const [reviewComment, setReviewComment] = React.useState('');
  const [submittingReview, setSubmittingReview] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/products/${slug}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.data?.product) {
          setData(json.data);
          const firstVar = json.data.product.variants?.[0];
          if (firstVar) setSelectedVariantId(firstVar.id);
          setQty(1);
          setCustomFields({});
          setFieldErrors({});
        } else {
          setError(json.error || 'محصول یافت نشد');
        }
      })
      .catch(() => setError('خطا در بارگذاری اطلاعات محصول'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 h-80 rounded-2xl bg-slate-200/60 dark:bg-slate-900 animate-pulse" />
          <div className="lg:col-span-7 h-96 rounded-2xl bg-slate-200/60 dark:bg-slate-900 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data?.product) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-16 text-center space-y-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {error || 'محصول مورد نظر یافت نشد'}
        </h1>
        <Link
          to="/products"
          className="inline-flex px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
        >
          بازگشت به فروشگاه
        </Link>
      </div>
    );
  }

  const { product, reviews, related } = data;
  const selectedVariant =
    product.variants.find((v: any) => v.id === selectedVariantId) || product.variants[0];
  const isFav = favorites.includes(product.id);

  const validateCustomFields = (): boolean => {
    const errs: Record<string, string> = {};
    for (const f of product.fields || []) {
      const val = (customFields[f.field_key] || '').trim();
      if (f.is_required && !val) {
        errs[f.field_key] = `تکمیل فیلد «${f.label}» الزامی است.`;
      } else if (val && f.field_type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        errs[f.field_key] = 'لطفاً یک آدرس ایمیل معتبر وارد کنید.';
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePurchaseAction = (fastCheckout: boolean) => {
    if (!selectedVariant) return;
    if (!selectedVariant.in_stock) {
      addToast('این واریانت در حال حاضر ناموجود است.', 'error');
      return;
    }
    if (!validateCustomFields()) {
      addToast('لطفاً فیلدهای مشخصات سفارش را کامل کنید.', 'error');
      return;
    }

    addToCart({
      productId: product.id,
      productSlug: product.slug,
      productTitle: product.title,
      brand: product.brand,
      region: product.region,
      variantId: selectedVariant.id,
      variantTitle: selectedVariant.title,
      unitPriceToman: selectedVariant.final_price_toman,
      usdPriceCents: selectedVariant.usd_price_cents,
      qty,
      maxQty: Math.min(selectedVariant.max_qty || 10, selectedVariant.available_stock || 10),
      deliveryType: product.delivery_type,
      customFields,
    });

    if (fastCheckout) {
      navigate('/checkout');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      addToast('برای ثبت دیدگاه ابتدا وارد حساب کاربری شوید.', 'info');
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/products/${product.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      });
      const json = await res.json();
      if (json.ok) {
        addToast(json.data.message, 'success');
        setReviewComment('');
      } else {
        addToast(json.error || 'خطا در ثبت دیدگاه', 'error');
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-14">
      {/* Main Contiguous Purchase Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Right/Start Column: Sticky Product Visual & Highlights */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
          <ProductBrandArt
            brand={product.brand}
            categorySlug={product.category_slug}
            imageUrl={product.images?.[0]}
            title={product.title}
            region={product.region}
            className="h-64 sm:h-72 rounded-2xl border border-slate-200 dark:border-slate-800"
          />

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Clock className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
              <div className="text-[11px] text-slate-500">زمان تحویل</div>
              <div className="text-xs font-bold mt-0.5">{product.delivery_time_text}</div>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
              <div className="text-[11px] text-slate-500">ریجن محصول</div>
              <div className="text-xs font-bold mt-0.5">{product.region}</div>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <CheckCircle2 className="w-4 h-4 text-cyan-500 mx-auto mb-1" />
              <div className="text-[11px] text-slate-500">ضمانت</div>
              <div className="text-xs font-bold mt-0.5">۱۰۰٪ اورجینال</div>
            </div>
          </div>
        </div>

        {/* Left/End Column: Contiguous Purchase Configurator */}
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                {product.category_name} · برند {product.brand} · ریجن {product.region}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                {product.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {product.short_description}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => toggleFavorite(product.id)}
                aria-label="افزودن به علاقه‌مندی"
                className={`p-2.5 rounded-xl border transition-colors ${
                  isFav
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-500'
                    : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-500'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(window.location.href);
                  } catch {
                    // ignore
                  }
                  addToast('لینک محصول کپی شد.', 'success');
                }}
                aria-label="اشتراک‌گذاری محصول"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-indigo-500"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Step 1: Select Variant */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-900 dark:text-white">
              ۱. انتخاب اعتبار یا پلن مورد نظر:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {product.variants.map((v: any) => {
                const isSelected = selectedVariant?.id === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`p-3.5 rounded-xl border text-start transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/15 ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    } ${!v.in_stock ? 'opacity-50' : ''}`}
                  >
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        {v.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {v.in_stock ? (
                          v.stock_mode === 'code_pool' ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              موجود در انبار کد ({toPersianDigits(v.available_stock, usePersian)} عدد)
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">موجود و آماده انجام</span>
                          )
                        ) : (
                          <span className="text-rose-500">ناموجود</span>
                        )}
                      </div>
                    </div>

                    <div className="text-end tabular-nums">
                      {v.is_discount_active && (
                        <div className="text-[11px] text-slate-400 line-through">
                          {formatToman(v.base_price_toman, usePersian, false)}
                        </div>
                      )}
                      <div className="text-xs sm:text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                        {formatToman(v.final_price_toman, usePersian)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Custom Product Fields (if any, e.g., Player ID or Account Email) */}
          {product.fields && product.fields.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                ۲. اطلاعات اکانت جهت تحویل سفارش:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {product.fields.map((f: any) => (
                  <div key={f.id} className="space-y-1.5">
                    <label
                      htmlFor={`field-${f.field_key}`}
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      {f.label} {f.is_required ? <span className="text-rose-500">*</span> : null}
                    </label>
                    {f.field_type === 'select' ? (
                      <select
                        id={`field-${f.field_key}`}
                        value={customFields[f.field_key] || ''}
                        onChange={(e) =>
                          setCustomFields((prev) => ({ ...prev, [f.field_key]: e.target.value }))
                        }
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                      >
                        <option value="">انتخاب کنید...</option>
                        {(f.options || []).map((opt: string) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`field-${f.field_key}`}
                        type={f.field_type === 'email' ? 'email' : 'text'}
                        dir={
                          f.field_type === 'email' || f.field_type === 'number' ? 'ltr' : 'rtl'
                        }
                        value={customFields[f.field_key] || ''}
                        onChange={(e) =>
                          setCustomFields((prev) => ({ ...prev, [f.field_key]: e.target.value }))
                        }
                        placeholder={f.help_text || f.label}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                      />
                    )}
                    {f.help_text && (
                      <p className="text-[11px] text-slate-400">{f.help_text}</p>
                    )}
                    {fieldErrors[f.field_key] && (
                      <p className="text-xs text-rose-500 font-medium">
                        {fieldErrors[f.field_key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Price Summary, Quantity & CTA Buttons */}
          {selectedVariant && (
            <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">تعداد:</span>
                  <div className="inline-flex items-center gap-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setQty((q) =>
                          Math.min(selectedVariant.max_qty || 10, selectedVariant.available_stock || 10, q + 1)
                        )
                      }
                      aria-label="افزایش تعداد"
                      className="text-slate-600 dark:text-slate-300 hover:text-indigo-500"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-bold w-6 text-center tabular-nums">
                      {toPersianDigits(qty, usePersian)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      aria-label="کاهش تعداد"
                      className="text-slate-600 dark:text-slate-300 hover:text-rose-500"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-end tabular-nums">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    مبلغ قابل پرداخت ({toPersianDigits(qty, usePersian)} عدد):
                  </div>
                  <div className="flex items-baseline justify-end gap-2 mt-0.5">
                    {showUsd && selectedVariant.usd_price_cents > 0 && (
                      <span dir="ltr" className="text-xs font-mono text-slate-400">
                        ({formatUsdCents(selectedVariant.usd_price_cents * qty, false)})
                      </span>
                    )}
                    <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                      {formatToman(selectedVariant.final_price_toman * qty, usePersian)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!selectedVariant.in_stock}
                  onClick={() => handlePurchaseAction(false)}
                  className="py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>افزودن به سبد خرید</span>
                </button>
                <button
                  type="button"
                  disabled={!selectedVariant.in_stock}
                  onClick={() => handlePurchaseAction(true)}
                  className="py-3.5 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Zap className="w-4 h-4" />
                  <span>خرید سریع و تسویه آنی</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Details, Instructions, FAQs & Verified Reviews Tabs */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          {[
            { key: 'desc', label: 'توضیحات و ویژگی‌ها' },
            { key: 'usage', label: 'آموزش فعال‌سازی و استفاده' },
            { key: 'faq', label: `سوالات متداول (${toPersianDigits(product.faqs?.length || 0, usePersian)})` },
            { key: 'reviews', label: `دیدگاه خریداران (${toPersianDigits(reviews.length, usePersian)})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-6 py-4 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 sm:p-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {activeTab === 'desc' && (
            <div
              className="prose dark:prose-invert max-w-none space-y-3"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(product.description_html || product.short_description),
              }}
            />
          )}

          {activeTab === 'usage' && (
            <div
              className="prose dark:prose-invert max-w-none space-y-3"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(product.usage_instructions_html || ''),
              }}
            />
          )}

          {activeTab === 'faq' && (
            <div className="space-y-4">
              {(product.faqs || []).map((f: any, idx: number) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                >
                  <div className="font-bold text-slate-900 dark:text-white mb-1.5">{f.q}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{f.a}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-4">
                {reviews.length === 0 ? (
                  <p className="text-xs text-slate-500">هنوز دیدگاهی برای این محصول ثبت نشده است.</p>
                ) : (
                  reviews.map((r: any) => (
                    <div
                      key={r.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {r.user_name}
                          {r.is_verified_buyer ? (
                            <span className="text-emerald-500 font-normal ms-2">
                              (خریدار تأییدشده)
                            </span>
                          ) : null}
                        </span>
                        <span className="flex items-center gap-0.5 text-amber-400">
                          {Array.from({ length: r.rating }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-current" />
                          ))}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{r.comment}</p>
                      {r.admin_reply && (
                        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-indigo-600 dark:text-indigo-400">
                          <strong>پاسخ پشتیبانی گرگیفت+:</strong> {r.admin_reply}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="lg:col-span-5">
                <form
                  onSubmit={handleSubmitReview}
                  className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4"
                >
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    ثبت دیدگاه جدید
                  </h3>
                  <div>
                    <label className="block text-xs font-medium mb-1">امتیاز شما:</label>
                    <select
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <option value={5}>۵ ستاره (عالی)</option>
                      <option value={4}>۴ ستاره (خوب)</option>
                      <option value={3}>۳ ستاره (متوسط)</option>
                      <option value={2}>۲ ستاره (ضعیف)</option>
                      <option value={1}>۱ ستاره</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">متن دیدگاه:</label>
                    <textarea
                      rows={3}
                      required
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="تجربه خرید خود را بنویسید..."
                      className="w-full p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                  >
                    {submittingReview ? 'در حال ثبت...' : 'ارسال دیدگاه'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related Products */}
      {related && related.length > 0 && (
        <div className="space-y-5">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            محصولات مشابه در همین دسته‌بندی
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

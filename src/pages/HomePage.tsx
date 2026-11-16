import React from 'react';
import { Link } from 'react-router-dom';
import {
  Gift,
  Cpu,
  Gamepad2,
  Zap,
  ShieldCheck,
  Headphones,
  Wallet,
  ChevronLeft,
  ChevronDown,
  Star,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { ProductCard } from '../components/ui/Common';
import { formatToman, toPersianDigits } from '../utils/format';

export function HomePage() {
  const { categories, banners, faqs, reviews, settings } = useAppStore();
  const [products, setProducts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeCatTab, setActiveCatTab] = React.useState<string>('all');
  const [openFaqId, setOpenFaqId] = React.useState<number | null>(null);

  const usePersian = settings?.general?.usePersianDigits !== false;

  React.useEffect(() => {
    let mounted = true;
    fetch('/api/products')
      .then((r) => r.json())
      .then((json) => {
        if (mounted && json.ok) {
          setProducts(json.data || []);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const heroBanner = (banners || []).find((b: any) => b.position === 'hero') || {
    title: 'تحویل آنی انواع گیفت‌کارت، اشتراک هوش مصنوعی و شارژ بازی',
    subtitle:
      'کدهای اورجینال گوگل‌پلی، اپل، استیم، اشتراک‌های ChatGPT Plus و Claude Pro و شارژ مستقیم یوسی پابجی و سی‌پی کالاف با نرخ لحظه‌ای و بدون کارمزد پنهان.',
    cta_text: 'مشاهده همه محصولات',
    link_url: '/products',
  };

  const displayedProducts = React.useMemo(() => {
    if (activeCatTab === 'all') {
      return products.filter((p) => p.is_featured).slice(0, 9);
    }
    return products.filter((p) => p.category_slug === activeCatTab).slice(0, 6);
  }, [products, activeCatTab]);

  return (
    <div className="space-y-20 pb-8">
      {/* SECTION 1: Storefront Hero + Full-width Category Strip */}
      <section className="pt-6 sm:pt-10">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 space-y-6">
          {/* Split-Screen Balanced Hero */}
          <div className="rounded-2xl bg-slate-900 text-white border border-slate-800 overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-7 p-7 sm:p-10 lg:p-12 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="text-xs font-semibold text-cyan-400 tracking-wide">
                  پلتفرم تخصصی محصولات دیجیتال بین‌المللی · تحویل خودکار ۲۴ ساعته
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight text-balance">
                  {heroBanner.title}
                </h1>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                  {heroBanner.subtitle}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to={heroBanner.link_url || '/products'}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{heroBanner.cta_text || 'مشاهده کاتالوگ محصولات'}</span>
                  <ChevronLeft className="w-4 h-4" />
                </Link>
                <Link
                  to="/products?category=ai-subscriptions"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold border border-slate-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>اشتراک‌های هوش مصنوعی</span>
                </Link>
              </div>
            </div>

            {/* Right Showcase Visual Panel */}
            <div className="lg:col-span-5 bg-gradient-to-br from-indigo-950 via-slate-900 to-cyan-950 p-7 sm:p-10 border-t lg:border-t-0 lg:border-s border-slate-800 flex flex-col justify-between gap-6">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>پرفروش‌ترین‌های امروز</span>
                <span className="tabular-nums">
                  نرخ مرجع: {formatToman(settings?.pricing?.globalUsdRate || 69000, usePersian)}
                </span>
              </div>

              <div className="space-y-3">
                {[
                  {
                    brand: 'Google Play',
                    title: 'گیفت‌کارت ۱۰ دلاری گوگل‌پلی آمریکا',
                    meta: 'تحویل آنی کد · بدون انقضا',
                    slug: 'google-play-gift-card-us',
                    color: 'from-emerald-600 to-teal-700',
                  },
                  {
                    brand: 'OpenAI',
                    title: 'اشتراک ChatGPT Plus یک‌ماهه اختصاصی',
                    meta: 'فعال‌سازی روی ایمیل شخصی شما',
                    slug: 'chatgpt-plus-subscription',
                    color: 'from-indigo-600 to-violet-700',
                  },
                  {
                    brand: 'PUBG Mobile',
                    title: '۶۶۰ یوسی پابجی موبایل گلوبال',
                    meta: 'شارژ مستقیم با Player ID',
                    slug: 'pubg-mobile-uc-topup',
                    color: 'from-amber-600 to-orange-700',
                  },
                ].map((spot) => (
                  <Link
                    key={spot.slug}
                    to={`/product/${spot.slug}`}
                    className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800/90 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        dir="ltr"
                        className={`w-11 h-11 rounded-lg bg-gradient-to-br ${spot.color} flex items-center justify-center font-mono text-xs font-bold text-white shrink-0`}
                      >
                        {spot.brand.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{spot.title}</div>
                        <div className="text-xs text-slate-400 truncate mt-0.5">{spot.meta}</div>
                      </div>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
                  </Link>
                ))}
              </div>

              <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span>تحویل خودکار از انبار کد رمزنگاری‌شده</span>
                <span>ضمانت ۱۰۰٪ اصالت</span>
              </div>
            </div>
          </div>

          {/* 3 Main Categories Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(categories.length > 0
              ? categories
              : [
                  {
                    id: 1,
                    name: 'گیفت‌کارت‌ها',
                    slug: 'gift-cards',
                    description: 'گوگل‌پلی، اپل، استیم، پلی‌استیشن، ایکس‌باکس و اسپاتیفای',
                  },
                  {
                    id: 2,
                    name: 'اشتراک‌های هوش مصنوعی',
                    slug: 'ai-subscriptions',
                    description: 'ChatGPT Plus، Claude Pro، Cursor، Midjourney و Gemini',
                  },
                  {
                    id: 3,
                    name: 'شارژ درون‌برنامه‌ای بازی‌ها',
                    slug: 'game-topup',
                    description: 'یوسی پابجی، سی‌پی کالاف، جم فری‌فایر، ولورانت و گنشین',
                  },
                ]
            ).map((cat: any) => {
              const Icon =
                cat.slug === 'ai-subscriptions'
                  ? Cpu
                  : cat.slug === 'game-topup'
                  ? Gamepad2
                  : Gift;
              return (
                <Link
                  key={cat.id}
                  to={`/products?category=${cat.slug}`}
                  className="group p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/60 flex items-start justify-between gap-4 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5 text-indigo-500 shrink-0" />
                      <h2 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-500 transition-colors">
                        {cat.name}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {cat.description}
                    </p>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 shrink-0 mt-1" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 2: Featured Product Catalog with Interactive Filter Tabs */}
      <section>
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                محصولات منتخب و پرفروش گرگیفت+
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                محاسبه لحظه‌ای قیمت بر اساس نرخ روز و تحویل مستقیم در پنل کاربری
              </p>
            </div>

            {/* Functional Interactive Segmented Filter Control */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
              {[
                { key: 'all', label: 'منتخب همه دسته‌ها' },
                { key: 'gift-cards', label: 'گیفت‌کارت‌ها' },
                { key: 'ai-subscriptions', label: 'هوش مصنوعی' },
                { key: 'game-topup', label: 'شارژ بازی‌ها' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveCatTab(tab.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    activeCatTab === tab.key
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="h-72 rounded-xl bg-slate-200/60 dark:bg-slate-900 animate-pulse border border-slate-200 dark:border-slate-800"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          <div className="text-center pt-2">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-indigo-500 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 transition-colors"
            >
              <span>مشاهده تمامی {toPersianDigits(products.length, usePersian)} محصول فروشگاه</span>
              <ChevronLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 3: Trust Guarantees, Verified Buyer Reviews & FAQ */}
      <section>
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 space-y-12">
          {/* Store Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: Zap,
                title: 'تحویل آنی و اتوماتیک کد',
                desc: 'استخراج خودکار کد اورجینال بلافاصله پس از پرداخت بدون نیاز به انتظار',
              },
              {
                icon: ShieldCheck,
                title: 'تضمین اصالت و امنیت کامل',
                desc: 'کدهای قانونی بدون تاریخ انقضا و شارژ مستقیم بازی‌ها بدون نیاز به رمز اکانت',
              },
              {
                icon: Wallet,
                title: 'کیف پول + کش‌بک خرید',
                desc: 'پرداخت تک‌کلیکی از کیف پول همراه با پاداش کش‌بک برای خریدهای بعدی',
              },
              {
                icon: Headphones,
                title: 'پشتیبانی تخصصی ۷ روز هفته',
                desc: 'پاسخگویی سریع از طریق تیکت داخل سایت، تلگرام و تلفن از ۹ صبح تا ۱۲ شب',
              },
            ].map((b, i) => (
              <div
                key={i}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
              >
                <b.icon className="w-6 h-6 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{b.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {b.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Two-column: Verified Customer Reviews + FAQs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Customer Reviews */}
            <div className="lg:col-span-6 space-y-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  دیدگاه خریداران تأییدشده
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  تجربه واقعی مشتریان از سرعت تحویل کد و فعال‌سازی اشتراک‌ها
                </p>
              </div>

              <div className="space-y-3">
                {(reviews || []).slice(0, 4).map((rev: any) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {rev.user_name} ·{' '}
                        <span className="font-normal text-indigo-500">{rev.product_title}</span>
                      </div>
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {Array.from({ length: rev.rating || 5 }).map((_, idx) => (
                          <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {rev.comment}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQs Accordion */}
            <div className="lg:col-span-6 space-y-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  سوالات متداول پیش از خرید
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  پاسخ به پرسش‌های پرتکرار درباره نحوه تحویل و روش‌های پرداخت
                </p>
              </div>

              <div className="space-y-2.5">
                {(faqs || []).slice(0, 5).map((faq: any) => {
                  const isOpen = openFaqId === faq.id;
                  return (
                    <div
                      key={faq.id}
                      className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                        aria-expanded={isOpen}
                        className="w-full p-4 text-start flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-white hover:text-indigo-500"
                      >
                        <span>{faq.question}</span>
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            isOpen ? 'rotate-180 text-indigo-500' : 'text-slate-400'
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/80 pt-3">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import { db, runInTransaction } from './db';
import { encryptCode, hashCodeFingerprint, hashPassword } from './crypto';
import { maskGiftCode } from '../utils/format';

export const DEFAULT_SETTINGS: Record<string, any> = {
  general: {
    siteName: 'گرگیفت+',
    siteNameLatin: 'GarGift+',
    slogan: 'گیفت‌کارت، اشتراک و شارژ بازی؛ سریع، مطمئن، ارزان',
    logoUrl: '',
    faviconUrl: '',
    usePersianDigits: true,
    showUsdPrice: true,
    supportPhone: '۰۲۱-۹۱۰۰۱۲۳۴',
    supportEmail: 'support@gargift.ir',
    workingHours: 'همه‌روزه حتی ایام تعطیل، ۹ صبح تا ۱۲ شب',
    telegramUrl: 'https://t.me/gargift_plus',
    whatsappUrl: 'https://wa.me/989120000000',
    instagramUrl: 'https://instagram.com/gargift_plus',
    enamadHtml: '',
    footerText: 'تمامی حقوق مادی و معنوی این وب‌سایت متعلق به فروشگاه گرگیفت+ (GarGift+) می‌باشد.',
    maintenanceMode: false,
    maintenanceMessage: 'فروشگاه در حال به‌روزرسانی زیرساخت است. لطفاً دقایقی دیگر مراجعه فرمایید.',
    announcementBarActive: true,
    announcementBarText: 'تحویل آنی کدهای گیفت‌کارت و اکانت‌های هوش مصنوعی + ۵٪ کش‌بک کیف پول برای اولین خرید با کد GARGIFT5',
    announcementBarLink: '/products',
  },
  theme: {
    defaultMode: 'dark',
    primaryColor: '#6366f1',
    accentColor: '#06b6d4',
    borderRadius: '0.75rem',
    cardStyle: 'bordered',
    customCss: '',
  },
  pricing: {
    globalUsdRate: 69000,
    isSampleRateWarning: true,
    globalMarginPercent: 6,
    fixedFeeToman: 0,
    roundingStepToman: 1000,
    referralRewardPercent: 3,
    loyaltyCashbackPercent: 1,
  },
  payment: {
    walletEnabled: true,
    cardToCardEnabled: true,
    cardSelectionMode: 'round_robin',
    cards: [
      {
        id: 'card-1',
        bankName: 'بانک سامان (نمونه تستی)',
        cardNumber: '6219-8610-0000-0000',
        ownerName: 'شرکت گرگیفت پلاس (حساب آزمایشی)',
        isActive: true,
      },
      {
        id: 'card-2',
        bankName: 'بانک ملت (نمونه تستی)',
        cardNumber: '6104-3370-0000-0000',
        ownerName: 'شرکت گرگیفت پلاس (حساب آزمایشی)',
        isActive: true,
      },
    ],
    zarinpalEnabled: true,
    zarinpalSandbox: true,
    zarinpalMerchantId: '00000000-0000-0000-0000-000000000000',
    zarinpalBaseUrl: 'https://sandbox.zarinpal.com',
    zibalEnabled: true,
    zibalSandbox: true,
    zibalMerchantId: 'zibal',
    zibalBaseUrl: 'https://gateway.zibal.ir',
    cryptoEnabled: true,
    cryptoNetwork: 'TRC20 (USDT)',
    cryptoWalletAddress: 'TTestWalletAddressGarGiftPlus000000000',
    paymentTimeoutMinutes: 30,
    maxOpenOrdersPerUser: 3,
    gatewayFeePercent: 0,
    minOrderToman: 10000,
    maxOrderToman: 100000000,
  },
  homepageLayout: {
    sections: [
      { id: 'hero', title: 'اسلایدر و بنر اصلی', enabled: true, order: 1 },
      { id: 'categories', title: 'دسته‌بندی‌های اصلی', enabled: true, order: 2 },
      { id: 'special_offers', title: 'پیشنهادهای ویژه و تخفیف‌دار', enabled: true, order: 3 },
      { id: 'bestsellers', title: 'پرفروش‌ترین محصولات', enabled: true, order: 4 },
      { id: 'newest', title: 'جدیدترین محصولات', enabled: true, order: 5 },
      { id: 'benefits', title: 'مزایای خرید از گرگیفت+', enabled: true, order: 6 },
      { id: 'reviews', title: 'نظرات خریداران', enabled: true, order: 7 },
      { id: 'faqs', title: 'سوالات متداول', enabled: true, order: 8 },
      { id: 'blog', title: 'آخرین مقالات آموزشی', enabled: true, order: 9 },
    ],
  },
  authAndSms: {
    registrationOpen: true,
    otpEnabled: false,
    smsProvider: 'kavenegar',
    smsSenderNumber: '10008663',
    telegramBotBaseUrl: 'https://api.telegram.org',
    telegramAdminChatId: '',
  },
};

export function seedDatabase(): void {
  const now = new Date().toISOString();

  // Check if settings already exist
  const existingSetting = db
    .prepare('SELECT key FROM settings WHERE key = ?')
    .get('general') as { key: string } | undefined;

  runInTransaction(() => {
    // 1. Seed Settings idempotently
    const upsertSetting = db.prepare(`
      INSERT INTO settings (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO NOTHING
    `);
    for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
      upsertSetting.run(key, JSON.stringify(val), now);
    }

    // 2. Seed Roles
    const upsertRole = db.prepare(`
      INSERT INTO roles (name, slug, permissions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO NOTHING
    `);
    upsertRole.run(
      'مدیرکل',
      'super_admin',
      JSON.stringify(['*']),
      now,
      now
    );
    upsertRole.run(
      'مدیر محصول و انبار',
      'product_manager',
      JSON.stringify([
        'products.view',
        'products.write',
        'categories.view',
        'categories.write',
        'codes.view',
        'codes.write',
        'codes.reveal',
        'pricing.view',
        'pricing.write',
      ]),
      now,
      now
    );
    upsertRole.run(
      'پشتیبان و اپراتور سفارش',
      'support_agent',
      JSON.stringify([
        'orders.view',
        'orders.write',
        'payments.view',
        'payments.verify',
        'tickets.view',
        'tickets.write',
        'reviews.view',
        'reviews.write',
      ]),
      now,
      now
    );

    // 3. Seed Super Admin & Demo Customer
    const adminPhone = process.env.ADMIN_PHONE || '09120000000';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@gargift.ir';
    const adminPass = process.env.ADMIN_INITIAL_PASSWORD || 'Admin@123456';

    const existingAdmin = db
      .prepare('SELECT id FROM users WHERE phone = ? OR email = ?')
      .get(adminPhone, adminEmail) as { id: number } | undefined;

    let adminId = existingAdmin?.id;
    if (!adminId) {
      const res = db
        .prepare(`
          INSERT INTO users (
            name, phone, email, password_hash, role, status,
            wallet_balance, referral_code, must_change_password, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'super_admin', 'active', 5000000, 'ADMINPLUS', 0, ?, ?)
        `)
        .run(
          'مدیرکل گرگیفت+',
          adminPhone,
          adminEmail,
          hashPassword(adminPass),
          now,
          now
        );
      adminId = Number(res.lastInsertRowid);
    }

    // Demo Customer
    const existingCustomer = db
      .prepare('SELECT id FROM users WHERE phone = ?')
      .get('09121112233') as { id: number } | undefined;

    let customerId = existingCustomer?.id;
    if (!customerId) {
      const res = db
        .prepare(`
          INSERT INTO users (
            name, phone, email, password_hash, role, status,
            wallet_balance, referral_code, must_change_password, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'customer', 'active', 2500000, 'ALI2026', 0, ?, ?)
        `)
        .run(
          'علی محمدی (مشتری نمونه)',
          '09121112233',
          'ali@example.com',
          hashPassword('User@123456'),
          now,
          now
        );
      customerId = Number(res.lastInsertRowid);

      // Initial wallet transaction for demo customer
      db.prepare(`
        INSERT INTO wallet_transactions (
          user_id, type, amount_toman, balance_after_toman, reference_type, description, created_at
        ) VALUES (?, 'deposit', 2500000, 2500000, 'seed', 'شارژ اولیه کیف پول نمونه برای تست سریع خرید', ?)
      `).run(customerId, now);
    }

    // Only run full catalog seed if not already seeded
    if (existingSetting) return;

    // 4. Seed Categories
    const insertCat = db.prepare(`
      INSERT INTO categories (
        name, slug, parent_id, icon, description, sort_order, is_active, seo_title, seo_description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `);

    const catGiftRes = insertCat.run(
      'گیفت‌کارت‌ها',
      'gift-cards',
      null,
      'Gift',
      'خرید انواع گیفت‌کارت اورجینال گوگل‌پلی، اپل، استیم، پلی‌استیشن، ایکس‌باکس و آمازون با تحویل آنی کد',
      1,
      'خرید گیفت کارت اورجینال با تحویل آنی | گرگیفت+',
      'ارزان‌ترین قیمت خرید گیفت کارت گوگل پلی، آیتونز اپل، استیم، پلی استیشن و اسپاتیفای با تحویل اتوماتیک',
      now,
      now
    );
    const catGiftId = Number(catGiftRes.lastInsertRowid);

    const catAiRes = insertCat.run(
      'اشتراک‌های هوش مصنوعی',
      'ai-subscriptions',
      null,
      'Cpu',
      'خرید و تمدید اکانت‌های پرمیوم ChatGPT Plus، Claude Pro، Gemini Advanced، Midjourney و Cursor',
      2,
      'خرید اکانت هوش مصنوعی ChatGPT، Claude و Cursor | گرگیفت+',
      'تأمین قانونی اشتراک‌های هوش مصنوعی روی ایمیل شخصی شما یا اکانت اختصاصی با ضمانت کامل دوره',
      now,
      now
    );
    const catAiId = Number(catAiRes.lastInsertRowid);

    const catGameRes = insertCat.run(
      'شارژ درون‌برنامه‌ای بازی‌ها',
      'game-topup',
      null,
      'Gamepad2',
      'خرید یوسی پابجی موبایل، سی‌پی کالاف دیوتی، جم فری‌فایر، ولورانت پوینت و کریستال گنشین ایمپکت',
      3,
      'خرید یوسی پابجی، سی‌پی کالاف و جم فری‌فایر | گرگیفت+',
      'شارژ سریع و مستقیم بازی‌های موبایل و کامپیوتر با آیدی عددی بدون نیاز به رمز اکانت',
      now,
      now
    );
    const catGameId = Number(catGameRes.lastInsertRowid);

    // 5. Seed 21 Realistic Products across the 3 categories
    interface SeedProduct {
      title: string;
      slug: string;
      catId: number;
      brand: string;
      region: string;
      shortDesc: string;
      deliveryType: 'auto_code' | 'manual_id' | 'subscription';
      deliveryTime: string;
      badges: string[];
      featured: boolean;
      variants: Array<{
        title: string;
        usdCents: number;
        costToman: number;
        discountPercent?: number;
        stockMode: 'code_pool' | 'numeric' | 'unlimited';
        stockQty: number;
        durationMonths?: number;
        subMode?: string;
      }>;
      fields?: Array<{
        label: string;
        key: string;
        type: 'text' | 'number' | 'select' | 'email';
        options?: string[];
        required: boolean;
        help: string;
      }>;
    }

    const seedProducts: SeedProduct[] = [
      // --- GIFT CARDS (9 products) ---
      {
        title: 'گیفت‌کارت گوگل‌پلی (Google Play)',
        slug: 'google-play-gift-card-us',
        catId: catGiftId,
        brand: 'Google Play',
        region: 'آمریکا (USA)',
        shortDesc: 'کد اورجینال گوگل‌پلی ریجن آمریکا بدون تاریخ انقضا برای خرید برنامه و جم بازی‌ها',
        deliveryType: 'auto_code',
        deliveryTime: 'تحویل آنی و خودکار',
        badges: ['پرفروش', 'تحویل آنی'],
        featured: true,
        variants: [
          { title: '۵ دلاری آمریکا', usdCents: 500, costToman: 330000, stockMode: 'code_pool', stockQty: 4 },
          { title: '۱۰ دلاری آمریکا', usdCents: 1000, costToman: 660000, discountPercent: 5, stockMode: 'code_pool', stockQty: 4 },
          { title: '۲۵ دلاری آمریکا', usdCents: 2500, costToman: 1650000, stockMode: 'code_pool', stockQty: 3 },
          { title: '۵۰ دلاری آمریکا', usdCents: 5000, costToman: 3300000, discountPercent: 7, stockMode: 'code_pool', stockQty: 3 },
        ],
      },
      {
        title: 'گیفت‌کارت اپل آیتونز (Apple / iTunes)',
        slug: 'apple-itunes-gift-card-us',
        catId: catGiftId,
        brand: 'Apple',
        region: 'آمریکا (USA)',
        shortDesc: 'شارژ اپل آیدی آمریکا برای خرید اشتراک آی‌کلود پلاس، اپل موزیک و برنامه‌های اپ‌استور',
        deliveryType: 'auto_code',
        deliveryTime: 'تحویل آنی و خودکار',
        badges: ['پرفروش', 'تحویل آنی'],
        featured: true,
        variants: [
          { title: '۵ دلاری اپل', usdCents: 500, costToman: 335000, stockMode: 'code_pool', stockQty: 3 },
          { title: '۱۰ دلاری اپل', usdCents: 1000, costToman: 665000, stockMode: 'code_pool', stockQty: 4 },
          { title: '۲۵ دلاری اپل', usdCents: 2500, costToman: 1660000, discountPercent: 4, stockMode: 'code_pool', stockQty: 3 },
          { title: '۵۰ دلاری اپل', usdCents: 5000, costToman: 3320000, stockMode: 'code_pool', stockQty: 2 },
        ],
      },
      {
        title: 'گیفت‌کارت استیم والت (Steam Wallet)',
        slug: 'steam-wallet-gift-card-global',
        catId: catGiftId,
        brand: 'Steam',
        region: 'گلوبال / آمریکا',
        shortDesc: 'کد دیجیتال شارژ کیف پول استیم برای خرید بازی‌های اورجینال PC و آیتم‌های Dota 2 و CS2',
        deliveryType: 'auto_code',
        deliveryTime: 'تحویل آنی و خودکار',
        badges: ['محبوب گیمرها'],
        featured: true,
        variants: [
          { title: '۵ دلاری استیم', usdCents: 500, costToman: 340000, stockMode: 'code_pool', stockQty: 3 },
          { title: '۱۰ دلاری استیم', usdCents: 1000, costToman: 675000, stockMode: 'code_pool', stockQty: 3 },
          { title: '۲۰ دلاری استیم', usdCents: 2000, costToman: 1350000, discountPercent: 5, stockMode: 'code_pool', stockQty: 3 },
          { title: '۵۰ دلاری استیم', usdCents: 5000, costToman: 3370000, stockMode: 'code_pool', stockQty: 2 },
        ],
      },
      {
        title: 'گیفت‌کارت پلی‌استیشن (PlayStation PSN)',
        slug: 'playstation-network-gift-card-us',
        catId: catGiftId,
        brand: 'PlayStation',
        region: 'آمریکا (USA)',
        shortDesc: 'شارژ کیف پول PSN و خرید اشتراک پلی‌استیشن پلاس Essential، Extra و Premium',
        deliveryType: 'auto_code',
        deliveryTime: 'تحویل آنی و خودکار',
        badges: ['تحویل آنی'],
        featured: false,
        variants: [
          { title: '۱۰ دلاری PSN آمریکا', usdCents: 1000, costToman: 650000, stockMode: 'code_pool', stockQty: 3 },
          { title: '۲۵ دلاری PSN آمریکا', usdCents: 2500, costToman: 1620000, discountPercent: 6, stockMode: 'code_pool', stockQty: 3 },
          { title: '۵۰ دلاری PSN آمریکا', usdCents: 5000, costToman: 3250000, stockMode: 'code_pool', stockQty: 2 },
          { title: '۱۰۰ دلاری PSN آمریکا', usdCents: 10000, costToman: 6500000, stockMode: 'code_pool', stockQty: 2 },
        ],
      },
      {
        title: 'گیفت‌کارت آمازون (Amazon Gift Card)',
        slug: 'amazon-gift-card-us',
        catId: catGiftId,
        brand: 'Amazon',
        region: 'آمریکا (USA)',
        shortDesc: 'کارت هدیه رسمی آمازون آمریکا مناسب خرید کالاهای دیجیتال و کتاب‌های کیندل',
        deliveryType: 'auto_code',
        deliveryTime: 'تحویل آنی و خودکار',
        badges: ['تحویل آنی'],
        featured: false,
        variants: [
          { title: '۱۰ دلاری آمازون', usdCents: 1000, costToman: 670000, stockMode: 'code_pool', stockQty: 3 },
          { title: '۲۵ دلاری آمازون', usdCents: 2500, costToman: 1680000, stockMode: 'code_pool', stockQty: 3 },
          { title: '۵۰ دلاری آمازون', usdCents: 5000, costToman: 3360000, stockMode: 'code_pool', stockQty: 2 },
        ],
      },
      {
        title: 'گیفت‌کارت ایکس‌باکس و گیم‌پس (Xbox / Game Pass)',
        slug: 'xbox-gamepass-gift-card-us',
        catId: catGiftId,
        brand: 'Xbox',
        region: 'گلوبال / آمریکا',
        shortDesc: 'کد دیجیتال مایکروسافت استور و اشتراک Xbox Game Pass Ultimate',
        deliveryType: 'auto_code',
        deliveryTime: 'تحویل آنی و خودکار',
        badges: ['تخفیف ویژه'],
        featured: false,
        variants: [
          { title: '۱۰ دلاری ایکس‌باکس', usdCents: 1000, costToman: 640000, stockMode: 'code_pool', stockQty: 3 },
          { title: '۲۵ دلاری ایکس‌باکس', usdCents: 2500, costToman: 1600000, stockMode: 'code_pool', stockQty: 3 },
          { title: 'گیم‌پس آلتیمیت ۱ ماهه', usdCents: 1499, costToman: 950000, discountPercent: 10, stockMode: 'code_pool', stockQty: 3 },
        ],
      },
      {
        title: 'گیفت‌کارت اسپاتیفای پرمیوم (Spotify Premium)',
        slug: 'spotify-premium-gift-card',
        catId: catGiftId,
        brand: 'Spotify',
        region: 'آمریکا / اروپا',
        shortDesc: 'کد فعال‌سازی اسپاتیفای پرمیوم بدون تبلیغات با قابلیت دانلود آفلاین موزیک',
        deliveryType: 'auto_code',
        deliveryTime: 'تحویل آنی و خودکار',
        badges: ['تحویل آنی'],
        featured: false,
        variants: [
          { title: '۱۰ دلاری اسپاتیفای (۱ ماهه)', usdCents: 1000, costToman: 660000, stockMode: 'code_pool', stockQty: 3 },
          { title: '۳۰ دلاری اسپاتیفای (۳ ماهه)', usdCents: 3000, costToman: 1980000, discountPercent: 5, stockMode: 'code_pool', stockQty: 2 },
        ],
      },
      {
        title: 'گیفت‌کارت نتفلیکس (Netflix Gift Card)',
        slug: 'netflix-gift-card-tr-us',
        catId: catGiftId,
        brand: 'Netflix',
        region: 'آمریکا / ترکیه',
        shortDesc: 'کد شارژ حساب نتفلیکس با کیفیت 4K Ultra HD بدون نیاز به کارت بانکی بین‌المللی',
        deliveryType: 'auto_code',
        deliveryTime: 'تحویل آنی و خودکار',
        badges: [],
        featured: false,
        variants: [
          { title: '۱۵ دلاری نتفلیکس آمریکا', usdCents: 1500, costToman: 1000000, stockMode: 'code_pool', stockQty: 3 },
          { title: '۳۰ دلاری نتفلیکس آمریکا', usdCents: 3000, costToman: 2000000, stockMode: 'code_pool', stockQty: 2 },
        ],
      },
      {
        title: 'گیفت‌کارت روبلاکس و ریزر گلد (Roblox / Razer Gold)',
        slug: 'roblox-razer-gold-gift-card',
        catId: catGiftId,
        brand: 'Roblox',
        region: 'گلوبال (Global)',
        shortDesc: 'دریافت Robux و شارژ کیف پول Razer Gold برای صدها بازی آنلاین',
        deliveryType: 'auto_code',
        deliveryTime: 'تحویل آنی و خودکار',
        badges: ['جدید'],
        featured: false,
        variants: [
          { title: '۸۰۰ روباکس (۱۰ دلاری)', usdCents: 1000, costToman: 665000, stockMode: 'code_pool', stockQty: 3 },
          { title: '۲۰۰۰ روباکس (۲۵ دلاری)', usdCents: 2500, costToman: 1660000, stockMode: 'code_pool', stockQty: 2 },
        ],
      },

      // --- AI SUBSCRIPTIONS (6 products) ---
      {
        title: 'اشتراک چت‌جی‌پی‌تی پلاس (ChatGPT Plus - OpenAI)',
        slug: 'chatgpt-plus-subscription',
        catId: catAiId,
        brand: 'OpenAI',
        region: 'گلوبال (بدون محدودیت)',
        shortDesc: 'دسترسی کامل به مدل‌های GPT-4o، o3-mini، ساخت تصویر DALL-E و تحلیل فایل روی ایمیل شخصی شما',
        deliveryType: 'subscription',
        deliveryTime: '۱۵ تا ۶۰ دقیقه',
        badges: ['پرفروش', 'ویژه برنامه‌نویسان'],
        featured: true,
        variants: [
          { title: '۱ ماهه (اکانت اختصاصی روی ایمیل شما)', usdCents: 2000, costToman: 1320000, discountPercent: 5, stockMode: 'unlimited', stockQty: 999, durationMonths: 1, subMode: 'personal_email' },
          { title: '۱ ماهه (اکانت اشتراکی اقتصادی)', usdCents: 750, costToman: 450000, stockMode: 'unlimited', stockQty: 999, durationMonths: 1, subMode: 'shared_account' },
          { title: '۳ ماهه (اکانت اختصاصی روی ایمیل شما)', usdCents: 5800, costToman: 3800000, discountPercent: 8, stockMode: 'unlimited', stockQty: 999, durationMonths: 3, subMode: 'personal_email' },
        ],
        fields: [
          { label: 'ایمیل اکانت OpenAI شما', key: 'account_email', type: 'email', required: true, help: 'ایمیلی که می‌خواهید اشتراک روی آن فعال شود را وارد کنید.' },
          { label: 'نحوه فعال‌سازی', key: 'activation_method', type: 'select', options: ['ارسال لینک پرداخت اختصاصی', 'ورود به اکانت و فعال‌سازی توسط پشتیبانی'], required: true, help: 'روش راحت‌تر برای خودتان را انتخاب کنید.' },
        ],
      },
      {
        title: 'اشتراک کلود پرو (Claude Pro - Anthropic)',
        slug: 'claude-pro-subscription',
        catId: catAiId,
        brand: 'Anthropic',
        region: 'گلوبال',
        shortDesc: 'بهترین هوش مصنوعی برای کدنویسی، نویسندگی و تحلیل پروژه‌های سنگین با مدل Claude 3.7 Sonnet',
        deliveryType: 'subscription',
        deliveryTime: '۲۰ تا ۹۰ دقیقه',
        badges: ['محبوب برنامه‌نویسان', 'تخفیف ویژه'],
        featured: true,
        variants: [
          { title: '۱ ماهه اختصاصی (تحویل با شماره وریفای‌شده)', usdCents: 2000, costToman: 1350000, discountPercent: 6, stockMode: 'unlimited', stockQty: 999, durationMonths: 1, subMode: 'personal_email' },
          { title: '۳ ماهه اختصاصی با ضمانت کامل', usdCents: 5700, costToman: 3850000, stockMode: 'unlimited', stockQty: 999, durationMonths: 3, subMode: 'personal_email' },
        ],
        fields: [
          { label: 'ایمیل شما جهت تحویل یا ارتقا', key: 'account_email', type: 'email', required: true, help: 'مشخصات اکانت به این ایمیل ارسال یا روی آن فعال می‌شود.' },
        ],
      },
      {
        title: 'اشتراک کرسر پرو (Cursor Pro IDE)',
        slug: 'cursor-pro-ai-subscription',
        catId: catAiId,
        brand: 'Cursor',
        region: 'گلوبال',
        shortDesc: 'محیط برنامه‌نویسی هوشمند با ۵۰۰ درخواست سریع پرمیوم به مدل‌های Claude و GPT',
        deliveryType: 'subscription',
        deliveryTime: 'کمتر از ۱ ساعت',
        badges: ['جدید', 'ویژه توسعه‌دهندگان'],
        featured: true,
        variants: [
          { title: '۱ ماهه اختصاصی روی اکانت شخصی', usdCents: 2000, costToman: 1340000, stockMode: 'unlimited', stockQty: 999, durationMonths: 1, subMode: 'personal_email' },
          { title: '۱۲ ماهه سالانه (۲۰٪ صرفه‌جویی)', usdCents: 19200, costToman: 12800000, discountPercent: 10, stockMode: 'unlimited', stockQty: 999, durationMonths: 12, subMode: 'personal_email' },
        ],
        fields: [
          { label: 'ایمیل اکانت Cursor.com', key: 'cursor_email', type: 'email', required: true, help: 'ایمیل ثبت‌نام شده در سایت Cursor را وارد نمایید.' },
        ],
      },
      {
        title: 'اشتراک جمینای ادونسد گوگل (Google One AI Premium - Gemini)',
        slug: 'gemini-advanced-google-one-ai',
        catId: catAiId,
        brand: 'Google AI',
        region: 'آمریکا / اروپا',
        shortDesc: 'دسترسی به قوی‌ترین مدل‌های جمینای گوگل به همراه ۲ ترابایت فضای ابری Google Drive',
        deliveryType: 'subscription',
        deliveryTime: '۳۰ دقیقه تا ۲ ساعت',
        badges: ['۲ ترابایت فضا'],
        featured: false,
        variants: [
          { title: '۱ ماهه روی جیمیل شخصی', usdCents: 1999, costToman: 1300000, stockMode: 'unlimited', stockQty: 999, durationMonths: 1, subMode: 'personal_email' },
          { title: '۳ ماهه روی جیمیل شخصی', usdCents: 5499, costToman: 3600000, discountPercent: 8, stockMode: 'unlimited', stockQty: 999, durationMonths: 3, subMode: 'personal_email' },
        ],
        fields: [
          { label: 'آدرس جیمیل (Gmail)', key: 'gmail_address', type: 'email', required: true, help: 'دعوت‌نامه خانواده گوگل وان یا ارتقای مستقیم روی این جیمیل انجام می‌شود.' },
        ],
      },
      {
        title: 'اشتراک میدجرنی (Midjourney AI Art)',
        slug: 'midjourney-ai-subscription',
        catId: catAiId,
        brand: 'Midjourney',
        region: 'گلوبال',
        shortDesc: 'تولید تصاویر هنری و فتورئال با هوش مصنوعی در وب‌اپلیکیشن و دیسکورد میدجرنی',
        deliveryType: 'subscription',
        deliveryTime: '۳۰ تا ۹۰ دقیقه',
        badges: ['طراحی و گرافیک'],
        featured: false,
        variants: [
          { title: 'پلن Basic یک‌ماهه (۱۰ دلاری)', usdCents: 1000, costToman: 680000, stockMode: 'unlimited', stockQty: 999, durationMonths: 1, subMode: 'personal_email' },
          { title: 'پلن Standard یک‌ماهه نامحدود (۳۰ دلاری)', usdCents: 3000, costToman: 2020000, discountPercent: 5, stockMode: 'unlimited', stockQty: 999, durationMonths: 1, subMode: 'personal_email' },
        ],
        fields: [
          { label: 'ایمیل اکانت دیسکورد یا گوگل', key: 'discord_email', type: 'email', required: true, help: 'ایمیل متصل به حساب Midjourney را وارد کنید.' },
        ],
      },
      {
        title: 'اشتراک پرپلکسیتی پرو و کوپایلت (Perplexity Pro / GitHub Copilot)',
        slug: 'perplexity-pro-github-copilot',
        catId: catAiId,
        brand: 'Perplexity / GitHub',
        region: 'گلوبال',
        shortDesc: 'موتور جستجوی پژوهشی هوشمند Perplexity Pro و دستیار کدنویسی GitHub Copilot Pro',
        deliveryType: 'subscription',
        deliveryTime: 'کمتر از ۱ ساعت',
        badges: ['پژوهش و کدنویسی'],
        featured: false,
        variants: [
          { title: 'Perplexity Pro یک‌ماهه اختصاصی', usdCents: 2000, costToman: 1320000, stockMode: 'unlimited', stockQty: 999, durationMonths: 1, subMode: 'personal_email' },
          { title: 'GitHub Copilot Pro یک‌ماهه', usdCents: 1000, costToman: 670000, stockMode: 'unlimited', stockQty: 999, durationMonths: 1, subMode: 'personal_email' },
        ],
        fields: [
          { label: 'ایمیل اکانت یا نام کاربری گیت‌هاب', key: 'target_account', type: 'text', required: true, help: 'ایمیل یا یوزرنیم حساب کاربری خود را بنویسید.' },
        ],
      },

      // --- GAME TOP-UPS (6 products) ---
      {
        title: 'خرید یوسی پابجی موبایل (PUBG Mobile UC)',
        slug: 'pubg-mobile-uc-topup',
        catId: catGameId,
        brand: 'PUBG Mobile',
        region: 'گلوبال (با آیدی عددی)',
        shortDesc: 'شارژ مستقیم و فوری یوسی پابجی موبایل فقط با Player ID بدون نیاز به رمز اکانت',
        deliveryType: 'manual_id',
        deliveryTime: '۵ تا ۲۰ دقیقه',
        badges: ['پرفروش', 'شارژ با آیدی'],
        featured: true,
        variants: [
          { title: '۶۰ یوسی پابجی موبایل', usdCents: 99, costToman: 64000, stockMode: 'unlimited', stockQty: 999 },
          { title: '۳۲۵ یوسی پابجی موبایل', usdCents: 499, costToman: 325000, discountPercent: 5, stockMode: 'unlimited', stockQty: 999 },
          { title: '۶۶۰ یوسی پابجی موبایل (مناسب رویال‌پس)', usdCents: 999, costToman: 650000, discountPercent: 6, stockMode: 'unlimited', stockQty: 999 },
          { title: '۱۸۰۰ یوسی پابجی موبایل', usdCents: 2499, costToman: 1620000, stockMode: 'unlimited', stockQty: 999 },
        ],
        fields: [
          { label: 'آیدی عددی بازیکن (Player ID)', key: 'player_id', type: 'number', required: true, help: 'آیدی عددی ۱۰ تا ۱۲ رقمی داخل پروفایل پابجی را وارد کنید (مثال: 5123456789).' },
          { label: 'نام اکانت در بازی (NickName)', key: 'player_name', type: 'text', required: true, help: 'جهت تطبیق و جلوگیری از خطا، نام نمایشی اکانت خود را بنویسید.' },
        ],
      },
      {
        title: 'خرید سی‌پی کالاف دیوتی موبایل (Call of Duty Mobile CP)',
        slug: 'call-of-duty-mobile-cp',
        catId: catGameId,
        brand: 'Call of Duty',
        region: 'گلوبال / اکتیویژن',
        shortDesc: 'خرید CP قانونی و فوری کالاف دیوتی موبایل با تضمین سلامت اکانت و بدون ریسک بن',
        deliveryType: 'manual_id',
        deliveryTime: '۱۵ تا ۴۵ دقیقه',
        badges: ['پرفروش', 'تضمین قانونی'],
        featured: true,
        variants: [
          { title: '۸۰ سی‌پی کالاف دیوتی', usdCents: 99, costToman: 65000, stockMode: 'unlimited', stockQty: 999 },
          { title: '۴۲۰ سی‌پی کالاف دیوتی (بتل‌پس)', usdCents: 499, costToman: 330000, discountPercent: 5, stockMode: 'unlimited', stockQty: 999 },
          { title: '۸۸۰ سی‌پی کالاف دیوتی', usdCents: 999, costToman: 660000, stockMode: 'unlimited', stockQty: 999 },
          { title: '۲۴۰۰ سی‌پی کالاف دیوتی', usdCents: 2499, costToman: 1640000, discountPercent: 7, stockMode: 'unlimited', stockQty: 999 },
        ],
        fields: [
          { label: 'ایمیل اکانت اکتیویژن (Activision Email)', key: 'activision_email', type: 'email', required: true, help: 'ایمیل متصل به اکانت Activision خود را وارد نمایید.' },
          { label: 'نام اکانت داخل بازی', key: 'in_game_name', type: 'text', required: true, help: 'نام دقیق کاراکتر شما در بازی برای تایید نهایی.' },
        ],
      },
      {
        title: 'خرید جم فری‌فایر (Garena Free Fire Diamonds)',
        slug: 'free-fire-diamonds-topup',
        catId: catGameId,
        brand: 'Free Fire',
        region: 'گلوبال / خاورمیانه',
        shortDesc: 'شارژ آنی الماس (جم) بازی فری‌فایر فقط با آیدی عددی بدون نیاز به ورود به اکانت',
        deliveryType: 'manual_id',
        deliveryTime: '۵ تا ۱۵ دقیقه',
        badges: ['شارژ با آیدی', 'سریع'],
        featured: false,
        variants: [
          { title: '۱۰۰ جم + ۱۰ جم هدیه فری‌فایر', usdCents: 110, costToman: 72000, stockMode: 'unlimited', stockQty: 999 },
          { title: '۳۱۰ جم + ۳۱ جم هدیه فری‌فایر', usdCents: 320, costToman: 210000, discountPercent: 4, stockMode: 'unlimited', stockQty: 999 },
          { title: '۵۲۰ جم + ۵۲ جم هدیه فری‌فایر', usdCents: 520, costToman: 345000, stockMode: 'unlimited', stockQty: 999 },
          { title: '۱۰۶۰ جم + ۱۰۶ جم هدیه فری‌فایر', usdCents: 1020, costToman: 675000, discountPercent: 6, stockMode: 'unlimited', stockQty: 999 },
        ],
        fields: [
          { label: 'آیدی عددی بازیکن (Player UID)', key: 'player_uid', type: 'number', required: true, help: 'آیدی عددی اکانت فری‌فایر خود را دقیق وارد کنید.' },
        ],
      },
      {
        title: 'خرید ولورانت پوینت (Valorant Points - VP)',
        slug: 'valorant-points-riot-pin',
        catId: catGameId,
        brand: 'Valorant',
        region: 'ترکیه / اروپا',
        shortDesc: 'کد Riot PIN برای شارژ فوری ولورانت پوینت و خرید اسکین‌های باندل و بتل‌پس',
        deliveryType: 'auto_code',
        deliveryTime: 'تحویل آنی کد',
        badges: ['تحویل آنی'],
        featured: false,
        variants: [
          { title: '۴۷۵ ولورانت پوینت (ریجن اروپا/ترکیه)', usdCents: 499, costToman: 330000, stockMode: 'code_pool', stockQty: 3 },
          { title: '۱۰۰۰ ولورانت پوینت (مناسب بتل‌پس)', usdCents: 999, costToman: 660000, discountPercent: 5, stockMode: 'code_pool', stockQty: 3 },
          { title: '۲۰۵۰ ولورانت پوینت', usdCents: 1999, costToman: 1320000, stockMode: 'code_pool', stockQty: 2 },
        ],
      },
      {
        title: 'شارژ کریستال گنشین ایمپکت (Genshin Impact Genesis Crystals)',
        slug: 'genshin-impact-genesis-crystals',
        catId: catGameId,
        brand: 'Genshin Impact',
        region: 'گلوبال (همه سرورها)',
        shortDesc: 'خرید بلسینگ ماهانه (Welkin Moon) و جنسیس کریستال مستقیم با UID و انتخاب سرور',
        deliveryType: 'manual_id',
        deliveryTime: '۱۰ تا ۳۰ دقیقه',
        badges: ['شارژ مستقیم UID'],
        featured: false,
        variants: [
          { title: 'بلسینگ ماهانه (Blessing of the Welkin Moon)', usdCents: 499, costToman: 325000, discountPercent: 5, stockMode: 'unlimited', stockQty: 999 },
          { title: '۳۰۰ + ۳۰ جنسیس کریستال', usdCents: 499, costToman: 325000, stockMode: 'unlimited', stockQty: 999 },
          { title: '۹۸۰ + ۱۱۰ جنسیس کریستال', usdCents: 1499, costToman: 980000, stockMode: 'unlimited', stockQty: 999 },
        ],
        fields: [
          { label: 'کد ۹ رقمی UID گنشین', key: 'genshin_uid', type: 'number', required: true, help: 'کد UID واقع در پایین سمت راست صفحه بازی.' },
          { label: 'سرور بازی', key: 'genshin_server', type: 'select', options: ['Europe', 'Asia', 'America', 'TW, HK, MO'], required: true, help: 'سرور اکانت خود را به درستی انتخاب کنید.' },
        ],
      },
      {
        title: 'خرید وی‌باکس فورتنایت (Fortnite V-Bucks)',
        slug: 'fortnite-vbucks-gift-card',
        catId: catGameId,
        brand: 'Fortnite',
        region: 'گلوبال (Epic Games)',
        shortDesc: 'کارت هدیه رسمی وی‌باکس فورتنایت قابل فعال‌سازی در سایت Epic Games روی تمام پلتفرم‌ها',
        deliveryType: 'auto_code',
        deliveryTime: 'تحویل آنی کد',
        badges: ['تحویل آنی'],
        featured: false,
        variants: [
          { title: '۱۰۰۰ وی‌باکس فورتنایت', usdCents: 899, costToman: 590000, stockMode: 'code_pool', stockQty: 3 },
          { title: '۲۸۰۰ وی‌باکس فورتنایت', usdCents: 2299, costToman: 1510000, discountPercent: 6, stockMode: 'code_pool', stockQty: 2 },
          { title: '۵۰۰۰ وی‌باکس فورتنایت', usdCents: 3699, costToman: 2430000, stockMode: 'code_pool', stockQty: 2 },
        ],
      },
    ];

    const insertProduct = db.prepare(`
      INSERT INTO products (
        title, slug, category_id, brand, region, short_description,
        description_html, usage_instructions_html, images_json, badges_json,
        delivery_type, delivery_time_text, faqs_json, is_featured, is_sample,
        sort_order, status, seo_title, seo_description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, 1, ?, 'active', ?, ?, ?, ?)
    `);

    const insertVariant = db.prepare(`
      INSERT INTO product_variants (
        product_id, title, pricing_mode, fixed_price_toman, usd_price_cents,
        cost_price_toman, discount_percent, min_qty, max_qty,
        stock_mode, stock_qty, low_stock_threshold, duration_months, subscription_mode,
        sort_order, is_active, created_at, updated_at
      ) VALUES (?, ?, 'dynamic', 0, ?, ?, ?, 1, 10, ?, ?, 2, ?, ?, ?, 1, ?, ?)
    `);

    const insertField = db.prepare(`
      INSERT INTO product_fields (
        product_id, label, field_key, field_type, options_json,
        is_required, help_text, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertCode = db.prepare(`
      INSERT INTO codes (
        variant_id, code_encrypted, code_masked, code_fingerprint,
        status, batch_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'available', 'SEED-BATCH-01', ?, ?)
    `);

    const firstVariantIds: number[] = [];
    const firstProductIds: number[] = [];

    seedProducts.forEach((p, idx) => {
      const descHtml = `<p>با خرید <strong>${p.title}</strong> از فروشگاه گرگیفت+، محصول اورجینال و قانونی را با کمترین کارمزد و پشتیبانی ۲۴ ساعته دریافت می‌کنید.</p><ul><li>تضمین اصالت ۱۰۰٪ و بدون تاریخ انقضا</li><li>پشتیبانی کامل در تمام مراحل فعال‌سازی</li><li>امکان مشاهده لحظه‌ای وضعیت سفارش در پنل کاربری</li></ul>`;
      const usageHtml =
        p.deliveryType === 'auto_code'
          ? `<ol><li>وارد حساب کاربری خود در پلتفرم ${p.brand} شوید.</li><li>به بخش Redeem Code یا Gift Card بروید.</li><li>کد دریافت‌شده از بخش سفارش‌های گرگیفت+ را کپی و وارد نمایید.</li></ol>`
          : p.deliveryType === 'manual_id'
          ? `<ol><li>آیدی عددی (Player ID) و نام کاربری خود را هنگام ثبت سفارش با دقت وارد کنید.</li><li>نیازی به ارسال رمز عبور اکانت نیست.</li><li>شارژ مستقیماً ظرف ۵ تا ۳۰ دقیقه به اکانت شما واریز می‌شود.</li></ol>`
          : `<ol><li>ایمیل اکانت خود را هنگام خرید وارد نمایید.</li><li>کارشناسان ما اشتراک را روی ایمیل شما فعال کرده و اطلاع‌رسانی می‌کنند.</li><li>تاریخ شروع و پایان اشتراک در پنل کاربری شما ثبت می‌گردد.</li></ol>`;

      const faqsJson = JSON.stringify([
        {
          q: `زمان تحویل ${p.title} چقدر است؟`,
          a: `زمان تحویل این محصول «${p.deliveryTime}» می‌باشد و بلافاصله در بخش سفارش‌های شما قابل مشاهده است.`,
        },
        {
          q: 'آیا برای استفاده نیاز به تغییر آی‌پی است؟',
          a: `بسته به ریجن محصول (${p.region})، هنگام Redeem کردن کد بهتر است آی‌پی دستگاه شما با کشور کارت هماهنگ باشد.`,
        },
      ]);

      const prodRes = insertProduct.run(
        p.title,
        p.slug,
        p.catId,
        p.brand,
        p.region,
        p.shortDesc,
        descHtml,
        usageHtml,
        JSON.stringify(p.badges),
        p.deliveryType,
        p.deliveryTime,
        faqsJson,
        p.featured ? 1 : 0,
        idx + 1,
        `${p.title} | خرید با تحویل فوری از گرگیفت+`,
        p.shortDesc,
        now,
        now
      );
      const productId = Number(prodRes.lastInsertRowid);
      firstProductIds.push(productId);

      p.variants.forEach((v, vIdx) => {
        const varRes = insertVariant.run(
          productId,
          v.title,
          v.usdCents,
          v.costToman,
          v.discountPercent || 0,
          v.stockMode,
          v.stockQty,
          v.durationMonths || null,
          v.subMode || null,
          vIdx + 1,
          now,
          now
        );
        const variantId = Number(varRes.lastInsertRowid);
        if (vIdx === 0) firstVariantIds.push(variantId);

        if (v.stockMode === 'code_pool') {
          for (let c = 1; c <= v.stockQty; c++) {
            const rawCode = `TEST-${p.brand.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 5)}-${variantId}0${c}-${1000 + variantId * 10 + c}`;
            insertCode.run(
              variantId,
              encryptCode(rawCode),
              maskGiftCode(rawCode),
              hashCodeFingerprint(variantId, rawCode),
              now,
              now
            );
          }
        }
      });

      if (p.fields) {
        p.fields.forEach((f, fIdx) => {
          insertField.run(
            productId,
            f.label,
            f.key,
            f.type,
            JSON.stringify(f.options || []),
            f.required ? 1 : 0,
            f.help,
            fIdx + 1,
            now,
            now
          );
        });
      }
    });

    // 6. Seed 4 Banners
    const insertBanner = db.prepare(`
      INSERT INTO banners (
        title, subtitle, badge_text, cta_text, link_url,
        gradient_class, position, sort_order, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    insertBanner.run(
      'تحویل آنی انواع گیفت‌کارت و اکانت‌های هوش مصنوعی',
      'دریافت کد اورجینال بلافاصله پس از پرداخت با نرخ لحظه‌ای و منصفانه بدون کارمزد پنهان',
      'پلتفرم هوشمند محصولات دیجیتال',
      'مشاهده همه محصولات',
      '/products',
      'from-indigo-600 via-violet-600 to-cyan-500',
      'hero',
      1,
      now,
      now
    );
    insertBanner.run(
      'اشتراک‌های ChatGPT Plus، Claude Pro و Cursor روی ایمیل شخصی شما',
      'ارتقای قانونی اکانت شخصی شما با ضمانت کامل دوره اشتراک و پشتیبانی تخصصی فارسی',
      'ویژه برنامه‌نویسان و پژوهشگران',
      'مشاهده اشتراک‌های هوش مصنوعی',
      '/products?category=ai-subscriptions',
      'from-emerald-600 via-teal-600 to-cyan-600',
      'hero',
      2,
      now,
      now
    );
    insertBanner.run(
      'شارژ مستقیم یوسی پابجی، سی‌پی کالاف و جم فری‌فایر',
      'واریز سریع با آیدی عددی (Player ID) بدون نیاز به رمز عبور اکانت شما',
      'ویژه گیمرهای حرفه‌ای',
      'شارژ آنی بازی‌ها',
      '/products?category=game-topup',
      'from-amber-600 via-orange-600 to-rose-600',
      'promo',
      3,
      now,
      now
    );
    insertBanner.run(
      'گیفت‌کارت‌های اپل، گوگل‌پلی، استیم و پلی‌استیشن با تخفیف پلکانی',
      'موجودی کامل ریجن آمریکا، اروپا و ترکیه با کدهای اورجینال و بدون تاریخ انقضا',
      'تحویل اتوماتیک ۲۴ ساعته',
      'خرید گیفت‌کارت',
      '/products?category=gift-cards',
      'from-blue-600 via-indigo-600 to-purple-600',
      'promo',
      4,
      now,
      now
    );

    // 7. Seed 3 Coupons
    const insertCoupon = db.prepare(`
      INSERT INTO coupons (
        code, title, discount_type, discount_value, min_order_toman,
        max_discount_toman, usage_limit, per_user_limit, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 500, 3, 1, ?, ?)
    `);
    insertCoupon.run('GARGIFT5', '۵٪ تخفیف اولین خرید تا سقف ۱۵۰ هزار تومان', 'percent', 5, 200000, 150000, now, now);
    insertCoupon.run('AIPLUS10', '۱۰٪ تخفیف ویژه اشتراک‌های هوش مصنوعی', 'percent', 10, 500000, 300000, now, now);
    insertCoupon.run('GAMER50', '۵۰ هزار تومان تخفیف ثابت خرید بالای ۵۰۰ هزار تومان', 'fixed', 50000, 500000, 50000, now, now);

    // 8. Seed 10 Reviews
    const insertReview = db.prepare(`
      INSERT INTO reviews (
        product_id, user_id, rating, comment, status, admin_reply, is_verified_buyer, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'approved', ?, 1, ?, ?)
    `);
    const sampleReviews = [
      { pIdx: 0, rating: 5, text: 'کد ۱۰ دلاری گوگل‌پلی دقیقاً در همان لحظه پرداخت تحویل داده شد و بدون مشکل روی اکانتم ریدیم شد.', reply: 'سپاس از اعتماد شما؛ خوشحالیم که تجربه سریعی داشتید.' },
      { pIdx: 1, rating: 5, text: 'گیفت کارت ۲۵ دلاری اپل خریدم، برای تمدید آی‌کلود پلاس عالی بود و قیمتش از همه‌جا مناسب‌تر بود.', reply: 'ممنون از همراهی شما با گرگیفت+.' },
      { pIdx: 2, rating: 5, text: 'استیم والت ۲۰ دلاری بلافاصله بعد از پرداخت از کیف پول نمایش داده شد. دکمه کپی کد هم خیلی راحت بود.', reply: 'از ثبت دیدگاه ارزشمندتان متشکریم.' },
      { pIdx: 9, rating: 5, text: 'اکانت ChatGPT Plus روی ایمیل شخصی خودم کمتر از ۲۰ دقیقه فعال شد. واقعاً پشتیبانی باحوصله‌ای دارید.', reply: 'خوشحالیم که از سرویس هوش مصنوعی رضایت دارید.' },
      { pIdx: 10, rating: 5, text: 'اشتراک Claude Pro برای برنامه‌نویسی فوق‌العاده است. ممنون که وریفای شماره رو هم کامل انجام دادید.', reply: 'موفق و پیروز باشید.' },
      { pIdx: 11, rating: 5, text: 'اشتراک Cursor Pro رو یک‌ماهه گرفتم و واقعاً سرعت کدنویسی رو چند برابر کرده. تحویل هم خیلی سریع بود.', reply: 'سپاس از نظر لطف شما.' },
      { pIdx: 15, rating: 5, text: '۶۶۰ یوسی پابجی موبایل با آیدی عددی سفارش دادم، زیر ۱۰ دقیقه داخل بازی نشسته بود!', reply: 'لذت ببرید! همیشه در خدمتیم.' },
      { pIdx: 16, rating: 4, text: 'سی‌پی کالاف دیوتی موبایل رو آخر شب سفارش دادم و حدود ۲۵ دقیقه طول کشید ولی کاملاً قانونی شارژ شد.', reply: 'ممنون از صبوری شما؛ در ساعات اوج ترافیک تلاش می‌کنیم سریع‌تر باشیم.' },
      { pIdx: 17, rating: 5, text: 'جم فری‌فایر با آیدی عددی خیلی سریع واریز شد و جم هدیه هم روش بود.', reply: 'مبارکتان باشد!' },
      { pIdx: 3, rating: 5, text: 'گیفت کارت پلی‌استیشن آمریکا رو با کارت به کارت خریدم، بعد از آپلود رسید ۵ دقیقه‌ای تایید و کد تحویل شد.', reply: 'سپاس از خرید شما از گرگیفت+.' },
    ];
    sampleReviews.forEach((r) => {
      const pid = firstProductIds[r.pIdx] || firstProductIds[0];
      insertReview.run(pid, customerId!, r.rating, r.text, r.reply, now, now);
    });

    // 9. Seed 8 FAQs
    const insertFaq = db.prepare(`
      INSERT INTO faqs (question, answer, category, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `);
    const sampleFaqs = [
      { q: 'کدهای گیفت‌کارت چطور و چه زمانی تحویل داده می‌شوند؟', a: 'تمامی گیفت‌کارت‌های دارای نشان «تحویل آنی» بلافاصله پس از پرداخت موفق از انبار کد رمزنگاری‌شده استخراج شده و در صفحه جزئیات سفارش به شما نمایش داده می‌شوند.', cat: 'تحویل سفارش' },
      { q: 'چطور می‌توانم از طریق کارت‌به‌کارت خرید کنم؟', a: 'در مرحله تسویه‌حساب روش «کارت‌به‌کارت» را انتخاب کنید، مبلغ سفارش را به شماره کارت نمایش‌داده‌شده واریز نموده و تصویر رسید یا کد پیگیری را بارگذاری کنید تا اپراتور مالی در سریع‌ترین زمان آن را تأیید کند.', cat: 'پرداخت' },
      { q: 'آیا برای شارژ بازی‌ها (پابجی و فری‌فایر) نیاز به رمز اکانت است؟', a: 'خیر! شارژ یوسی پابجی، جم فری‌فایر و کریستال گنشین ایمپکت صرفاً با آیدی عددی (Player ID / UID) انجام می‌شود و هیچ نیازی به اطلاعات ورود اکانت شما نیست.', cat: 'شارژ بازی' },
      { q: 'اشتراک‌های هوش مصنوعی روی ایمیل شخصی خودم فعال می‌شوند؟', a: 'بله، در واریانت‌های «اختصاصی روی ایمیل شخصی» اشتراک مستقیماً روی اکانت خودتان فعال شده و تمام تاریخچه چت‌ها کاملاً خصوصی باقی می‌ماند.', cat: 'هوش مصنوعی' },
      { q: 'چرا قیمت محصولات بر اساس نرخ دلار تغییر می‌کند؟', a: 'محصولات ارزی بر پایه نرخ روز دلار فروشگاه محاسبه می‌شوند تا همیشه منصفانه‌ترین قیمت لحظه‌ای را پرداخت کنید. البته پس از ثبت سفارش، قیمت سفارش شما ثابت می‌ماند.', cat: 'قیمت‌گذاری' },
      { q: 'اگر پس از خرید، کد گیفت‌کارت روی اکانتم کار نکرد چه کنم؟', a: 'تمامی کدهای گرگیفت+ اورجینال هستند. در صورت بروز خطای ریجن یا هرگونه ابهام، از داخل همان سفارش دکمه «ثبت تیکت پشتیبانی» را بزنید تا بلافاصله بررسی شود.', cat: 'پشتیبانی' },
      { q: 'کیف پول گرگیفت+ چه مزیتی دارد؟', a: 'با شارژ کیف پول می‌توانید خریدهای بعدی را بدون معطلی درگاه بانکی یا تأیید رسید، تنها با یک کلیک و به صورت آنی انجام دهید و از پاداش کش‌بک بهره‌مند شوید.', cat: 'کیف پول' },
      { q: 'کد معرف و پاداش دعوت از دوستان چگونه کار می‌کند؟', a: 'کد معرف اختصاصی شما در پنل کاربری قرار دارد. با ثبت‌نام و خرید دوستانتان با کد شما، درصدی از مبلغ خرید به عنوان پاداش نقدی به کیف پول شما واریز می‌شود.', cat: 'عمومی' },
    ];
    sampleFaqs.forEach((f, idx) => insertFaq.run(f.q, f.a, f.cat, idx + 1, now, now));

    // 10. Seed Static Pages
    const insertPage = db.prepare(`
      INSERT INTO pages (slug, title, content_html, seo_title, seo_description, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `);
    insertPage.run(
      'about-us',
      'درباره گرگیفت+',
      `<h2>درباره فروشگاه تخصصی گرگیفت+ (GarGift+)</h2><p>فروشگاه آنلاین <strong>گرگیفت+</strong> با هدف تأمین سریع، مطمئن و بدون واسطه محصولات دیجیتال بین‌المللی برای کاربران ایرانی راه‌اندازی شده است. ما با اتصال به تأمین‌کنندگان رسمی جهانی، انواع گیفت‌کارت، اشتراک‌های هوش مصنوعی و شارژ درون‌برنامه‌ای بازی‌ها را با تحویل آنی ارائه می‌دهیم.</p><h3>چرا گرگیفت+؟</h3><ul><li>تحویل خودکار و لحظه‌ای کدهای گیفت‌کارت از انبار رمزنگاری‌شده</li><li>محاسبه شفاف قیمت‌ها بدون کارمزدهای پنهان</li><li>پشتیبانی واقعی ۷ روز هفته از طریق تیکت و تلگرام</li></ul>`,
      'درباره ما | فروشگاه گرگیفت+',
      'آشنایی با فروشگاه آنلاین گرگیفت+، مرجع خرید گیفت‌کارت، اکانت هوش مصنوعی و شارژ بازی',
      now,
      now
    );
    insertPage.run(
      'contact-us',
      'تماس با ما',
      `<h2>راه‌های ارتباطی با پشتیبانی گرگیفت+</h2><p>تیم پشتیبانی گرگیفت+ همه‌روزه حتی در روزهای تعطیل از ساعت ۹ صبح الی ۱۲ شب آماده پاسخگویی به سوالات و پیگیری سفارش‌های شماست.</p><ul><li><strong>تلفن پشتیبانی:</strong> ۰۲۱-۹۱۰۰۱۲۳۴</li><li><strong>ایمیل رسمی:</strong> support@gargift.ir</li><li><strong>پشتیبانی سریع داخل سایت:</strong> از طریق بخش «تیکت‌های پشتیبانی» در پنل کاربری</li></ul>`,
      'تماس با ما | فروشگاه گرگیفت+',
      'اطلاعات تماس، تلفن و تیکت پشتیبانی فروشگاه گرگیفت+',
      now,
      now
    );
    insertPage.run(
      'terms',
      'قوانین و مقررات',
      `<h2>قوانین و شرایط استفاده از خدمات گرگیفت+</h2><p>ثبت سفارش در وب‌سایت گرگیفت+ به منزله مطالعه و پذیرش کامل قوانین زیر است:</p><ol><li>به دلیل ماهیت دیجیتال کدهای گیفت‌کارت، پس از نمایش کد تحویل‌شده به کاربر امکان لغو یا مرجوع کردن کد وجود ندارد.</li><li>مسئولیت انتخاب صحیح ریجن (کشور) گیفت‌کارت و تطابق آن با ریجن اکانت بر عهده خریدار محترم است.</li><li>در سفارش‌های شارژ با آیدی (Player ID)، خریدار موظف است آیدی عددی و نام اکانت را به درستی وارد نماید.</li></ol>`,
      'قوانین و مقررات | فروشگاه گرگیفت+',
      'شرایط و ضوابط خرید گیفت‌کارت و محصولات دیجیتال از گرگیفت+',
      now,
      now
    );
    insertPage.run(
      'privacy',
      'حریم خصوصی',
      `<h2>سیاست حفظ حریم خصوصی کاربران</h2><p>در گرگیفت+ اطلاعات شخصی کاربران شامل شماره موبایل، ایمیل و تاریخچه سفارش‌ها کاملاً محرمانه تلقی شده و با استانداردهای امنیتی پیشرفته محافظت می‌شود. کدهای خریداری‌شده با الگوریتم AES-256-GCM در پایگاه داده رمزنگاری می‌شوند.</p>`,
      'حریم خصوصی | فروشگاه گرگیفت+',
      'سیاست حفاظت از داده‌ها و حریم خصوصی کاربران در گرگیفت+',
      now,
      now
    );
    insertPage.run(
      'refund-policy',
      'سیاست بازگشت وجه',
      `<h2>شرایط استرداد و بازگشت وجه</h2><p>در صورتی که سفارشی به دلیل اتمام موجودی یا عدم امکان فعال‌سازی توسط پشتیبانی لغو شود، کل مبلغ پرداختی بلافاصله به کیف پول کاربر برگشت داده می‌شود و کاربر می‌تواند درخواست واریز بانکی یا خرید محصول جایگزین ثبت نماید.</p>`,
      'سیاست بازگشت وجه | گرگیفت+',
      'قوانین مرجوعی و بازگشت وجه به کیف پول در فروشگاه گرگیفت+',
      now,
      now
    );
    insertPage.run(
      'buying-guide',
      'راهنمای خرید و استفاده',
      `<h2>راهنمای گام‌به‌گام خرید از گرگیفت+</h2><ol><li>محصول و واریانت دلخواه (مثلاً ۱۰ دلاری یا ۶۶۰ یوسی) را انتخاب کنید.</li><li>در صورت نیاز، فیلدهای اختصاصی محصول (مثل ایمیل یا Player ID) را تکمیل نمایید.</li><li>در صفحه تسویه‌حساب، روش پرداخت (کیف پول، درگاه آنلاین یا کارت‌به‌کارت) را انتخاب کنید.</li><li>بلافاصله پس از تأیید پرداخت، کد یا نتیجه تحویل در بخش «سفارش‌های من» قابل مشاهده و کپی است.</li></ol>`,
      'راهنمای خرید | فروشگاه گرگیفت+',
      'آموزش نحوه سفارش و ریدیم کردن گیفت‌کارت در فروشگاه گرگیفت+',
      now,
      now
    );

    // 11. Seed Blog Posts
    const insertPost = db.prepare(`
      INSERT INTO posts (slug, title, excerpt, content_html, is_published, views_count, seo_title, seo_description, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `);
    insertPost.run(
      'how-to-redeem-google-play-gift-card',
      'آموزش کامل ریدیم کردن گیفت‌کارت گوگل‌پلی بدون خطای کشور',
      'نکات کلیدی برای شارژ موفق اکانت گوگل‌پلی آمریکا و رفع ارور تغییر ریجن در اندروید.',
      `<p>برای استفاده از گیفت‌کارت گوگل‌پلی آمریکا، ابتدا مطمئن شوید که Country/Region پروفایل پرداخت گوگل شما روی United States تنظیم شده باشد. سپس کد ۱۶ رقمی دریافتی از گرگیفت+ را در بخش Payments & Subscriptions وارد نمایید.</p>`,
      142,
      'آموزش ریدیم کردن گیفت کارت گوگل پلی | بلاگ گرگیفت+',
      'راهنمای تصویری و گام به گام استفاده از گیفت کارت گوگل پلی آمریکا',
      now,
      now
    );
    insertPost.run(
      'chatgpt-plus-vs-claude-pro-comparison',
      'مقایسه اشتراک ChatGPT Plus و Claude Pro؛ کدام برای شما بهتر است؟',
      'بررسی دقیق امکانات، سرعت کدنویسی و تحلیل متن در دو هوش مصنوعی برتر دنیا.',
      `<p>اگر تمرکز اصلی شما روی برنامه‌نویسی، ریفکتور کدهای سنگین و نگارش متون طبیعی است، <strong>Claude Pro</strong> عملکرد کم‌نظیری دارد. در مقابل، اگر به ساخت تصویر، جستجوی وب زنده و حالت صوتی پیشرفته نیاز دارید، <strong>ChatGPT Plus</strong> انتخاب کامل‌تری است.</p>`,
      218,
      'مقایسه ChatGPT Plus و Claude Pro | بلاگ گرگیفت+',
      'کدام اشتراک هوش مصنوعی ارزش خرید بیشتری دارد؟ مقایسه کامل در گرگیفت+',
      now,
      now
    );

    // 12. Seed Header & Footer Menus
    const insertMenu = db.prepare(`
      INSERT INTO menus (location, title, url, parent_id, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, NULL, ?, 1, ?, ?)
    `);
    insertMenu.run('header', 'صفحه اصلی', '/', 1, now, now);
    insertMenu.run('header', 'گیفت‌کارت‌ها', '/products?category=gift-cards', 2, now, now);
    insertMenu.run('header', 'اشتراک هوش مصنوعی', '/products?category=ai-subscriptions', 3, now, now);
    insertMenu.run('header', 'شارژ بازی‌ها', '/products?category=game-topup', 4, now, now);
    insertMenu.run('header', 'راهنمای خرید', '/page/buying-guide', 5, now, now);

    insertMenu.run('footer', 'درباره گرگیفت+', '/page/about-us', 1, now, now);
    insertMenu.run('footer', 'تماس با ما', '/page/contact-us', 2, now, now);
    insertMenu.run('footer', 'قوانین و مقررات', '/page/terms', 3, now, now);
    insertMenu.run('footer', 'سیاست بازگشت وجه', '/page/refund-policy', 4, now, now);
    insertMenu.run('footer', 'حریم خصوصی', '/page/privacy', 5, now, now);

    // 13. Seed 5 Sample Orders with different statuses
    const insertOrder = db.prepare(`
      INSERT INTO orders (
        order_number, user_id, status, subtotal_toman, discount_toman,
        gateway_fee_toman, final_toman, payment_method, customer_note,
        delivery_result_text, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `);
    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, variant_id, product_title_snapshot, variant_title_snapshot,
        unit_price_toman, cost_price_toman, qty, total_price_toman, delivery_type,
        custom_fields_json, delivered_codes_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
    `);
    const insertOrderEvent = db.prepare(`
      INSERT INTO order_events (order_id, status, actor_type, actor_id, description, created_at)
      VALUES (?, ?, 'system', ?, ?, ?)
    `);
    const insertPayment = db.prepare(`
      INSERT INTO payments (
        user_id, order_id, purpose, method, amount_toman, status, tracking_code, destination_card, created_at, updated_at
      ) VALUES (?, ?, 'order', ?, ?, ?, ?, ?, ?, ?)
    `);

    const sampleOrders = [
      {
        num: 'GG-100241',
        status: 'delivered',
        price: 731000,
        cost: 660000,
        method: 'wallet',
        pTitle: 'گیفت‌کارت گوگل‌پلی (Google Play)',
        vTitle: '۱۰ دلاری آمریکا',
        delivType: 'auto_code',
        codes: [encryptCode('TEST-GPLAY-DELIVERED-9988')],
        resultText: 'کد گیفت‌کارت به صورت خودکار تحویل داده شد.',
        fields: {},
      },
      {
        num: 'GG-100242',
        status: 'pending_verification',
        price: 1390000,
        cost: 1320000,
        method: 'card_to_card',
        pTitle: 'اشتراک چت‌جی‌پی‌تی پلاس (ChatGPT Plus - OpenAI)',
        vTitle: '۱ ماهه (اکانت اختصاصی روی ایمیل شما)',
        delivType: 'subscription',
        codes: [],
        resultText: null,
        fields: { account_email: 'ali@example.com', activation_method: 'ارسال لینک پرداخت اختصاصی' },
      },
      {
        num: 'GG-100243',
        status: 'processing',
        price: 689000,
        cost: 650000,
        method: 'zarinpal',
        pTitle: 'خرید یوسی پابجی موبایل (PUBG Mobile UC)',
        vTitle: '۶۶۰ یوسی پابجی موبایل (مناسب رویال‌پس)',
        delivType: 'manual_id',
        codes: [],
        resultText: null,
        fields: { player_id: '5192837465', player_name: 'AliSniperIR' },
      },
      {
        num: 'GG-100244',
        status: 'waiting_stock',
        price: 1830000,
        cost: 1660000,
        method: 'wallet',
        pTitle: 'گیفت‌کارت اپل آیتونز (Apple / iTunes)',
        vTitle: '۲۵ دلاری اپل',
        delivType: 'auto_code',
        codes: [],
        resultText: null,
        fields: {},
      },
      {
        num: 'GG-100245',
        status: 'cancelled',
        price: 366000,
        cost: 330000,
        method: 'card_to_card',
        pTitle: 'گیفت‌کارت گوگل‌پلی (Google Play)',
        vTitle: '۵ دلاری آمریکا',
        delivType: 'auto_code',
        codes: [],
        resultText: 'مهلت پرداخت منقضی شد و سفارش لغو گردید.',
        fields: {},
      },
    ];

    sampleOrders.forEach((so, idx) => {
      const oRes = insertOrder.run(
        so.num,
        customerId!,
        so.status,
        so.price,
        0,
        so.price,
        so.method,
        'سفارش نمونه سیستم',
        so.resultText,
        now,
        now
      );
      const oid = Number(oRes.lastInsertRowid);
      insertOrderItem.run(
        oid,
        firstProductIds[idx] || firstProductIds[0],
        firstVariantIds[idx] || firstVariantIds[0],
        so.pTitle,
        so.vTitle,
        so.price,
        so.cost,
        so.price,
        so.delivType,
        JSON.stringify(so.fields),
        JSON.stringify(so.codes),
        now,
        now
      );
      insertOrderEvent.run(oid, so.status, customerId!, `ثبت و به‌روزرسانی وضعیت به ${so.status}`, now);
      insertPayment.run(
        customerId!,
        oid,
        so.method,
        so.price,
        so.status === 'delivered' || so.status === 'processing' || so.status === 'waiting_stock'
          ? 'paid'
          : so.status === 'pending_verification'
          ? 'pending_review'
          : 'failed',
        `TRK-${900100 + idx}`,
        '6219-8610-0000-0000',
        now,
        now
      );
    });

    // 14. Seed Price Rate History
    db.prepare(`
      INSERT INTO price_rate_history (old_rate, new_rate, admin_id, note, created_at)
      VALUES (68000, 69000, ?, 'نرخ نمونه اولیه هنگام راه‌اندازی سیستم', ?)
    `).run(adminId!, now);

    // 15. Seed sample ticket
    const ticketRes = db
      .prepare(`
        INSERT INTO tickets (user_id, subject, department, priority, status, created_at, updated_at)
        VALUES (?, 'سوال درباره فعال‌سازی اشتراک ChatGPT Plus', 'پشتیبانی فنی', 'high', 'answered', ?, ?)
      `)
      .run(customerId!, now, now);
    const tid = Number(ticketRes.lastInsertRowid);
    db.prepare(`
      INSERT INTO ticket_messages (ticket_id, sender_id, is_admin, message, created_at)
      VALUES (?, ?, 0, 'سلام، برای فعال‌سازی اشتراک روی ایمیل شخصی نیازی به ارسال رمز جیمیل هست؟', ?)
    `).run(tid, customerId!, now);
    db.prepare(`
      INSERT INTO ticket_messages (ticket_id, sender_id, is_admin, message, created_at)
      VALUES (?, ?, 1, 'سلام وقت بخیر؛ خیر اصلاً نیازی به رمز جیمیل شما نیست. لینک پرداخت رسمی برای شما ارسال می‌شود.', ?)
    `).run(tid, adminId!, now);
  });
}

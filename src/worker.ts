/**
 * Cloudflare Worker + Durable Object (Built-in SQLite) Entry Point for GarGift+
 * 100% Web-Standard / Edge-safe: Zero imports of node:fs or src/server/db.ts.
 */
import crypto from 'node:crypto';
import {
  toEnglishDigits,
  maskGiftCode,
  calculateVariantPrice,
} from './utils/format';

export interface Env {
  GARGIFT_STORE: any;
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  JWT_SECRET?: string;
  CODES_ENCRYPTION_KEY?: string;
  ADMIN_PHONE?: string;
  ADMIN_EMAIL?: string;
  ADMIN_INITIAL_PASSWORD?: string;
}

const DEFAULT_SETTINGS: Record<string, any> = {
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

const DEFAULT_DEV_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const AUTH_COOKIE_NAME = 'gargift_token';

function getKeyBuffer(envKey?: string): Buffer {
  const raw = envKey || DEFAULT_DEV_KEY;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptCode(plainText: string, envKey?: string): string {
  const key = getKeyBuffer(envKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptCode(encryptedPayload: string, envKey?: string): string {
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) return encryptedPayload;
    const [ivHex, authTagHex, cipherHex] = parts;
    const key = getKeyBuffer(envKey);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(cipherHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return 'INVALID-ENCRYPTED-CODE';
  }
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, keyHex] = storedHash.split(':');
    if (!salt || !keyHex) return false;
    const keyBuffer = Buffer.from(keyHex, 'hex');
    const derivedBuffer = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedBuffer.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
  } catch {
    return false;
  }
}

function hashCodeFingerprint(variantId: number, rawCode: string): string {
  const normalized = rawCode.trim().toUpperCase();
  return crypto.createHash('sha256').update(`${variantId}:${normalized}`).digest('hex');
}

function signJwt(userId: number, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

function verifyJwt(token: string, secret: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return Number(data.sub) || null;
  } catch {
    return null;
  }
}

function safeJsonParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  }
  return out;
}

/**
 * Durable Object with built-in SQLite storage (`ctx.storage.sql`)
 */
export class GarGiftStoreDO {
  private sql: any;
  private env: Env;
  private initialized = false;

  constructor(ctx: any, env: Env) {
    this.sql = ctx.storage.sql;
    this.env = env;
  }

  private queryAll(query: string, ...params: any[]): any[] {
    return Array.from(this.sql.exec(query, ...params));
  }

  private queryOne(query: string, ...params: any[]): any | undefined {
    const rows = Array.from(this.sql.exec(query, ...params));
    return rows[0];
  }

  private ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        permissions TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        custom_role_id INTEGER,
        status TEXT NOT NULL DEFAULT 'active',
        ban_reason TEXT,
        wallet_balance INTEGER NOT NULL DEFAULT 0,
        referral_code TEXT UNIQUE,
        referred_by_id INTEGER,
        admin_note TEXT,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        deleted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        parent_id INTEGER,
        icon TEXT,
        image_url TEXT,
        description TEXT,
        usd_rate_override INTEGER,
        margin_percent_override REAL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        seo_title TEXT,
        seo_description TEXT,
        deleted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        category_id INTEGER NOT NULL,
        brand TEXT NOT NULL,
        region TEXT NOT NULL DEFAULT 'Global',
        short_description TEXT,
        description_html TEXT,
        usage_instructions_html TEXT,
        images_json TEXT NOT NULL DEFAULT '[]',
        badges_json TEXT NOT NULL DEFAULT '[]',
        delivery_type TEXT NOT NULL DEFAULT 'auto_code',
        delivery_time_text TEXT NOT NULL DEFAULT 'تحویل آنی و خودکار',
        faqs_json TEXT NOT NULL DEFAULT '[]',
        is_featured INTEGER NOT NULL DEFAULT 0,
        is_sample INTEGER NOT NULL DEFAULT 0,
        usd_rate_override INTEGER,
        margin_percent_override REAL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        seo_title TEXT,
        seo_description TEXT,
        deleted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS product_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        pricing_mode TEXT NOT NULL DEFAULT 'dynamic',
        fixed_price_toman INTEGER NOT NULL DEFAULT 0,
        usd_price_cents INTEGER NOT NULL DEFAULT 0,
        cost_price_toman INTEGER NOT NULL DEFAULT 0,
        discount_percent INTEGER NOT NULL DEFAULT 0,
        discount_amount_toman INTEGER NOT NULL DEFAULT 0,
        discount_start_at TEXT,
        discount_end_at TEXT,
        min_qty INTEGER NOT NULL DEFAULT 1,
        max_qty INTEGER NOT NULL DEFAULT 10,
        stock_mode TEXT NOT NULL DEFAULT 'code_pool',
        stock_qty INTEGER NOT NULL DEFAULT 0,
        low_stock_threshold INTEGER NOT NULL DEFAULT 3,
        delivery_type_override TEXT,
        duration_months INTEGER,
        subscription_mode TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS product_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        field_key TEXT NOT NULL,
        field_type TEXT NOT NULL DEFAULT 'text',
        options_json TEXT NOT NULL DEFAULT '[]',
        is_required INTEGER NOT NULL DEFAULT 1,
        validation_regex TEXT,
        help_text TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        variant_id INTEGER NOT NULL,
        code_encrypted TEXT NOT NULL,
        code_masked TEXT NOT NULL,
        code_fingerprint TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'available',
        order_id INTEGER,
        order_item_id INTEGER,
        batch_id TEXT,
        reserved_at TEXT,
        sold_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        discount_type TEXT NOT NULL DEFAULT 'percent',
        discount_value INTEGER NOT NULL,
        min_order_toman INTEGER NOT NULL DEFAULT 0,
        max_discount_toman INTEGER NOT NULL DEFAULT 0,
        usage_limit INTEGER NOT NULL DEFAULT 100,
        per_user_limit INTEGER NOT NULL DEFAULT 1,
        used_count INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_payment',
        subtotal_toman INTEGER NOT NULL,
        discount_toman INTEGER NOT NULL DEFAULT 0,
        gateway_fee_toman INTEGER NOT NULL DEFAULT 0,
        final_toman INTEGER NOT NULL,
        coupon_id INTEGER,
        coupon_code TEXT,
        payment_method TEXT NOT NULL,
        customer_note TEXT,
        admin_note TEXT,
        delivery_result_text TEXT,
        delivery_result_image TEXT,
        is_suspicious INTEGER NOT NULL DEFAULT 0,
        suspicious_reason TEXT,
        idempotency_key TEXT UNIQUE,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        variant_id INTEGER NOT NULL,
        product_title_snapshot TEXT NOT NULL,
        variant_title_snapshot TEXT NOT NULL,
        unit_price_toman INTEGER NOT NULL,
        cost_price_toman INTEGER NOT NULL DEFAULT 0,
        qty INTEGER NOT NULL,
        total_price_toman INTEGER NOT NULL,
        delivery_type TEXT NOT NULL,
        custom_fields_json TEXT NOT NULL DEFAULT '{}',
        delivered_codes_json TEXT NOT NULL DEFAULT '[]',
        delivery_note TEXT,
        subscription_start_at TEXT,
        subscription_end_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS order_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        actor_type TEXT NOT NULL,
        actor_id INTEGER,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        order_id INTEGER,
        purpose TEXT NOT NULL DEFAULT 'order',
        method TEXT NOT NULL,
        amount_toman INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        receipt_image_url TEXT,
        tracking_code TEXT,
        authority TEXT,
        ref_id TEXT,
        destination_card TEXT,
        crypto_tx_id TEXT,
        reject_reason TEXT,
        reviewed_by INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount_toman INTEGER NOT NULL,
        balance_after_toman INTEGER NOT NULL,
        reference_type TEXT,
        reference_id INTEGER,
        description TEXT NOT NULL,
        admin_id INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS coupon_usages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coupon_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        order_id INTEGER NOT NULL,
        discount_amount_toman INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        order_id INTEGER,
        rating INTEGER NOT NULL,
        comment TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_reply TEXT,
        is_verified_buyer INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        order_id INTEGER,
        subject TEXT NOT NULL,
        department TEXT NOT NULL DEFAULT 'پشتیبانی فنی',
        priority TEXT NOT NULL DEFAULT 'normal',
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        is_admin INTEGER NOT NULL DEFAULT 0,
        message TEXT NOT NULL,
        attachment_url TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        is_admin_target INTEGER NOT NULL DEFAULT 0,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        link TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS banners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        subtitle TEXT,
        badge_text TEXT,
        cta_text TEXT,
        link_url TEXT NOT NULL DEFAULT '/products',
        image_url TEXT,
        gradient_class TEXT NOT NULL DEFAULT 'from-indigo-600 via-violet-600 to-cyan-500',
        position TEXT NOT NULL DEFAULT 'hero',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS menus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location TEXT NOT NULL DEFAULT 'header',
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        parent_id INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content_html TEXT NOT NULL,
        seo_title TEXT,
        seo_description TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        excerpt TEXT,
        content_html TEXT NOT NULL,
        cover_image TEXT,
        is_published INTEGER NOT NULL DEFAULT 1,
        views_count INTEGER NOT NULL DEFAULT 0,
        seo_title TEXT,
        seo_description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS faqs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'عمومی',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS price_rate_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        old_rate INTEGER NOT NULL,
        new_rate INTEGER NOT NULL,
        admin_id INTEGER,
        note TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER,
        admin_name TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        before_json TEXT,
        after_json TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS favorites (
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, product_id)
      );
    `);

    const existing = this.queryOne("SELECT key FROM settings WHERE key = 'general'");
    if (existing) return;

    const now = new Date().toISOString();
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      this.sql.exec(
        'INSERT OR IGNORE INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)',
        k,
        JSON.stringify(v),
        now
      );
    }

    this.sql.exec(
      "INSERT OR IGNORE INTO roles (name, slug, permissions, created_at, updated_at) VALUES ('مدیرکل', 'super_admin', '[\"*\"]', ?, ?)",
      now,
      now
    );

    const adminPhone = this.env.ADMIN_PHONE || '09120000000';
    const adminEmail = this.env.ADMIN_EMAIL || 'admin@gargift.ir';
    const adminPass = this.env.ADMIN_INITIAL_PASSWORD || 'Admin@123456';

    this.sql.exec(
      `INSERT OR IGNORE INTO users (name, phone, email, password_hash, role, status, wallet_balance, referral_code, created_at, updated_at)
       VALUES ('مدیرکل گرگیفت+', ?, ?, ?, 'super_admin', 'active', 5000000, 'ADMINPLUS', ?, ?)`,
      adminPhone,
      adminEmail,
      hashPassword(adminPass),
      now,
      now
    );

    this.sql.exec(
      `INSERT OR IGNORE INTO users (name, phone, email, password_hash, role, status, wallet_balance, referral_code, created_at, updated_at)
       VALUES ('علی محمدی (مشتری نمونه)', '09121112233', 'ali@example.com', ?, 'customer', 'active', 2500000, 'ALI2026', ?, ?)`,
      hashPassword('User@123456'),
      now,
      now
    );

    // Seed 3 Categories
    this.sql.exec(
      `INSERT INTO categories (id, name, slug, icon, description, sort_order, is_active, created_at, updated_at)
       VALUES
       (1, 'گیفت‌کارت‌ها', 'gift-cards', 'Gift', 'گوگل‌پلی، اپل، استیم، پلی‌استیشن، ایکس‌باکس و آمازون با تحویل آنی', 1, 1, ?, ?),
       (2, 'اشتراک‌های هوش مصنوعی', 'ai-subscriptions', 'Cpu', 'ChatGPT Plus، Claude Pro، Gemini Advanced، Midjourney و Cursor', 2, 1, ?, ?),
       (3, 'شارژ درون‌برنامه‌ای بازی‌ها', 'game-topup', 'Gamepad2', 'یوسی پابجی موبایل، سی‌پی کالاف دیوتی، جم فری‌فایر و ولورانت', 3, 1, ?, ?)`,
      now,
      now,
      now,
      now,
      now,
      now
    );

    // Seed Products & Variants
    const seedProds = [
      {
        id: 1,
        title: 'گیفت‌کارت گوگل‌پلی (Google Play)',
        slug: 'google-play-gift-card-us',
        catId: 1,
        brand: 'Google Play',
        region: 'آمریکا (USA)',
        deliv: 'auto_code',
        time: 'تحویل آنی و خودکار',
        variants: [
          { title: '۵ دلاری آمریکا', usd: 500, cost: 330000, disc: 0, mode: 'code_pool', qty: 4 },
          { title: '۱۰ دلاری آمریکا', usd: 1000, cost: 660000, disc: 5, mode: 'code_pool', qty: 4 },
          { title: '۲۵ دلاری آمریکا', usd: 2500, cost: 1650000, disc: 0, mode: 'code_pool', qty: 3 },
        ],
      },
      {
        id: 2,
        title: 'گیفت‌کارت اپل آیتونز (Apple / iTunes)',
        slug: 'apple-itunes-gift-card-us',
        catId: 1,
        brand: 'Apple',
        region: 'آمریکا (USA)',
        deliv: 'auto_code',
        time: 'تحویل آنی و خودکار',
        variants: [
          { title: '۱۰ دلاری اپل', usd: 1000, cost: 665000, disc: 0, mode: 'code_pool', qty: 4 },
          { title: '۲۵ دلاری اپل', usd: 2500, cost: 1660000, disc: 4, mode: 'code_pool', qty: 3 },
        ],
      },
      {
        id: 3,
        title: 'گیفت‌کارت استیم والت (Steam Wallet)',
        slug: 'steam-wallet-gift-card-global',
        catId: 1,
        brand: 'Steam',
        region: 'گلوبال / آمریکا',
        deliv: 'auto_code',
        time: 'تحویل آنی و خودکار',
        variants: [
          { title: '۱۰ دلاری استیم', usd: 1000, cost: 675000, disc: 0, mode: 'code_pool', qty: 3 },
          { title: '۲۰ دلاری استیم', usd: 2000, cost: 1350000, disc: 5, mode: 'code_pool', qty: 3 },
        ],
      },
      {
        id: 4,
        title: 'اشتراک چت‌جی‌پی‌تی پلاس (ChatGPT Plus - OpenAI)',
        slug: 'chatgpt-plus-subscription',
        catId: 2,
        brand: 'OpenAI',
        region: 'گلوبال',
        deliv: 'subscription',
        time: '۱۵ تا ۶۰ دقیقه',
        variants: [
          { title: '۱ ماهه (اکانت اختصاصی روی ایمیل شما)', usd: 2000, cost: 1320000, disc: 5, mode: 'unlimited', qty: 999 },
          { title: '۳ ماهه (اکانت اختصاصی روی ایمیل شما)', usd: 5800, cost: 3800000, disc: 8, mode: 'unlimited', qty: 999 },
        ],
      },
      {
        id: 5,
        title: 'اشتراک کلود پرو (Claude Pro - Anthropic)',
        slug: 'claude-pro-subscription',
        catId: 2,
        brand: 'Anthropic',
        region: 'گلوبال',
        deliv: 'subscription',
        time: '۲۰ تا ۹۰ دقیقه',
        variants: [
          { title: '۱ ماهه اختصاصی', usd: 2000, cost: 1350000, disc: 6, mode: 'unlimited', qty: 999 },
        ],
      },
      {
        id: 6,
        title: 'خرید یوسی پابجی موبایل (PUBG Mobile UC)',
        slug: 'pubg-mobile-uc-topup',
        catId: 3,
        brand: 'PUBG Mobile',
        region: 'گلوبال (با آیدی عددی)',
        deliv: 'manual_id',
        time: '۵ تا ۲۰ دقیقه',
        variants: [
          { title: '۳۲۵ یوسی پابجی موبایل', usd: 499, cost: 325000, disc: 5, mode: 'unlimited', qty: 999 },
          { title: '۶۶۰ یوسی پابجی موبایل', usd: 999, cost: 650000, disc: 6, mode: 'unlimited', qty: 999 },
        ],
      },
    ];

    let varIdCounter = 1;
    for (const p of seedProds) {
      this.sql.exec(
        `INSERT INTO products (id, title, slug, category_id, brand, region, short_description, description_html, usage_instructions_html, delivery_type, delivery_time_text, is_featured, is_sample, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'active', ?, ?)`,
        p.id,
        p.title,
        p.slug,
        p.catId,
        p.brand,
        p.region,
        `خرید آنلاین و سریع ${p.title} با تضمین اصالت از گرگیفت+`,
        `<p>خرید مطمئن <strong>${p.title}</strong> با تحویل سریع و پشتیبانی ۲۴ ساعته.</p>`,
        `<p>پس از ثبت سفارش، کد یا نتیجه فعال‌سازی در پنل کاربری شما نمایش داده می‌شود.</p>`,
        p.deliv,
        p.time,
        now,
        now
      );

      for (const v of p.variants) {
        const vid = varIdCounter++;
        this.sql.exec(
          `INSERT INTO product_variants (id, product_id, title, pricing_mode, usd_price_cents, cost_price_toman, discount_percent, stock_mode, stock_qty, is_active, created_at, updated_at)
           VALUES (?, ?, ?, 'dynamic', ?, ?, ?, ?, ?, 1, ?, ?)`,
          vid,
          p.id,
          v.title,
          v.usd,
          v.cost,
          v.disc,
          v.mode,
          v.qty,
          now,
          now
        );

        if (v.mode === 'code_pool') {
          for (let c = 1; c <= v.qty; c++) {
            const rawCode = `TEST-${p.brand.slice(0, 4).toUpperCase()}-${vid}0${c}-${1000 + vid * 10 + c}`;
            this.sql.exec(
              `INSERT INTO codes (variant_id, code_encrypted, code_masked, code_fingerprint, status, batch_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'available', 'CF-SEED', ?, ?)`,
              vid,
              encryptCode(rawCode, this.env.CODES_ENCRYPTION_KEY),
              maskGiftCode(rawCode),
              hashCodeFingerprint(vid, rawCode),
              now,
              now
            );
          }
        }
      }
    }

    this.sql.exec(
      `INSERT INTO coupons (code, title, discount_type, discount_value, min_order_toman, max_discount_toman, usage_limit, per_user_limit, is_active, created_at, updated_at)
       VALUES ('GARGIFT5', '۵٪ تخفیف اولین خرید', 'percent', 5, 100000, 150000, 500, 3, 1, ?, ?)`,
      now,
      now
    );

    this.sql.exec(
      `INSERT INTO faqs (question, answer, category, sort_order, is_active, created_at, updated_at)
       VALUES ('کدهای گیفت‌کارت چطور تحویل داده می‌شوند؟', 'بلافاصله پس از پرداخت از انبار کد رمزنگاری‌شده استخراج و در صفحه سفارش نمایش داده می‌شوند.', 'عمومی', 1, 1, ?, ?)`,
      now,
      now
    );
  }

  private getAllSettings(): Record<string, any> {
    const rows = this.queryAll('SELECT key, value_json FROM settings');
    const out: Record<string, any> = { ...DEFAULT_SETTINGS };
    for (const r of rows) {
      out[r.key] = safeJsonParse(r.value_json, out[r.key]);
    }
    return out;
  }

  private getEnrichedProducts() {
    const settings = this.getAllSettings();
    const cats = this.queryAll('SELECT * FROM categories WHERE deleted_at IS NULL');
    const catMap = new Map(cats.map((c) => [c.id, c]));
    const prods = this.queryAll("SELECT * FROM products WHERE deleted_at IS NULL AND status = 'active' ORDER BY sort_order ASC, id ASC");
    const vars = this.queryAll('SELECT * FROM product_variants WHERE is_active = 1 ORDER BY id ASC');
    const fields = this.queryAll('SELECT * FROM product_fields ORDER BY id ASC');

    return prods.map((p) => {
      const cat = catMap.get(p.category_id);
      const pVars = vars
        .filter((v) => v.product_id === p.id)
        .map((v) => {
          let stock = v.stock_qty;
          if (v.stock_mode === 'code_pool') {
            const cRow = this.queryOne(
              "SELECT COUNT(*) as c FROM codes WHERE variant_id = ? AND status = 'available'",
              v.id
            );
            stock = Number(cRow?.c || 0);
          } else if (v.stock_mode === 'unlimited') {
            stock = 999;
          }
          const calc = calculateVariantPrice({
            pricingMode: v.pricing_mode,
            fixedPriceToman: v.fixed_price_toman,
            usdPriceCents: v.usd_price_cents,
            globalUsdRate: Number(settings.pricing?.globalUsdRate || 69000),
            globalMarginPercent: Number(settings.pricing?.globalMarginPercent ?? 6),
            roundingStepToman: Number(settings.pricing?.roundingStepToman || 1000),
            discountPercent: v.discount_percent,
          });
          return {
            ...v,
            available_stock: stock,
            in_stock: stock > 0,
            base_price_toman: calc.basePriceToman,
            final_price_toman: calc.finalPriceToman,
            discount_percent_calculated: calc.discountPercent,
            is_discount_active: calc.isDiscountActive,
          };
        });

      return {
        ...p,
        category_name: cat?.name || '',
        category_slug: cat?.slug || '',
        images: safeJsonParse(p.images_json, []),
        badges: safeJsonParse(p.badges_json, []),
        faqs: safeJsonParse(p.faqs_json, []),
        variants: pVars,
        fields: fields.filter((f) => f.product_id === p.id),
        starting_price_toman: pVars.length ? Math.min(...pVars.map((v) => v.final_price_toman)) : 0,
        max_discount_percent: pVars.length ? Math.max(...pVars.map((v) => v.discount_percent_calculated || 0)) : 0,
        in_stock: pVars.some((v) => v.in_stock),
      };
    });
  }

  async fetch(request: Request): Promise<Response> {
    this.ensureInitialized();
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();
    const jwtSecret = this.env.JWT_SECRET || 'cf_worker_jwt_secret_gargift_plus_2026';

    const cookies = parseCookies(request.headers.get('Cookie'));
    const token = cookies[AUTH_COOKIE_NAME];
    const userId = token ? verifyJwt(token, jwtSecret) : null;
    const currentUser = userId
      ? this.queryOne(
          'SELECT id, name, phone, email, role, status, wallet_balance, referral_code FROM users WHERE id = ? AND deleted_at IS NULL',
          userId
        )
      : null;

    const jsonRes = (data: any, status = 200, extraHeaders?: Record<string, string>) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...(extraHeaders || {}),
        },
      });

    try {
      if (path === '/api/bootstrap' && method === 'GET') {
        const settings = this.getAllSettings();
        return jsonRes({
          ok: true,
          data: {
            user: currentUser
              ? { ...currentUser, permissions: currentUser.role === 'super_admin' ? ['*'] : [] }
              : null,
            favorites: [],
            unreadNotifications: 0,
            settings,
            categories: this.queryAll('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC'),
            menus: this.queryAll('SELECT * FROM menus WHERE is_active = 1 ORDER BY sort_order ASC'),
            banners: this.queryAll('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC'),
            faqs: this.queryAll('SELECT * FROM faqs WHERE is_active = 1 ORDER BY sort_order ASC'),
            posts: this.queryAll('SELECT * FROM posts WHERE is_published = 1 ORDER BY id DESC'),
            reviews: this.queryAll("SELECT r.*, u.name as user_name, p.title as product_title FROM reviews r JOIN users u ON u.id = r.user_id JOIN products p ON p.id = r.product_id WHERE r.status = 'approved'"),
          },
        });
      }

      if (path === '/api/products' && method === 'GET') {
        let list = this.getEnrichedProducts();
        const cat = url.searchParams.get('category');
        const q = url.searchParams.get('search');
        if (cat) list = list.filter((p) => p.category_slug === cat);
        if (q) list = list.filter((p) => p.title.includes(q) || p.brand.toLowerCase().includes(q.toLowerCase()));
        return jsonRes({ ok: true, data: list });
      }

      if (path.startsWith('/api/products/') && method === 'GET') {
        const slug = decodeURIComponent(path.replace('/api/products/', ''));
        const all = this.getEnrichedProducts();
        const product = all.find((p) => p.slug === slug || String(p.id) === slug);
        if (!product) return jsonRes({ ok: false, error: 'محصول یافت نشد' }, 404);
        return jsonRes({
          ok: true,
          data: {
            product,
            reviews: [],
            related: all.filter((p) => p.category_id === product.category_id && p.id !== product.id).slice(0, 4),
          },
        });
      }

      if (path === '/api/auth/login' && method === 'POST') {
        const body: any = await request.json();
        const idf = toEnglishDigits(String(body.identifier || '').trim());
        const u = this.queryOne(
          'SELECT * FROM users WHERE (phone = ? OR lower(email) = lower(?)) AND deleted_at IS NULL',
          idf,
          idf
        );
        if (!u || !verifyPassword(String(body.password || ''), u.password_hash)) {
          return jsonRes({ ok: false, error: 'مشخصات ورود یا رمز عبور اشتباه است.' }, 401);
        }
        const signed = signJwt(u.id, jwtSecret);
        return jsonRes(
          {
            ok: true,
            data: {
              user: {
                id: u.id,
                name: u.name,
                phone: u.phone,
                email: u.email,
                role: u.role,
                wallet_balance: u.wallet_balance,
                permissions: u.role === 'super_admin' ? ['*'] : [],
              },
            },
          },
          200,
          {
            'Set-Cookie': `${AUTH_COOKIE_NAME}=${signed}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`,
          }
        );
      }

      if (path === '/api/auth/logout' && method === 'POST') {
        return jsonRes({ ok: true, data: { loggedOut: true } }, 200, {
          'Set-Cookie': `${AUTH_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
        });
      }

      if (path === '/api/orders' && method === 'POST') {
        if (!currentUser) return jsonRes({ ok: false, error: 'لطفاً ابتدا وارد حساب شوید.' }, 401);
        const body: any = await request.json();
        const allProds = this.getEnrichedProducts();
        const now = new Date().toISOString();
        let subtotal = 0;
        const resolvedItems: any[] = [];

        for (const it of body.items || []) {
          const p = allProds.find((x) => x.id === Number(it.productId));
          const v = p?.variants.find((x: any) => x.id === Number(it.variantId));
          if (!p || !v) return jsonRes({ ok: false, error: 'محصول نامعتبر است' }, 400);
          const line = v.final_price_toman * Number(it.qty || 1);
          subtotal += line;
          resolvedItems.push({ p, v, qty: Number(it.qty || 1), line, customFields: it.customFields || {} });
        }

        const orderNumber = `GG-${Math.floor(100000 + Math.random() * 899999)}`;
        if (body.paymentMethod === 'wallet') {
          if (currentUser.wallet_balance < subtotal) {
            return jsonRes({ ok: false, error: 'موجودی کیف پول کافی نیست.' }, 400);
          }
          const newBal = currentUser.wallet_balance - subtotal;
          this.sql.exec('UPDATE users SET wallet_balance = ?, updated_at = ? WHERE id = ?', newBal, now, currentUser.id);
        }

        this.sql.exec(
          `INSERT INTO orders (order_number, user_id, status, subtotal_toman, discount_toman, gateway_fee_toman, final_toman, payment_method, delivery_result_text, created_at, updated_at)
           VALUES (?, ?, 'delivered', ?, 0, 0, ?, ?, 'کدها به صورت آنی تحویل داده شدند.', ?, ?)`,
          orderNumber,
          currentUser.id,
          subtotal,
          subtotal,
          body.paymentMethod || 'wallet',
          now,
          now
        );

        const ordRow = this.queryOne('SELECT * FROM orders WHERE order_number = ?', orderNumber);

        for (const ri of resolvedItems) {
          const codesRows = this.queryAll(
            "SELECT * FROM codes WHERE variant_id = ? AND status = 'available' LIMIT ?",
            ri.v.id,
            ri.qty
          );
          const encCodes = codesRows.map((c) => {
            this.sql.exec("UPDATE codes SET status = 'sold', order_id = ?, sold_at = ? WHERE id = ?", ordRow.id, now, c.id);
            return c.code_encrypted;
          });
          this.sql.exec(
            `INSERT INTO order_items (order_id, product_id, variant_id, product_title_snapshot, variant_title_snapshot, unit_price_toman, cost_price_toman, qty, total_price_toman, delivery_type, custom_fields_json, delivered_codes_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ordRow.id,
            ri.p.id,
            ri.v.id,
            ri.p.title,
            ri.v.title,
            ri.v.final_price_toman,
            ri.v.cost_price_toman || 0,
            ri.qty,
            ri.line,
            ri.p.delivery_type,
            JSON.stringify(ri.customFields),
            JSON.stringify(encCodes),
            now,
            now
          );
        }

        return jsonRes({ ok: true, data: { order: ordRow } });
      }

      if (path === '/api/account/orders' && method === 'GET') {
        if (!currentUser) return jsonRes({ ok: false, error: 'نیاز به ورود' }, 401);
        const ords = this.queryAll('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', currentUser.id);
        const enriched = ords.map((o) => {
          const items = this.queryAll('SELECT * FROM order_items WHERE order_id = ?', o.id).map((it) => ({
            ...it,
            custom_fields: safeJsonParse(it.custom_fields_json, {}),
            delivered_codes: safeJsonParse(it.delivered_codes_json, []).map((enc: string) =>
              decryptCode(enc, this.env.CODES_ENCRYPTION_KEY)
            ),
          }));
          return { ...o, items };
        });
        return jsonRes({ ok: true, data: enriched });
      }

      if (path === '/api/admin/overview' && method === 'GET') {
        const settings = this.getAllSettings();
        return jsonRes({
          ok: true,
          data: {
            totalSalesToman: 3616000,
            paidOrdersCount: 4,
            totalProfitToman: 340000,
            totalCustomers: 2,
            statusCounts: [],
            actionRequired: { pendingReceipts: 0, waitingStockOrders: 0, openTickets: 0, pendingReviews: 0 },
            lowStockVariants: [],
            recentOrders: [],
            adminNotifications: [],
            salesChart: [
              { day: 'شنبه', sales: 4200000, profit: 380000 },
              { day: 'یکشنبه', sales: 5850000, profit: 510000 },
              { day: 'دوشنبه', sales: 3900000, profit: 340000 },
              { day: 'سه‌شنبه', sales: 7400000, profit: 690000 },
              { day: 'چهارشنبه', sales: 8100000, profit: 760000 },
              { day: 'پنج‌شنبه', sales: 11200000, profit: 1050000 },
              { day: 'جمعه', sales: 6450000, profit: 590000 },
            ],
            pricing: settings.pricing,
          },
        });
      }

      if (path === '/api/admin/pricing/usd-rate' && method === 'POST') {
        const body: any = await request.json();
        const newRate = Math.round(Number(toEnglishDigits(String(body.usdRate || 69000))));
        const settings = this.getAllSettings();
        const nextPricing = { ...settings.pricing, globalUsdRate: newRate, isSampleRateWarning: false };
        this.sql.exec(
          'INSERT OR REPLACE INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)',
          'pricing',
          JSON.stringify(nextPricing),
          new Date().toISOString()
        );
        return jsonRes({ ok: true, data: nextPricing });
      }

      if (path === '/api/admin/products' && method === 'GET') {
        return jsonRes({ ok: true, data: this.getEnrichedProducts() });
      }

      if (path === '/api/admin/categories' && method === 'GET') {
        return jsonRes({ ok: true, data: this.queryAll('SELECT * FROM categories ORDER BY sort_order ASC') });
      }

      if (path === '/api/admin/codes' && method === 'GET') {
        const rows = this.queryAll(`
          SELECT c.id, c.variant_id, c.code_masked, c.status, c.order_id, c.batch_id, c.sold_at, c.created_at,
                 pv.title as variant_title, p.title as product_title
          FROM codes c
          JOIN product_variants pv ON pv.id = c.variant_id
          JOIN products p ON p.id = pv.product_id
          ORDER BY c.id DESC LIMIT 200
        `);
        return jsonRes({ ok: true, data: rows });
      }

      if (path === '/api/admin/users' && method === 'GET') {
        return jsonRes({ ok: true, data: this.queryAll('SELECT id, name, phone, email, role, status, wallet_balance, created_at FROM users ORDER BY id DESC') });
      }

      if (path === '/api/admin/settings' && method === 'GET') {
        return jsonRes({ ok: true, data: this.getAllSettings() });
      }

      return jsonRes({ ok: true, data: [] });
    } catch (err: any) {
      return jsonRes({ ok: false, error: err?.message || 'خطای سرور ورکر' }, 500);
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route all /api/* requests to our singleton Durable Object with SQLite
    if (url.pathname.startsWith('/api/') || url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml') {
      const id = env.GARGIFT_STORE.idFromName('global-store-v1');
      const stub = env.GARGIFT_STORE.get(id);
      return stub.fetch(request);
    }

    // Serve React SPA static assets from ./dist
    return env.ASSETS.fetch(request);
  },
};

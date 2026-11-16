import { Router, Request, Response } from 'express';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { db, runInTransaction, DB_PATH } from './db';
import {
  getAllSettings,
  updateSettingKey,
  getEnrichedProducts,
  computeEnrichedVariant,
  fulfillPaidOrder,
  formatOrderWithDetails,
  logAudit,
  createNotification,
  safeJsonParse,
} from './repository';
import {
  signUserToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  requireAdmin,
  loadUserFromId,
} from './auth';
import {
  hashPassword,
  verifyPassword,
  encryptCode,
  decryptCode,
  hashCodeFingerprint,
} from './crypto';
import { toEnglishDigits, maskGiftCode } from '../utils/format';

export const apiRouter = Router();

// Configure Multer for secure image uploads
const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads');
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.webp';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(ext) ? ext : '.png';
    const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|svg\+xml)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('فقط فایل‌های تصویری (JPG, PNG, WebP) مجاز هستند.'));
    }
  },
});

// ==========================================
// 1. PUBLIC BOOTSTRAP & STOREFRONT ENDPOINTS
// ==========================================

apiRouter.get('/bootstrap', (req: Request, res: Response) => {
  const settings = getAllSettings();
  const categories = db
    .prepare(
      'SELECT * FROM categories WHERE deleted_at IS NULL AND is_active = 1 ORDER BY sort_order ASC, id ASC'
    )
    .all();
  const menus = db
    .prepare('SELECT * FROM menus WHERE is_active = 1 ORDER BY sort_order ASC, id ASC')
    .all();
  const banners = db
    .prepare('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC, id ASC')
    .all();
  const faqs = db
    .prepare('SELECT * FROM faqs WHERE is_active = 1 ORDER BY sort_order ASC, id ASC')
    .all();
  const posts = db
    .prepare(
      'SELECT id, slug, title, excerpt, cover_image, views_count, created_at FROM posts WHERE is_published = 1 ORDER BY id DESC LIMIT 4'
    )
    .all();
  const reviews = db
    .prepare(`
      SELECT r.*, u.name as user_name, p.title as product_title, p.slug as product_slug
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      JOIN products p ON p.id = r.product_id
      WHERE r.status = 'approved'
      ORDER BY r.id DESC LIMIT 8
    `)
    .all();

  let favorites: number[] = [];
  let unreadNotifications = 0;
  if (req.user) {
    const favRows = db
      .prepare('SELECT product_id FROM favorites WHERE user_id = ?')
      .all(req.user.id) as Array<{ product_id: number }>;
    favorites = favRows.map((f) => f.product_id);

    const notifCount = db
      .prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0')
      .get(req.user.id) as { c: number };
    unreadNotifications = Number(notifCount?.c || 0);
  }

  // Strip sensitive gateway keys from public settings
  const publicPayment = {
    walletEnabled: settings.payment?.walletEnabled,
    cardToCardEnabled: settings.payment?.cardToCardEnabled,
    cards: (settings.payment?.cards || []).filter((c: any) => c.isActive),
    zarinpalEnabled: settings.payment?.zarinpalEnabled && !!settings.payment?.zarinpalMerchantId,
    zibalEnabled: settings.payment?.zibalEnabled && !!settings.payment?.zibalMerchantId,
    cryptoEnabled: settings.payment?.cryptoEnabled,
    cryptoNetwork: settings.payment?.cryptoNetwork,
    cryptoWalletAddress: settings.payment?.cryptoWalletAddress,
    paymentTimeoutMinutes: settings.payment?.paymentTimeoutMinutes || 30,
    gatewayFeePercent: settings.payment?.gatewayFeePercent || 0,
    minOrderToman: settings.payment?.minOrderToman || 10000,
    maxOrderToman: settings.payment?.maxOrderToman || 100000000,
  };

  res.json({
    ok: true,
    data: {
      user: req.user || null,
      favorites,
      unreadNotifications,
      settings: {
        general: settings.general,
        theme: settings.theme,
        pricing: {
          globalUsdRate: settings.pricing?.globalUsdRate,
          loyaltyCashbackPercent: settings.pricing?.loyaltyCashbackPercent,
          referralRewardPercent: settings.pricing?.referralRewardPercent,
        },
        payment: publicPayment,
        homepageLayout: settings.homepageLayout,
      },
      categories,
      menus,
      banners,
      faqs,
      posts,
      reviews,
    },
  });
});

apiRouter.get('/products', (req: Request, res: Response) => {
  const categorySlug = typeof req.query.category === 'string' ? req.query.category : undefined;
  const brand = typeof req.query.brand === 'string' ? req.query.brand : undefined;
  const region = typeof req.query.region === 'string' ? req.query.region : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const sort = typeof req.query.sort === 'string' ? req.query.sort : undefined;
  const onlyInStock = req.query.inStock === 'true';
  const onlyDiscounted = req.query.discounted === 'true';
  const featuredOnly = req.query.featured === 'true';
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;

  const products = getEnrichedProducts({
    categorySlug,
    brand,
    region,
    search,
    sort,
    onlyInStock,
    onlyDiscounted,
    featuredOnly,
    minPrice,
    maxPrice,
  });

  res.json({ ok: true, data: products });
});

apiRouter.get('/products/:slug', (req: Request, res: Response) => {
  const all = getEnrichedProducts();
  const product = all.find((p) => p.slug === req.params.slug || String(p.id) === req.params.slug);
  if (!product) {
    res.status(404).json({ ok: false, error: 'محصول مورد نظر یافت نشد.' });
    return;
  }

  const reviews = db
    .prepare(`
      SELECT r.*, u.name as user_name
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ? AND r.status = 'approved'
      ORDER BY r.id DESC
    `)
    .all(product.id);

  const related = all
    .filter((p) => p.category_id === product.category_id && p.id !== product.id)
    .slice(0, 4);

  res.json({
    ok: true,
    data: {
      product,
      reviews,
      related,
    },
  });
});

apiRouter.get('/pages/:slug', (req: Request, res: Response) => {
  const page = db
    .prepare('SELECT * FROM pages WHERE slug = ? AND is_active = 1')
    .get(req.params.slug);
  if (!page) {
    res.status(404).json({ ok: false, error: 'صفحه مورد نظر یافت نشد.' });
    return;
  }
  res.json({ ok: true, data: page });
});

apiRouter.get('/posts', (_req: Request, res: Response) => {
  const posts = db
    .prepare('SELECT * FROM posts WHERE is_published = 1 ORDER BY id DESC')
    .all();
  res.json({ ok: true, data: posts });
});

apiRouter.get('/posts/:slug', (req: Request, res: Response) => {
  const post = db
    .prepare('SELECT * FROM posts WHERE slug = ? AND is_published = 1')
    .get(req.params.slug) as any;
  if (!post) {
    res.status(404).json({ ok: false, error: 'مقاله یافت نشد.' });
    return;
  }
  db.prepare('UPDATE posts SET views_count = views_count + 1 WHERE id = ?').run(post.id);
  res.json({ ok: true, data: post });
});

// ==========================================
// 2. AUTHENTICATION ENDPOINTS
// ==========================================

const loginSchema = z.object({
  identifier: z.string().min(3, 'شماره موبایل یا ایمیل را وارد کنید'),
  password: z.string().min(4, 'رمز عبور را وارد کنید'),
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'اطلاعات نامعتبر' });
    return;
  }

  const identifier = toEnglishDigits(parsed.data.identifier.trim());
  const userRow = db
    .prepare(
      'SELECT * FROM users WHERE (phone = ? OR lower(email) = lower(?)) AND deleted_at IS NULL'
    )
    .get(identifier, identifier) as any;

  if (!userRow) {
    res.status(401).json({ ok: false, error: 'کاربری با این مشخصات یافت نشد.' });
    return;
  }

  if (userRow.status !== 'active') {
    res.status(403).json({
      ok: false,
      error: `حساب کاربری شما مسدود است. دلیل: ${userRow.ban_reason || 'عدم رعایت قوانین'}`,
    });
    return;
  }

  if (userRow.locked_until && new Date(userRow.locked_until).getTime() > Date.now()) {
    res.status(429).json({
      ok: false,
      error: 'حساب شما به دلیل تلاش‌های ناموفق متعدد موقتاً قفل شده است. ۵ دقیقه دیگر تلاش کنید.',
    });
    return;
  }

  const valid = verifyPassword(parsed.data.password, userRow.password_hash);
  if (!valid) {
    const attempts = Number(userRow.failed_login_attempts || 0) + 1;
    const lockedUntil =
      attempts >= 5 ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null;
    db.prepare(
      'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?'
    ).run(attempts, lockedUntil, userRow.id);
    res.status(401).json({ ok: false, error: 'رمز عبور اشتباه است.' });
    return;
  }

  db.prepare(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?'
  ).run(userRow.id);

  const token = signUserToken(userRow.id);
  setAuthCookie(res, token);
  const authUser = loadUserFromId(userRow.id);
  res.json({ ok: true, data: { user: authUser } });
});

const registerSchema = z.object({
  name: z.string().min(2, 'نام و نام خانوادگی حداقل ۲ حرف باشد'),
  phone: z.string().min(10, 'شماره موبایل معتبر وارد کنید'),
  email: z.string().email('ایمیل معتبر نیست').optional().or(z.literal('')),
  password: z.string().min(6, 'رمز عبور باید حداقل ۶ کاراکتر باشد'),
  referralCode: z.string().optional(),
});

apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const settings = getAllSettings();
  if (settings.authAndSms?.registrationOpen === false) {
    res.status(403).json({ ok: false, error: 'ثبت‌نام کاربران جدید موقتاً غیرفعال است.' });
    return;
  }

  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'اطلاعات نامعتبر' });
    return;
  }

  const phone = toEnglishDigits(parsed.data.phone.trim());
  if (!/^09\d{9}$/.test(phone)) {
    res.status(400).json({ ok: false, error: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.' });
    return;
  }

  const email = parsed.data.email ? parsed.data.email.trim().toLowerCase() : null;

  const existing = db
    .prepare('SELECT id FROM users WHERE phone = ? OR (email IS NOT NULL AND email = ?)')
    .get(phone, email);
  if (existing) {
    res.status(409).json({ ok: false, error: 'این شماره موبایل یا ایمیل قبلاً ثبت شده است.' });
    return;
  }

  let referredById: number | null = null;
  if (parsed.data.referralCode) {
    const refUser = db
      .prepare('SELECT id FROM users WHERE referral_code = ?')
      .get(parsed.data.referralCode.trim().toUpperCase()) as { id: number } | undefined;
    if (refUser) referredById = refUser.id;
  }

  const now = new Date().toISOString();
  const myRefCode = `GG${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const result = db
    .prepare(`
      INSERT INTO users (
        name, phone, email, password_hash, role, status,
        wallet_balance, referral_code, referred_by_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'customer', 'active', 0, ?, ?, ?, ?)
    `)
    .run(
      parsed.data.name.trim(),
      phone,
      email,
      hashPassword(parsed.data.password),
      myRefCode,
      referredById,
      now,
      now
    );

  const userId = Number(result.lastInsertRowid);
  const token = signUserToken(userId);
  setAuthCookie(res, token);
  const authUser = loadUserFromId(userId);

  createNotification({
    userId,
    title: 'به گرگیفت+ خوش آمدید!',
    body: 'حساب کاربری شما با موفقیت ساخته شد. برای اولین خرید می‌توانید از کد تخفیف GARGIFT5 استفاده کنید.',
    link: '/products',
  });

  res.json({ ok: true, data: { user: authUser } });
});

apiRouter.post('/auth/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ ok: true, data: { loggedOut: true } });
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  res.json({ ok: true, data: { user: req.user || null } });
});

// ==========================================
// 3. COUPON VALIDATION & CHECKOUT / ORDERS
// ==========================================

apiRouter.post('/coupons/validate', requireAuth, (req: Request, res: Response) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const subtotal = Number(req.body.subtotal || 0);
  if (!code) {
    res.status(400).json({ ok: false, error: 'کد تخفیف را وارد کنید.' });
    return;
  }

  const coupon = db
    .prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1')
    .get(code) as any;

  if (!coupon) {
    res.status(404).json({ ok: false, error: 'کد تخفیف معتبر نیست یا منقضی شده است.' });
    return;
  }

  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    res.status(400).json({ ok: false, error: 'مهلت استفاده از این کد تخفیف به پایان رسیده است.' });
    return;
  }

  if (coupon.used_count >= coupon.usage_limit) {
    res.status(400).json({ ok: false, error: 'ظرفیت استفاده از این کد تخفیف تکمیل شده است.' });
    return;
  }

  if (subtotal < coupon.min_order_toman) {
    res.status(400).json({
      ok: false,
      error: `حداقل مبلغ سبد خرید برای این کد ${coupon.min_order_toman.toLocaleString('en-US')} تومان است.`,
    });
    return;
  }

  const userUsages = db
    .prepare('SELECT COUNT(*) as c FROM coupon_usages WHERE coupon_id = ? AND user_id = ?')
    .get(coupon.id, req.user!.id) as { c: number };
  if (Number(userUsages?.c || 0) >= coupon.per_user_limit) {
    res.status(400).json({ ok: false, error: 'شما قبلاً از این کد تخفیف استفاده کرده‌اید.' });
    return;
  }

  let discountToman = 0;
  if (coupon.discount_type === 'percent') {
    discountToman = Math.round((subtotal * coupon.discount_value) / 100);
    if (coupon.max_discount_toman > 0) {
      discountToman = Math.min(discountToman, coupon.max_discount_toman);
    }
  } else {
    discountToman = Math.min(subtotal, coupon.discount_value);
  }

  res.json({
    ok: true,
    data: {
      couponId: coupon.id,
      code: coupon.code,
      title: coupon.title,
      discountToman,
    },
  });
});

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number(),
        variantId: z.number(),
        qty: z.number().int().min(1).max(20),
        customFields: z.record(z.string(), z.string()).optional(),
      })
    )
    .min(1, 'سبد خرید شما خالی است'),
  paymentMethod: z.enum(['wallet', 'card_to_card', 'zarinpal', 'zibal', 'crypto']),
  couponCode: z.string().optional(),
  customerNote: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

apiRouter.post('/orders', requireAuth, (req: Request, res: Response) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'اطلاعات سفارش نامعتبر است' });
    return;
  }

  const { items, paymentMethod, couponCode, customerNote, idempotencyKey } = parsed.data;
  const userId = req.user!.id;

  // Check idempotency
  if (idempotencyKey) {
    const existingOrder = db
      .prepare('SELECT * FROM orders WHERE idempotency_key = ? AND user_id = ?')
      .get(idempotencyKey, userId) as any;
    if (existingOrder) {
      res.json({
        ok: true,
        data: { order: formatOrderWithDetails(existingOrder, true) },
      });
      return;
    }
  }

  const settings = getAllSettings();
  const maxOpenOrders = Number(settings.payment?.maxOpenOrdersPerUser || 3);
  const openCountRow = db
    .prepare(
      "SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status = 'pending_payment'"
    )
    .get(userId) as { c: number };
  if (Number(openCountRow?.c || 0) >= maxOpenOrders) {
    res.status(400).json({
      ok: false,
      error: `شما ${maxOpenOrders} سفارش پرداخت‌نشده دارید. لطفاً ابتدا آن‌ها را تعیین تکلیف کنید.`,
    });
    return;
  }

  try {
    const createdOrder = runInTransaction(() => {
      const now = new Date().toISOString();
      const timeoutMin = Number(settings.payment?.paymentTimeoutMinutes || 30);
      const expiresAt = new Date(Date.now() + timeoutMin * 60 * 1000).toISOString();

      let subtotalToman = 0;
      const preparedItems: any[] = [];

      for (const reqItem of items) {
        const product = db
          .prepare("SELECT * FROM products WHERE id = ? AND deleted_at IS NULL AND status = 'active'")
          .get(reqItem.productId) as any;
        if (!product) throw new Error('یکی از محصولات سبد خرید یافت نشد یا غیرفعال شده است.');

        const variant = db
          .prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ? AND is_active = 1')
          .get(reqItem.variantId, product.id) as any;
        if (!variant) throw new Error(`واریانت انتخاب‌شده برای ${product.title} معتبر نیست.`);

        const cat = db
          .prepare('SELECT * FROM categories WHERE id = ?')
          .get(product.category_id) as any;

        const enrichedVar = computeEnrichedVariant(variant, product, cat, settings.pricing);

        if (reqItem.qty < variant.min_qty || reqItem.qty > variant.max_qty) {
          throw new Error(`تعداد مجاز برای «${variant.title}» بین ${variant.min_qty} تا ${variant.max_qty} عدد است.`);
        }

        if (enrichedVar.available_stock < reqItem.qty) {
          throw new Error(`موجودی «${product.title} - ${variant.title}» کافی نیست (موجودی فعلی: ${enrichedVar.available_stock}).`);
        }

        // Validate required product fields
        const pFields = db
          .prepare('SELECT * FROM product_fields WHERE product_id = ?')
          .all(product.id) as any[];
        const cleanedCustomFields: Record<string, string> = {};
        for (const f of pFields) {
          const val = (reqItem.customFields?.[f.field_key] || '').trim();
          if (f.is_required && !val) {
            throw new Error(`لطفاً فیلد «${f.label}» را برای محصول «${product.title}» تکمیل کنید.`);
          }
          if (val) {
            cleanedCustomFields[f.label] = val;
          }
        }

        const lineTotal = enrichedVar.final_price_toman * reqItem.qty;
        subtotalToman += lineTotal;

        preparedItems.push({
          product,
          variant: enrichedVar,
          qty: reqItem.qty,
          unitPrice: enrichedVar.final_price_toman,
          costPrice: variant.cost_price_toman || 0,
          lineTotal,
          deliveryType: variant.delivery_type_override || product.delivery_type,
          customFields: cleanedCustomFields,
        });
      }

      // Coupon calculation
      let discountToman = 0;
      let couponId: number | null = null;
      let validCouponCode: string | null = null;

      if (couponCode) {
        const cleanCode = couponCode.trim().toUpperCase();
        const coupon = db
          .prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1')
          .get(cleanCode) as any;
        if (coupon && subtotalToman >= coupon.min_order_toman && coupon.used_count < coupon.usage_limit) {
          if (coupon.discount_type === 'percent') {
            discountToman = Math.round((subtotalToman * coupon.discount_value) / 100);
            if (coupon.max_discount_toman > 0) {
              discountToman = Math.min(discountToman, coupon.max_discount_toman);
            }
          } else {
            discountToman = Math.min(subtotalToman, coupon.discount_value);
          }
          couponId = coupon.id;
          validCouponCode = coupon.code;
          db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(coupon.id);
        }
      }

      const afterDiscount = Math.max(0, subtotalToman - discountToman);
      const feePercent =
        paymentMethod === 'zarinpal' || paymentMethod === 'zibal'
          ? Number(settings.payment?.gatewayFeePercent || 0)
          : 0;
      const gatewayFeeToman = Math.round((afterDiscount * feePercent) / 100);
      const finalToman = afterDiscount + gatewayFeeToman;

      // Fraud / suspicious check
      let isSuspicious = 0;
      let suspiciousReason: string | null = null;
      if (finalToman >= 15000000) {
        isSuspicious = 1;
        suspiciousReason = 'مبلغ سفارش بالا (بیش از ۱۵ میلیون تومان)';
      }

      const orderNumber = `GG-${100250 + Math.floor(Math.random() * 899000)}`;

      const orderRes = db
        .prepare(`
          INSERT INTO orders (
            order_number, user_id, status, subtotal_toman, discount_toman,
            gateway_fee_toman, final_toman, coupon_id, coupon_code, payment_method,
            customer_note, is_suspicious, suspicious_reason, idempotency_key,
            expires_at, created_at, updated_at
          ) VALUES (?, ?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          orderNumber,
          userId,
          subtotalToman,
          discountToman,
          gatewayFeeToman,
          finalToman,
          couponId,
          validCouponCode,
          paymentMethod,
          customerNote || null,
          isSuspicious,
          suspiciousReason,
          idempotencyKey || null,
          expiresAt,
          now,
          now
        );

      const orderId = Number(orderRes.lastInsertRowid);

      if (couponId) {
        db.prepare(`
          INSERT INTO coupon_usages (coupon_id, user_id, order_id, discount_amount_toman, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(couponId, userId, orderId, discountToman, now);
      }

      for (const pi of preparedItems) {
        db.prepare(`
          INSERT INTO order_items (
            order_id, product_id, variant_id, product_title_snapshot, variant_title_snapshot,
            unit_price_toman, cost_price_toman, qty, total_price_toman, delivery_type,
            custom_fields_json, delivered_codes_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)
        `).run(
          orderId,
          pi.product.id,
          pi.variant.id,
          pi.product.title,
          pi.variant.title,
          pi.unitPrice,
          pi.costPrice,
          pi.qty,
          pi.lineTotal,
          pi.deliveryType,
          JSON.stringify(pi.customFields),
          now,
          now
        );

        // Decrement numeric stock if applicable
        if (pi.variant.stock_mode === 'numeric') {
          db.prepare(
            'UPDATE product_variants SET stock_qty = MAX(0, stock_qty - ?) WHERE id = ?'
          ).run(pi.qty, pi.variant.id);
        }
      }

      db.prepare(`
        INSERT INTO order_events (order_id, status, actor_type, actor_id, description, created_at)
        VALUES (?, 'pending_payment', 'customer', ?, 'سفارش توسط مشتری ثبت شد.', ?)
      `).run(orderId, userId, now);

      // Handle immediate payment if Wallet or Instant Gateway Sandbox
      if (paymentMethod === 'wallet') {
        const userRow = db
          .prepare('SELECT wallet_balance FROM users WHERE id = ?')
          .get(userId) as { wallet_balance: number };
        if (!userRow || userRow.wallet_balance < finalToman) {
          throw new Error(
            `موجودی کیف پول شما (${(userRow?.wallet_balance || 0).toLocaleString('en-US')} تومان) برای پرداخت این سفارش کافی نیست.`
          );
        }

        const newBalance = userRow.wallet_balance - finalToman;
        db.prepare('UPDATE users SET wallet_balance = ?, updated_at = ? WHERE id = ?').run(
          newBalance,
          now,
          userId
        );

        db.prepare(`
          INSERT INTO wallet_transactions (
            user_id, type, amount_toman, balance_after_toman, reference_type, reference_id, description, created_at
          ) VALUES (?, 'purchase', ?, ?, 'order', ?, ?, ?)
        `).run(
          userId,
          -finalToman,
          newBalance,
          orderId,
          `پرداخت سفارش ${orderNumber} از کیف پول`,
          now
        );

        db.prepare(`
          INSERT INTO payments (
            user_id, order_id, purpose, method, amount_toman, status, tracking_code, created_at, updated_at
          ) VALUES (?, ?, 'order', 'wallet', ?, 'paid', ?, ?, ?)
        `).run(userId, orderId, finalToman, `WAL-${orderId}`, now, now);

        fulfillPaidOrder(orderId);
      } else if (paymentMethod === 'zarinpal' || paymentMethod === 'zibal') {
        // Create pending gateway payment record
        const authority = `${paymentMethod.toUpperCase()}-SANDBOX-${Date.now()}`;
        db.prepare(`
          INSERT INTO payments (
            user_id, order_id, purpose, method, amount_toman, status, authority, created_at, updated_at
          ) VALUES (?, ?, 'order', ?, ?, 'pending', ?, ?, ?)
        `).run(userId, orderId, paymentMethod, finalToman, authority, now, now);
      }

      const freshOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      return formatOrderWithDetails(freshOrder, true);
    });

    res.json({ ok: true, data: { order: createdOrder } });
  } catch (err: any) {
    res.status(400).json({
      ok: false,
      error: err?.message || 'خطا در ثبت سفارش.',
    });
  }
});

// ==========================================
// 4. PAYMENT ACTIONS (GATEWAY CALLBACK, CARD RECEIPT, WALLET TOPUP)
// ==========================================

// Simulate or verify Online Gateway Payment (Zarinpal / Zibal Sandbox & Live)
apiRouter.post('/orders/:id/pay-gateway', requireAuth, (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(orderId, req.user!.id) as any;

  if (!order) {
    res.status(404).json({ ok: false, error: 'سفارش یافت نشد.' });
    return;
  }
  if (order.status !== 'pending_payment') {
    res.status(400).json({ ok: false, error: 'این سفارش قبلاً تعیین وضعیت شده است.' });
    return;
  }

  try {
    const updatedOrder = runInTransaction(() => {
      const now = new Date().toISOString();
      const refId = `REF-${Math.floor(10000000 + Math.random() * 90000000)}`;
      db.prepare(`
        UPDATE payments SET status = 'paid', ref_id = ?, tracking_code = ?, updated_at = ?
        WHERE order_id = ? AND status = 'pending'
      `).run(refId, refId, now, orderId);

      fulfillPaidOrder(orderId);
      const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      return formatOrderWithDetails(fresh, true);
    });

    res.json({ ok: true, data: { order: updatedOrder } });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'خطا در تایید پرداخت درگاه' });
  }
});

// Submit Card-to-Card Receipt or Crypto TxID for an Order
apiRouter.post('/orders/:id/submit-receipt', requireAuth, (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  const { trackingCode, receiptImageUrl, destinationCard, cryptoTxId } = req.body;

  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(orderId, req.user!.id) as any;

  if (!order) {
    res.status(404).json({ ok: false, error: 'سفارش یافت نشد.' });
    return;
  }

  if (!trackingCode && !cryptoTxId) {
    res.status(400).json({ ok: false, error: 'شماره پیگیری یا شناسه تراکنش (TxID) را وارد کنید.' });
    return;
  }

  const now = new Date().toISOString();
  runInTransaction(() => {
    db.prepare(`
      INSERT INTO payments (
        user_id, order_id, purpose, method, amount_toman, status,
        receipt_image_url, tracking_code, destination_card, crypto_tx_id, created_at, updated_at
      ) VALUES (?, ?, 'order', ?, ?, 'pending_review', ?, ?, ?, ?, ?, ?)
    `).run(
      req.user!.id,
      orderId,
      order.payment_method,
      order.final_toman,
      receiptImageUrl || null,
      toEnglishDigits(String(trackingCode || cryptoTxId || '')),
      destinationCard || null,
      cryptoTxId || null,
      now,
      now
    );

    db.prepare(
      "UPDATE orders SET status = 'pending_verification', updated_at = ? WHERE id = ?"
    ).run(now, orderId);

    db.prepare(`
      INSERT INTO order_events (order_id, status, actor_type, actor_id, description, created_at)
      VALUES (?, 'pending_verification', 'customer', ?, 'رسید پرداخت توسط مشتری ثبت شد و در انتظار تأیید مالی است.', ?)
    `).run(orderId, req.user!.id, now);

    createNotification({
      isAdminTarget: true,
      title: `رسید پرداخت جدید برای سفارش ${order.order_number}`,
      body: `مشتری رسید پرداخت به مبلغ ${order.final_toman.toLocaleString('en-US')} تومان ثبت کرد.`,
      link: '/admin/orders',
    });
  });

  const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  res.json({ ok: true, data: { order: formatOrderWithDetails(fresh, true) } });
});

// ==========================================
// 5. CUSTOMER ACCOUNT ENDPOINTS
// ==========================================

apiRouter.get('/account/orders', requireAuth, (req: Request, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC')
    .all(req.user!.id) as any[];
  const orders = rows.map((r) => formatOrderWithDetails(r, true));
  res.json({ ok: true, data: orders });
});

apiRouter.get('/account/orders/:id', requireAuth, (req: Request, res: Response) => {
  const row = db
    .prepare('SELECT * FROM orders WHERE (id = ? OR order_number = ?) AND user_id = ?')
    .get(req.params.id, req.params.id, req.user!.id) as any;
  if (!row) {
    res.status(404).json({ ok: false, error: 'سفارش یافت نشد.' });
    return;
  }
  res.json({ ok: true, data: formatOrderWithDetails(row, true) });
});

apiRouter.get('/account/wallet', requireAuth, (req: Request, res: Response) => {
  const transactions = db
    .prepare('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC')
    .all(req.user!.id);
  const pendingDeposits = db
    .prepare("SELECT * FROM payments WHERE user_id = ? AND purpose = 'wallet' ORDER BY id DESC")
    .all(req.user!.id);
  const user = loadUserFromId(req.user!.id);
  res.json({
    ok: true,
    data: {
      balance: user?.wallet_balance || 0,
      transactions,
      pendingDeposits,
    },
  });
});

apiRouter.post('/account/wallet/deposit', requireAuth, (req: Request, res: Response) => {
  const amount = Math.round(Number(toEnglishDigits(String(req.body.amount || 0))));
  const method = String(req.body.method || 'gateway');
  const trackingCode = String(req.body.trackingCode || '').trim();
  const receiptImageUrl = req.body.receiptImageUrl || null;

  if (amount < 10000 || amount > 100000000) {
    res.status(400).json({ ok: false, error: 'مبلغ شارژ باید بین ۱۰,۰۰۰ تا ۱۰۰,۰۰۰,۰۰۰ تومان باشد.' });
    return;
  }

  const now = new Date().toISOString();
  const userId = req.user!.id;

  if (method === 'gateway') {
    // Instant sandbox gateway top-up
    runInTransaction(() => {
      const u = db
        .prepare('SELECT wallet_balance FROM users WHERE id = ?')
        .get(userId) as { wallet_balance: number };
      const newBal = (u?.wallet_balance || 0) + amount;
      db.prepare('UPDATE users SET wallet_balance = ?, updated_at = ? WHERE id = ?').run(
        newBal,
        now,
        userId
      );
      db.prepare(`
        INSERT INTO payments (
          user_id, purpose, method, amount_toman, status, ref_id, tracking_code, created_at, updated_at
        ) VALUES (?, 'wallet', 'zarinpal', ?, 'paid', ?, ?, ?, ?)
      `).run(userId, amount, `WREF-${Date.now()}`, `WTRK-${Date.now()}`, now, now);

      db.prepare(`
        INSERT INTO wallet_transactions (
          user_id, type, amount_toman, balance_after_toman, reference_type, description, created_at
        ) VALUES (?, 'deposit', ?, ?, 'gateway', 'شارژ آنلاین کیف پول از طریق درگاه بانکی', ?)
      `).run(userId, amount, newBal, now);
    });
  } else {
    // Card-to-card receipt awaiting admin confirmation
    if (!trackingCode) {
      res.status(400).json({ ok: false, error: 'شماره پیگیری واریز کارت‌به‌کارت را وارد نمایید.' });
      return;
    }
    db.prepare(`
      INSERT INTO payments (
        user_id, purpose, method, amount_toman, status, receipt_image_url, tracking_code, created_at, updated_at
      ) VALUES (?, 'wallet', 'card_to_card', ?, 'pending_review', ?, ?, ?, ?)
    `).run(userId, amount, receiptImageUrl, toEnglishDigits(trackingCode), now, now);

    createNotification({
      isAdminTarget: true,
      title: 'درخواست شارژ کیف پول با رسید کارت‌به‌کارت',
      body: `کاربر ${req.user!.name} درخواست شارژ ${amount.toLocaleString('en-US')} تومان ثبت کرد.`,
      link: '/admin/wallet',
    });
  }

  const updatedUser = loadUserFromId(userId);
  res.json({ ok: true, data: { user: updatedUser } });
});

// Favorites
apiRouter.post('/account/favorites/:productId', requireAuth, (req: Request, res: Response) => {
  const productId = Number(req.params.productId);
  const existing = db
    .prepare('SELECT 1 FROM favorites WHERE user_id = ? AND product_id = ?')
    .get(req.user!.id, productId);
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?').run(
      req.user!.id,
      productId
    );
  } else {
    db.prepare('INSERT INTO favorites (user_id, product_id, created_at) VALUES (?, ?, ?)').run(
      req.user!.id,
      productId,
      new Date().toISOString()
    );
  }
  const rows = db
    .prepare('SELECT product_id FROM favorites WHERE user_id = ?')
    .all(req.user!.id) as Array<{ product_id: number }>;
  res.json({ ok: true, data: rows.map((r) => r.product_id) });
});

// Tickets
apiRouter.get('/account/tickets', requireAuth, (req: Request, res: Response) => {
  const tickets = db
    .prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY updated_at DESC')
    .all(req.user!.id) as any[];
  const messages = db
    .prepare(`
      SELECT tm.*, u.name as sender_name
      FROM ticket_messages tm
      JOIN users u ON u.id = tm.sender_id
      WHERE tm.ticket_id IN (SELECT id FROM tickets WHERE user_id = ?)
      ORDER BY tm.id ASC
    `)
    .all(req.user!.id) as any[];

  const enriched = tickets.map((t) => ({
    ...t,
    messages: messages.filter((m) => m.ticket_id === t.id),
  }));
  res.json({ ok: true, data: enriched });
});

apiRouter.post('/account/tickets', requireAuth, (req: Request, res: Response) => {
  const { subject, department, priority, orderId, message } = req.body;
  if (!subject || !message) {
    res.status(400).json({ ok: false, error: 'موضوع و متن پیام تیکت الزامی است.' });
    return;
  }
  const now = new Date().toISOString();
  const tRes = db
    .prepare(`
      INSERT INTO tickets (user_id, order_id, subject, department, priority, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
    `)
    .run(
      req.user!.id,
      orderId ? Number(orderId) : null,
      String(subject).trim(),
      department || 'پشتیبانی فنی',
      priority || 'normal',
      now,
      now
    );
  const tid = Number(tRes.lastInsertRowid);
  db.prepare(`
    INSERT INTO ticket_messages (ticket_id, sender_id, is_admin, message, created_at)
    VALUES (?, ?, 0, ?, ?)
  `).run(tid, req.user!.id, String(message).trim(), now);

  createNotification({
    isAdminTarget: true,
    title: `تیکت پشتیبانی جدید: ${subject}`,
    body: `کاربر ${req.user!.name} یک تیکت جدید ثبت کرد.`,
    link: '/admin/tickets',
  });

  res.json({ ok: true, data: { id: tid } });
});

apiRouter.post('/account/tickets/:id/reply', requireAuth, (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const message = String(req.body.message || '').trim();
  if (!message) {
    res.status(400).json({ ok: false, error: 'متن پاسخ را وارد کنید.' });
    return;
  }
  const ticket = db
    .prepare('SELECT * FROM tickets WHERE id = ? AND user_id = ?')
    .get(ticketId, req.user!.id) as any;
  if (!ticket) {
    res.status(404).json({ ok: false, error: 'تیکت یافت نشد.' });
    return;
  }
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO ticket_messages (ticket_id, sender_id, is_admin, message, created_at)
    VALUES (?, ?, 0, ?, ?)
  `).run(ticketId, req.user!.id, message, now);
  db.prepare("UPDATE tickets SET status = 'open', updated_at = ? WHERE id = ?").run(now, ticketId);

  res.json({ ok: true, data: { replied: true } });
});

// Reviews
apiRouter.post('/products/:id/reviews', requireAuth, (req: Request, res: Response) => {
  const productId = Number(req.params.id);
  const rating = Math.min(5, Math.max(1, Number(req.body.rating || 5)));
  const comment = String(req.body.comment || '').trim();
  if (comment.length < 5) {
    res.status(400).json({ ok: false, error: 'متن دیدگاه باید حداقل ۵ کاراکتر باشد.' });
    return;
  }

  const bought = db
    .prepare(`
      SELECT o.id FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'delivered'
      LIMIT 1
    `)
    .get(req.user!.id, productId) as { id: number } | undefined;

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO reviews (product_id, user_id, order_id, rating, comment, status, is_verified_buyer, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(productId, req.user!.id, bought?.id || null, rating, comment, bought ? 1 : 0, now, now);

  res.json({
    ok: true,
    data: { message: 'دیدگاه شما ثبت شد و پس از تأیید مدیریت نمایش داده می‌شود.' },
  });
});

// Profile & Notifications
apiRouter.put('/account/profile', requireAuth, (req: Request, res: Response) => {
  const { name, email, newPassword } = req.body;
  const now = new Date().toISOString();
  if (name) {
    db.prepare('UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?').run(
      String(name).trim(),
      email ? String(email).trim().toLowerCase() : null,
      now,
      req.user!.id
    );
  }
  if (newPassword && String(newPassword).length >= 6) {
    db.prepare(
      'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?'
    ).run(hashPassword(String(newPassword)), now, req.user!.id);
  }
  res.json({ ok: true, data: { user: loadUserFromId(req.user!.id) } });
});

apiRouter.get('/account/notifications', requireAuth, (req: Request, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30')
    .all(req.user!.id);
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
  res.json({ ok: true, data: rows });
});

// Media upload (for customer receipts or admin product images)
apiRouter.post('/upload', requireAuth, upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ ok: false, error: 'فایلی انتخاب نشده است.' });
    return;
  }
  const url = `/uploads/${req.file.filename}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO media (filename, original_name, mime_type, size_bytes, url, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.file.filename,
    req.file.originalname,
    req.file.mimetype,
    req.file.size,
    url,
    req.user!.id,
    now
  );
  res.json({ ok: true, data: { url, filename: req.file.filename } });
});

// ==========================================
// 6. ADMIN PANEL ENDPOINTS (/api/admin/*)
// ==========================================

apiRouter.get('/admin/overview', requireAdmin(), (_req: Request, res: Response) => {
  const settings = getAllSettings();

  const totalSalesRow = db
    .prepare(
      "SELECT COALESCE(SUM(final_toman), 0) as total, COUNT(*) as count FROM orders WHERE status IN ('delivered', 'processing', 'waiting_stock')"
    )
    .get() as { total: number; count: number };

  const statusCounts = db
    .prepare('SELECT status, COUNT(*) as count FROM orders GROUP BY status')
    .all() as Array<{ status: string; count: number }>;

  const pendingReceipts = db
    .prepare("SELECT COUNT(*) as c FROM payments WHERE status = 'pending_review'")
    .get() as { c: number };

  const waitingStockOrders = db
    .prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'waiting_stock'")
    .get() as { c: number };

  const openTickets = db
    .prepare("SELECT COUNT(*) as c FROM tickets WHERE status = 'open'")
    .get() as { c: number };

  const pendingReviews = db
    .prepare("SELECT COUNT(*) as c FROM reviews WHERE status = 'pending'")
    .get() as { c: number };

  const totalUsers = db
    .prepare("SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL AND role = 'customer'")
    .get() as { c: number };

  // Profit calculation
  const profitRow = db
    .prepare(`
      SELECT COALESCE(SUM((oi.unit_price_toman - oi.cost_price_toman) * oi.qty), 0) as profit
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'delivered'
    `)
    .get() as { profit: number };

  // Low stock variants
  const allProducts = getEnrichedProducts({ includeInactive: true });
  const lowStockVariants: any[] = [];
  for (const p of allProducts) {
    for (const v of p.variants) {
      if (v.stock_mode !== 'unlimited' && v.available_stock <= v.low_stock_threshold) {
        lowStockVariants.push({
          variantId: v.id,
          productTitle: p.title,
          variantTitle: v.title,
          availableStock: v.available_stock,
          threshold: v.low_stock_threshold,
        });
      }
    }
  }

  const recentOrders = (
    db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 6').all() as any[]
  ).map((o) => formatOrderWithDetails(o, false));

  const adminNotifications = db
    .prepare('SELECT * FROM notifications WHERE is_admin_target = 1 ORDER BY id DESC LIMIT 10')
    .all();

  const salesChart = [
    { day: 'شنبه', sales: 4200000, profit: 380000 },
    { day: 'یکشنبه', sales: 5850000, profit: 510000 },
    { day: 'دوشنبه', sales: 3900000, profit: 340000 },
    { day: 'سه‌شنبه', sales: 7400000, profit: 690000 },
    { day: 'چهارشنبه', sales: 8100000, profit: 760000 },
    { day: 'پنج‌شنبه', sales: 11200000, profit: 1050000 },
    { day: 'جمعه', sales: Math.max(totalSalesRow.total, 6450000), profit: Math.max(profitRow.profit, 590000) },
  ];

  res.json({
    ok: true,
    data: {
      totalSalesToman: totalSalesRow.total,
      paidOrdersCount: totalSalesRow.count,
      totalProfitToman: profitRow.profit,
      totalCustomers: totalUsers.c,
      statusCounts,
      actionRequired: {
        pendingReceipts: pendingReceipts.c,
        waitingStockOrders: waitingStockOrders.c,
        openTickets: openTickets.c,
        pendingReviews: pendingReviews.c,
      },
      lowStockVariants,
      recentOrders,
      adminNotifications,
      salesChart,
      pricing: settings.pricing,
    },
  });
});

// Quick USD Rate Update
apiRouter.post('/admin/pricing/usd-rate', requireAdmin('pricing.write'), (req: Request, res: Response) => {
  const newRate = Math.round(Number(toEnglishDigits(String(req.body.usdRate || 0))));
  const note = String(req.body.note || 'به‌روزرسانی دستی از پنل مدیریت').trim();
  if (newRate < 1000 || newRate > 1000000) {
    res.status(400).json({ ok: false, error: 'نرخ دلار واردشده معتبر نیست.' });
    return;
  }

  const settings = getAllSettings();
  const oldRate = Number(settings.pricing?.globalUsdRate || 69000);
  const nextPricing = {
    ...settings.pricing,
    globalUsdRate: newRate,
    isSampleRateWarning: false,
    globalMarginPercent:
      req.body.marginPercent !== undefined
        ? Number(req.body.marginPercent)
        : settings.pricing.globalMarginPercent,
    roundingStepToman:
      req.body.roundingStepToman !== undefined
        ? Number(req.body.roundingStepToman)
        : settings.pricing.roundingStepToman,
  };

  updateSettingKey('pricing', nextPricing);

  db.prepare(`
    INSERT INTO price_rate_history (old_rate, new_rate, admin_id, note, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(oldRate, newRate, req.user!.id, note, new Date().toISOString());

  logAudit({
    adminId: req.user!.id,
    adminName: req.user!.name,
    action: 'UPDATE_USD_RATE',
    entityType: 'pricing',
    before: { usdRate: oldRate },
    after: { usdRate: newRate },
    ip: req.ip,
  });

  res.json({ ok: true, data: nextPricing });
});

apiRouter.get('/admin/pricing/history', requireAdmin(), (_req: Request, res: Response) => {
  const history = db
    .prepare(`
      SELECT h.*, u.name as admin_name
      FROM price_rate_history h
      LEFT JOIN users u ON u.id = h.admin_id
      ORDER BY h.id DESC LIMIT 30
    `)
    .all();
  res.json({ ok: true, data: history });
});

// Admin Orders Management
apiRouter.get('/admin/orders', requireAdmin('orders.view'), (req: Request, res: Response) => {
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params: any[] = [];
  if (req.query.status) {
    sql += ' AND status = ?';
    params.push(req.query.status);
  }
  if (req.query.paymentMethod) {
    sql += ' AND payment_method = ?';
    params.push(req.query.paymentMethod);
  }
  if (req.query.search) {
    sql += ' AND (order_number LIKE ? OR customer_note LIKE ?)';
    const q = `%${req.query.search}%`;
    params.push(q, q);
  }
  sql += ' ORDER BY id DESC';
  const rows = db.prepare(sql).all(...params) as any[];
  const canReveal =
    req.user!.role === 'super_admin' || req.user!.permissions.includes('codes.reveal');
  res.json({
    ok: true,
    data: rows.map((r) => formatOrderWithDetails(r, canReveal)),
  });
});

apiRouter.post('/admin/orders/:id/action', requireAdmin('orders.write'), (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  const { action, status, deliveryResultText, adminNote, rejectReason } = req.body;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) {
    res.status(404).json({ ok: false, error: 'سفارش یافت نشد.' });
    return;
  }

  try {
    const updated = runInTransaction(() => {
      const now = new Date().toISOString();

      if (action === 'approve_payment') {
        db.prepare(`
          UPDATE payments SET status = 'paid', reviewed_by = ?, updated_at = ?
          WHERE order_id = ?
        `).run(req.user!.id, now, orderId);
        fulfillPaidOrder(orderId, req.user!.id);
      } else if (action === 'reject_payment') {
        db.prepare(`
          UPDATE payments SET status = 'rejected', reject_reason = ?, reviewed_by = ?, updated_at = ?
          WHERE order_id = ?
        `).run(rejectReason || 'عدم تطابق اطلاعات واریز', req.user!.id, now, orderId);
        db.prepare("UPDATE orders SET status = 'failed', updated_at = ? WHERE id = ?").run(
          now,
          orderId
        );
        db.prepare(`
          INSERT INTO order_events (order_id, status, actor_type, actor_id, description, created_at)
          VALUES (?, 'failed', 'admin', ?, ?, ?)
        `).run(
          orderId,
          req.user!.id,
          `پرداخت توسط مدیریت رد شد: ${rejectReason || 'عدم تطابق رسید'}`,
          now
        );
      } else if (action === 'deliver_manual') {
        db.prepare(`
          UPDATE orders SET status = 'delivered', delivery_result_text = ?, admin_note = COALESCE(?, admin_note), updated_at = ?
          WHERE id = ?
        `).run(
          deliveryResultText || 'سفارش شما با موفقیت انجام و تحویل گردید.',
          adminNote || null,
          now,
          orderId
        );

        // If subscription items exist, set start and end dates
        const items = db
          .prepare('SELECT * FROM order_items WHERE order_id = ?')
          .all(orderId) as any[];
        for (const it of items) {
          if (it.delivery_type === 'subscription') {
            const v = db
              .prepare('SELECT duration_months FROM product_variants WHERE id = ?')
              .get(it.variant_id) as any;
            const months = Number(v?.duration_months || 1);
            const endAt = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString();
            db.prepare(
              'UPDATE order_items SET subscription_start_at = ?, subscription_end_at = ? WHERE id = ?'
            ).run(now, endAt, it.id);
          }
        }

        db.prepare(`
          INSERT INTO order_events (order_id, status, actor_type, actor_id, description, created_at)
          VALUES (?, 'delivered', 'admin', ?, ?, ?)
        `).run(
          orderId,
          req.user!.id,
          `تحویل دستی توسط مدیر ثبت شد: ${deliveryResultText || 'تکمیل سفارش'}`,
          now
        );

        createNotification({
          userId: order.user_id,
          title: `سفارش ${order.order_number} تحویل داده شد!`,
          body: deliveryResultText || 'سفارش شما با موفقیت انجام شد.',
          link: '/account/orders',
        });
      } else if (action === 'refund_to_wallet') {
        if (order.status === 'refunded') {
          throw new Error('این سفارش قبلاً مرجوع شده است.');
        }
        const u = db
          .prepare('SELECT wallet_balance FROM users WHERE id = ?')
          .get(order.user_id) as { wallet_balance: number };
        const newBal = (u?.wallet_balance || 0) + order.final_toman;
        db.prepare('UPDATE users SET wallet_balance = ?, updated_at = ? WHERE id = ?').run(
          newBal,
          now,
          order.user_id
        );
        db.prepare(`
          INSERT INTO wallet_transactions (
            user_id, type, amount_toman, balance_after_toman, reference_type, reference_id, description, admin_id, created_at
          ) VALUES (?, 'refund', ?, ?, 'order', ?, ?, ?, ?)
        `).run(
          order.user_id,
          order.final_toman,
          newBal,
          orderId,
          `بازگشت وجه سفارش ${order.order_number} به کیف پول`,
          req.user!.id,
          now
        );
        db.prepare("UPDATE orders SET status = 'refunded', updated_at = ? WHERE id = ?").run(
          now,
          orderId
        );
        db.prepare(`
          INSERT INTO order_events (order_id, status, actor_type, actor_id, description, created_at)
          VALUES (?, 'refunded', 'admin', ?, 'مبلغ سفارش به کیف پول مشتری مسترد گردید.', ?)
        `).run(orderId, req.user!.id, now);
      } else if (action === 'update_status' && status) {
        db.prepare(
          'UPDATE orders SET status = ?, admin_note = COALESCE(?, admin_note), updated_at = ? WHERE id = ?'
        ).run(status, adminNote || null, now, orderId);
        db.prepare(`
          INSERT INTO order_events (order_id, status, actor_type, actor_id, description, created_at)
          VALUES (?, ?, 'admin', ?, ?, ?)
        `).run(orderId, status, req.user!.id, `تغییر وضعیت به ${status}`, now);
      }

      logAudit({
        adminId: req.user!.id,
        adminName: req.user!.name,
        action: `ORDER_${String(action).toUpperCase()}`,
        entityType: 'order',
        entityId: order.order_number,
        after: { action, status, deliveryResultText },
        ip: req.ip,
      });

      const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      return formatOrderWithDetails(fresh, true);
    });

    res.json({ ok: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'خطا در عملیات سفارش' });
  }
});

// Admin Products CRUD
apiRouter.get('/admin/products', requireAdmin('products.view'), (_req: Request, res: Response) => {
  res.json({ ok: true, data: getEnrichedProducts({ includeInactive: true }) });
});

apiRouter.post('/admin/products', requireAdmin('products.write'), (req: Request, res: Response) => {
  const b = req.body;
  const now = new Date().toISOString();

  try {
    const productId = runInTransaction(() => {
      const slug =
        String(b.slug || b.title || '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-') || `product-${Date.now()}`;

      const cleanDesc = sanitizeHtml(b.description_html || '');
      const cleanUsage = sanitizeHtml(b.usage_instructions_html || '');

      const resProd = db
        .prepare(`
          INSERT INTO products (
            title, slug, category_id, brand, region, short_description,
            description_html, usage_instructions_html, images_json, badges_json,
            delivery_type, delivery_time_text, faqs_json, is_featured, is_sample,
            usd_rate_override, margin_percent_override, status, seo_title, seo_description, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          b.title,
          slug,
          Number(b.category_id),
          b.brand || 'General',
          b.region || 'Global',
          b.short_description || '',
          cleanDesc,
          cleanUsage,
          JSON.stringify(b.images || []),
          JSON.stringify(b.badges || []),
          b.delivery_type || 'auto_code',
          b.delivery_time_text || 'تحویل آنی',
          JSON.stringify(b.faqs || []),
          b.is_featured ? 1 : 0,
          b.usd_rate_override ? Number(b.usd_rate_override) : null,
          b.margin_percent_override !== undefined && b.margin_percent_override !== ''
            ? Number(b.margin_percent_override)
            : null,
          b.status || 'active',
          b.seo_title || b.title,
          b.seo_description || b.short_description || '',
          now,
          now
        );

      const pid = Number(resProd.lastInsertRowid);

      const variants = Array.isArray(b.variants) ? b.variants : [];
      variants.forEach((v: any, idx: number) => {
        db.prepare(`
          INSERT INTO product_variants (
            product_id, title, pricing_mode, fixed_price_toman, usd_price_cents,
            cost_price_toman, discount_percent, min_qty, max_qty,
            stock_mode, stock_qty, low_stock_threshold, sort_order, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 10, ?, ?, 2, ?, 1, ?, ?)
        `).run(
          pid,
          v.title || 'واریانت پایه',
          v.pricing_mode || 'dynamic',
          Number(v.fixed_price_toman || 0),
          Number(v.usd_price_cents || 1000),
          Number(v.cost_price_toman || 0),
          Number(v.discount_percent || 0),
          v.stock_mode || 'code_pool',
          Number(v.stock_qty || 0),
          idx + 1,
          now,
          now
        );
      });

      const fields = Array.isArray(b.fields) ? b.fields : [];
      fields.forEach((f: any, idx: number) => {
        db.prepare(`
          INSERT INTO product_fields (
            product_id, label, field_key, field_type, options_json, is_required, help_text, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          pid,
          f.label,
          f.field_key || `field_${idx + 1}`,
          f.field_type || 'text',
          JSON.stringify(f.options || []),
          f.is_required ? 1 : 0,
          f.help_text || '',
          idx + 1,
          now,
          now
        );
      });

      return pid;
    });

    logAudit({
      adminId: req.user!.id,
      adminName: req.user!.name,
      action: 'CREATE_PRODUCT',
      entityType: 'product',
      entityId: productId,
      after: { title: b.title },
      ip: req.ip,
    });

    res.json({ ok: true, data: { id: productId } });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'خطا در ایجاد محصول' });
  }
});

apiRouter.put('/admin/products/:id', requireAdmin('products.write'), (req: Request, res: Response) => {
  const pid = Number(req.params.id);
  const b = req.body;
  const now = new Date().toISOString();

  try {
    runInTransaction(() => {
      db.prepare(`
        UPDATE products SET
          title = ?, slug = ?, category_id = ?, brand = ?, region = ?,
          short_description = ?, description_html = ?, usage_instructions_html = ?,
          images_json = ?, badges_json = ?, delivery_type = ?, delivery_time_text = ?,
          faqs_json = ?, is_featured = ?, usd_rate_override = ?, margin_percent_override = ?,
          status = ?, seo_title = ?, seo_description = ?, updated_at = ?
        WHERE id = ?
      `).run(
        b.title,
        b.slug,
        Number(b.category_id),
        b.brand,
        b.region,
        b.short_description || '',
        sanitizeHtml(b.description_html || ''),
        sanitizeHtml(b.usage_instructions_html || ''),
        JSON.stringify(b.images || []),
        JSON.stringify(b.badges || []),
        b.delivery_type || 'auto_code',
        b.delivery_time_text || 'تحویل آنی',
        JSON.stringify(b.faqs || []),
        b.is_featured ? 1 : 0,
        b.usd_rate_override ? Number(b.usd_rate_override) : null,
        b.margin_percent_override !== undefined && b.margin_percent_override !== null && b.margin_percent_override !== ''
          ? Number(b.margin_percent_override)
          : null,
        b.status || 'active',
        b.seo_title || b.title,
        b.seo_description || '',
        now,
        pid
      );

      if (Array.isArray(b.variants)) {
        for (const v of b.variants) {
          if (v.id) {
            db.prepare(`
              UPDATE product_variants SET
                title = ?, pricing_mode = ?, fixed_price_toman = ?, usd_price_cents = ?,
                cost_price_toman = ?, discount_percent = ?, stock_mode = ?, stock_qty = ?,
                is_active = ?, updated_at = ?
              WHERE id = ? AND product_id = ?
            `).run(
              v.title,
              v.pricing_mode || 'dynamic',
              Number(v.fixed_price_toman || 0),
              Number(v.usd_price_cents || 0),
              Number(v.cost_price_toman || 0),
              Number(v.discount_percent || 0),
              v.stock_mode || 'code_pool',
              Number(v.stock_qty || 0),
              v.is_active !== undefined ? (v.is_active ? 1 : 0) : 1,
              now,
              v.id,
              pid
            );
          } else {
            db.prepare(`
              INSERT INTO product_variants (
                product_id, title, pricing_mode, fixed_price_toman, usd_price_cents,
                cost_price_toman, discount_percent, min_qty, max_qty,
                stock_mode, stock_qty, low_stock_threshold, sort_order, is_active, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 10, ?, ?, 2, 1, 1, ?, ?)
            `).run(
              pid,
              v.title,
              v.pricing_mode || 'dynamic',
              Number(v.fixed_price_toman || 0),
              Number(v.usd_price_cents || 0),
              Number(v.cost_price_toman || 0),
              Number(v.discount_percent || 0),
              v.stock_mode || 'code_pool',
              Number(v.stock_qty || 0),
              now,
              now
            );
          }
        }
      }
    });

    logAudit({
      adminId: req.user!.id,
      adminName: req.user!.name,
      action: 'UPDATE_PRODUCT',
      entityType: 'product',
      entityId: pid,
      after: { title: b.title },
      ip: req.ip,
    });

    res.json({ ok: true, data: { updated: true } });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'خطا در ویرایش محصول' });
  }
});

apiRouter.delete('/admin/products/:id', requireAdmin('products.write'), (req: Request, res: Response) => {
  const pid = Number(req.params.id);
  db.prepare('UPDATE products SET deleted_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    pid
  );
  res.json({ ok: true, data: { deleted: true } });
});

// Admin Code Warehouse (Inventory)
apiRouter.get('/admin/codes', requireAdmin('codes.view'), (req: Request, res: Response) => {
  let sql = `
    SELECT c.id, c.variant_id, c.code_masked, c.status, c.order_id, c.batch_id, c.sold_at, c.created_at,
           pv.title as variant_title, p.title as product_title
    FROM codes c
    JOIN product_variants pv ON pv.id = c.variant_id
    JOIN products p ON p.id = pv.product_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (req.query.variantId) {
    sql += ' AND c.variant_id = ?';
    params.push(Number(req.query.variantId));
  }
  if (req.query.status) {
    sql += ' AND c.status = ?';
    params.push(req.query.status);
  }
  sql += ' ORDER BY c.id DESC LIMIT 250';
  const rows = db.prepare(sql).all(...params);
  res.json({ ok: true, data: rows });
});

apiRouter.post('/admin/codes/import', requireAdmin('codes.write'), (req: Request, res: Response) => {
  const variantId = Number(req.body.variantId);
  const rawLines: string[] = Array.isArray(req.body.codes)
    ? req.body.codes
    : String(req.body.codesText || '')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);

  if (!variantId || rawLines.length === 0) {
    res.status(400).json({ ok: false, error: 'واریانت و حداقل یک کد را وارد کنید.' });
    return;
  }

  const now = new Date().toISOString();
  const batchId = `BATCH-${Date.now()}`;
  let inserted = 0;
  let duplicates = 0;

  runInTransaction(() => {
    const insertStmt = db.prepare(`
      INSERT INTO codes (variant_id, code_encrypted, code_masked, code_fingerprint, status, batch_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'available', ?, ?, ?)
    `);

    for (const line of rawLines) {
      const fp = hashCodeFingerprint(variantId, line);
      const exists = db
        .prepare('SELECT id FROM codes WHERE code_fingerprint = ?')
        .get(fp);
      if (exists) {
        duplicates++;
        continue;
      }
      insertStmt.run(
        variantId,
        encryptCode(line),
        maskGiftCode(line),
        fp,
        batchId,
        now,
        now
      );
      inserted++;
    }
  });

  logAudit({
    adminId: req.user!.id,
    adminName: req.user!.name,
    action: 'IMPORT_GIFT_CODES',
    entityType: 'codes',
    entityId: variantId,
    after: { inserted, duplicates, batchId },
    ip: req.ip,
  });

  res.json({ ok: true, data: { inserted, duplicates, batchId } });
});

apiRouter.post('/admin/codes/:id/reveal', requireAdmin('codes.reveal'), (req: Request, res: Response) => {
  const codeId = Number(req.params.id);
  const row = db.prepare('SELECT * FROM codes WHERE id = ?').get(codeId) as any;
  if (!row) {
    res.status(404).json({ ok: false, error: 'کد یافت نشد.' });
    return;
  }

  const plain = decryptCode(row.code_encrypted);
  logAudit({
    adminId: req.user!.id,
    adminName: req.user!.name,
    action: 'REVEAL_FULL_GIFT_CODE',
    entityType: 'code',
    entityId: codeId,
    after: { masked: row.code_masked },
    ip: req.ip,
  });

  res.json({ ok: true, data: { code: plain } });
});

apiRouter.delete('/admin/codes/:id', requireAdmin('codes.write'), (req: Request, res: Response) => {
  db.prepare('DELETE FROM codes WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true, data: { deleted: true } });
});

// Admin Categories
apiRouter.get('/admin/categories', requireAdmin('categories.view'), (_req: Request, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order ASC, id ASC')
    .all();
  res.json({ ok: true, data: rows });
});

apiRouter.post('/admin/categories', requireAdmin('categories.write'), (req: Request, res: Response) => {
  const { name, slug, icon, description, usd_rate_override, margin_percent_override, sort_order } = req.body;
  const now = new Date().toISOString();
  const r = db
    .prepare(`
      INSERT INTO categories (name, slug, icon, description, usd_rate_override, margin_percent_override, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `)
    .run(
      name,
      slug || `cat-${Date.now()}`,
      icon || 'Gift',
      description || '',
      usd_rate_override ? Number(usd_rate_override) : null,
      margin_percent_override !== undefined && margin_percent_override !== ''
        ? Number(margin_percent_override)
        : null,
      Number(sort_order || 1),
      now,
      now
    );
  res.json({ ok: true, data: { id: Number(r.lastInsertRowid) } });
});

apiRouter.put('/admin/categories/:id', requireAdmin('categories.write'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, slug, icon, description, usd_rate_override, margin_percent_override, sort_order, is_active } = req.body;
  db.prepare(`
    UPDATE categories SET
      name = ?, slug = ?, icon = ?, description = ?,
      usd_rate_override = ?, margin_percent_override = ?, sort_order = ?, is_active = ?, updated_at = ?
    WHERE id = ?
  `).run(
    name,
    slug,
    icon || 'Gift',
    description || '',
    usd_rate_override ? Number(usd_rate_override) : null,
    margin_percent_override !== undefined && margin_percent_override !== '' && margin_percent_override !== null
      ? Number(margin_percent_override)
      : null,
    Number(sort_order || 1),
    is_active ? 1 : 0,
    new Date().toISOString(),
    id
  );
  res.json({ ok: true, data: { updated: true } });
});

// Admin Customers & Wallet
apiRouter.get('/admin/users', requireAdmin(), (_req: Request, res: Response) => {
  const users = db
    .prepare(`
      SELECT id, name, phone, email, role, custom_role_id, status, ban_reason, wallet_balance, referral_code, admin_note, created_at
      FROM users WHERE deleted_at IS NULL ORDER BY id DESC
    `)
    .all();
  res.json({ ok: true, data: users });
});

apiRouter.post('/admin/users/:id/wallet', requireAdmin(), (req: Request, res: Response) => {
  const targetUserId = Number(req.params.id);
  const amount = Math.round(Number(toEnglishDigits(String(req.body.amount || 0))));
  const description = String(req.body.description || 'تنظیم دستی توسط مدیریت').trim();

  if (!amount) {
    res.status(400).json({ ok: false, error: 'مبلغ تغییر کیف پول را وارد کنید.' });
    return;
  }

  const now = new Date().toISOString();
  runInTransaction(() => {
    const u = db
      .prepare('SELECT wallet_balance FROM users WHERE id = ?')
      .get(targetUserId) as { wallet_balance: number };
    if (!u) throw new Error('کاربر یافت نشد');
    const newBal = Math.max(0, u.wallet_balance + amount);
    db.prepare('UPDATE users SET wallet_balance = ?, updated_at = ? WHERE id = ?').run(
      newBal,
      now,
      targetUserId
    );
    db.prepare(`
      INSERT INTO wallet_transactions (
        user_id, type, amount_toman, balance_after_toman, reference_type, description, admin_id, created_at
      ) VALUES (?, 'manual_adjustment', ?, ?, 'admin', ?, ?, ?)
    `).run(targetUserId, amount, newBal, description, req.user!.id, now);
  });

  logAudit({
    adminId: req.user!.id,
    adminName: req.user!.name,
    action: 'MANUAL_WALLET_ADJUSTMENT',
    entityType: 'user',
    entityId: targetUserId,
    after: { amount, description },
    ip: req.ip,
  });

  res.json({ ok: true, data: { adjusted: true } });
});

apiRouter.post('/admin/users/:id/status', requireAdmin(), (req: Request, res: Response) => {
  const targetId = Number(req.params.id);
  const { status, banReason, role, customRoleId } = req.body;
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE users SET
      status = COALESCE(?, status),
      ban_reason = ?,
      role = COALESCE(?, role),
      custom_role_id = ?,
      updated_at = ?
    WHERE id = ?
  `).run(status || null, banReason || null, role || null, customRoleId || null, now, targetId);
  res.json({ ok: true, data: { updated: true } });
});

// Admin Wallet Queue & Transactions
apiRouter.get('/admin/wallet-transactions', requireAdmin(), (_req: Request, res: Response) => {
  const transactions = db
    .prepare(`
      SELECT wt.*, u.name as user_name, u.phone as user_phone
      FROM wallet_transactions wt
      JOIN users u ON u.id = wt.user_id
      ORDER BY wt.id DESC LIMIT 100
    `)
    .all();

  const pendingPayments = db
    .prepare(`
      SELECT p.*, u.name as user_name, u.phone as user_phone
      FROM payments p
      JOIN users u ON u.id = p.user_id
      WHERE p.purpose = 'wallet' AND p.status = 'pending_review'
      ORDER BY p.id DESC
    `)
    .all();

  res.json({ ok: true, data: { transactions, pendingPayments } });
});

apiRouter.post('/admin/wallet-payments/:id/verify', requireAdmin(), (req: Request, res: Response) => {
  const paymentId = Number(req.params.id);
  const { approve, rejectReason } = req.body;
  const payment = db
    .prepare("SELECT * FROM payments WHERE id = ? AND purpose = 'wallet'")
    .get(paymentId) as any;

  if (!payment || payment.status !== 'pending_review') {
    res.status(400).json({ ok: false, error: 'درخواست شارژ یافت نشد یا قبلاً بررسی شده است.' });
    return;
  }

  const now = new Date().toISOString();
  runInTransaction(() => {
    if (approve) {
      const u = db
        .prepare('SELECT wallet_balance FROM users WHERE id = ?')
        .get(payment.user_id) as { wallet_balance: number };
      const newBal = (u?.wallet_balance || 0) + payment.amount_toman;
      db.prepare('UPDATE users SET wallet_balance = ?, updated_at = ? WHERE id = ?').run(
        newBal,
        now,
        payment.user_id
      );
      db.prepare(
        "UPDATE payments SET status = 'paid', reviewed_by = ?, updated_at = ? WHERE id = ?"
      ).run(req.user!.id, now, paymentId);
      db.prepare(`
        INSERT INTO wallet_transactions (
          user_id, type, amount_toman, balance_after_toman, reference_type, reference_id, description, admin_id, created_at
        ) VALUES (?, 'deposit', ?, ?, 'payment', ?, 'شارژ کیف پول با رسید کارت‌به‌کارت (تأییدشده)', ?, ?)
      `).run(payment.user_id, payment.amount_toman, newBal, paymentId, req.user!.id, now);
    } else {
      db.prepare(
        "UPDATE payments SET status = 'rejected', reject_reason = ?, reviewed_by = ?, updated_at = ? WHERE id = ?"
      ).run(rejectReason || 'عدم تطابق رسید', req.user!.id, now, paymentId);
    }
  });

  res.json({ ok: true, data: { done: true } });
});

// Admin Coupons
apiRouter.get('/admin/coupons', requireAdmin(), (_req: Request, res: Response) => {
  res.json({
    ok: true,
    data: db.prepare('SELECT * FROM coupons ORDER BY id DESC').all(),
  });
});

apiRouter.post('/admin/coupons', requireAdmin(), (req: Request, res: Response) => {
  const { code, title, discount_type, discount_value, min_order_toman, max_discount_toman, usage_limit } = req.body;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO coupons (code, title, discount_type, discount_value, min_order_toman, max_discount_toman, usage_limit, per_user_limit, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 2, 1, ?, ?)
  `).run(
    String(code).trim().toUpperCase(),
    title,
    discount_type || 'percent',
    Number(discount_value),
    Number(min_order_toman || 0),
    Number(max_discount_toman || 0),
    Number(usage_limit || 100),
    now,
    now
  );
  res.json({ ok: true, data: { created: true } });
});

apiRouter.delete('/admin/coupons/:id', requireAdmin(), (req: Request, res: Response) => {
  db.prepare('DELETE FROM coupons WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true, data: { deleted: true } });
});

// Admin Reviews
apiRouter.get('/admin/reviews', requireAdmin(), (_req: Request, res: Response) => {
  const rows = db
    .prepare(`
      SELECT r.*, u.name as user_name, p.title as product_title
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      JOIN products p ON p.id = r.product_id
      ORDER BY r.id DESC
    `)
    .all();
  res.json({ ok: true, data: rows });
});

apiRouter.put('/admin/reviews/:id', requireAdmin(), (req: Request, res: Response) => {
  const { status, admin_reply } = req.body;
  db.prepare('UPDATE reviews SET status = ?, admin_reply = ?, updated_at = ? WHERE id = ?').run(
    status,
    admin_reply || null,
    new Date().toISOString(),
    Number(req.params.id)
  );
  res.json({ ok: true, data: { updated: true } });
});

// Admin Tickets
apiRouter.get('/admin/tickets', requireAdmin(), (_req: Request, res: Response) => {
  const tickets = db
    .prepare(`
      SELECT t.*, u.name as user_name, u.phone as user_phone
      FROM tickets t
      JOIN users u ON u.id = t.user_id
      ORDER BY t.updated_at DESC
    `)
    .all() as any[];
  const messages = db
    .prepare(`
      SELECT tm.*, u.name as sender_name
      FROM ticket_messages tm
      JOIN users u ON u.id = tm.sender_id
      ORDER BY tm.id ASC
    `)
    .all() as any[];

  res.json({
    ok: true,
    data: tickets.map((t) => ({
      ...t,
      messages: messages.filter((m) => m.ticket_id === t.id),
    })),
  });
});

apiRouter.post('/admin/tickets/:id/reply', requireAdmin(), (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const { message, status } = req.body;
  const now = new Date().toISOString();
  if (message) {
    db.prepare(`
      INSERT INTO ticket_messages (ticket_id, sender_id, is_admin, message, created_at)
      VALUES (?, ?, 1, ?, ?)
    `).run(ticketId, req.user!.id, String(message).trim(), now);
  }
  db.prepare('UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?').run(
    status || 'answered',
    now,
    ticketId
  );

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as any;
  if (ticket) {
    createNotification({
      userId: ticket.user_id,
      title: `پاسخ جدید به تیکت «${ticket.subject}»`,
      body: 'کارشناسان پشتیبانی به تیکت شما پاسخ دادند.',
      link: '/account/tickets',
    });
  }
  res.json({ ok: true, data: { replied: true } });
});

// Admin Content Management (Banners, Menus, Pages, FAQs)
apiRouter.get('/admin/content', requireAdmin(), (_req: Request, res: Response) => {
  res.json({
    ok: true,
    data: {
      banners: db.prepare('SELECT * FROM banners ORDER BY sort_order ASC, id ASC').all(),
      menus: db.prepare('SELECT * FROM menus ORDER BY location ASC, sort_order ASC').all(),
      pages: db.prepare('SELECT * FROM pages ORDER BY id ASC').all(),
      faqs: db.prepare('SELECT * FROM faqs ORDER BY sort_order ASC, id ASC').all(),
      posts: db.prepare('SELECT * FROM posts ORDER BY id DESC').all(),
    },
  });
});

apiRouter.post('/admin/banners', requireAdmin(), (req: Request, res: Response) => {
  const { title, subtitle, badge_text, cta_text, link_url, gradient_class, position, sort_order } = req.body;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO banners (title, subtitle, badge_text, cta_text, link_url, gradient_class, position, sort_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    title,
    subtitle || '',
    badge_text || 'ویژه',
    cta_text || 'مشاهده',
    link_url || '/products',
    gradient_class || 'from-indigo-600 via-violet-600 to-cyan-500',
    position || 'hero',
    Number(sort_order || 1),
    now,
    now
  );
  res.json({ ok: true, data: { created: true } });
});

apiRouter.delete('/admin/banners/:id', requireAdmin(), (req: Request, res: Response) => {
  db.prepare('DELETE FROM banners WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true, data: { deleted: true } });
});

apiRouter.post('/admin/menus', requireAdmin(), (req: Request, res: Response) => {
  const { location, title, url, sort_order } = req.body;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO menus (location, title, url, sort_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `).run(location || 'header', title, url || '/', Number(sort_order || 1), now, now);
  res.json({ ok: true, data: { created: true } });
});

apiRouter.delete('/admin/menus/:id', requireAdmin(), (req: Request, res: Response) => {
  db.prepare('DELETE FROM menus WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true, data: { deleted: true } });
});

apiRouter.put('/admin/pages/:id', requireAdmin(), (req: Request, res: Response) => {
  const { title, content_html, seo_title, seo_description } = req.body;
  db.prepare(`
    UPDATE pages SET title = ?, content_html = ?, seo_title = ?, seo_description = ?, updated_at = ?
    WHERE id = ?
  `).run(
    title,
    sanitizeHtml(content_html || ''),
    seo_title || title,
    seo_description || '',
    new Date().toISOString(),
    Number(req.params.id)
  );
  res.json({ ok: true, data: { updated: true } });
});

apiRouter.post('/admin/faqs', requireAdmin(), (req: Request, res: Response) => {
  const { question, answer, category } = req.body;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO faqs (question, answer, category, sort_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, 1, 1, ?, ?)
  `).run(question, answer, category || 'عمومی', now, now);
  res.json({ ok: true, data: { created: true } });
});

apiRouter.delete('/admin/faqs/:id', requireAdmin(), (req: Request, res: Response) => {
  db.prepare('DELETE FROM faqs WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true, data: { deleted: true } });
});

// Admin Settings & Theme
apiRouter.get('/admin/settings', requireAdmin(), (_req: Request, res: Response) => {
  res.json({ ok: true, data: getAllSettings() });
});

apiRouter.put('/admin/settings/:key', requireAdmin(), (req: Request, res: Response) => {
  const key = req.params.key;
  const before = getAllSettings()[key];
  updateSettingKey(key, req.body);

  logAudit({
    adminId: req.user!.id,
    adminName: req.user!.name,
    action: `UPDATE_SETTINGS_${key.toUpperCase()}`,
    entityType: 'settings',
    entityId: key,
    before,
    after: req.body,
    ip: req.ip,
  });

  res.json({ ok: true, data: getAllSettings()[key] });
});

// Admin Roles & Audit Logs
apiRouter.get('/admin/roles-and-logs', requireAdmin(), (_req: Request, res: Response) => {
  const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all() as any[];
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100').all();
  res.json({
    ok: true,
    data: {
      roles: roles.map((r) => ({ ...r, permissions: safeJsonParse(r.permissions, []) })),
      logs,
    },
  });
});

apiRouter.post('/admin/roles', requireAdmin(), (req: Request, res: Response) => {
  if (req.user!.role !== 'super_admin') {
    res.status(403).json({ ok: false, error: 'فقط مدیرکل مجاز به تعریف نقش جدید است.' });
    return;
  }
  const { name, slug, permissions } = req.body;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO roles (name, slug, permissions, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    name,
    slug || `role_${Date.now()}`,
    JSON.stringify(Array.isArray(permissions) ? permissions : []),
    now,
    now
  );
  res.json({ ok: true, data: { created: true } });
});

// Admin Database Backup & Clear Sample Data
apiRouter.post('/admin/tools/backup', requireAdmin(), (req: Request, res: Response) => {
  const backupsDir = path.resolve(process.cwd(), 'data', 'backups');
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  const fileName = `gargift-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
  const dest = path.resolve(backupsDir, fileName);
  fs.copyFileSync(DB_PATH, dest);

  logAudit({
    adminId: req.user!.id,
    adminName: req.user!.name,
    action: 'CREATE_DB_BACKUP',
    entityType: 'database',
    entityId: fileName,
    ip: req.ip,
  });

  res.json({ ok: true, data: { fileName, createdAt: new Date().toISOString() } });
});

apiRouter.post('/admin/tools/clear-samples', requireAdmin(), (req: Request, res: Response) => {
  if (req.user!.role !== 'super_admin') {
    res.status(403).json({ ok: false, error: 'فقط مدیرکل می‌تواند داده‌های نمونه را پاک کند.' });
    return;
  }
  runInTransaction(() => {
    db.prepare('DELETE FROM products WHERE is_sample = 1').run();
  });
  logAudit({
    adminId: req.user!.id,
    adminName: req.user!.name,
    action: 'CLEAR_SAMPLE_PRODUCTS',
    entityType: 'products',
    ip: req.ip,
  });
  res.json({ ok: true, data: { cleared: true } });
});

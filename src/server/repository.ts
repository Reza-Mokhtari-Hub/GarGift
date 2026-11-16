import { db, runInTransaction } from './db';
import { DEFAULT_SETTINGS } from './seed';
import { calculateVariantPrice } from '../utils/format';
import { decryptCode } from './crypto';

export function getAllSettings(): Record<string, any> {
  const rows = db.prepare('SELECT key, value_json FROM settings').all() as Array<{
    key: string;
    value_json: string;
  }>;
  const result: Record<string, any> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value_json);
    } catch {
      // keep default
    }
  }
  return result;
}

export function updateSettingKey(key: string, value: any): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings (key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value), now);
}

export function logAudit(params: {
  adminId?: number | null;
  adminName?: string | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  before?: any;
  after?: any;
  ip?: string | null;
}): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO audit_logs (
      admin_id, admin_name, action, entity_type, entity_id, before_json, after_json, ip_address, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.adminId || null,
    params.adminName || 'سیستم',
    params.action,
    params.entityType,
    params.entityId ? String(params.entityId) : null,
    params.before ? JSON.stringify(params.before) : null,
    params.after ? JSON.stringify(params.after) : null,
    params.ip || null,
    now
  );
}

export function createNotification(params: {
  userId?: number | null;
  isAdminTarget?: boolean;
  title: string;
  body: string;
  link?: string;
}): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO notifications (user_id, is_admin_target, title, body, link, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(
    params.userId || null,
    params.isAdminTarget ? 1 : 0,
    params.title,
    params.body,
    params.link || null,
    now
  );
}

export function computeEnrichedVariant(
  variant: any,
  product: any,
  category: any,
  pricingSettings: any
) {
  let availableStock = variant.stock_qty;
  if (variant.stock_mode === 'code_pool') {
    const countRow = db
      .prepare("SELECT COUNT(*) as c FROM codes WHERE variant_id = ? AND status = 'available'")
      .get(variant.id) as { c: number };
    availableStock = Number(countRow?.c || 0);
  } else if (variant.stock_mode === 'unlimited') {
    availableStock = 999;
  }

  const priceCalc = calculateVariantPrice({
    pricingMode: variant.pricing_mode as 'fixed' | 'dynamic',
    fixedPriceToman: variant.fixed_price_toman,
    usdPriceCents: variant.usd_price_cents,
    globalUsdRate: Number(pricingSettings?.globalUsdRate || 69000),
    categoryUsdRate: category?.usd_rate_override,
    productUsdRate: product?.usd_rate_override,
    globalMarginPercent: Number(pricingSettings?.globalMarginPercent ?? 6),
    categoryMarginPercent: category?.margin_percent_override,
    productMarginPercent: product?.margin_percent_override,
    fixedFeeToman: Number(pricingSettings?.fixedFeeToman || 0),
    roundingStepToman: Number(pricingSettings?.roundingStepToman || 1000),
    discountPercent: variant.discount_percent,
    discountAmountToman: variant.discount_amount_toman,
    discountStartAt: variant.discount_start_at,
    discountEndAt: variant.discount_end_at,
  });

  return {
    ...variant,
    available_stock: availableStock,
    in_stock: availableStock > 0,
    base_price_toman: priceCalc.basePriceToman,
    final_price_toman: priceCalc.finalPriceToman,
    discount_amount_calculated: priceCalc.discountAmountToman,
    discount_percent_calculated: priceCalc.discountPercent,
    is_discount_active: priceCalc.isDiscountActive,
    effective_usd_rate: priceCalc.effectiveUsdRate,
  };
}

export function getEnrichedProducts(filters?: {
  categorySlug?: string;
  brand?: string;
  region?: string;
  search?: string;
  onlyInStock?: boolean;
  onlyDiscounted?: boolean;
  featuredOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  includeInactive?: boolean;
}) {
  const settings = getAllSettings();
  const pricingSettings = settings.pricing;

  const categories = db
    .prepare('SELECT * FROM categories WHERE deleted_at IS NULL')
    .all() as any[];
  const catMap = new Map(categories.map((c) => [c.id, c]));

  let sql = 'SELECT * FROM products WHERE deleted_at IS NULL';
  const params: any[] = [];

  if (!filters?.includeInactive) {
    sql += " AND status = 'active'";
  }
  if (filters?.categorySlug) {
    const cat = categories.find((c) => c.slug === filters.categorySlug);
    if (cat) {
      sql += ' AND category_id = ?';
      params.push(cat.id);
    } else {
      return [];
    }
  }
  if (filters?.brand) {
    sql += ' AND brand = ?';
    params.push(filters.brand);
  }
  if (filters?.region) {
    sql += ' AND region LIKE ?';
    params.push(`%${filters.region}%`);
  }
  if (filters?.featuredOnly) {
    sql += ' AND is_featured = 1';
  }
  if (filters?.search) {
    sql += ' AND (title LIKE ? OR brand LIKE ? OR short_description LIKE ? OR slug LIKE ?)';
    const q = `%${filters.search}%`;
    params.push(q, q, q, q);
  }

  sql += ' ORDER BY sort_order ASC, id DESC';

  const rawProducts = db.prepare(sql).all(...params) as any[];
  const allVariants = db
    .prepare('SELECT * FROM product_variants ORDER BY sort_order ASC, id ASC')
    .all() as any[];
  const allFields = db
    .prepare('SELECT * FROM product_fields ORDER BY sort_order ASC, id ASC')
    .all() as any[];

  const enriched = rawProducts.map((p) => {
    const cat = catMap.get(p.category_id);
    const pVariants = allVariants
      .filter((v) => v.product_id === p.id && (filters?.includeInactive || v.is_active === 1))
      .map((v) => computeEnrichedVariant(v, p, cat, pricingSettings));
    const pFields = allFields
      .filter((f) => f.product_id === p.id)
      .map((f) => ({
        ...f,
        options: safeJsonParse(f.options_json, []),
      }));

    const minVariantPrice =
      pVariants.length > 0
        ? Math.min(...pVariants.map((v) => v.final_price_toman))
        : 0;
    const maxDiscountPercent =
      pVariants.length > 0
        ? Math.max(...pVariants.map((v) => v.discount_percent_calculated || 0))
        : 0;
    const hasStock = pVariants.some((v) => v.in_stock);

    return {
      ...p,
      category_name: cat?.name || '',
      category_slug: cat?.slug || '',
      images: safeJsonParse(p.images_json, []),
      badges: safeJsonParse(p.badges_json, []),
      faqs: safeJsonParse(p.faqs_json, []),
      variants: pVariants,
      fields: pFields,
      starting_price_toman: minVariantPrice,
      max_discount_percent: maxDiscountPercent,
      in_stock: hasStock,
    };
  });

  let filtered = enriched;
  if (filters?.onlyInStock) {
    filtered = filtered.filter((p) => p.in_stock);
  }
  if (filters?.onlyDiscounted) {
    filtered = filtered.filter((p) => p.max_discount_percent > 0);
  }
  if (filters?.minPrice !== undefined && filters.minPrice > 0) {
    filtered = filtered.filter((p) => p.starting_price_toman >= filters.minPrice!);
  }
  if (filters?.maxPrice !== undefined && filters.maxPrice > 0) {
    filtered = filtered.filter((p) => p.starting_price_toman <= filters.maxPrice!);
  }

  if (filters?.sort === 'price_asc') {
    filtered.sort((a, b) => a.starting_price_toman - b.starting_price_toman);
  } else if (filters?.sort === 'price_desc') {
    filtered.sort((a, b) => b.starting_price_toman - a.starting_price_toman);
  } else if (filters?.sort === 'newest') {
    filtered.sort((a, b) => b.id - a.id);
  }

  return filtered;
}

/**
 * Fulfill an order automatically after payment is confirmed.
 * Must be called inside or wraps a transaction.
 */
export function fulfillPaidOrder(orderId: number, actorId?: number): {
  status: string;
  deliveredAllAuto: boolean;
} {
  const now = new Date().toISOString();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) throw new Error('سفارش یافت نشد');

  const items = db
    .prepare('SELECT * FROM order_items WHERE order_id = ?')
    .all(orderId) as any[];

  let allItemsAutoDelivered = true;
  let waitingForStock = false;

  for (const item of items) {
    const existingCodes = safeJsonParse(item.delivered_codes_json, []);
    if (existingCodes.length >= item.qty) {
      continue;
    }

    if (item.delivery_type === 'auto_code') {
      const needed = item.qty - existingCodes.length;
      const availableCodes = db
        .prepare(
          "SELECT * FROM codes WHERE variant_id = ? AND status = 'available' ORDER BY id ASC LIMIT ?"
        )
        .all(item.variant_id, needed) as any[];

      if (availableCodes.length < needed) {
        waitingForStock = true;
        allItemsAutoDelivered = false;
      } else {
        const assignedEncrypted: string[] = [...existingCodes];
        for (const codeRow of availableCodes) {
          db.prepare(
            "UPDATE codes SET status = 'sold', order_id = ?, order_item_id = ?, sold_at = ?, updated_at = ? WHERE id = ? AND status = 'available'"
          ).run(orderId, item.id, now, now, codeRow.id);
          assignedEncrypted.push(codeRow.code_encrypted);
        }
        db.prepare(
          'UPDATE order_items SET delivered_codes_json = ?, updated_at = ? WHERE id = ?'
        ).run(JSON.stringify(assignedEncrypted), now, item.id);
      }
    } else {
      allItemsAutoDelivered = false;
    }
  }

  let nextStatus = 'processing';
  let eventDesc = 'پرداخت تأیید شد و سفارش در صف انجام قرار گرفت.';

  if (waitingForStock) {
    nextStatus = 'waiting_stock';
    eventDesc = 'پرداخت تأیید شد؛ در انتظار تأمین موجودی انبار کد.';
    createNotification({
      isAdminTarget: true,
      title: `کمبود موجودی کد برای سفارش ${order.order_number}`,
      body: `سفارش ${order.order_number} پرداخت شد اما موجودی کد کافی نبود و به وضعیت «در انتظار موجودی» رفت.`,
      link: `/admin/orders`,
    });
  } else if (allItemsAutoDelivered) {
    nextStatus = 'delivered';
    eventDesc = 'پرداخت تأیید شد و کدهای گیفت‌کارت به صورت خودکار تحویل گردید.';
  }

  db.prepare(
    'UPDATE orders SET status = ?, delivery_result_text = COALESCE(delivery_result_text, ?), updated_at = ? WHERE id = ?'
  ).run(
    nextStatus,
    nextStatus === 'delivered' ? 'کدها به صورت آنی و خودکار تحویل داده شدند.' : null,
    now,
    orderId
  );

  db.prepare(
    'INSERT INTO order_events (order_id, status, actor_type, actor_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(orderId, nextStatus, actorId ? 'admin' : 'system', actorId || null, eventDesc, now);

  createNotification({
    userId: order.user_id,
    title: `به‌روزرسانی وضعیت سفارش ${order.order_number}`,
    body: eventDesc,
    link: `/account/orders`,
  });

  // Loyalty cashback & Referral reward if delivered or paid
  const settings = getAllSettings();
  const cashbackPercent = Number(settings.pricing?.loyaltyCashbackPercent || 0);
  if (cashbackPercent > 0 && order.final_toman > 0) {
    const existingCashback = db
      .prepare(
        "SELECT id FROM wallet_transactions WHERE reference_type = 'cashback' AND reference_id = ?"
      )
      .get(orderId);
    if (!existingCashback) {
      const cashbackAmount = Math.round((order.final_toman * cashbackPercent) / 100);
      if (cashbackAmount >= 500) {
        const u = db
          .prepare('SELECT wallet_balance, referred_by_id FROM users WHERE id = ?')
          .get(order.user_id) as any;
        if (u) {
          const newBal = u.wallet_balance + cashbackAmount;
          db.prepare('UPDATE users SET wallet_balance = ?, updated_at = ? WHERE id = ?').run(
            newBal,
            now,
            order.user_id
          );
          db.prepare(`
            INSERT INTO wallet_transactions (
              user_id, type, amount_toman, balance_after_toman, reference_type, reference_id, description, created_at
            ) VALUES (?, 'reward', ?, ?, 'cashback', ?, ?, ?)
          `).run(
            order.user_id,
            cashbackAmount,
            newBal,
            orderId,
            `پاداش کش‌بک وفاداری خرید سفارش ${order.order_number}`,
            now
          );
        }
      }
    }
  }

  return { status: nextStatus, deliveredAllAuto: allItemsAutoDelivered };
}

export function safeJsonParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

export function formatOrderWithDetails(orderRow: any, canRevealCodes = false) {
  const items = db
    .prepare('SELECT * FROM order_items WHERE order_id = ?')
    .all(orderRow.id) as any[];
  const events = db
    .prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY id ASC')
    .all(orderRow.id) as any[];
  const payments = db
    .prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC')
    .all(orderRow.id) as any[];
  const user = db
    .prepare('SELECT id, name, phone, email FROM users WHERE id = ?')
    .get(orderRow.user_id) as any;

  return {
    ...orderRow,
    user_name: user?.name || 'کاربر',
    user_phone: user?.phone || '',
    user_email: user?.email || '',
    items: items.map((it) => {
      const encryptedList: string[] = safeJsonParse(it.delivered_codes_json, []);
      const codes = canRevealCodes ? encryptedList.map((enc) => decryptCode(enc)) : [];
      return {
        ...it,
        custom_fields: safeJsonParse(it.custom_fields_json, {}),
        delivered_codes: codes,
      };
    }),
    events,
    payments,
  };
}

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
const BACKUPS_DIR = path.resolve(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export const DB_PATH = path.resolve(DATA_DIR, 'gargift.sqlite');

export const db = new DatabaseSync(DB_PATH);

// Enable WAL and Foreign Keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA synchronous = NORMAL;');

export function runInTransaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore rollback error
    }
    throw err;
  }
}

export function initializeSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

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
      custom_role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'active',
      ban_reason TEXT,
      wallet_balance INTEGER NOT NULL DEFAULT 0,
      referral_code TEXT UNIQUE,
      referred_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
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
      parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
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
      category_id INTEGER NOT NULL REFERENCES categories(id),
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
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
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
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
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
      variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
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

    CREATE INDEX IF NOT EXISTS idx_codes_variant_status ON codes(variant_id, status);

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
      category_id INTEGER,
      product_id INTEGER,
      user_id INTEGER,
      expires_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending_payment',
      subtotal_toman INTEGER NOT NULL,
      discount_toman INTEGER NOT NULL DEFAULT 0,
      gateway_fee_toman INTEGER NOT NULL DEFAULT 0,
      final_toman INTEGER NOT NULL,
      coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL,
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
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      variant_id INTEGER NOT NULL REFERENCES product_variants(id),
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
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      actor_id INTEGER,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
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
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      amount_toman INTEGER NOT NULL,
      balance_after_toman INTEGER NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      description TEXT NOT NULL,
      admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coupon_usages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      discount_amount_toman INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
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
      user_id INTEGER NOT NULL REFERENCES users(id),
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      subject TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'پشتیبانی فنی',
      priority TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ticket_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      is_admin INTEGER NOT NULL DEFAULT 0,
      message TEXT NOT NULL,
      attachment_url TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
      start_at TEXT,
      end_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location TEXT NOT NULL DEFAULT 'header',
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      parent_id INTEGER REFERENCES menus(id) ON DELETE CASCADE,
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
      admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      url TEXT NOT NULL,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      admin_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      before_json TEXT,
      after_json TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL REFERENCES users(id),
      referred_id INTEGER NOT NULL REFERENCES users(id),
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      reward_toman INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, product_id)
    );
  `);
}

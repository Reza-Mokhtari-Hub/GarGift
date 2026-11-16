import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';
import { initializeSchema, db, runInTransaction, DB_PATH } from './src/server/db';
import { seedDatabase } from './src/server/seed';
import { attachAuthUser } from './src/server/auth';
import { apiRouter } from './src/server/routes';

async function startServer() {
  // Initialize SQLite Schema & Idempotent Seed Data
  initializeSchema();
  seedDatabase();

  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.set('trust proxy', 1);

  // Security headers configured for iframe compatibility
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false,
    })
  );

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Serve uploaded files safely
  const uploadsDir = path.resolve(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  // Rate limit sensitive auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً کمی صبر کنید.' },
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  // Attach authenticated user from JWT cookie or Bearer header
  app.use(attachAuthUser);

  // Dynamic robots.txt & sitemap.xml
  app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const products = db
      .prepare("SELECT slug, updated_at FROM products WHERE deleted_at IS NULL AND status = 'active'")
      .all() as Array<{ slug: string; updated_at: string }>;
    const categories = db
      .prepare('SELECT slug, updated_at FROM categories WHERE deleted_at IS NULL AND is_active = 1')
      .all() as Array<{ slug: string; updated_at: string }>;
    const pages = db
      .prepare('SELECT slug, updated_at FROM pages WHERE is_active = 1')
      .all() as Array<{ slug: string; updated_at: string }>;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    xml += `  <url><loc>${baseUrl}/</loc><priority>1.0</priority></url>\n`;
    xml += `  <url><loc>${baseUrl}/products</loc><priority>0.9</priority></url>\n`;
    for (const c of categories) {
      xml += `  <url><loc>${baseUrl}/products?category=${c.slug}</loc><priority>0.8</priority></url>\n`;
    }
    for (const p of products) {
      xml += `  <url><loc>${baseUrl}/product/${p.slug}</loc><lastmod>${p.updated_at.slice(0, 10)}</lastmod><priority>0.8</priority></url>\n`;
    }
    for (const pg of pages) {
      xml += `  <url><loc>${baseUrl}/page/${pg.slug}</loc><priority>0.6</priority></url>\n`;
    }
    xml += `</urlset>`;
    res.type('application/xml').send(xml);
  });

  // Mount API routes
  app.use('/api', apiRouter);

  // Scheduled background tasks (node-cron)
  // 1. Every 2 minutes: auto-cancel expired pending_payment orders
  cron.schedule('*/2 * * * *', () => {
    try {
      const now = new Date().toISOString();
      const expiredOrders = db
        .prepare(
          "SELECT id, order_number FROM orders WHERE status = 'pending_payment' AND expires_at IS NOT NULL AND expires_at < ?"
        )
        .all(now) as Array<{ id: number; order_number: string }>;

      if (expiredOrders.length > 0) {
        runInTransaction(() => {
          for (const ord of expiredOrders) {
            db.prepare(
              "UPDATE orders SET status = 'cancelled', delivery_result_text = 'لغو خودکار به دلیل اتمام مهلت پرداخت', updated_at = ? WHERE id = ?"
            ).run(now, ord.id);
            db.prepare(
              "UPDATE codes SET status = 'available', order_id = NULL, reserved_at = NULL, updated_at = ? WHERE order_id = ? AND status = 'reserved'"
            ).run(now, ord.id);
            db.prepare(`
              INSERT INTO order_events (order_id, status, actor_type, description, created_at)
              VALUES (?, 'cancelled', 'system', 'سفارش به دلیل اتمام مهلت پرداخت به صورت خودکار لغو شد.', ?)
            `).run(ord.id, now);
          }
        });
      }
    } catch (err) {
      console.error('Cron auto-cancel error:', err);
    }
  });

  // 2. Daily at 03:00 AM: Database backup keeping last 7 copies
  cron.schedule('0 3 * * *', () => {
    try {
      const backupsDir = path.resolve(process.cwd(), 'data', 'backups');
      if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
      const fileName = `auto-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;
      fs.copyFileSync(DB_PATH, path.resolve(backupsDir, fileName));

      const files = fs
        .readdirSync(backupsDir)
        .filter((f) => f.endsWith('.sqlite'))
        .sort()
        .reverse();
      for (const oldFile of files.slice(7)) {
        fs.unlinkSync(path.resolve(backupsDir, oldFile));
      }
    } catch (err) {
      console.error('Cron backup error:', err);
    }
  });

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GarGift+ server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

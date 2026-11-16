import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db';
import { safeJsonParse } from './repository';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_fallback_jwt_secret_gargift_plus_2026';
export const AUTH_COOKIE_NAME = 'gargift_token';

export interface AuthUser {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  custom_role_id: number | null;
  status: string;
  wallet_balance: number;
  referral_code: string | null;
  must_change_password: number;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signUserToken(userId: number): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function setAuthCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
}

export function loadUserFromId(userId: number): AuthUser | null {
  const row = db
    .prepare(
      'SELECT id, name, phone, email, role, custom_role_id, status, wallet_balance, referral_code, must_change_password, deleted_at FROM users WHERE id = ?'
    )
    .get(userId) as any;

  if (!row || row.deleted_at) return null;

  let permissions: string[] = [];
  if (row.role === 'super_admin') {
    permissions = ['*'];
  } else if (row.role === 'admin' && row.custom_role_id) {
    const r = db
      .prepare('SELECT permissions FROM roles WHERE id = ?')
      .get(row.custom_role_id) as any;
    permissions = safeJsonParse(r?.permissions, []);
  } else if (row.role === 'admin') {
    permissions = ['orders.view', 'products.view', 'categories.view', 'tickets.view'];
  }

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    role: row.role,
    custom_role_id: row.custom_role_id,
    status: row.status,
    wallet_balance: row.wallet_balance,
    referral_code: row.referral_code,
    must_change_password: row.must_change_password,
    permissions,
  };
}

export function attachAuthUser(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token =
      req.cookies?.[AUTH_COOKIE_NAME] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as { sub?: number };
      if (decoded?.sub) {
        const user = loadUserFromId(Number(decoded.sub));
        if (user && user.status === 'active') {
          req.user = user;
        }
      }
    }
  } catch {
    // invalid or expired token
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ ok: false, error: 'لطفاً ابتدا وارد حساب کاربری خود شوید.' });
    return;
  }
  if (req.user.status !== 'active') {
    res.status(403).json({ ok: false, error: 'حساب کاربری شما مسدود شده است.' });
    return;
  }
  next();
}

export function requireAdmin(permission?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ ok: false, error: 'لطفاً وارد حساب مدیریت شوید.' });
      return;
    }
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      res.status(403).json({ ok: false, error: 'شما مجوز دسترسی به پنل مدیریت را ندارید.' });
      return;
    }
    if (permission && req.user.role !== 'super_admin') {
      const hasPerm =
        req.user.permissions.includes('*') || req.user.permissions.includes(permission);
      if (!hasPerm) {
        res.status(403).json({
          ok: false,
          error: `شما مجوز «${permission}» برای انجام این عملیات را ندارید.`,
        });
        return;
      }
    }
    next();
  };
}

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db';

// ─── JWT_SECRET resolution ─────────────────────────────────────────
// Rules:
//   - In production, JWT_SECRET is REQUIRED. If missing, refuse to sign/verify
//     tokens by throwing on first use (generateToken / verifyToken). We do NOT
//     throw at module-load time because Next.js may import this module during
//     `next build` (where env vars aren't loaded yet) — NEXT_BUILD skips the
//     hard requirement, mirroring the previous behavior.
//   - In development only, fall back to a known insecure dev secret with a
//     loud warning. Never expose the actual secret value in logs.
//   - The dev fallback MUST remain distinct from any production secret.

const DEV_FALLBACK_SECRET = 'kfm-delice-dev-secret-change-in-prod';
const isProduction = process.env.NODE_ENV === 'production';
const isNextBuild = process.env.NEXT_BUILD === 'true';

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }
  if (isProduction && !isNextBuild) {
    throw new Error(
      '[AUTH] FATAL: JWT_SECRET environment variable is missing or too short (min 16 chars). ' +
      'Refusing to sign/verify tokens in production. Set JWT_SECRET in Render → Environment.'
    );
  }
  // Dev / build only — warn loudly, do not log the actual value.
  if (!secret) {
    console.warn(
      '[AUTH] WARNING: JWT_SECRET is not set — using insecure dev fallback. ' +
      'Set JWT_SECRET (≥16 chars) in .env before deploying to production.'
    );
  } else if (secret.length < 16) {
    console.warn(
      '[AUTH] WARNING: JWT_SECRET is shorter than 16 chars — using insecure dev fallback. ' +
      'Generate a stronger secret (e.g. `openssl rand -hex 32`).'
    );
  }
  return DEV_FALLBACK_SECRET;
}

// Lazily resolve so the production throw happens on first token operation,
// not at import time (safer for tooling, tests, and `next build`).
let _cachedSecret: string | null = null;
function getJwtSecret(): string {
  if (_cachedSecret === null) {
    _cachedSecret = resolveJwtSecret();
  }
  return _cachedSecret;
}

const JWT_EXPIRES_IN = '24h';

// Hash a password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify a password against a hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ────────────────────────────────────────────────────────────────
// JWT Token Generation
// ────────────────────────────────────────────────────────────────

// Extended JWT payload with tenant context
interface TokenPayload {
  id: string;
  email: string;
  role: string;
  type: 'admin' | 'customer' | 'driver' | 'platform_admin';
  restaurantId?: string;
  restaurantSlug?: string;
}

// Generate a JWT token
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  type: 'admin' | 'customer' | 'driver' | 'platform_admin';
  restaurantId?: string;
  restaurantSlug?: string;
}

// Verify a JWT token
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (typeof decoded === 'object' && decoded !== null && 'id' in decoded && 'type' in decoded) {
      return decoded as JwtPayload;
    }
    return null;
  } catch {
    return null;
  }
}

// Extract token from Authorization header
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// ────────────────────────────────────────────────────────────────
// Authentication Helpers — Tenant-aware
// ────────────────────────────────────────────────────────────────

interface AuthenticatedAdmin {
  id: string;
  email: string;
  role: string;
  restaurantId: string;
  restaurantSlug: string;
}

// Authenticate an admin request - returns admin payload with tenant context
export async function authenticateAdmin(request: Request): Promise<AuthenticatedAdmin | null> {
  const token = extractToken(request);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'admin') return null;
  // Verify admin still exists and is active — use Prisma client for
  // cross-database compatibility (raw SQL `FROM Admin` fails on PostgreSQL
  // due to identifier case-folding).
  try {
    const admin = await db.admin.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, role: true, status: true, restaurantId: true },
    });
    if (!admin || admin.status === 'inactive') return null;
    return {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      restaurantId: admin.restaurantId,
      restaurantSlug: payload.restaurantSlug || '',
    };
  } catch {
    return null;
  }
}

interface AuthenticatedCustomer {
  id: string;
  email: string;
  name: string;
  restaurantId: string;
  restaurantSlug: string;
}

// Authenticate a customer request
export async function authenticateCustomer(request: Request): Promise<AuthenticatedCustomer | null> {
  const token = extractToken(request);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'customer') return null;
  try {
    const customer = await db.customer.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, status: true, restaurantId: true },
    });
    if (!customer || customer.status === 'inactive') return null;
    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      restaurantId: customer.restaurantId,
      restaurantSlug: payload.restaurantSlug || '',
    };
  } catch {
    return null;
  }
}

interface AuthenticatedDriver {
  id: string;
  email: string;
  name: string;
  phone: string;
  vehicle: string;
  status: string;
  zone: string;
  restaurantId: string;
  restaurantSlug: string;
}

// Authenticate a driver request
export async function authenticateDriver(request: Request): Promise<AuthenticatedDriver | null> {
  const token = extractToken(request);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'driver') return null;
  try {
    const driver = await db.driver.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, phone: true, vehicle: true, status: true, zone: true, restaurantId: true },
    });
    if (!driver) return null;
    return {
      id: driver.id,
      email: driver.email,
      name: driver.name,
      phone: driver.phone,
      vehicle: driver.vehicle,
      status: driver.status,
      zone: driver.zone,
      restaurantId: driver.restaurantId,
      restaurantSlug: payload.restaurantSlug || '',
    };
  } catch {
    return null;
  }
}

// Authenticate either admin, customer, driver, or platform_admin
export async function authenticateAny(request: Request): Promise<{ id: string; email: string; role: string; type: 'admin' | 'customer' | 'driver' | 'platform_admin'; restaurantId?: string; restaurantSlug?: string } | null> {
  const token = extractToken(request);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  try {
    if (payload.type === 'platform_admin') {
      const platformAdmin = await db.platformAdmin.findUnique({
        where: { id: payload.id },
        select: { id: true, status: true },
      });
      if (!platformAdmin || platformAdmin.status === 'inactive') return null;
      return { ...payload };
    }
    if (payload.type === 'admin') {
      const admin = await db.admin.findUnique({
        where: { id: payload.id },
        select: { id: true, status: true, restaurantId: true },
      });
      if (!admin || admin.status === 'inactive') return null;
      return { ...payload, restaurantId: admin.restaurantId };
    } else if (payload.type === 'driver') {
      const driver = await db.driver.findUnique({
        where: { id: payload.id },
        select: { id: true, restaurantId: true },
      });
      if (!driver) return null;
      return { ...payload, restaurantId: driver.restaurantId };
    } else {
      const customer = await db.customer.findUnique({
        where: { id: payload.id },
        select: { id: true, status: true, restaurantId: true },
      });
      if (!customer || customer.status === 'inactive') return null;
      return { ...payload, restaurantId: customer.restaurantId };
    }
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────
// Platform Admin Authentication
// ────────────────────────────────────────────────────────────────

interface AuthenticatedPlatformAdmin {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function authenticatePlatformAdmin(request: Request): Promise<AuthenticatedPlatformAdmin | null> {
  const token = extractToken(request);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'platform_admin') return null;
  try {
    const platformAdmin = await db.platformAdmin.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
    if (!platformAdmin || platformAdmin.status === 'inactive') return null;
    return {
      id: platformAdmin.id,
      email: platformAdmin.email,
      name: platformAdmin.name,
      role: platformAdmin.role,
    };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────
// Admin role registry & permission matrix
// ────────────────────────────────────────────────────────────────

/**
 * Canonical list of admin roles recognized by the platform.
 * Order matters — dropdowns display roles in this order.
 *
 *   admin              — Super Admin restaurant (full access)
 *   manager            — Gérant adjoint (operational management)
 *   staff              — Personnel polyvalent (orders, reservations, kitchen view)
 *   cashier            — Caissier (POS, payments, invoices, customer list)
 *   kitchen            — Chef Cuisine (kitchen display, stock view, order status)
 *   delivery_manager   — Responsable Livraison (drivers, deliveries)
 *   host               — Hôte d'Accueil (reservations only)
 *   accountant         — Comptable (invoices, expenses, quotes, analytics — no ops)
 */
export const ADMIN_ROLES = [
  "admin",
  "manager",
  "staff",
  "cashier",
  "kitchen",
  "delivery_manager",
  "host",
  "accountant",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * Permission groups for API routes. Each group is a list of roles
 * allowed to call a given endpoint family. Add new roles to existing
 * groups here, then reference the group in the API route via
 * `hasRole(admin.role, PERMISSION_GROUPS.ORDERS_WRITE)`.
 *
 * Groups are intentionally more granular than the previous ad-hoc
 * `["admin", "manager"]` arrays — this lets us grant scoped access
 * to the new specialist roles (cashier, kitchen, etc.) without
 * copy-pasting role lists everywhere.
 */
export const PERMISSION_GROUPS = {
  // User management — admin only (super-admin of the restaurant)
  ADMINS_MANAGE: ["admin"],
  CUSTOMERS_MANAGE: ["admin"],
  CUSTOMERS_READ: ["admin", "manager", "cashier"],

  // Operational management (manager-level)
  MENU_MANAGE: ["admin", "manager"],
  MENU_READ: ["admin", "manager", "kitchen", "staff"],
  STAFF_MANAGE: ["admin", "manager"],
  DRIVERS_MANAGE: ["admin", "manager", "delivery_manager"],
  DRIVERS_LOCATION: ["admin", "manager", "delivery_manager"],
  STOCK_MANAGE: ["admin", "manager"],
  STOCK_READ: ["admin", "manager", "staff", "kitchen"],
  LOYALTY_MANAGE: ["admin", "manager"],
  LOYALTY_DELETE: ["admin"],

  // Finance & invoicing
  INVOICES_MANAGE: ["admin", "manager", "cashier", "accountant"],
  QUOTES_MANAGE: ["admin", "manager", "accountant"],
  EXPENSES_MANAGE: ["admin", "manager", "accountant"],
  PAYMENTS_MANAGE: ["admin", "manager", "cashier", "accountant"],
  ANALYTICS_READ: ["admin", "manager", "accountant"],
  STATS_READ: ["admin", "manager", "accountant"],

  // Operations
  ORDERS_WRITE: ["admin", "manager", "staff", "cashier", "kitchen", "delivery_manager"],
  ORDERS_READ: ["admin", "manager", "staff", "cashier", "kitchen", "delivery_manager", "host"],
  RESERVATIONS_WRITE: ["admin", "manager", "staff", "host"],
  RESERVATIONS_READ: ["admin", "manager", "staff", "host"],
  KITCHEN_DISPLAY: ["admin", "manager", "staff", "kitchen"],
  REVIEWS_MANAGE: ["admin", "manager"],

  // Communications
  EMAIL_SEND: ["admin", "manager"],
  PUSH_SEND: ["admin", "manager"],
  WS_NOTIFY: ["admin", "manager"],

  // Platform
  DASHBOARD_VIEW: ["admin", "manager"],
  SEED_RUN: ["admin"],
} as const;

/**
 * Check if admin has any of the required roles.
 * Kept as a simple `includes` for backwards compatibility —
 * any new role must appear in the relevant PERMISSION_GROUPS
 * entry to be granted access.
 */
export function hasRole(adminRole: string, requiredRoles: readonly string[]): boolean {
  return (requiredRoles as readonly string[]).includes(adminRole);
}

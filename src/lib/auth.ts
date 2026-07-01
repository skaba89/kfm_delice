import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'kfm-delice-dev-secret-change-in-prod';
const _JWT_SECRET: string = JWT_SECRET;

// Warn at startup if the insecure fallback is being used
// Note: Next.js build phase runs in "production" mode but without .env,
// so we skip the fatal check during build (next build sets NEXT_BUILD=true).
if (!process.env.JWT_SECRET && !process.env.NEXT_BUILD) {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[AUTH] FATAL: JWT_SECRET environment variable is not set. ' +
      'Using insecure fallback — this is dangerous in production!'
    );
  } else {
    console.warn(
      '[AUTH] WARNING: JWT_SECRET is not set — using insecure dev fallback. ' +
      'Set JWT_SECRET in your .env file before deploying to production.'
    );
  }
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
  return jwt.sign(payload, _JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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
    const decoded = jwt.verify(token, _JWT_SECRET);
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
  // Verify admin still exists and is active — use raw SQL to avoid schema mismatch (missing columns)
  try {
    const admins = await db.$queryRawUnsafe<Array<{
      id: string; email: string; role: string; status: string; restaurantId: string;
    }>>('SELECT id, email, role, status, restaurantId FROM Admin WHERE id = ?', payload.id);
    const admin = admins[0];
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
  // Use raw SQL to avoid schema mismatch
  try {
    const customers = await db.$queryRawUnsafe<Array<{
      id: string; email: string; name: string; status: string; restaurantId: string;
    }>>('SELECT id, email, name, status, restaurantId FROM Customer WHERE id = ?', payload.id);
    const customer = customers[0];
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
  // Use raw SQL to avoid schema mismatch
  try {
    const drivers = await db.$queryRawUnsafe<Array<{
      id: string; email: string; name: string; phone: string; vehicle: string; status: string; zone: string; restaurantId: string;
    }>>('SELECT id, email, name, phone, vehicle, status, zone, restaurantId FROM Driver WHERE id = ?', payload.id);
    const driver = drivers[0];
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
  // Use raw SQL to avoid schema mismatch (missing columns like mustChangePassword)
  try {
    if (payload.type === 'platform_admin') {
      const rows = await db.$queryRawUnsafe<Array<{ id: string; status: string }>>('SELECT id, status FROM PlatformAdmin WHERE id = ?', payload.id);
      if (!rows[0] || rows[0].status === 'inactive') return null;
      return { ...payload };
    }
    if (payload.type === 'admin') {
      const rows = await db.$queryRawUnsafe<Array<{ id: string; status: string; restaurantId: string }>>('SELECT id, status, restaurantId FROM Admin WHERE id = ?', payload.id);
      if (!rows[0] || rows[0].status === 'inactive') return null;
      return { ...payload, restaurantId: rows[0].restaurantId };
    } else if (payload.type === 'driver') {
      const rows = await db.$queryRawUnsafe<Array<{ id: string; restaurantId: string }>>('SELECT id, restaurantId FROM Driver WHERE id = ?', payload.id);
      if (!rows[0]) return null;
      return { ...payload, restaurantId: rows[0].restaurantId };
    } else {
      const rows = await db.$queryRawUnsafe<Array<{ id: string; status: string; restaurantId: string }>>('SELECT id, status, restaurantId FROM Customer WHERE id = ?', payload.id);
      if (!rows[0] || rows[0].status === 'inactive') return null;
      return { ...payload, restaurantId: rows[0].restaurantId };
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
  // Use raw SQL to avoid schema mismatch
  try {
    const rows = await db.$queryRawUnsafe<Array<{
      id: string; email: string; name: string; role: string; status: string;
    }>>('SELECT id, email, name, role, status FROM PlatformAdmin WHERE id = ?', payload.id);
    const platformAdmin = rows[0];
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

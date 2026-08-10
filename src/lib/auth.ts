import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db';

const DEV_FALLBACK_SECRET = 'kfm-delice-dev-secret-change-in-prod';
const isProduction = process.env.NODE_ENV === 'production';
const isNextBuild = process.env.NEXT_BUILD === 'true';

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (isProduction && !isNextBuild) {
    throw new Error(
      '[AUTH] FATAL: JWT_SECRET environment variable is missing or too short (min 16 chars). ' +
      'Refusing to sign/verify tokens in production. Set JWT_SECRET in Render → Environment.'
    );
  }
  if (!secret) {
    console.warn('[AUTH] WARNING: JWT_SECRET is not set — using insecure dev fallback.');
  } else if (secret.length < 16) {
    console.warn('[AUTH] WARNING: JWT_SECRET is shorter than 16 chars — using insecure dev fallback.');
  }
  return DEV_FALLBACK_SECRET;
}

let _cachedSecret: string | null = null;
function getJwtSecret(): string {
  if (_cachedSecret === null) _cachedSecret = resolveJwtSecret();
  return _cachedSecret;
}

const JWT_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as string;
const JWT_ISSUER = process.env.JWT_ISSUER || 'kfm-delice';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'kfm-delice-users';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

interface TokenPayload {
  id: string;
  email: string;
  role: string;
  type: 'admin' | 'customer' | 'driver' | 'platform_admin';
  restaurantId?: string;
  restaurantSlug?: string;
  tokenVersion?: number;
}

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  type: 'admin' | 'customer' | 'driver' | 'platform_admin';
  restaurantId?: string;
  restaurantSlug?: string;
  tokenVersion?: number;
  jti?: string;
  iat?: number;
  exp?: number;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(
    { ...payload, tokenVersion: payload.tokenVersion ?? 0 },
    getJwtSecret(),
    {
      expiresIn: JWT_EXPIRES_IN as any,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      jwtid: `${payload.type}-${payload.id}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
    }
  );
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (typeof decoded === 'object' && decoded !== null && 'id' in decoded && 'type' in decoded) {
      return decoded as JwtPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Access-token revocation is security-critical. Protected routes already depend
 * on the database for their user/tenant profile, so a failure to query the
 * revocation table is treated as revoked instead of silently failing open.
 */
export async function isTokenRevoked(payload: JwtPayload): Promise<boolean> {
  if (!payload.jti) return true;
  try {
    const revoked = await db.revokedToken.findUnique({
      where: { jti: payload.jti },
      select: { id: true },
    });
    return revoked !== null;
  } catch (error) {
    console.error('[auth] Failed to check RevokedToken:', error);
    return true;
  }
}

/**
 * Admin, customer and platform-admin access tokens must carry the same
 * tokenVersion as the persisted user. Drivers currently have no tokenVersion
 * column, so they are protected by short TTL + explicit jti revocation.
 */
export async function isTokenVersionValid(payload: JwtPayload): Promise<boolean> {
  if (payload.type === 'driver') return true;
  if (payload.tokenVersion === undefined) return false;

  try {
    let dbTokenVersion: number | undefined;
    if (payload.type === 'admin') {
      const admin = await db.admin.findUnique({
        where: { id: payload.id },
        select: { tokenVersion: true },
      });
      dbTokenVersion = admin?.tokenVersion;
    } else if (payload.type === 'customer') {
      const customer = await db.customer.findUnique({
        where: { id: payload.id },
        select: { tokenVersion: true },
      });
      dbTokenVersion = customer?.tokenVersion;
    } else if (payload.type === 'platform_admin') {
      const platformAdmin = await db.platformAdmin.findUnique({
        where: { id: payload.id },
        select: { tokenVersion: true },
      });
      dbTokenVersion = platformAdmin?.tokenVersion;
    }
    return dbTokenVersion !== undefined && dbTokenVersion === payload.tokenVersion;
  } catch (error) {
    console.error('[auth] Failed to check tokenVersion:', error);
    return false;
  }
}

export async function isAccessSessionValid(payload: JwtPayload): Promise<boolean> {
  if (await isTokenRevoked(payload)) return false;
  return isTokenVersionValid(payload);
}

export async function revokeToken(
  jti: string,
  userId: string,
  userType: string,
  expiresAt: Date,
  reason: string = 'revoked'
): Promise<void> {
  if (!jti) return;
  try {
    await db.revokedToken.upsert({
      where: { jti },
      create: { jti, userId, userType, expiresAt, reason },
      update: { reason, expiresAt },
    });
  } catch (error) {
    console.error('[auth] Failed to revoke access token:', error);
    throw error;
  }
}

export async function revokeAllUserSessions(userId: string, userType: string): Promise<void> {
  if (userType === 'admin') {
    await db.admin.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  } else if (userType === 'customer') {
    await db.customer.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  } else if (userType === 'platform_admin') {
    await db.platformAdmin.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  }
}

export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  return token || null;
}

interface AuthenticatedAdmin {
  id: string;
  email: string;
  name?: string;
  role: string;
  restaurantId: string;
  restaurantSlug: string;
  accountId?: string;
  canCreateRestaurant?: boolean;
  restaurantCreationLimit?: number;
  restaurantsCreatedCount?: number;
}

interface AuthenticatedCustomer {
  id: string;
  email: string;
  name: string;
  restaurantId: string;
  restaurantSlug: string;
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

interface AuthenticatedPlatformAdmin {
  id: string;
  email: string;
  name: string;
  role: string;
}

export type AuthenticatedAny = {
  id: string;
  email: string;
  role: string;
  type: 'admin' | 'customer' | 'driver' | 'platform_admin';
  restaurantId?: string;
  restaurantSlug?: string;
  accountId?: string;
  canCreateRestaurant?: boolean;
  restaurantCreationLimit?: number;
  restaurantsCreatedCount?: number;
};

async function getVerifiedPayload(request: Request): Promise<JwtPayload | null> {
  const token = extractToken(request);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  if (!(await isAccessSessionValid(payload))) return null;
  return payload;
}

export async function authenticateAdmin(request: Request): Promise<AuthenticatedAdmin | null> {
  const payload = await getVerifiedPayload(request);
  if (!payload || payload.type !== 'admin') return null;

  try {
    const admin = await db.admin.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        restaurantId: true,
        accountId: true,
        canCreateRestaurant: true,
        restaurantCreationLimit: true,
        restaurantsCreatedCount: true,
      },
    });
    if (!admin || admin.status === 'inactive') return null;
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      restaurantId: admin.restaurantId,
      restaurantSlug: payload.restaurantSlug || '',
      accountId: admin.accountId ?? undefined,
      canCreateRestaurant: admin.canCreateRestaurant ?? false,
      restaurantCreationLimit: admin.restaurantCreationLimit ?? 0,
      restaurantsCreatedCount: admin.restaurantsCreatedCount ?? 0,
    };
  } catch (error) {
    console.error('[auth] authenticateAdmin failed:', error);
    return null;
  }
}

export async function authenticateCustomer(request: Request): Promise<AuthenticatedCustomer | null> {
  const payload = await getVerifiedPayload(request);
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
  } catch (error) {
    console.error('[auth] authenticateCustomer failed:', error);
    return null;
  }
}

export async function authenticateDriver(request: Request): Promise<AuthenticatedDriver | null> {
  const payload = await getVerifiedPayload(request);
  if (!payload || payload.type !== 'driver') return null;

  try {
    const driver = await db.driver.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        vehicle: true,
        status: true,
        zone: true,
        restaurantId: true,
      },
    });
    if (!driver || driver.status === 'inactive') return null;
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
  } catch (error) {
    console.error('[auth] authenticateDriver failed:', error);
    return null;
  }
}

export async function authenticateAny(request: Request): Promise<AuthenticatedAny | null> {
  const payload = await getVerifiedPayload(request);
  if (!payload) return null;

  try {
    if (payload.type === 'platform_admin') {
      const admin = await db.platformAdmin.findUnique({
        where: { id: payload.id },
        select: { id: true, status: true },
      });
      if (!admin || admin.status === 'inactive') return null;
      return { ...payload };
    }

    if (payload.type === 'admin') {
      const admin = await db.admin.findUnique({
        where: { id: payload.id },
        select: {
          id: true,
          status: true,
          restaurantId: true,
          accountId: true,
          canCreateRestaurant: true,
          restaurantCreationLimit: true,
          restaurantsCreatedCount: true,
        },
      });
      if (!admin || admin.status === 'inactive') return null;
      return {
        ...payload,
        restaurantId: admin.restaurantId,
        accountId: admin.accountId ?? undefined,
        canCreateRestaurant: admin.canCreateRestaurant ?? false,
        restaurantCreationLimit: admin.restaurantCreationLimit ?? 0,
        restaurantsCreatedCount: admin.restaurantsCreatedCount ?? 0,
      };
    }

    if (payload.type === 'driver') {
      const driver = await db.driver.findUnique({
        where: { id: payload.id },
        select: { id: true, status: true, restaurantId: true },
      });
      if (!driver || driver.status === 'inactive') return null;
      return { ...payload, restaurantId: driver.restaurantId };
    }

    const customer = await db.customer.findUnique({
      where: { id: payload.id },
      select: { id: true, status: true, restaurantId: true },
    });
    if (!customer || customer.status === 'inactive') return null;
    return { ...payload, restaurantId: customer.restaurantId };
  } catch (error) {
    console.error('[auth] authenticateAny failed:', error);
    return null;
  }
}

export async function authenticatePlatformAdmin(request: Request): Promise<AuthenticatedPlatformAdmin | null> {
  const payload = await getVerifiedPayload(request);
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
  } catch (error) {
    console.error('[auth] authenticatePlatformAdmin failed:', error);
    return null;
  }
}

export const ADMIN_ROLES = [
  'admin',
  'manager',
  'staff',
  'cashier',
  'kitchen',
  'delivery_manager',
  'driver',
  'host',
  'accountant',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const PERMISSION_GROUPS = {
  ADMINS_MANAGE: ['admin'],
  CUSTOMERS_MANAGE: ['admin'],
  CUSTOMERS_READ: ['admin', 'manager', 'cashier'],
  MENU_MANAGE: ['admin', 'manager'],
  MENU_READ: ['admin', 'manager', 'kitchen', 'staff'],
  STAFF_MANAGE: ['admin', 'manager'],
  DRIVERS_MANAGE: ['admin', 'manager', 'delivery_manager'],
  DRIVERS_LOCATION: ['admin', 'manager', 'delivery_manager'],
  STOCK_MANAGE: ['admin', 'manager'],
  STOCK_READ: ['admin', 'manager', 'staff', 'kitchen'],
  LOYALTY_MANAGE: ['admin', 'manager'],
  LOYALTY_DELETE: ['admin'],
  INVOICES_MANAGE: ['admin', 'manager', 'cashier', 'accountant'],
  QUOTES_MANAGE: ['admin', 'manager', 'accountant'],
  EXPENSES_MANAGE: ['admin', 'manager', 'accountant'],
  PAYMENTS_MANAGE: ['admin', 'manager', 'cashier', 'accountant'],
  ANALYTICS_READ: ['admin', 'manager', 'accountant'],
  STATS_READ: ['admin', 'manager', 'accountant'],
  ORDERS_WRITE: ['admin', 'manager', 'staff', 'cashier', 'kitchen', 'delivery_manager'],
  ORDERS_READ: ['admin', 'manager', 'staff', 'cashier', 'kitchen', 'delivery_manager', 'driver', 'host'],
  RESERVATIONS_WRITE: ['admin', 'manager', 'staff', 'host'],
  RESERVATIONS_READ: ['admin', 'manager', 'staff', 'host'],
  KITCHEN_DISPLAY: ['admin', 'manager', 'staff', 'kitchen'],
  REVIEWS_MANAGE: ['admin', 'manager'],
  EMAIL_SEND: ['admin', 'manager'],
  PUSH_SEND: ['admin', 'manager'],
  WS_NOTIFY: ['admin', 'manager'],
  DASHBOARD_VIEW: ['admin', 'manager', 'driver'],
  SEED_RUN: ['admin'],
} as const;

export function hasRole(adminRole: string, requiredRoles: readonly string[]): boolean {
  return requiredRoles.includes(adminRole);
}

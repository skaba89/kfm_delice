import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret-do-not-use-in-prod');
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  // Will fail at runtime if not set, but allow build to proceed
  console.warn('JWT_SECRET is not set — authentication will not work in production');
}
const _JWT_SECRET: string = JWT_SECRET || 'fallback';
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
  // Verify admin still exists and is active
  const admin = await db.admin.findUnique({ where: { id: payload.id } });
  if (!admin || admin.status === 'inactive') return null;
  return {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    restaurantId: admin.restaurantId,
    restaurantSlug: payload.restaurantSlug || '',
  };
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
  const customer = await db.customer.findUnique({ where: { id: payload.id } });
  if (!customer || customer.status === 'inactive') return null;
  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    restaurantId: customer.restaurantId,
    restaurantSlug: payload.restaurantSlug || '',
  };
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
  const driver = await db.driver.findUnique({ where: { id: payload.id } });
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
}

// Authenticate either admin, customer, driver, or platform_admin
export async function authenticateAny(request: Request): Promise<{ id: string; email: string; role: string; type: 'admin' | 'customer' | 'driver' | 'platform_admin'; restaurantId?: string; restaurantSlug?: string } | null> {
  const token = extractToken(request);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  if (payload.type === 'platform_admin') {
    const platformAdmin = await db.platformAdmin.findUnique({ where: { id: payload.id } });
    if (!platformAdmin || platformAdmin.status === 'inactive') return null;
    return { ...payload };
  }
  if (payload.type === 'admin') {
    const admin = await db.admin.findUnique({ where: { id: payload.id } });
    if (!admin || admin.status === 'inactive') return null;
    return { ...payload, restaurantId: admin.restaurantId };
  } else if (payload.type === 'driver') {
    const driver = await db.driver.findUnique({ where: { id: payload.id } });
    if (!driver) return null;
    return { ...payload, restaurantId: driver.restaurantId };
  } else {
    const customer = await db.customer.findUnique({ where: { id: payload.id } });
    if (!customer || customer.status === 'inactive') return null;
    return { ...payload, restaurantId: customer.restaurantId };
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
  const platformAdmin = await db.platformAdmin.findUnique({ where: { id: payload.id } });
  if (!platformAdmin || platformAdmin.status === 'inactive') return null;
  return {
    id: platformAdmin.id,
    email: platformAdmin.email,
    name: platformAdmin.name,
    role: platformAdmin.role,
  };
}

// Check if admin has required role
export function hasRole(adminRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(adminRole);
}

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'kfm-delice-dev-secret-change-in-prod';
const _JWT_SECRET: string = JWT_SECRET;
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

// Check if admin has required role
export function hasRole(adminRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(adminRole);
}

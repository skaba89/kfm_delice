import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
const _JWT_SECRET: string = JWT_SECRET; // Narrowed type after runtime check
const JWT_EXPIRES_IN = '24h';

// Hash a password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify a password against a hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate a JWT token
export function generateToken(payload: { id: string; email: string; role: string; type: 'admin' | 'customer' | 'driver' }): string {
  return jwt.sign(payload, _JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  type: 'admin' | 'customer' | 'driver';
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

// Authenticate an admin request - returns admin payload or null
export async function authenticateAdmin(request: Request): Promise<{ id: string; email: string; role: string } | null> {
  const token = extractToken(request);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'admin') return null;
  // Verify admin still exists and is active
  const admin = await db.admin.findUnique({ where: { id: payload.id } });
  if (!admin || admin.status === 'inactive') return null;
  return { id: admin.id, email: admin.email, role: admin.role };
}

// Authenticate a customer request
export async function authenticateCustomer(request: Request): Promise<{ id: string; email: string; name: string } | null> {
  const token = extractToken(request);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'customer') return null;
  const customer = await db.customer.findUnique({ where: { id: payload.id } });
  if (!customer || customer.status === 'inactive') return null;
  return { id: customer.id, email: customer.email, name: customer.name };
}

// Authenticate a driver request
export async function authenticateDriver(request: Request): Promise<{ id: string; email: string; name: string; phone: string; vehicle: string; status: string; zone: string } | null> {
  const token = extractToken(request);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'driver') return null;
  const driver = await db.driver.findUnique({ where: { id: payload.id } });
  if (!driver) return null;
  return { id: driver.id, email: driver.email, name: driver.name, phone: driver.phone, vehicle: driver.vehicle, status: driver.status, zone: driver.zone };
}

// Authenticate either admin, customer or driver
export async function authenticateAny(request: Request): Promise<{ id: string; email: string; role: string; type: 'admin' | 'customer' | 'driver' } | null> {
  const token = extractToken(request);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  if (payload.type === 'admin') {
    const admin = await db.admin.findUnique({ where: { id: payload.id } });
    if (!admin || admin.status === 'inactive') return null;
    return payload;
  } else if (payload.type === 'driver') {
    const driver = await db.driver.findUnique({ where: { id: payload.id } });
    if (!driver) return null;
    return payload;
  } else {
    const customer = await db.customer.findUnique({ where: { id: payload.id } });
    if (!customer || customer.status === 'inactive') return null;
    return payload;
  }
}

// Check if admin has required role
export function hasRole(adminRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(adminRole);
}

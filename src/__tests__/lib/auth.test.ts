import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-for-vitest';
  process.env.NODE_ENV = 'test';
});

vi.mock('@/lib/db', () => ({
  db: {
    admin: { findUnique: vi.fn(), update: vi.fn() },
    customer: { findUnique: vi.fn(), update: vi.fn() },
    driver: { findUnique: vi.fn() },
    platformAdmin: { findUnique: vi.fn(), update: vi.fn() },
    restaurant: { findUnique: vi.fn() },
    revokedToken: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  extractToken,
  isTokenRevoked,
  isTokenVersionValid,
  isAccessSessionValid,
  authenticateAdmin,
  authenticateCustomer,
  authenticateDriver,
  authenticatePlatformAdmin,
} from '@/lib/auth';
import { db } from '@/lib/db';

describe('hashPassword & verifyPassword', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('mySecret123');
    expect(hash).toMatch(/^\$2[ab]\$/);
    await expect(verifyPassword('mySecret123', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrongPassword', hash)).resolves.toBe(false);
  });

  it('uses a different salt for the same password', async () => {
    const hash1 = await hashPassword('samePassword');
    const hash2 = await hashPassword('samePassword');
    expect(hash1).not.toBe(hash2);
  });
});

describe('generateToken & verifyToken', () => {
  const payload = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'admin',
    type: 'admin' as const,
    tokenVersion: 3,
  };

  it('generates a signed token with jti, expiry and tokenVersion', () => {
    const decoded = verifyToken(generateToken(payload));
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(payload.id);
    expect(decoded!.type).toBe('admin');
    expect(decoded!.tokenVersion).toBe(3);
    expect(decoded!.jti).toBeTruthy();
    expect(decoded!.iat).toBeDefined();
    expect(decoded!.exp).toBeDefined();
  });

  it('rejects invalid tokens', async () => {
    expect(verifyToken('not-a-jwt')).toBeNull();
    const jwt = await import('jsonwebtoken');
    const badToken = jwt.sign(payload, 'wrong-secret', { expiresIn: '1h' });
    expect(verifyToken(badToken)).toBeNull();
  });
});

describe('extractToken', () => {
  it('extracts and trims a Bearer token', () => {
    const request = new Request('https://example.com/api/test', {
      headers: { Authorization: 'Bearer  abc123token ' },
    });
    expect(extractToken(request)).toBe('abc123token');
  });

  it('rejects missing, empty or non-Bearer credentials', () => {
    expect(extractToken(new Request('https://example.com/api/test'))).toBeNull();
    expect(extractToken(new Request('https://example.com/api/test', { headers: { Authorization: 'Bearer ' } }))).toBeNull();
    expect(extractToken(new Request('https://example.com/api/test', { headers: { Authorization: 'Basic abc' } }))).toBeNull();
  });
});

describe('access session enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a current non-revoked admin session', async () => {
    const payload = verifyToken(generateToken({
      id: 'a1', email: 'a@x.test', role: 'admin', type: 'admin', tokenVersion: 2,
    }))!;
    vi.mocked(db.revokedToken.findUnique).mockResolvedValue(null as any);
    vi.mocked(db.admin.findUnique).mockResolvedValue({ tokenVersion: 2 } as any);
    await expect(isAccessSessionValid(payload)).resolves.toBe(true);
  });

  it('rejects an explicitly revoked jti before tokenVersion lookup', async () => {
    const payload = verifyToken(generateToken({
      id: 'a2', email: 'a@x.test', role: 'admin', type: 'admin', tokenVersion: 0,
    }))!;
    vi.mocked(db.revokedToken.findUnique).mockResolvedValue({ id: 'revoked' } as any);
    await expect(isAccessSessionValid(payload)).resolves.toBe(false);
    expect(db.admin.findUnique).not.toHaveBeenCalled();
  });

  it('fails closed if the revocation store cannot be read', async () => {
    const payload = verifyToken(generateToken({
      id: 'a3', email: 'a@x.test', role: 'admin', type: 'admin', tokenVersion: 0,
    }))!;
    vi.mocked(db.revokedToken.findUnique).mockRejectedValue(new Error('db unavailable'));
    await expect(isTokenRevoked(payload)).resolves.toBe(true);
  });

  it('rejects a stale tokenVersion', async () => {
    const payload = verifyToken(generateToken({
      id: 'a4', email: 'a@x.test', role: 'admin', type: 'admin', tokenVersion: 1,
    }))!;
    vi.mocked(db.admin.findUnique).mockResolvedValue({ tokenVersion: 2 } as any);
    await expect(isTokenVersionValid(payload)).resolves.toBe(false);
  });

  it('rejects missing tokenVersion for persisted session-version identities', async () => {
    const payload = verifyToken(generateToken({
      id: 'a5', email: 'a@x.test', role: 'admin', type: 'admin', tokenVersion: 1,
    }))!;
    delete payload.tokenVersion;
    await expect(isTokenVersionValid(payload)).resolves.toBe(false);
  });

  it('uses jti-only session enforcement for drivers', async () => {
    const payload = verifyToken(generateToken({
      id: 'd1', email: 'd@x.test', role: 'driver', type: 'driver',
    }))!;
    vi.mocked(db.revokedToken.findUnique).mockResolvedValue(null as any);
    await expect(isAccessSessionValid(payload)).resolves.toBe(true);
    expect(db.driver.findUnique).not.toHaveBeenCalled();
  });
});

describe('central authenticators enforce session and subscription state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a revoked admin before profile or subscription lookup', async () => {
    const token = generateToken({ id: 'admin-1', email: 'a@x.test', role: 'admin', type: 'admin', tokenVersion: 0, restaurantId: 'r1' });
    vi.mocked(db.revokedToken.findUnique).mockResolvedValue({ id: 'revoked' } as any);
    const request = new Request('https://example.com/api/orders', { headers: { Authorization: `Bearer ${token}` } });
    await expect(authenticateAdmin(request)).resolves.toBeNull();
    expect(db.restaurant.findUnique).not.toHaveBeenCalled();
  });

  it('accepts an active customer with matching tokenVersion and active subscription', async () => {
    const token = generateToken({ id: 'customer-1', email: 'c@x.test', role: 'customer', type: 'customer', tokenVersion: 4, restaurantId: 'r1' });
    vi.mocked(db.revokedToken.findUnique).mockResolvedValue(null as any);
    vi.mocked(db.customer.findUnique)
      .mockResolvedValueOnce({ tokenVersion: 4 } as any)
      .mockResolvedValueOnce({ id: 'customer-1', email: 'c@x.test', name: 'Client', status: 'active', restaurantId: 'r1' } as any);
    vi.mocked(db.restaurant.findUnique).mockResolvedValue({ status: 'active', account: { status: 'active' } } as any);
    const request = new Request('https://example.com/api/customer', { headers: { Authorization: `Bearer ${token}` } });
    await expect(authenticateCustomer(request)).resolves.toMatchObject({ id: 'customer-1', restaurantId: 'r1' });
  });

  it('rejects an otherwise valid customer session after account suspension', async () => {
    const token = generateToken({ id: 'customer-2', email: 'c2@x.test', role: 'customer', type: 'customer', tokenVersion: 1, restaurantId: 'r2' });
    vi.mocked(db.revokedToken.findUnique).mockResolvedValue(null as any);
    vi.mocked(db.customer.findUnique).mockResolvedValueOnce({ tokenVersion: 1 } as any);
    vi.mocked(db.restaurant.findUnique).mockResolvedValue({ status: 'active', account: { status: 'suspended' } } as any);
    const request = new Request('https://example.com/api/customer', { headers: { Authorization: `Bearer ${token}` } });
    await expect(authenticateCustomer(request)).resolves.toBeNull();
  });

  it('rejects inactive drivers after subscription validation', async () => {
    const token = generateToken({ id: 'driver-1', email: 'd@x.test', role: 'driver', type: 'driver', restaurantId: 'r1' });
    vi.mocked(db.revokedToken.findUnique).mockResolvedValue(null as any);
    vi.mocked(db.restaurant.findUnique).mockResolvedValue({ status: 'active', account: { status: 'active' } } as any);
    vi.mocked(db.driver.findUnique).mockResolvedValue({
      id: 'driver-1', email: 'd@x.test', name: 'Driver', phone: '1', vehicle: 'bike',
      status: 'inactive', zone: '', restaurantId: 'r1',
    } as any);
    const request = new Request('https://example.com/api/driver-me', { headers: { Authorization: `Bearer ${token}` } });
    await expect(authenticateDriver(request)).resolves.toBeNull();
  });

  it('accepts an active platform admin regardless of customer subscription state', async () => {
    const token = generateToken({ id: 'pa-1', email: 'p@x.test', role: 'super_admin', type: 'platform_admin', tokenVersion: 7 });
    vi.mocked(db.revokedToken.findUnique).mockResolvedValue(null as any);
    vi.mocked(db.platformAdmin.findUnique)
      .mockResolvedValueOnce({ tokenVersion: 7 } as any)
      .mockResolvedValueOnce({ id: 'pa-1', email: 'p@x.test', name: 'Platform', role: 'super_admin', status: 'active' } as any);
    const request = new Request('https://example.com/api/platform/accounts', { headers: { Authorization: `Bearer ${token}` } });
    await expect(authenticatePlatformAdmin(request)).resolves.toMatchObject({ id: 'pa-1' });
    expect(db.restaurant.findUnique).not.toHaveBeenCalled();
  });
});

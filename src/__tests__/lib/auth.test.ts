import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Set JWT_SECRET before auth module is imported ──────────────
// auth.ts reads process.env.JWT_SECRET at module level and throws
// if it's missing, so we must provide it before the import.
vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-for-vitest';
});

// ── Mock the database module ───────────────────────────────────
vi.mock('@/lib/db', () => ({
  db: {
    admin: { findUnique: vi.fn() },
    customer: { findUnique: vi.fn() },
    driver: { findUnique: vi.fn() },
  },
}));

import { hashPassword, verifyPassword, generateToken, verifyToken, extractToken } from '@/lib/auth';

// ── Tests ──────────────────────────────────────────────────────

describe('hashPassword & verifyPassword', () => {
  it('should hash a password', async () => {
    const hash = await hashPassword('mySecret123');
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
    // bcrypt hashes start with $2a$ or $2b$
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it('should verify a correct password', async () => {
    const hash = await hashPassword('mySecret123');
    const isValid = await verifyPassword('mySecret123', hash);
    expect(isValid).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const hash = await hashPassword('mySecret123');
    const isValid = await verifyPassword('wrongPassword', hash);
    expect(isValid).toBe(false);
  });

  it('should produce different hashes for the same password', async () => {
    const hash1 = await hashPassword('samePassword');
    const hash2 = await hashPassword('samePassword');
    // Different salt each time
    expect(hash1).not.toBe(hash2);
  });
});

describe('generateToken & verifyToken', () => {
  const payload = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'admin',
    type: 'admin' as const,
  };

  it('should generate a token string', () => {
    const token = generateToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
  });

  it('should verify a valid token and return the payload', () => {
    const token = generateToken(payload);
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(payload.id);
    expect(decoded!.email).toBe(payload.email);
    expect(decoded!.role).toBe(payload.role);
    expect(decoded!.type).toBe(payload.type);
  });

  it('should return null for an invalid token', () => {
    const result = verifyToken('this.is.not.a.valid.token');
    expect(result).toBeNull();
  });

  it('should return null for a malformed token', () => {
    const result = verifyToken('not-a-jwt');
    expect(result).toBeNull();
  });

  it('should return null for an empty string', () => {
    const result = verifyToken('');
    expect(result).toBeNull();
  });

  it('should return null for a token signed with a different secret', async () => {
    const jwt = await import('jsonwebtoken');
    const badToken = jwt.sign(payload, 'wrong-secret', { expiresIn: '1h' });
    const result = verifyToken(badToken);
    expect(result).toBeNull();
  });

  it('should include standard JWT claims (iat, exp)', () => {
    const token = generateToken(payload);
    const decoded = verifyToken(token) as any;
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
  });

  it('should generate tokens for customer type', () => {
    const customerPayload = {
      id: 'cust-456',
      email: 'customer@example.com',
      role: 'customer',
      type: 'customer' as const,
    };
    const token = generateToken(customerPayload);
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.type).toBe('customer');
  });

  it('should generate tokens for driver type', () => {
    const driverPayload = {
      id: 'drv-789',
      email: 'driver@example.com',
      role: 'driver',
      type: 'driver' as const,
    };
    const token = generateToken(driverPayload);
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.type).toBe('driver');
  });
});

describe('extractToken', () => {
  it('should extract token from Bearer header', () => {
    const request = new Request('https://example.com/api/test', {
      headers: { Authorization: 'Bearer abc123token' },
    });
    const token = extractToken(request);
    expect(token).toBe('abc123token');
  });

  it('should return null when Authorization header is missing', () => {
    const request = new Request('https://example.com/api/test');
    const token = extractToken(request);
    expect(token).toBeNull();
  });

  it('should return null for non-Bearer auth scheme', () => {
    const request = new Request('https://example.com/api/test', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    const token = extractToken(request);
    expect(token).toBeNull();
  });

  it('should return null for empty Authorization header', () => {
    const request = new Request('https://example.com/api/test', {
      headers: { Authorization: '' },
    });
    const token = extractToken(request);
    expect(token).toBeNull();
  });

  it('should handle Bearer with no space after', () => {
    const request = new Request('https://example.com/api/test', {
      headers: { Authorization: 'Bearer' },
    });
    const token = extractToken(request);
    // "Bearer" alone without space — startsWith('Bearer ') is false
    expect(token).toBeNull();
  });

  it('should handle Bearer with extra spaces', () => {
    const request = new Request('https://example.com/api/test', {
      headers: { Authorization: 'Bearer  token-with-leading-space' },
    });
    const token = extractToken(request);
    // substring(7) takes from character index 7, which would be " token-with-leading-space"
    expect(token).toBe(' token-with-leading-space');
  });

  it('should extract a real JWT token', () => {
    const payload = {
      id: 'user-1',
      email: 'test@test.com',
      role: 'admin',
      type: 'admin' as const,
    };
    const jwt = generateToken(payload);
    const request = new Request('https://example.com/api/test', {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const extracted = extractToken(request);
    expect(extracted).toBe(jwt);
    // Verify the extracted token is valid
    const decoded = verifyToken(extracted!);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe('user-1');
  });
});

import { describe, it, expect } from 'vitest';
import { generateTableQrToken, buildTableQrUrl, resolvePublicAppUrl, buildPublicTableQrResponse } from '@/lib/table-qr';

/**
 * Mission 11.12 — Unit tests for table-qr.ts
 *
 * These tests verify the PURE helpers (token generation, URL building,
 * response shaping). They do NOT touch the database — the resolution
 * and rotation functions are exercised end-to-end by the E2E script
 * `scripts/e2e-qr-tables.py`.
 */

describe('table-qr — generateTableQrToken', () => {
  it('returns a non-empty string', () => {
    const t = generateTableQrToken();
    expect(typeof t).toBe('string');
    expect(t.length).toBeGreaterThan(0);
  });

  it('produces base64url-safe characters only', () => {
    // base64url alphabet: A-Z a-z 0-9 - _
    for (let i = 0; i < 50; i++) {
      const t = generateTableQrToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('is 43 characters long (32 bytes base64url-encoded)', () => {
    // 32 bytes → 256 bits → 43 base64url chars (no padding)
    const t = generateTableQrToken();
    expect(t.length).toBe(43);
  });

  it('produces unique tokens across many invocations', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      seen.add(generateTableQrToken());
    }
    // With 256 bits of entropy, collisions are astronomically unlikely.
    expect(seen.size).toBe(1000);
  });

  it('does not contain predictable patterns', () => {
    // Token must not look like a restaurantId + tableId concatenation.
    const t = generateTableQrToken();
    expect(t).not.toContain('restaurant');
    expect(t).not.toContain('table');
    expect(t).not.toContain('=');
    expect(t).not.toContain('+');
    expect(t).not.toContain('/');
    // No sequences of 5+ identical chars (would suggest low entropy)
    expect(t).not.toMatch(/(.)\1{4,}/);
  });

  it('does not start with a known prefix', () => {
    // A common mistake would be to prefix with a tenant identifier.
    for (let i = 0; i < 100; i++) {
      const t = generateTableQrToken();
      expect(t).not.toMatch(/^(kfm|admin|tbl|rst|abc|test)/i);
    }
  });
});

describe('table-qr — buildTableQrUrl', () => {
  it('builds a URL in the form <base>/q/<token>', () => {
    const token = generateTableQrToken();
    const url = buildTableQrUrl(token, 'https://app.example.com');
    expect(url).toBe(`https://app.example.com/q/${token}`);
  });

  it('strips trailing slashes from the base URL', () => {
    const url = buildTableQrUrl('abc', 'https://app.example.com/');
    expect(url).toBe('https://app.example.com/q/abc');
  });

  it('handles multi-segment paths in PUBLIC_APP_URL', () => {
    const url = buildTableQrUrl('abc', 'https://example.com/app');
    expect(url).toBe('https://example.com/app/q/abc');
  });
});

describe('table-qr — resolvePublicAppUrl', () => {
  const originalEnv = { ...process.env };

  it('uses PUBLIC_APP_URL when set', () => {
    process.env.PUBLIC_APP_URL = 'https://canonical.example.com';
    expect(resolvePublicAppUrl('https://other.example.com')).toBe(
      'https://canonical.example.com'
    );
  });

  it('falls back to VERCEL_URL when PUBLIC_APP_URL is missing', () => {
    delete process.env.PUBLIC_APP_URL;
    process.env.VERCEL_URL = 'preview.vercel.app';
    expect(resolvePublicAppUrl('https://other.example.com')).toBe(
      'https://preview.vercel.app'
    );
  });

  it('falls back to requestOrigin when env vars are missing', () => {
    delete process.env.PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    expect(resolvePublicAppUrl('https://render.example.com')).toBe(
      'https://render.example.com'
    );
  });

  it('falls back to localhost in dev when nothing is set', () => {
    delete process.env.PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    expect(resolvePublicAppUrl(undefined)).toBe('http://localhost:3000');
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });
});

describe('table-qr — buildPublicTableQrResponse', () => {
  it('returns only the public fields (no accountId, no DB id, no secrets)', () => {
    const resolved = {
      tableId: 'tbl_123',
      tableNumber: 'T04',
      tableName: 'Table Terrasse 4',
      tableZone: 'Terrasse',
      restaurantId: 'rst_456',
      restaurantSlug: 'kfm-delice',
      restaurantName: 'KFM Delice',
      restaurantStatus: 'active',
      restaurantCurrency: 'GNF',
      accountStatus: 'active',
    };
    const response = buildPublicTableQrResponse(resolved);
    const json = JSON.stringify(response);

    // Public fields must be present
    expect(response.restaurant.slug).toBe('kfm-delice');
    expect(response.restaurant.name).toBe('KFM Delice');
    expect(response.table.number).toBe('T04');
    // The QR redirects to /r/<slug>/menu?tableToken=<id> — each
    // restaurant has its own URL based on its name (slug), NOT the
    // generic /menu?restaurant=... path.
    expect(response.menuUrl).toBe('/r/kfm-delice/menu?tableToken=tbl_123');
    expect(response.menuUrl).toContain('tableToken=tbl_123');

    // Private fields must NOT leak
    expect(json).not.toContain('restaurantId');
    expect(json).not.toContain('accountId');
    expect(json).not.toContain('rst_456');
    expect(json).not.toContain('accountStatus');
    expect(json).not.toContain('password');
    expect(json).not.toContain('secret');
    expect(json).not.toContain('email');
  });

  it('encodes the slug safely in the menuUrl', () => {
    const resolved = {
      tableId: 't1',
      tableNumber: '1',
      tableName: 'Table 1',
      tableZone: '',
      restaurantId: 'r1',
      restaurantSlug: 'cafe-de-la-gare',
      restaurantName: 'Café de la Gare',
      restaurantStatus: 'active',
      restaurantCurrency: 'EUR',
      accountStatus: 'active',
    };
    const response = buildPublicTableQrResponse(resolved);
    expect(response.menuUrl).toBe('/r/cafe-de-la-gare/menu?tableToken=t1');
  });
});

describe('table-qr — security invariants', () => {
  it('tokens are NOT predictable from a sequence', () => {
    // Generate 100 tokens — none should be predictable from the previous
    const tokens = Array.from({ length: 100 }, () => generateTableQrToken());
    for (let i = 1; i < tokens.length; i++) {
      // No common prefix longer than 3 chars (base64url alphabet has 64 chars,
      // so 4-char prefix collisions are < 1/16M — anything more is suspicious)
      const a = tokens[i - 1];
      const b = tokens[i];
      let commonPrefix = 0;
      for (let j = 0; j < Math.min(a.length, b.length); j++) {
        if (a[j] === b[j]) commonPrefix++;
        else break;
      }
      expect(commonPrefix).toBeLessThan(5);
    }
  });

  it('a token from one "session" cannot be guessed from another', () => {
    // Simulate two different restaurants / tables
    const tokenA = generateTableQrToken();
    const tokenB = generateTableQrToken();
    expect(tokenA).not.toBe(tokenB);
    // The Hamming distance should be > 30 out of 43 chars (random chance)
    let distance = 0;
    for (let i = 0; i < Math.min(tokenA.length, tokenB.length); i++) {
      if (tokenA[i] !== tokenB[i]) distance++;
    }
    expect(distance).toBeGreaterThan(30);
  });
});

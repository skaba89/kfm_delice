import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimit } from '@/lib/rate-limit';

/**
 * These tests cover security-focused scenarios for the rate-limit module
 * used by the middleware. The middleware at src/middleware.ts has an in-file
 * rate limiter with the same logic; we test the shared module here since
 * it is functionally equivalent and exportable.
 */

describe('rateLimit – security scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // ── Under limit ───────────────────────────────────────────

  it('should allow requests under the limit', () => {
    const result = rateLimit('sec-ip-1', 10, 60000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('should track remaining count accurately', () => {
    const limit = 5;
    for (let i = 0; i < limit - 1; i++) {
      const r = rateLimit('sec-ip-remaining', limit, 60000);
      expect(r.success).toBe(true);
      expect(r.remaining).toBe(limit - (i + 1));
    }
  });

  // ── At limit ──────────────────────────────────────────────

  it('should block requests when limit is reached', () => {
    const limit = 3;
    for (let i = 0; i < limit; i++) {
      rateLimit('sec-ip-limit', limit, 60000);
    }
    const result = rateLimit('sec-ip-limit', limit, 60000);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should continue blocking after limit is exceeded', () => {
    const limit = 2;
    for (let i = 0; i < limit; i++) {
      rateLimit('sec-ip-persist', limit, 60000);
    }
    // Multiple attempts after limit should all fail
    expect(rateLimit('sec-ip-persist', limit, 60000).success).toBe(false);
    expect(rateLimit('sec-ip-persist', limit, 60000).success).toBe(false);
  });

  // ── Window expiry ─────────────────────────────────────────

  it('should reset counter after window expires', () => {
    const limit = 3;
    const windowMs = 60000;
    for (let i = 0; i < limit; i++) {
      rateLimit('sec-ip-expire', limit, windowMs);
    }
    expect(rateLimit('sec-ip-expire', limit, windowMs).success).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(windowMs + 1);

    const result = rateLimit('sec-ip-expire', limit, windowMs);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(limit - 1);
  });

  it('should start a fresh window after expiry', () => {
    const limit = 3;
    const windowMs = 30000;

    // Use up the limit
    for (let i = 0; i < limit; i++) {
      rateLimit('sec-ip-fresh', limit, windowMs);
    }

    // Wait for window to expire
    vi.advanceTimersByTime(windowMs + 1);

    // Should be able to make all requests again
    for (let i = 0; i < limit; i++) {
      const r = rateLimit('sec-ip-fresh', limit, windowMs);
      expect(r.success).toBe(true);
    }
  });

  // ── Separate identifiers ──────────────────────────────────

  it('should track different identifiers with separate counters', () => {
    const limit = 2;
    const windowMs = 60000;

    // Exhaust limit for IP-A
    rateLimit('ip-A', limit, windowMs);
    rateLimit('ip-A', limit, windowMs);

    // IP-B should still be allowed
    const resultB = rateLimit('ip-B', limit, windowMs);
    expect(resultB.success).toBe(true);

    // IP-A should be blocked
    const resultA = rateLimit('ip-A', limit, windowMs);
    expect(resultA.success).toBe(false);
  });

  it('should isolate auth and API rate limits for same IP', () => {
    const windowMs = 60000;

    // Exhaust auth limit (lower: 5)
    for (let i = 0; i < 5; i++) {
      rateLimit('auth:192.168.1.1', 5, windowMs);
    }
    expect(rateLimit('auth:192.168.1.1', 5, windowMs).success).toBe(false);

    // General API limit (higher: 60) with different key should still allow
    const apiResult = rateLimit('api:192.168.1.1', 60, windowMs);
    expect(apiResult.success).toBe(true);
  });

  // ── Edge cases ────────────────────────────────────────────

  it('should work with limit of 1', () => {
    const result1 = rateLimit('sec-ip-1limit', 1, 60000);
    expect(result1.success).toBe(true);
    expect(result1.remaining).toBe(0);

    const result2 = rateLimit('sec-ip-1limit', 1, 60000);
    expect(result2.success).toBe(false);
  });

  it('should handle very short windows', () => {
    const windowMs = 1000;
    rateLimit('sec-ip-short', 2, windowMs);
    rateLimit('sec-ip-short', 2, windowMs);

    expect(rateLimit('sec-ip-short', 2, windowMs).success).toBe(false);

    vi.advanceTimersByTime(windowMs + 1);

    expect(rateLimit('sec-ip-short', 2, windowMs).success).toBe(true);
  });

  it('should return correct remaining for first request', () => {
    const result = rateLimit('sec-ip-first', 10, 60000);
    expect(result.remaining).toBe(9);
  });

  it('should handle concurrent identifiers efficiently', () => {
    const limit = 3;
    const windowMs = 60000;
    const identifiers = Array.from({ length: 50 }, (_, i) => `ip-${i}`);

    for (const id of identifiers) {
      for (let j = 0; j < limit; j++) {
        const r = rateLimit(id, limit, windowMs);
        expect(r.success).toBe(true);
      }
      // Next request for each identifier should be blocked
      const r = rateLimit(id, limit, windowMs);
      expect(r.success).toBe(false);
    }
  });
});

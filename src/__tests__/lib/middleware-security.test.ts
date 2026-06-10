import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimit, MemoryRateLimitStore } from '@/lib/rate-limit';

/**
 * These tests cover security-focused scenarios for the rate-limit module
 * used by the middleware. The rateLimit function is now async (supports
 * Upstash Redis), so all tests use await.
 */

describe('rateLimit – security scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // ── Under limit ───────────────────────────────────────────

  it('should allow requests under the limit', async () => {
    const result = await rateLimit('sec-ip-1', 10, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('should track remaining count accurately', async () => {
    const limit = 5;
    for (let i = 0; i < limit - 1; i++) {
      const r = await rateLimit('sec-ip-remaining', limit, 60000);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(limit - (i + 1));
    }
  });

  // ── At limit ──────────────────────────────────────────────

  it('should block requests when limit is reached', async () => {
    const limit = 3;
    for (let i = 0; i < limit; i++) {
      await rateLimit('sec-ip-limit', limit, 60000);
    }
    const result = await rateLimit('sec-ip-limit', limit, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should continue blocking after limit is exceeded', async () => {
    const limit = 2;
    for (let i = 0; i < limit; i++) {
      await rateLimit('sec-ip-persist', limit, 60000);
    }
    // Multiple attempts after limit should all fail
    expect((await rateLimit('sec-ip-persist', limit, 60000)).allowed).toBe(false);
    expect((await rateLimit('sec-ip-persist', limit, 60000)).allowed).toBe(false);
  });

  // ── Window expiry ─────────────────────────────────────────

  it('should reset counter after window expires', async () => {
    const limit = 3;
    const windowMs = 60000;
    for (let i = 0; i < limit; i++) {
      await rateLimit('sec-ip-expire', limit, windowMs);
    }
    expect((await rateLimit('sec-ip-expire', limit, windowMs)).allowed).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(windowMs + 1);

    const result = await rateLimit('sec-ip-expire', limit, windowMs);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(limit - 1);
  });

  it('should start a fresh window after expiry', async () => {
    const limit = 3;
    const windowMs = 30000;

    // Use up the limit
    for (let i = 0; i < limit; i++) {
      await rateLimit('sec-ip-fresh', limit, windowMs);
    }

    // Wait for window to expire
    vi.advanceTimersByTime(windowMs + 1);

    // Should be able to make all requests again
    for (let i = 0; i < limit; i++) {
      const r = await rateLimit('sec-ip-fresh', limit, windowMs);
      expect(r.allowed).toBe(true);
    }
  });

  // ── Separate identifiers ──────────────────────────────────

  it('should track different identifiers with separate counters', async () => {
    const limit = 2;
    const windowMs = 60000;

    // Exhaust limit for IP-A
    await rateLimit('ip-A', limit, windowMs);
    await rateLimit('ip-A', limit, windowMs);

    // IP-B should still be allowed
    const resultB = await rateLimit('ip-B', limit, windowMs);
    expect(resultB.allowed).toBe(true);

    // IP-A should be blocked
    const resultA = await rateLimit('ip-A', limit, windowMs);
    expect(resultA.allowed).toBe(false);
  });

  it('should isolate auth and API rate limits for same IP', async () => {
    const windowMs = 60000;

    // Exhaust auth limit (lower: 5)
    for (let i = 0; i < 5; i++) {
      await rateLimit('auth:192.168.1.1', 5, windowMs);
    }
    expect((await rateLimit('auth:192.168.1.1', 5, windowMs)).allowed).toBe(false);

    // General API limit (higher: 60) with different key should still allow
    const apiResult = await rateLimit('api:192.168.1.1', 60, windowMs);
    expect(apiResult.allowed).toBe(true);
  });

  // ── Edge cases ────────────────────────────────────────────

  it('should work with limit of 1', async () => {
    const result1 = await rateLimit('sec-ip-1limit', 1, 60000);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(0);

    const result2 = await rateLimit('sec-ip-1limit', 1, 60000);
    expect(result2.allowed).toBe(false);
  });

  it('should handle very short windows', async () => {
    const windowMs = 1000;
    await rateLimit('sec-ip-short', 2, windowMs);
    await rateLimit('sec-ip-short', 2, windowMs);

    expect((await rateLimit('sec-ip-short', 2, windowMs)).allowed).toBe(false);

    vi.advanceTimersByTime(windowMs + 1);

    expect((await rateLimit('sec-ip-short', 2, windowMs)).allowed).toBe(true);
  });

  it('should return correct remaining for first request', async () => {
    const result = await rateLimit('sec-ip-first', 10, 60000);
    expect(result.remaining).toBe(9);
  });

  it('should handle concurrent identifiers efficiently', async () => {
    const limit = 3;
    const windowMs = 60000;
    const identifiers = Array.from({ length: 50 }, (_, i) => `ip-${i}`);

    for (const id of identifiers) {
      for (let j = 0; j < limit; j++) {
        const r = await rateLimit(id, limit, windowMs);
        expect(r.allowed).toBe(true);
      }
      // Next request for each identifier should be blocked
      const r = await rateLimit(id, limit, windowMs);
      expect(r.allowed).toBe(false);
    }
  });
});

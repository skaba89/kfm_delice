import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimit, MemoryRateLimitStore } from '@/lib/rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should allow requests within limit', async () => {
    const result = await rateLimit('test-ip', 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should block requests exceeding limit', async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimit('test-ip-2', 5, 60000);
    }
    const result = await rateLimit('test-ip-2', 5, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset after window expires', async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimit('test-ip-3', 5, 60000);
    }
    vi.advanceTimersByTime(61000);
    const result = await rateLimit('test-ip-3', 5, 60000);
    expect(result.allowed).toBe(true);
  });

  it('should track different identifiers independently', async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimit('ip-a', 5, 60000);
    }
    const resultB = await rateLimit('ip-b', 5, 60000);
    expect(resultB.allowed).toBe(true);

    const resultA = await rateLimit('ip-a', 5, 60000);
    expect(resultA.allowed).toBe(false);
  });

  it('should decrement remaining count correctly', async () => {
    const r1 = await rateLimit('test-remaining', 3, 60000);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await rateLimit('test-remaining', 3, 60000);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await rateLimit('test-remaining', 3, 60000);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    const r4 = await rateLimit('test-remaining', 3, 60000);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });
});

describe('MemoryRateLimitStore', () => {
  it('should increment count and return TTL', async () => {
    const store = new MemoryRateLimitStore();
    const result = await store.increment('key1', 60000);
    expect(result.count).toBe(1);
    expect(result.ttl).toBeGreaterThan(0);
  });

  it('should increment existing key', async () => {
    const store = new MemoryRateLimitStore();
    await store.increment('key2', 60000);
    const result = await store.increment('key2', 60000);
    expect(result.count).toBe(2);
  });

  it('should reset count after window expires', async () => {
    vi.useFakeTimers();
    const store = new MemoryRateLimitStore();
    await store.increment('key3', 60000);
    vi.advanceTimersByTime(61000);
    const result = await store.increment('key3', 60000);
    expect(result.count).toBe(1);
    vi.useRealTimers();
  });

  it('should cleanup stale entries', async () => {
    vi.useFakeTimers();
    const store = new MemoryRateLimitStore();
    await store.increment('key4', 60000);
    // Advance past window + stale threshold
    vi.advanceTimersByTime(300000);
    // This should trigger cleanup
    const result = await store.increment('key5', 60000);
    expect(result.count).toBe(1);
    vi.useRealTimers();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryRateLimitStore,
  UpstashRateLimitStore,
  rateLimit,
  resetRateLimitStoreForTests,
} from '@/lib/rate-limit';

describe('rate limit stores', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetRateLimitStoreForTests();
  });

  it('enforces counts in memory', async () => {
    const store = new MemoryRateLimitStore();
    expect((await store.increment('ip', 60_000)).count).toBe(1);
    expect((await store.increment('ip', 60_000)).count).toBe(2);
  });

  it('throws instead of failing open when Upstash returns HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    }));
    const store = new UpstashRateLimitStore('https://example.upstash.io', 'token');
    await expect(store.increment('auth:ip', 60_000)).rejects.toThrow('Upstash Redis error');
  });

  it('rejects malformed Upstash pipeline responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: 1 }],
    }));
    const store = new UpstashRateLimitStore('https://example.upstash.io', 'token');
    await expect(store.increment('auth:ip', 60_000)).rejects.toThrow('invalid pipeline response');
  });

  it('keeps limiting locally when configured Upstash is unavailable', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    }));
    resetRateLimitStoreForTests();
    const identifier = `fallback-${Date.now()}-${Math.random()}`;
    await expect(rateLimit(identifier, 1, 60_000)).resolves.toEqual({ allowed: true, remaining: 0 });
    await expect(rateLimit(identifier, 1, 60_000)).resolves.toEqual({ allowed: false, remaining: 0 });
  });
});

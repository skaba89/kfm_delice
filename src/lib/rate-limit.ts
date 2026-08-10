/**
 * Rate limiting store abstraction.
 *
 * Upstash is preferred when configured. If a configured Upstash backend is
 * temporarily unavailable, callers fall back to a local emergency limiter —
 * never to an unconditional allow.
 */

export interface RateLimitResult {
  count: number;
  ttl: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitResult>;
}

interface MemoryRateEntry {
  count: number;
  resetTime: number;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, MemoryRateEntry>();
  private lastCleanup = Date.now();
  private static readonly CLEANUP_INTERVAL_MS = 120_000;
  private static readonly STALE_THRESHOLD_MS = 120_000;

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    this.cleanup();
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry || now >= entry.resetTime) {
      const resetTime = now + windowMs;
      this.store.set(key, { count: 1, resetTime });
      return { count: 1, ttl: windowMs };
    }
    entry.count += 1;
    return { count: entry.count, ttl: Math.max(0, entry.resetTime - now) };
  }

  private cleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < MemoryRateLimitStore.CLEANUP_INTERVAL_MS) return;
    this.lastCleanup = now;
    for (const [key, value] of this.store) {
      if (now - value.resetTime > MemoryRateLimitStore.STALE_THRESHOLD_MS) this.store.delete(key);
    }
  }
}

export class UpstashRateLimitStore implements RateLimitStore {
  private readonly url: string;
  private readonly token: string;

  constructor(url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (!url || !token) {
      throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set');
    }
    this.url = url.replace(/\/+$/, '');
    this.token = token;
  }

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const windowSec = Math.ceil(windowMs / 1000);
    const redisKey = `ratelimit:${key}`;
    const pipelineBody = [
      ['INCR', redisKey],
      ['EVAL',
        'if redis.call("GET", KEYS[1]) == "1" then return redis.call("EXPIRE", KEYS[1], ARGV[1]) else return 0 end',
        '1', redisKey, String(windowSec)],
      ['TTL', redisKey],
    ];

    const response = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipelineBody),
    });
    if (!response.ok) {
      throw new Error(`Upstash Redis error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as Array<{ result?: number | null; error?: string }>;
    if (!Array.isArray(data) || data.length < 3 || data.some(item => item?.error)) {
      throw new Error('Upstash Redis returned an invalid pipeline response');
    }
    const count = data[0]?.result;
    const ttlRaw = data[2]?.result;
    if (typeof count !== 'number' || typeof ttlRaw !== 'number') {
      throw new Error('Upstash Redis pipeline result is missing INCR/TTL values');
    }
    return { count, ttl: ttlRaw > 0 ? ttlRaw * 1000 : windowMs };
  }
}

let _storeInstance: RateLimitStore | null = null;
const emergencyMemoryStore = new MemoryRateLimitStore();
let lastFallbackLogAt = 0;

export function createRateLimitStore(): RateLimitStore {
  if (_storeInstance) return _storeInstance;
  const hasUpstash = Boolean(
    typeof process !== 'undefined' &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
  _storeInstance = hasUpstash ? new UpstashRateLimitStore() : new MemoryRateLimitStore();
  console.log(`[rate-limit] Using ${hasUpstash ? 'Upstash Redis' : 'in-memory'} store`);
  return _storeInstance;
}

export async function rateLimit(
  identifier: string,
  limit: number = 5,
  windowMs: number = 60_000
): Promise<{ allowed: boolean; remaining: number }> {
  let result: RateLimitResult;
  try {
    result = await createRateLimitStore().increment(identifier, windowMs);
  } catch (error) {
    // A configured distributed limiter must never fail open. Emergency memory
    // limiting keeps protection active for the current instance until Upstash
    // recovers. Log at most once per minute to avoid flooding production logs.
    const now = Date.now();
    if (now - lastFallbackLogAt > 60_000) {
      lastFallbackLogAt = now;
      console.error('[rate-limit] Distributed backend unavailable; using emergency memory limiter:',
        error instanceof Error ? error.message : String(error));
    }
    result = await emergencyMemoryStore.increment(identifier, windowMs);
  }

  if (result.count > limit) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: Math.max(0, limit - result.count) };
}

/** Test-only reset; harmless in production and avoids cross-test singleton state. */
export function resetRateLimitStoreForTests(): void {
  _storeInstance = null;
  lastFallbackLogAt = 0;
}

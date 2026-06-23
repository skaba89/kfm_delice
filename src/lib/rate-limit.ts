/**
 * Rate limiting store abstraction.
 *
 * Provides a `RateLimitStore` interface with two implementations:
 * - `MemoryRateLimitStore` — in-memory Map (default, backward-compatible)
 * - `UpstashRateLimitStore` — persistent via Upstash Redis REST API (Edge-compatible)
 *
 * The `createRateLimitStore()` factory auto-detects Upstash env vars and falls
 * back to in-memory when they are not set, so existing deployments need zero
 * config changes.
 *
 * All code is Edge Runtime compatible (no Node.js `net`, `fs`, etc.).
 */

// ────────────────────────────────────────────────────────────────
// Interface
// ────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  /** Current request count within the window */
  count: number;
  /** Remaining TTL of the current window in milliseconds */
  ttl: number;
}

export interface RateLimitStore {
  /**
   * Atomically increment the counter for `key` within a sliding window.
   *
   * If the key does not exist or has expired, it is created with count = 1
   * and a TTL of `windowMs`.
   *
   * @param key      - Unique identifier (e.g. IP address with route prefix)
   * @param windowMs - Time window in milliseconds
   * @returns The current count and remaining TTL
   */
  increment(key: string, windowMs: number): Promise<RateLimitResult>;
}

// ────────────────────────────────────────────────────────────────
// In-Memory Implementation
// ────────────────────────────────────────────────────────────────

interface MemoryRateEntry {
  count: number;
  resetTime: number;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, MemoryRateEntry>();
  private lastCleanup = Date.now();

  private static readonly CLEANUP_INTERVAL_MS = 120_000; // 2 minutes
  private static readonly STALE_THRESHOLD_MS = 120_000; // 2 minutes past window

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    this.cleanup();
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetTime) {
      // No entry or window expired — start fresh
      const resetTime = now + windowMs;
      this.store.set(key, { count: 1, resetTime });
      return { count: 1, ttl: windowMs };
    }

    // Within the current window — increment
    entry.count += 1;
    return { count: entry.count, ttl: Math.max(0, entry.resetTime - now) };
  }

  private cleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < MemoryRateLimitStore.CLEANUP_INTERVAL_MS) return;

    this.lastCleanup = now;
    for (const [k, v] of this.store) {
      if (now - v.resetTime > MemoryRateLimitStore.STALE_THRESHOLD_MS) {
        this.store.delete(k);
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────
// Upstash Redis REST API Implementation
// ────────────────────────────────────────────────────────────────

/**
 * Uses the Upstash Redis REST API over `fetch` — fully Edge-compatible.
 *
 * The pipeline performs:
 *   1. INCR on the key (atomically increments, starts at 1 if missing)
 *   2. If count === 1, set EXPIRE (only on first request in window)
 *   3. TTL to read remaining time
 *
 * Required environment variables:
 *   - UPSTASH_REDIS_REST_URL   e.g. https://xxx.upstash.io
 *   - UPSTASH_REDIS_REST_TOKEN
 */
export class UpstashRateLimitStore implements RateLimitStore {
  private url: string;
  private token: string;

  constructor() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set to use UpstashRateLimitStore'
      );
    }

    this.url = url.replace(/\/+$/, ''); // strip trailing slashes
    this.token = token;
  }

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const windowSec = Math.ceil(windowMs / 1000);
    const redisKey = `ratelimit:${key}`;

    // Use Upstash Redis pipeline to execute multiple commands atomically
    // Pipeline: [INCR, EXPIRE (only if new), TTL]
    const pipelineBody = [
      ['INCR', redisKey],
      // Only set expiry on a brand-new key (count will be 1 after INCR)
      // We use a Lua script for atomicity: if count == 1 then expire
      ['EVAL',
        'if redis.call("GET", KEYS[1]) == "1" then return redis.call("EXPIRE", KEYS[1], ARGV[1]) else return 0 end',
        '1',
        redisKey,
        String(windowSec)
      ],
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
      // Fallback: if Upstash is unreachable, allow the request rather than blocking everyone
      console.error(`Upstash Redis error: ${response.status} ${response.statusText}`);
      return { count: 1, ttl: windowMs };
    }

    const data = await response.json() as Array<{ result: number | null }>;

    // Pipeline results: [INCR result, EVAL result, TTL result]
    const count = typeof data[0]?.result === 'number' ? data[0].result : 1;
    const ttlRaw = typeof data[2]?.result === 'number' ? data[2].result : windowSec;
    // TTL returns seconds; -1 means no expiry set, -2 means key doesn't exist
    const ttlMs = ttlRaw > 0 ? ttlRaw * 1000 : windowMs;

    return { count, ttl: ttlMs };
  }
}

// ────────────────────────────────────────────────────────────────
// Factory
// ────────────────────────────────────────────────────────────────

let _storeInstance: RateLimitStore | null = null;

/**
 * Create (or return the cached singleton) rate limit store.
 *
 * Auto-detects `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
 * environment variables. When both are present, uses Upstash for persistent
 * rate limiting across restarts and instances. Otherwise falls back to
 * in-memory storage (backward-compatible with zero config).
 */
export function createRateLimitStore(): RateLimitStore {
  if (_storeInstance) return _storeInstance;

  const hasUpstash =
    typeof process !== 'undefined' &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (hasUpstash) {
    console.log('[rate-limit] Using Upstash Redis store (persistent)');
    _storeInstance = new UpstashRateLimitStore();
  } else {
    console.log('[rate-limit] Using in-memory store (non-persistent)');
    _storeInstance = new MemoryRateLimitStore();
  }

  return _storeInstance;
}

// ────────────────────────────────────────────────────────────────
// Convenience helper (replaces the old synchronous `rateLimit`)
// ────────────────────────────────────────────────────────────────

/**
 * Async rate-limit check compatible with the new store abstraction.
 *
 * @param identifier - Unique key such as an IP address (optionally prefixed)
 * @param limit      - Max number of requests allowed in the window
 * @param windowMs   - Time window in milliseconds
 * @returns `{ allowed, remaining }` where `allowed` is false when the limit is exceeded
 */
export async function rateLimit(
  identifier: string,
  limit: number = 5,
  windowMs: number = 60_000
): Promise<{ allowed: boolean; remaining: number }> {
  const store = createRateLimitStore();
  const { count } = await store.increment(identifier, windowMs);

  if (count > limit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: limit - count };
}

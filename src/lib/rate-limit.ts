/**
 * In-memory rate limiter for authentication endpoints.
 * No external packages required — uses a Map for tracking requests.
 *
 * Default: 5 requests per minute (suitable for login endpoints).
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup interval: remove stale entries every 2 minutes to prevent memory leaks
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // entries older than 2 min past their window

let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;

  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now - entry.resetTime > STALE_THRESHOLD_MS) {
      store.delete(key);
    }
  }
}

/**
 * Rate limit a given identifier (e.g. client IP).
 *
 * @param identifier - Unique key such as an IP address
 * @param limit      - Max number of requests allowed in the window (default 5)
 * @param windowMs   - Time window in milliseconds (default 60 000 = 1 minute)
 * @returns `{ success, remaining }` where `success` is false when the limit is exceeded
 */
export function rateLimit(
  identifier: string,
  limit: number = 5,
  windowMs: number = 60_000
): { success: boolean; remaining: number } {
  // Periodic cleanup to avoid unbounded memory growth
  cleanup();

  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now >= entry.resetTime) {
    // No entry yet or the window has expired — start fresh
    store.set(identifier, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  // Within the current window
  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count += 1;
  return { success: true, remaining: limit - entry.count };
}

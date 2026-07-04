// Next.js Instrumentation — runs once at server startup (before any request)
// This is the earliest possible hook to log environment state.
//
// IMPORTANT: This file must NOT override DATABASE_URL. On Render, the
// PostgreSQL connection string is injected via the DATABASE_URL env var.
// Previously, this file forced SQLite when DATABASE_URL didn't start with
// 'file:' — which OVERWROTE the PostgreSQL URL on Render, causing the app
// to silently fall back to a local SQLite file that didn't have the
// migrations applied (missing commissionRate, totalEarnings, etc.).
//
// Now this file only LOGS the provider (never the full URL, which contains
// credentials) and does not modify any environment variable.

export async function register() {
  const url = process.env.DATABASE_URL || '';
  const provider =
    url.startsWith('postgresql://') || url.startsWith('postgres://')
      ? 'postgres'
      : url.startsWith('file:')
        ? 'sqlite'
        : 'unknown';

  if (!url) {
    // In production, db.ts will throw a clear error if DATABASE_URL is missing.
    // In dev, db.ts falls back to file:./data/kfm-delice.db.
    // We do NOT touch process.env.DATABASE_URL here anymore.
    console.warn('[instrumentation] DATABASE_URL is not set — db.ts will handle the fallback/error.');
  } else {
    // Log only the provider — never the full URL (contains credentials).
    console.log(`[instrumentation] Database provider: ${provider}`);
  }
}

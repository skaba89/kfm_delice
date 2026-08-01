#!/usr/bin/env node
/**
 * check-production-safety.cjs — Mission 6
 *
 * Reads APP_MODE. If "production", enforces strict safety:
 *   1. No dangerous feature flags (ALLOW_AUTO_SEED, ALLOW_DEFAULT_TENANT, etc.)
 *   2. JWT_SECRET present and robust (>=32 chars)
 *   3. DATABASE_URL is PostgreSQL (not SQLite)
 *   4. STRIPE_WEBHOOK_SECRET present (if Stripe is used)
 *   5. WEBHOOK_SECRET present (for internal payment webhooks)
 *   6. TOTP_ENCRYPTION_KEY present (for 2FA secret encryption)
 *   7. REDIS_URL or UPSTASH_REDIS_REST_URL present (for distributed rate limiting)
 *   8. PUBLIC_APP_URL is HTTPS
 *   9. No demo accounts (ALLOW_LOGIN_AUTO_SEED=false)
 *
 * Exits with code 1 if any violation found.
 * Never logs sensitive values — only the variable name.
 */

const APP_MODE = process.env.APP_MODE || '';
const NODE_ENV = process.env.NODE_ENV || '';

// Non-production: skip all checks
if (APP_MODE !== 'production' && NODE_ENV !== 'production') {
  console.log(`[production-safety] APP_MODE=${APP_MODE || '(not set)'} — safety check skipped (non-production).`);
  process.exit(0);
}

console.log('[production-safety] APP_MODE=production — running strict safety check...');

const violations = [];
const warnings = [];

// ── 1. Dangerous feature flags ──
const DANGEROUS_VARS = [
  'ALLOW_AUTO_SEED',
  'ALLOW_DEFAULT_TENANT',
  'ALLOW_PRISMA_DB_PUSH_FALLBACK',
  'ALLOW_LOGIN_AUTO_SEED',
  'ENABLE_PUBLIC_RESTAURANT_REGISTRATION',
  'NEXT_PUBLIC_SHOW_DEMO_CREDS',
];

for (const varName of DANGEROUS_VARS) {
  const value = process.env[varName];
  if (value === 'true' || value === '1') {
    violations.push(`${varName}=true (must be false/unset in production)`);
  }
}

// ── 2. JWT_SECRET robust ──
const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  violations.push('JWT_SECRET is not set');
} else if (JWT_SECRET.length < 32) {
  violations.push(`JWT_SECRET is too short (${JWT_SECRET.length} chars, min 32 required)`);
} else if (JWT_SECRET === 'kfm-delice-dev-secret-change-in-prod') {
  violations.push('JWT_SECRET is the known dev fallback (publicly committed) — MUST be changed');
}

// ── 3. DATABASE_URL is PostgreSQL ──
const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) {
  violations.push('DATABASE_URL is not set');
} else if (!DATABASE_URL.startsWith('postgresql://') && !DATABASE_URL.startsWith('postgres://')) {
  violations.push('DATABASE_URL must be PostgreSQL in production (postgresql:// or postgres://)');
}

// ── 4. TOTP_ENCRYPTION_KEY present (Mission 7) ──
const TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || '';
if (!TOTP_ENCRYPTION_KEY) {
  violations.push('TOTP_ENCRYPTION_KEY is not set (required for 2FA secret encryption)');
} else if (TOTP_ENCRYPTION_KEY.length !== 32) {
  // Accept base64-encoded 32-byte keys (44 chars) or raw 32-byte keys (32 chars)
  try {
    const decoded = Buffer.from(TOTP_ENCRYPTION_KEY, 'base64');
    if (decoded.length !== 32 && TOTP_ENCRYPTION_KEY.length !== 32) {
      violations.push('TOTP_ENCRYPTION_KEY must be 32 bytes (raw or base64-encoded). Generate with: openssl rand -base64 32');
    }
  } catch {
    violations.push('TOTP_ENCRYPTION_KEY is not valid base64 or raw 32-byte key');
  }
}

// ── 5. WEBHOOK_SECRET present (for internal payment webhooks) ──
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
if (!WEBHOOK_SECRET) {
  violations.push('WEBHOOK_SECRET is not set (required for internal payment webhook HMAC verification)');
}

// ── 6. STRIPE_WEBHOOK_SECRET (warn only — Stripe may not be used) ──
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
if (STRIPE_SECRET_KEY && !STRIPE_WEBHOOK_SECRET) {
  violations.push('STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is missing — webhook signature cannot be verified');
}

// ── 7. Rate limiting: Redis/Upstash required for production ──
const REDIS_URL = process.env.REDIS_URL || '';
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const KV_REST_API_URL = process.env.KV_REST_API_URL || '';
if (!REDIS_URL && !UPSTASH_REDIS_REST_URL && !KV_REST_API_URL) {
  warnings.push('No Redis/Upstash/KV URL found — rate limiting will be in-memory only (not suitable for multi-instance production)');
}

// ── 8. PUBLIC_APP_URL is HTTPS ──
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || '';
if (!PUBLIC_APP_URL) {
  warnings.push('PUBLIC_APP_URL is not set');
} else if (!PUBLIC_APP_URL.startsWith('https://')) {
  violations.push(`PUBLIC_APP_URL must be HTTPS in production (got: ${PUBLIC_APP_URL.substring(0, 10)}...)`);
}

// ── 9. Sentry DSN (warn only) ──
const SENTRY_DSN = process.env.SENTRY_DSN || '';
if (!SENTRY_DSN) {
  warnings.push('SENTRY_DSN is not set — error monitoring will be limited');
}

// ── Report ──
if (warnings.length > 0) {
  console.log('[production-safety] ── Warnings ──');
  for (const w of warnings) {
    console.log(`[production-safety]   ⚠ ${w}`);
  }
}

if (violations.length > 0) {
  console.error('[production-safety] ────────────────────────────────────────');
  console.error('[production-safety] FATAL: Production safety violations detected:');
  for (const v of violations) {
    console.error(`[production-safety]   ✗ ${v}`);
  }
  console.error('[production-safety] Refusing to start. Fix these variables and redeploy.');
  console.error('[production-safety] ────────────────────────────────────────');
  process.exit(1);
}

console.log('[production-safety] ✓ All production safety checks passed.');
process.exit(0);

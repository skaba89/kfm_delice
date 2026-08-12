#!/usr/bin/env node
/**
 * check-production-safety.cjs — Mission 6
 *
 * Production startup guard. It validates only capabilities the application
 * actually supports; a configured-but-unused backend must never count as safe.
 */

const APP_MODE = process.env.APP_MODE || '';
const NODE_ENV = process.env.NODE_ENV || '';

if (APP_MODE !== 'production' && NODE_ENV !== 'production') {
  console.log(`[production-safety] APP_MODE=${APP_MODE || '(not set)'} — safety check skipped (non-production).`);
  process.exit(0);
}

console.log('[production-safety] APP_MODE=production — running strict safety check...');

const violations = [];
const warnings = [];

const DANGEROUS_VARS = [
  'ALLOW_AUTO_SEED',
  'ALLOW_DEFAULT_TENANT',
  'ALLOW_PRISMA_DB_PUSH_FALLBACK',
  'ALLOW_LOGIN_AUTO_SEED',
  'NEXT_PUBLIC_SHOW_DEMO_CREDS',
];

for (const varName of DANGEROUS_VARS) {
  const value = process.env[varName];
  if (value === 'true' || value === '1') {
    violations.push(`${varName}=true (must be false/unset in production)`);
  }
}

const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  violations.push('JWT_SECRET is not set');
} else if (JWT_SECRET.length < 32) {
  violations.push(`JWT_SECRET is too short (${JWT_SECRET.length} chars, min 32 required)`);
} else if (JWT_SECRET === 'kfm-delice-dev-secret-change-in-prod') {
  violations.push('JWT_SECRET is the known dev fallback (publicly committed) — MUST be changed');
}

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) {
  violations.push('DATABASE_URL is not set');
} else if (!DATABASE_URL.startsWith('postgresql://') && !DATABASE_URL.startsWith('postgres://')) {
  violations.push('DATABASE_URL must be PostgreSQL in production (postgresql:// or postgres://)');
}

const TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || '';
if (!TOTP_ENCRYPTION_KEY) {
  violations.push('TOTP_ENCRYPTION_KEY is not set (required for 2FA secret encryption)');
} else if (TOTP_ENCRYPTION_KEY.length !== 32) {
  try {
    const decoded = Buffer.from(TOTP_ENCRYPTION_KEY, 'base64');
    if (decoded.length !== 32 && TOTP_ENCRYPTION_KEY.length !== 32) {
      violations.push('TOTP_ENCRYPTION_KEY must be 32 bytes (raw or base64-encoded). Generate with: openssl rand -base64 32');
    }
  } catch {
    violations.push('TOTP_ENCRYPTION_KEY is not valid base64 or raw 32-byte key');
  }
}

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
if (!WEBHOOK_SECRET) {
  violations.push('WEBHOOK_SECRET is not set (required for internal payment webhook HMAC verification)');
}

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
if (STRIPE_SECRET_KEY && !STRIPE_WEBHOOK_SECRET) {
  violations.push('STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is missing — webhook signature cannot be verified');
}

const REALTIME_MODE = (process.env.REALTIME_MODE || 'disabled').toLowerCase();
if (REALTIME_MODE === 'local') {
  violations.push('REALTIME_MODE=local is forbidden in production; use disabled until a distributed tenant-scoped realtime adapter is configured');
}

const SCALE_MODE = (process.env.SCALE_MODE || 'single-instance').toLowerCase();
const VALID_SCALE_MODES = ['single-instance', 'multi-instance', 'national'];
if (!VALID_SCALE_MODES.includes(SCALE_MODE)) {
  violations.push(`SCALE_MODE=${SCALE_MODE} is invalid; expected one of: ${VALID_SCALE_MODES.join(', ')}`);
}
const nationalScale = SCALE_MODE === 'national';
const distributedScale = SCALE_MODE === 'multi-instance' || nationalScale;

// Distributed rate limiting currently supports Upstash REST only. Do not count
// REDIS_URL or KV_REST_API_URL as configured until a corresponding adapter is
// implemented in src/lib/rate-limit.ts.
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const hasUpstashUrl = Boolean(UPSTASH_REDIS_REST_URL);
const hasUpstashToken = Boolean(UPSTASH_REDIS_REST_TOKEN);
const distributedRateLimitReady = hasUpstashUrl && hasUpstashToken;
if (hasUpstashUrl !== hasUpstashToken) {
  violations.push('Upstash rate limiting is partially configured — both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required');
}
if (distributedScale && !distributedRateLimitReady) {
  violations.push(`SCALE_MODE=${SCALE_MODE} requires distributed rate limiting via Upstash REST URL + token`);
} else if (!distributedRateLimitReady) {
  warnings.push('Distributed rate limiting is not configured — safe only for a single application instance');
}

const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const realPlatformEmailReady = Boolean(RESEND_API_KEY || (SMTP_HOST && SMTP_USER && SMTP_PASS));

// Public self-service registration is Internet-facing and creates identities.
// It is allowed in production only when abuse controls, real email ownership
// verification, HTTPS callback URLs and a tightly bounded trial policy exist.
const publicRegistrationEnabled = process.env.ENABLE_PUBLIC_RESTAURANT_REGISTRATION === 'true';
if (publicRegistrationEnabled) {
  if (!distributedRateLimitReady) {
    violations.push('ENABLE_PUBLIC_RESTAURANT_REGISTRATION=true requires Upstash distributed rate limiting');
  }
  if (!realPlatformEmailReady) {
    violations.push('ENABLE_PUBLIC_RESTAURANT_REGISTRATION=true requires a real email provider (Resend or authenticated SMTP)');
  }
  if (!PUBLIC_APP_URL || !PUBLIC_APP_URL.startsWith('https://')) {
    violations.push('ENABLE_PUBLIC_RESTAURANT_REGISTRATION=true requires HTTPS PUBLIC_APP_URL for verification links');
  }

  const trialPlan = (process.env.PUBLIC_REGISTRATION_TRIAL_PLAN || 'starter').toLowerCase();
  if (!['starter', 'pro'].includes(trialPlan)) {
    violations.push('PUBLIC_REGISTRATION_TRIAL_PLAN must be starter or pro when public registration is enabled');
  }

  const rawTrialDays = process.env.PUBLIC_REGISTRATION_TRIAL_DAYS || '14';
  const trialDays = Number(rawTrialDays);
  if (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 30) {
    violations.push('PUBLIC_REGISTRATION_TRIAL_DAYS must be an integer between 1 and 30');
  }

  const rawVerificationTtl = process.env.PUBLIC_REGISTRATION_VERIFICATION_TTL_MINUTES || '60';
  const verificationTtl = Number(rawVerificationTtl);
  if (!Number.isInteger(verificationTtl) || verificationTtl < 10 || verificationTtl > 1440) {
    violations.push('PUBLIC_REGISTRATION_VERIFICATION_TTL_MINUTES must be an integer between 10 and 1440');
  }
}

if (!PUBLIC_APP_URL) {
  if (nationalScale) violations.push('PUBLIC_APP_URL is required for national scale');
  else warnings.push('PUBLIC_APP_URL is not set');
} else if (!PUBLIC_APP_URL.startsWith('https://')) {
  violations.push(`PUBLIC_APP_URL must be HTTPS in production (got: ${PUBLIC_APP_URL.substring(0, 10)}...)`);
}

const SENTRY_DSN = process.env.SENTRY_DSN || '';
if (!SENTRY_DSN) {
  if (nationalScale) violations.push('SENTRY_DSN is required for national scale observability');
  else warnings.push('SENTRY_DSN is not set — error monitoring will be limited');
}

if (warnings.length > 0) {
  console.log('[production-safety] ── Warnings ──');
  for (const w of warnings) console.log(`[production-safety]   ⚠ ${w}`);
}

if (violations.length > 0) {
  console.error('[production-safety] ────────────────────────────────────────');
  console.error('[production-safety] FATAL: Production safety violations detected:');
  for (const v of violations) console.error(`[production-safety]   ✗ ${v}`);
  console.error('[production-safety] Refusing to start. Fix these variables and redeploy.');
  console.error('[production-safety] ────────────────────────────────────────');
  process.exit(1);
}

console.log(`[production-safety] ✓ All production safety checks passed (scale=${SCALE_MODE}, realtime=${REALTIME_MODE}).`);
process.exit(0);

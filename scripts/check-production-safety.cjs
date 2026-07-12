#!/usr/bin/env node
/**
 * check-production-safety.cjs
 *
 * Reads APP_MODE. If "production", refuses dangerous env vars.
 * Exits with code 1 if any violation found.
 * Never logs sensitive values — only the variable name.
 */

const APP_MODE = process.env.APP_MODE || '';

if (APP_MODE !== 'production') {
  console.log(`[production-safety] APP_MODE=${APP_MODE || '(not set)'} — safety check skipped (non-production).`);
  process.exit(0);
}

console.log('[production-safety] APP_MODE=production — running strict safety check...');

const DANGEROUS_VARS = [
  'ALLOW_AUTO_SEED',
  'ALLOW_DEFAULT_TENANT',
  'ALLOW_PRISMA_DB_PUSH_FALLBACK',
  'ENABLE_PUBLIC_RESTAURANT_REGISTRATION',
  'NEXT_PUBLIC_SHOW_DEMO_CREDS',
];

const violations = [];

for (const varName of DANGEROUS_VARS) {
  const value = process.env[varName];
  if (value === 'true' || value === '1') {
    violations.push(varName);
  }
}

if (violations.length > 0) {
  console.error('[production-safety] ────────────────────────────────────────');
  console.error('[production-safety] FATAL: Production safety violations detected:');
  for (const v of violations) {
    console.error(`[production-safety]   - ${v} is set (must be false/unset in production)`);
  }
  console.error('[production-safety] Refusing to start. Fix these variables and redeploy.');
  console.error('[production-safety] ────────────────────────────────────────');
  process.exit(1);
}

console.log('[production-safety] ✓ All production safety checks passed.');

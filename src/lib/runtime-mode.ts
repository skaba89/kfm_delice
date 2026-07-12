/**
 * Runtime mode helper — centralizes demo/staging/production detection.
 *
 * APP_MODE is the source of truth:
 *   "demo"       → demo (ALLOW_AUTO_SEED=true, ALLOW_DEFAULT_TENANT=true)
 *   "staging"    → staging (ALLOW_AUTO_SEED=true, ALLOW_DEFAULT_TENANT=false)
 *   "production"  → production (ALLOW_AUTO_SEED=false, ALLOW_DEFAULT_TENANT=false)
 *
 * If APP_MODE is not set, falls back to NODE_ENV:
 *   production → production
 *   development → demo
 */

type AppMode = 'demo' | 'staging' | 'production';

function detectMode(): AppMode {
  const explicit = process.env.APP_MODE as AppMode | undefined;
  if (explicit === 'demo' || explicit === 'staging' || explicit === 'production') {
    return explicit;
  }
  // Fallback: NODE_ENV=production → production, else demo
  return process.env.NODE_ENV === 'production' ? 'production' : 'demo';
}

const MODE: AppMode = detectMode();

export function isDemoMode(): boolean {
  return MODE === 'demo';
}

export function isStagingMode(): boolean {
  return MODE === 'staging';
}

export function isProductionMode(): boolean {
  return MODE === 'production';
}

export function getAppMode(): AppMode {
  return MODE;
}

/**
 * In production mode, refuse to start if dangerous demo flags are set.
 * Returns an array of violations (empty = OK).
 */
export function productionSafetyViolations(): string[] {
  if (MODE !== 'production') return [];

  const violations: string[] = [];

  if (process.env.ALLOW_AUTO_SEED === 'true') {
    violations.push('ALLOW_AUTO_SEED=true is forbidden in production mode');
  }
  if (process.env.ALLOW_DEFAULT_TENANT === 'true') {
    violations.push('ALLOW_DEFAULT_TENANT=true is forbidden in production mode');
  }
  if (process.env.ALLOW_PRISMA_DB_PUSH_FALLBACK === 'true') {
    violations.push('ALLOW_PRISMA_DB_PUSH_FALLBACK=true is forbidden in production mode');
  }

  return violations;
}

/**
 * Assert production safety — throws if violations found.
 * Call in render-start.sh or instrumentation.ts.
 */
export function assertProductionSafety(): void {
  const violations = productionSafetyViolations();
  if (violations.length > 0) {
    const msg = `[FATAL] Production safety violations:\n${violations.map(v => `  - ${v}`).join('\n')}`;
    console.error(msg);
    throw new Error(msg);
  }
}

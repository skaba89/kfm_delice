import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const script = path.join(process.cwd(), 'scripts', 'check-production-safety.cjs');

function runSafety(overrides: Record<string, string | undefined>) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    APP_MODE: 'production',
    DATABASE_URL: 'postgresql://user:password@localhost:5432/kfm_test',
    JWT_SECRET: 'ci-production-safety-jwt-secret-1234567890',
    TOTP_ENCRYPTION_KEY: '12345678901234567890123456789012',
    WEBHOOK_SECRET: 'ci-webhook-secret',
    PUBLIC_APP_URL: 'https://kfm.example.com',
    REALTIME_MODE: 'disabled',
    SCALE_MODE: 'single-instance',
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
    UPSTASH_REDIS_REST_URL: '',
    UPSTASH_REDIS_REST_TOKEN: '',
    ...overrides,
  };

  const result = spawnSync(process.execPath, [script], {
    env,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  };
}

describe('production safety guard', () => {
  it('rejects the process-local websocket server in production', () => {
    const result = runSafety({ REALTIME_MODE: 'local' });
    expect(result.status).toBe(1);
    expect(result.output).toContain('REALTIME_MODE=local is forbidden in production');
  });

  it('rejects national scale without distributed rate limiting', () => {
    const result = runSafety({ SCALE_MODE: 'national' });
    expect(result.status).toBe(1);
    expect(result.output).toContain('SCALE_MODE=national requires distributed rate limiting');
  });

  it('rejects a partially configured Upstash backend', () => {
    const result = runSafety({ UPSTASH_REDIS_REST_URL: 'https://example.upstash.io' });
    expect(result.status).toBe(1);
    expect(result.output).toContain('Upstash rate limiting is partially configured');
  });

  it('accepts national scale when the supported distributed backend is complete', () => {
    const result = runSafety({
      SCALE_MODE: 'national',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    expect(result.status).toBe(0);
    expect(result.output).toContain('All production safety checks passed');
  });
});

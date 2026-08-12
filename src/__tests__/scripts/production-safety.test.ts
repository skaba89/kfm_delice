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
    SENTRY_DSN: '',
    UPSTASH_REDIS_REST_URL: '',
    UPSTASH_REDIS_REST_TOKEN: '',
    RESEND_API_KEY: '',
    SMTP_HOST: '',
    SMTP_USER: '',
    SMTP_PASS: '',
    // CI jobs may deliberately enable bootstrap helpers. Production-safety
    // tests must start from a clean production policy and opt into each
    // violation explicitly so their result is independent from job env vars.
    ALLOW_AUTO_SEED: 'false',
    ALLOW_DEFAULT_TENANT: 'false',
    ALLOW_PRISMA_DB_PUSH_FALLBACK: 'false',
    ALLOW_LOGIN_AUTO_SEED: 'false',
    ENABLE_PUBLIC_RESTAURANT_REGISTRATION: 'false',
    PUBLIC_REGISTRATION_TRIAL_PLAN: 'starter',
    PUBLIC_REGISTRATION_TRIAL_DAYS: '14',
    PUBLIC_REGISTRATION_VERIFICATION_TTL_MINUTES: '60',
    NEXT_PUBLIC_SHOW_DEMO_CREDS: 'false',
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

const publicRegistrationInfra = {
  ENABLE_PUBLIC_RESTAURANT_REGISTRATION: 'true',
  UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'token',
  RESEND_API_KEY: 'provider-enabled-for-test',
};

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

  it('rejects national scale without error monitoring', () => {
    const result = runSafety({
      SCALE_MODE: 'national',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('SENTRY_DSN is required for national scale observability');
  });

  it('rejects a partially configured Upstash backend', () => {
    const result = runSafety({ UPSTASH_REDIS_REST_URL: 'https://example.upstash.io' });
    expect(result.status).toBe(1);
    expect(result.output).toContain('Upstash rate limiting is partially configured');
  });

  it('rejects an unknown scale mode instead of silently downgrading safety', () => {
    const result = runSafety({ SCALE_MODE: 'nationnal' });
    expect(result.status).toBe(1);
    expect(result.output).toContain('SCALE_MODE=nationnal is invalid');
  });

  it('accepts national scale when supported distributed and observability backends are complete', () => {
    const result = runSafety({
      SCALE_MODE: 'national',
      SENTRY_DSN: 'https://public@example.invalid/1',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    expect(result.status).toBe(0);
    expect(result.output).toContain('All production safety checks passed');
  });

  it('rejects public registration without distributed abuse protection', () => {
    const result = runSafety({
      ENABLE_PUBLIC_RESTAURANT_REGISTRATION: 'true',
      RESEND_API_KEY: 'provider-enabled-for-test',
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('requires Upstash distributed rate limiting');
  });

  it('rejects public registration without a real verification email provider', () => {
    const result = runSafety({
      ENABLE_PUBLIC_RESTAURANT_REGISTRATION: 'true',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('requires a real email provider');
  });

  it('rejects public registration without an HTTPS verification base URL', () => {
    const result = runSafety({
      ...publicRegistrationInfra,
      PUBLIC_APP_URL: '',
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('requires HTTPS PUBLIC_APP_URL for verification links');
  });

  it('accepts a controlled Starter trial with Upstash, HTTPS and Resend', () => {
    const result = runSafety({
      ...publicRegistrationInfra,
      PUBLIC_REGISTRATION_TRIAL_PLAN: 'starter',
      PUBLIC_REGISTRATION_TRIAL_DAYS: '14',
      PUBLIC_REGISTRATION_VERIFICATION_TTL_MINUTES: '60',
    });
    expect(result.status).toBe(0);
    expect(result.output).toContain('All production safety checks passed');
  });

  it('accepts authenticated SMTP instead of Resend for verification delivery', () => {
    const result = runSafety({
      ENABLE_PUBLIC_RESTAURANT_REGISTRATION: 'true',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
      SMTP_HOST: 'smtp.example.test',
      SMTP_USER: 'mailer',
      SMTP_PASS: 'test-value',
    });
    expect(result.status).toBe(0);
  });

  it('rejects enterprise or custom as a public trial plan', () => {
    for (const plan of ['enterprise', 'custom']) {
      const result = runSafety({
        ...publicRegistrationInfra,
        PUBLIC_REGISTRATION_TRIAL_PLAN: plan,
      });
      expect(result.status).toBe(1);
      expect(result.output).toContain('PUBLIC_REGISTRATION_TRIAL_PLAN must be starter or pro');
    }
  });

  it('rejects out-of-range or non-integer public trial durations', () => {
    for (const days of ['0', '31', '14.5', 'abc']) {
      const result = runSafety({
        ...publicRegistrationInfra,
        PUBLIC_REGISTRATION_TRIAL_DAYS: days,
      });
      expect(result.status).toBe(1);
      expect(result.output).toContain('PUBLIC_REGISTRATION_TRIAL_DAYS must be an integer between 1 and 30');
    }
  });

  it('rejects unsafe verification link TTLs', () => {
    for (const minutes of ['9', '1441', '60.5', 'abc']) {
      const result = runSafety({
        ...publicRegistrationInfra,
        PUBLIC_REGISTRATION_VERIFICATION_TTL_MINUTES: minutes,
      });
      expect(result.status).toBe(1);
      expect(result.output).toContain('PUBLIC_REGISTRATION_VERIFICATION_TTL_MINUTES must be an integer between 10 and 1440');
    }
  });
});

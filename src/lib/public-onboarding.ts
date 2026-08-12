import { createHash, randomBytes } from 'node:crypto';
import type { CommercialPlan } from '@/lib/commercial-plan-catalog';

const DEFAULT_TRIAL_DAYS = 14;
const MIN_TRIAL_DAYS = 1;
const MAX_TRIAL_DAYS = 30;
const DEFAULT_VERIFICATION_TTL_MINUTES = 60;
const MIN_VERIFICATION_TTL_MINUTES = 10;
const MAX_VERIFICATION_TTL_MINUTES = 24 * 60;
const SAFE_PUBLIC_TRIAL_PLANS = new Set<CommercialPlan>(['starter', 'pro']);

export interface PublicOnboardingSettings {
  enabled: boolean;
  trialPlan: 'starter' | 'pro';
  trialDays: number;
  verificationTtlMinutes: number;
}

function clampInteger(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function getPublicOnboardingSettings(
  env: NodeJS.ProcessEnv = process.env,
): PublicOnboardingSettings {
  const requestedPlan = env.PUBLIC_REGISTRATION_TRIAL_PLAN?.trim().toLowerCase() as CommercialPlan | undefined;
  const trialPlan = requestedPlan && SAFE_PUBLIC_TRIAL_PLANS.has(requestedPlan)
    ? requestedPlan as 'starter' | 'pro'
    : 'starter';

  return {
    enabled: env.ENABLE_PUBLIC_RESTAURANT_REGISTRATION === 'true',
    trialPlan,
    trialDays: clampInteger(env.PUBLIC_REGISTRATION_TRIAL_DAYS, DEFAULT_TRIAL_DAYS, MIN_TRIAL_DAYS, MAX_TRIAL_DAYS),
    verificationTtlMinutes: clampInteger(
      env.PUBLIC_REGISTRATION_VERIFICATION_TTL_MINUTES,
      DEFAULT_VERIFICATION_TTL_MINUTES,
      MIN_VERIFICATION_TTL_MINUTES,
      MAX_VERIFICATION_TTL_MINUTES,
    ),
  };
}

export function normalizePublicOwnerEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function calculatePublicTrialEnd(now: Date, trialDays: number): Date {
  const trialEndsAt = new Date(now.getTime());
  trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + trialDays);
  return trialEndsAt;
}

export function calculateVerificationExpiry(now: Date, ttlMinutes: number): Date {
  return new Date(now.getTime() + ttlMinutes * 60 * 1000);
}

export function generatePublicVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashPublicVerificationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function hashPublicIdentityKey(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase(), 'utf8').digest('hex');
}

export function escapePublicEmailHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

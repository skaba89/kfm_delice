import type { CommercialPlan } from '@/lib/commercial-plan-catalog';

const DEFAULT_TRIAL_DAYS = 14;
const MIN_TRIAL_DAYS = 1;
const MAX_TRIAL_DAYS = 30;
const SAFE_PUBLIC_TRIAL_PLANS = new Set<CommercialPlan>(['starter', 'pro']);

export interface PublicOnboardingSettings {
  enabled: boolean;
  trialPlan: 'starter' | 'pro';
  trialDays: number;
}

function clampTrialDays(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_TRIAL_DAYS;
  return Math.min(MAX_TRIAL_DAYS, Math.max(MIN_TRIAL_DAYS, Math.trunc(parsed)));
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
    trialDays: clampTrialDays(env.PUBLIC_REGISTRATION_TRIAL_DAYS),
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

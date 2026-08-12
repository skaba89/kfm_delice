import { describe, expect, it } from 'vitest';
import {
  calculatePublicTrialEnd,
  getPublicOnboardingSettings,
  normalizePublicOwnerEmail,
} from '@/lib/public-onboarding';

describe('public onboarding settings', () => {
  it('is disabled by default with a bounded Starter 14-day trial', () => {
    expect(getPublicOnboardingSettings({} as NodeJS.ProcessEnv)).toEqual({
      enabled: false,
      trialPlan: 'starter',
      trialDays: 14,
    });
  });

  it('accepts only Starter or Pro as public trial plans', () => {
    expect(getPublicOnboardingSettings({ PUBLIC_REGISTRATION_TRIAL_PLAN: 'pro' } as NodeJS.ProcessEnv).trialPlan).toBe('pro');
    expect(getPublicOnboardingSettings({ PUBLIC_REGISTRATION_TRIAL_PLAN: 'starter' } as NodeJS.ProcessEnv).trialPlan).toBe('starter');

    for (const value of ['free', 'enterprise', 'custom', 'garbage']) {
      expect(getPublicOnboardingSettings({ PUBLIC_REGISTRATION_TRIAL_PLAN: value } as NodeJS.ProcessEnv).trialPlan).toBe('starter');
    }
  });

  it('bounds configured trial duration to 1..30 and defaults invalid values', () => {
    expect(getPublicOnboardingSettings({ PUBLIC_REGISTRATION_TRIAL_DAYS: '1' } as NodeJS.ProcessEnv).trialDays).toBe(1);
    expect(getPublicOnboardingSettings({ PUBLIC_REGISTRATION_TRIAL_DAYS: '30' } as NodeJS.ProcessEnv).trialDays).toBe(30);
    expect(getPublicOnboardingSettings({ PUBLIC_REGISTRATION_TRIAL_DAYS: '0' } as NodeJS.ProcessEnv).trialDays).toBe(1);
    expect(getPublicOnboardingSettings({ PUBLIC_REGISTRATION_TRIAL_DAYS: '99' } as NodeJS.ProcessEnv).trialDays).toBe(30);
    expect(getPublicOnboardingSettings({ PUBLIC_REGISTRATION_TRIAL_DAYS: 'abc' } as NodeJS.ProcessEnv).trialDays).toBe(14);
  });

  it('normalizes owner identity email before persistence', () => {
    expect(normalizePublicOwnerEmail('  Owner@Example.COM ')).toBe('owner@example.com');
  });

  it('calculates the trial boundary without mutating the input date', () => {
    const now = new Date('2026-08-12T10:30:00.000Z');
    const end = calculatePublicTrialEnd(now, 14);
    expect(end.toISOString()).toBe('2026-08-26T10:30:00.000Z');
    expect(now.toISOString()).toBe('2026-08-12T10:30:00.000Z');
  });
});

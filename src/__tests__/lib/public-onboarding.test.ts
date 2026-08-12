import { describe, expect, it } from 'vitest';
import {
  calculatePublicTrialEnd,
  calculateVerificationExpiry,
  escapePublicEmailHtml,
  generatePublicVerificationToken,
  getPublicOnboardingSettings,
  hashPublicIdentityKey,
  hashPublicVerificationToken,
  normalizePublicOwnerEmail,
} from '@/lib/public-onboarding';

describe('public onboarding settings', () => {
  it('is disabled by default with bounded trial and verification policies', () => {
    expect(getPublicOnboardingSettings({} as NodeJS.ProcessEnv)).toEqual({
      enabled: false,
      trialPlan: 'starter',
      trialDays: 14,
      verificationTtlMinutes: 60,
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

  it('bounds verification links to 10..1440 minutes and defaults invalid values', () => {
    expect(getPublicOnboardingSettings({ PUBLIC_REGISTRATION_VERIFICATION_TTL_MINUTES: '10' } as NodeJS.ProcessEnv).verificationTtlMinutes).toBe(10);
    expect(getPublicOnboardingSettings({ PUBLIC_REGISTRATION_VERIFICATION_TTL_MINUTES: '1440' } as NodeJS.ProcessEnv).verificationTtlMinutes).toBe(1440);
    expect(getPublicOnboardingSettings({ PUBLIC_REGISTRATION_VERIFICATION_TTL_MINUTES: '1' } as NodeJS.ProcessEnv).verificationTtlMinutes).toBe(10);
    expect(getPublicOnboardingSettings({ PUBLIC_REGISTRATION_VERIFICATION_TTL_MINUTES: '9999' } as NodeJS.ProcessEnv).verificationTtlMinutes).toBe(1440);
    expect(getPublicOnboardingSettings({ PUBLIC_REGISTRATION_VERIFICATION_TTL_MINUTES: 'abc' } as NodeJS.ProcessEnv).verificationTtlMinutes).toBe(60);
  });

  it('normalizes and hashes owner identity deterministically without exposing it', () => {
    expect(normalizePublicOwnerEmail('  Owner@Example.COM ')).toBe('owner@example.com');
    expect(hashPublicIdentityKey('Owner@Example.COM')).toBe(hashPublicIdentityKey(' owner@example.com '));
    expect(hashPublicIdentityKey('owner@example.com')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates a high-entropy token and persists only its deterministic hash', () => {
    const token = generatePublicVerificationToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const hash = hashPublicVerificationToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(token);
    expect(hashPublicVerificationToken(token)).toBe(hash);
  });

  it('calculates trial and verification boundaries without mutating the input date', () => {
    const now = new Date('2026-08-12T10:30:00.000Z');
    expect(calculatePublicTrialEnd(now, 14).toISOString()).toBe('2026-08-26T10:30:00.000Z');
    expect(calculateVerificationExpiry(now, 60).toISOString()).toBe('2026-08-12T11:30:00.000Z');
    expect(now.toISOString()).toBe('2026-08-12T10:30:00.000Z');
  });

  it('escapes user-controlled values before platform verification email HTML', () => {
    expect(escapePublicEmailHtml(`<script>alert('x')</script> & \"test\"`)).toBe('&lt;script&gt;alert(&#039;x&#039;)&lt;/script&gt; &amp; &quot;test&quot;');
  });
});

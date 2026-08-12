import { beforeEach, describe, expect, it, vi } from 'vitest';

const TOKEN = 'a'.repeat(64);
const TOKEN_HASH = 'b'.repeat(64);
const IDENTITY_HASH = 'c'.repeat(64);

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  rateLimit: vi.fn(),
  validatePassword: vi.fn(),
  hashPassword: vi.fn(),
  emailConfigured: vi.fn(),
  sendPlatformEmail: vi.fn(),
  queryRaw: vi.fn(),
  intentUpsert: vi.fn(),
  intentDeleteMany: vi.fn(),
  intentFindUnique: vi.fn(),
  transaction: vi.fn(),
  txIntentUpdateMany: vi.fn(),
  txIntentDelete: vi.fn(),
  txQueryRaw: vi.fn(),
  accountCreate: vi.fn(),
  restaurantCreate: vi.fn(),
  configCreate: vi.fn(),
  adminCreate: vi.fn(),
  subscriptionCreate: vi.fn(),
  ensureUniqueSlug: vi.fn(),
  logAudit: vi.fn(),
  invalidateTenantCache: vi.fn(),
  invalidateConfigCache: vi.fn(),
}));

vi.mock('@/lib/public-onboarding', () => ({
  getPublicOnboardingSettings: mocks.getSettings,
  normalizePublicOwnerEmail: (value: string) => value.trim().toLowerCase(),
  calculatePublicTrialEnd: (now: Date, days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
  calculateVerificationExpiry: (now: Date, minutes: number) => new Date(now.getTime() + minutes * 60 * 1000),
  generatePublicVerificationToken: () => TOKEN,
  hashPublicVerificationToken: () => TOKEN_HASH,
  hashPublicIdentityKey: () => IDENTITY_HASH,
  escapePublicEmailHtml: (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;'),
}));

vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rateLimit }));
vi.mock('@/lib/password-policy', () => ({ validatePassword: mocks.validatePassword }));
vi.mock('@/lib/auth', () => ({ hashPassword: mocks.hashPassword }));
vi.mock('@/lib/platform-email', () => ({
  isPlatformEmailDeliveryConfigured: mocks.emailConfigured,
  sendPlatformEmail: mocks.sendPlatformEmail,
}));
vi.mock('@/lib/tenant', () => ({
  generateSlug: (value: string) => value.trim().toLowerCase().replace(/\s+/g, '-'),
  ensureUniqueSlug: mocks.ensureUniqueSlug,
  invalidateTenantCache: mocks.invalidateTenantCache,
}));
vi.mock('@/lib/constants', () => ({ invalidateConfigCache: mocks.invalidateConfigCache }));
vi.mock('@/lib/audit', () => ({ logAudit: mocks.logAudit }));
vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  db: {
    $queryRaw: mocks.queryRaw,
    publicRegistrationIntent: {
      upsert: mocks.intentUpsert,
      deleteMany: mocks.intentDeleteMany,
      findUnique: mocks.intentFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

import { GET, POST as initiateRegistration } from '@/app/api/register-restaurant/route';
import { POST as verifyRegistration } from '@/app/api/register-restaurant/verify/route';

function registrationBody(extra: Record<string, unknown> = {}) {
  return {
    restaurantName: 'Chez Diallo',
    phone: '+224622000000',
    whatsapp: '+224622000000',
    email: 'contact@diallo.example',
    address: 'Conakry',
    currency: 'GNF',
    locale: 'fr',
    ownerName: 'Amadou Diallo',
    ownerEmail: ' Owner@Example.COM ',
    ownerPassword: 'StrongPassword1!',
    ownerPhone: '+224623000000',
    ...extra,
  };
}

function request(path: string, body: unknown) {
  return new Request(`https://kfm.example${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10, 10.0.0.5',
    },
    body: JSON.stringify(body),
  });
}

function persistedPayload() {
  return JSON.stringify({
    restaurantName: 'Chez Diallo',
    phone: '+224622000000',
    whatsapp: '+224622000000',
    email: 'contact@diallo.example',
    address: 'Conakry',
    currency: 'GNF',
    locale: 'fr',
    ownerName: 'Amadou Diallo',
    ownerEmail: 'owner@example.com',
    ownerPhone: '+224623000000',
    trialPlan: 'starter',
    trialDays: 14,
  });
}

function pendingIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'intent-1',
    ownerEmail: 'owner@example.com',
    tokenHash: TOKEN_HASH,
    payload: persistedPayload(),
    passwordHash: 'hashed-password',
    status: 'pending',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('public restaurant onboarding — verification initiation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockReturnValue({
      enabled: true,
      trialPlan: 'starter',
      trialDays: 14,
      verificationTtlMinutes: 60,
    });
    mocks.rateLimit.mockResolvedValue({ allowed: true, remaining: 2 });
    mocks.validatePassword.mockReturnValue({ valid: true, errors: [] });
    mocks.hashPassword.mockResolvedValue('hashed-password');
    mocks.emailConfigured.mockReturnValue(true);
    mocks.sendPlatformEmail.mockResolvedValue({ success: true, configured: true, provider: 'resend' });
    mocks.queryRaw.mockResolvedValue([]);
    mocks.intentUpsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      id: 'intent-1',
      ...create,
    }));
    mocks.intentDeleteMany.mockResolvedValue({ count: 1 });
    mocks.logAudit.mockResolvedValue(undefined);
  });

  it('publishes the controlled trial and mandatory verification policy', async () => {
    const response = await GET();
    expect(await response.json()).toEqual({
      enabled: true,
      trialPlan: 'starter',
      trialDays: 14,
      verificationRequired: true,
    });
  });

  it('fails closed when registration is disabled', async () => {
    mocks.getSettings.mockReturnValue({ enabled: false, trialPlan: 'starter', trialDays: 14, verificationTtlMinutes: 60 });
    const response = await initiateRegistration(request('/api/register-restaurant', registrationBody()));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('PUBLIC_REGISTRATION_DISABLED');
    expect(mocks.emailConfigured).not.toHaveBeenCalled();
    expect(mocks.intentUpsert).not.toHaveBeenCalled();
  });

  it('fails closed when only the console email fallback is available', async () => {
    mocks.emailConfigured.mockReturnValue(false);
    const response = await initiateRegistration(request('/api/register-restaurant', registrationBody()));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('PUBLIC_REGISTRATION_EMAIL_UNAVAILABLE');
    expect(mocks.intentUpsert).not.toHaveBeenCalled();
  });

  it('still rejects a client-supplied plan before any intent is persisted', async () => {
    const response = await initiateRegistration(request('/api/register-restaurant', registrationBody({ plan: 'enterprise' })));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('PUBLIC_REGISTRATION_VALIDATION_ERROR');
    expect(mocks.intentUpsert).not.toHaveBeenCalled();
  });

  it('applies the production password policy before persisting an intent', async () => {
    mocks.validatePassword.mockReturnValue({ valid: false, errors: ['Mot de passe trop faible'] });
    const response = await initiateRegistration(request('/api/register-restaurant', registrationBody({ ownerPassword: 'short1!' })));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('PUBLIC_REGISTRATION_WEAK_PASSWORD');
    expect(mocks.intentUpsert).not.toHaveBeenCalled();
  });

  it('rejects an already registered owner before creating a verification intent', async () => {
    mocks.queryRaw.mockResolvedValue([{ id: 'existing-admin' }]);
    const response = await initiateRegistration(request('/api/register-restaurant', registrationBody()));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('PUBLIC_REGISTRATION_EMAIL_EXISTS');
    expect(mocks.intentUpsert).not.toHaveBeenCalled();
  });

  it('stores only a token hash and sends the raw token by email without creating a tenant', async () => {
    const response = await initiateRegistration(request('/api/register-restaurant', registrationBody()));
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({ success: true, verificationRequired: true, ownerEmail: 'owner@example.com' });
    expect(mocks.intentUpsert).toHaveBeenCalledOnce();
    const call = mocks.intentUpsert.mock.calls[0][0];
    expect(call.where).toEqual({ ownerEmail: 'owner@example.com' });
    expect(call.create).toEqual(expect.objectContaining({
      ownerEmail: 'owner@example.com',
      tokenHash: TOKEN_HASH,
      passwordHash: 'hashed-password',
      status: 'pending',
    }));
    expect(call.create).not.toHaveProperty('token');
    expect(call.create.payload).not.toContain('ownerPassword');
    expect(JSON.parse(call.create.payload)).toMatchObject({
      ownerEmail: 'owner@example.com',
      trialPlan: 'starter',
      trialDays: 14,
    });

    expect(mocks.sendPlatformEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@example.com',
      subject: expect.stringContaining('Confirmez'),
      html: expect.stringContaining(`/onboard/verify?token=${TOKEN}`),
    }));
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'public_registration_verification_sent',
      entityType: 'PublicRegistrationIntent',
      entityId: 'intent-1',
    }));
  });

  it('deletes only the exact failed intent token when email delivery fails', async () => {
    mocks.sendPlatformEmail.mockResolvedValue({ success: false, configured: true, provider: 'resend', error: 'provider error' });
    const response = await initiateRegistration(request('/api/register-restaurant', registrationBody()));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('PUBLIC_REGISTRATION_EMAIL_DELIVERY_FAILED');
    expect(mocks.intentDeleteMany).toHaveBeenCalledWith({ where: { id: 'intent-1', tokenHash: TOKEN_HASH } });
  });

  it('applies a second hashed-email rate limit to resend attempts', async () => {
    mocks.rateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 2 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0 });
    const response = await initiateRegistration(request('/api/register-restaurant', registrationBody()));
    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe('PUBLIC_REGISTRATION_EMAIL_RATE_LIMITED');
    expect(mocks.rateLimit).toHaveBeenNthCalledWith(2, `public-registration-email:${IDENTITY_HASH}`, 3, 15 * 60_000);
    expect(mocks.intentUpsert).not.toHaveBeenCalled();
  });
});

describe('public restaurant onboarding — verified tenant creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockReturnValue({
      enabled: true,
      trialPlan: 'starter',
      trialDays: 14,
      verificationTtlMinutes: 60,
    });
    mocks.rateLimit.mockResolvedValue({ allowed: true, remaining: 9 });
    mocks.intentFindUnique.mockResolvedValue(pendingIntent());
    mocks.intentDeleteMany.mockResolvedValue({ count: 1 });
    mocks.ensureUniqueSlug.mockResolvedValue('chez-diallo');
    mocks.txIntentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txIntentDelete.mockResolvedValue(pendingIntent({ status: 'processing' }));
    mocks.txQueryRaw.mockResolvedValue([]);
    mocks.logAudit.mockResolvedValue(undefined);

    mocks.accountCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'account-1', ...data }));
    mocks.restaurantCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'restaurant-1', ...data }));
    mocks.configCreate.mockResolvedValue({ id: 'config-1', restaurantId: 'restaurant-1' });
    mocks.adminCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'admin-1', ...data }));
    mocks.subscriptionCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'subscription-1', ...data }));

    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      publicRegistrationIntent: {
        updateMany: mocks.txIntentUpdateMany,
        delete: mocks.txIntentDelete,
      },
      $queryRaw: mocks.txQueryRaw,
      account: { create: mocks.accountCreate },
      restaurant: { create: mocks.restaurantCreate },
      restaurantConfig: { create: mocks.configCreate },
      admin: { create: mocks.adminCreate },
      platformSubscription: { create: mocks.subscriptionCreate },
    }));
  });

  it('rejects malformed verification tokens before database lookup', async () => {
    const response = await verifyRegistration(request('/api/register-restaurant/verify', { token: 'short' }));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('PUBLIC_REGISTRATION_VERIFY_VALIDATION_ERROR');
    expect(mocks.intentFindUnique).not.toHaveBeenCalled();
  });

  it('rejects an unknown or already-consumed token', async () => {
    mocks.intentFindUnique.mockResolvedValue(null);
    const response = await verifyRegistration(request('/api/register-restaurant/verify', { token: TOKEN }));
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('PUBLIC_REGISTRATION_VERIFY_NOT_FOUND');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('expires stale intents without creating a tenant', async () => {
    mocks.intentFindUnique.mockResolvedValue(pendingIntent({ expiresAt: new Date(Date.now() - 1000) }));
    const response = await verifyRegistration(request('/api/register-restaurant/verify', { token: TOKEN }));
    expect(response.status).toBe(410);
    expect((await response.json()).code).toBe('PUBLIC_REGISTRATION_VERIFY_EXPIRED');
    expect(mocks.intentDeleteMany).toHaveBeenCalledWith({ where: { id: 'intent-1', tokenHash: TOKEN_HASH } });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('claims the pending intent and creates the complete tenant atomically only after verification', async () => {
    const before = Date.now();
    const response = await verifyRegistration(request('/api/register-restaurant/verify', { token: TOKEN }));
    const after = Date.now();
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      success: true,
      loginRequired: true,
      loginUrl: '/admin/login?verified=1',
      account: { id: 'account-1', plan: 'starter', status: 'trial' },
      restaurant: { id: 'restaurant-1', slug: 'chez-diallo' },
      trial: { plan: 'starter', days: 14 },
    });

    expect(mocks.txIntentUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'intent-1',
        tokenHash: TOKEN_HASH,
        status: 'pending',
        expiresAt: { gt: expect.any(Date) },
      }),
      data: { status: 'processing' },
    });
    expect(mocks.accountCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerEmail: 'owner@example.com',
        status: 'trial',
        plan: 'starter',
        maxRestaurants: 2,
        maxSecondaryRestaurants: 1,
        maxAdmins: 5,
        maxUsers: 15,
      }),
    });
    expect(mocks.restaurantCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'account-1',
        type: 'principal',
        status: 'trial',
        plan: 'starter',
      }),
    });
    expect(mocks.adminCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'owner@example.com',
        password: 'hashed-password',
        accountId: 'account-1',
        restaurantId: 'restaurant-1',
      }),
    });
    expect(mocks.subscriptionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'account-1',
        plan: 'starter',
        status: 'trialing',
        unitAmount: 50_000n,
      }),
    });
    expect(mocks.txIntentDelete).toHaveBeenCalledWith({ where: { id: 'intent-1' } });

    const subscription = mocks.subscriptionCreate.mock.calls[0][0].data;
    const minExpected = before + 14 * 24 * 60 * 60 * 1000;
    const maxExpected = after + 14 * 24 * 60 * 60 * 1000;
    expect((subscription.nextBillingAt as Date).getTime()).toBeGreaterThanOrEqual(minExpected);
    expect((subscription.nextBillingAt as Date).getTime()).toBeLessThanOrEqual(maxExpected);

    expect(mocks.invalidateTenantCache).toHaveBeenCalledOnce();
    expect(mocks.invalidateConfigCache).toHaveBeenCalledOnce();
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'public_trial_registration_verified',
      accountId: 'account-1',
      restaurantId: 'restaurant-1',
      after: expect.objectContaining({ emailVerified: true }),
    }));
  });

  it('rejects a concurrent second verification when the claim is already taken', async () => {
    mocks.txIntentUpdateMany.mockResolvedValue({ count: 0 });
    const response = await verifyRegistration(request('/api/register-restaurant/verify', { token: TOKEN }));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('PUBLIC_REGISTRATION_VERIFY_ALREADY_PROCESSING');
    expect(mocks.accountCreate).not.toHaveBeenCalled();
  });

  it('rechecks owner uniqueness inside the consumption transaction', async () => {
    mocks.txQueryRaw.mockResolvedValue([{ id: 'newly-created-admin' }]);
    const response = await verifyRegistration(request('/api/register-restaurant/verify', { token: TOKEN }));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('PUBLIC_REGISTRATION_EMAIL_EXISTS');
    expect(mocks.accountCreate).not.toHaveBeenCalled();
  });

  it('maps a late unique collision to a stable conflict instead of partially succeeding', async () => {
    mocks.accountCreate.mockRejectedValue({ code: 'P2002' });
    const response = await verifyRegistration(request('/api/register-restaurant/verify', { token: TOKEN }));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('PUBLIC_REGISTRATION_CONFLICT');
  });
});

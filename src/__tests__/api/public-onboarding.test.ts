import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  rateLimit: vi.fn(),
  validatePassword: vi.fn(),
  hashPassword: vi.fn(),
  generateToken: vi.fn(),
  ensureUniqueSlug: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
  accountCreate: vi.fn(),
  restaurantCreate: vi.fn(),
  configCreate: vi.fn(),
  adminCreate: vi.fn(),
  subscriptionCreate: vi.fn(),
  logAudit: vi.fn(),
  invalidateTenantCache: vi.fn(),
  invalidateConfigCache: vi.fn(),
}));

vi.mock('@/lib/public-onboarding', () => ({
  getPublicOnboardingSettings: mocks.getSettings,
  normalizePublicOwnerEmail: (value: string) => value.trim().toLowerCase(),
  calculatePublicTrialEnd: (now: Date, days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mocks.rateLimit,
}));

vi.mock('@/lib/password-policy', () => ({
  validatePassword: mocks.validatePassword,
}));

vi.mock('@/lib/auth', () => ({
  hashPassword: mocks.hashPassword,
  generateToken: mocks.generateToken,
}));

vi.mock('@/lib/tenant', () => ({
  generateSlug: (value: string) => value.trim().toLowerCase().replace(/\s+/g, '-'),
  ensureUniqueSlug: mocks.ensureUniqueSlug,
  invalidateTenantCache: mocks.invalidateTenantCache,
}));

vi.mock('@/lib/constants', () => ({
  invalidateConfigCache: mocks.invalidateConfigCache,
}));

vi.mock('@/lib/audit', () => ({
  logAudit: mocks.logAudit,
}));

vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  db: {
    $queryRaw: mocks.queryRaw,
    $transaction: mocks.transaction,
  },
}));

import { GET, POST } from '@/app/api/register-restaurant/route';

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

function request(body: unknown) {
  return new Request('https://kfm.example/api/register-restaurant', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10, 10.0.0.5',
    },
    body: JSON.stringify(body),
  });
}

describe('public restaurant onboarding contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockReturnValue({ enabled: true, trialPlan: 'starter', trialDays: 14 });
    mocks.rateLimit.mockResolvedValue({ allowed: true, remaining: 2 });
    mocks.validatePassword.mockReturnValue({ valid: true, errors: [] });
    mocks.hashPassword.mockResolvedValue('hashed-password');
    mocks.generateToken.mockReturnValue('signed-access-token');
    mocks.ensureUniqueSlug.mockResolvedValue('chez-diallo');
    mocks.queryRaw.mockResolvedValue([]);
    mocks.logAudit.mockResolvedValue(undefined);

    mocks.accountCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'account-1',
      ...data,
    }));
    mocks.restaurantCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'restaurant-1',
      ...data,
    }));
    mocks.configCreate.mockResolvedValue({ id: 'config-1', restaurantId: 'restaurant-1' });
    mocks.adminCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'admin-1',
      tokenVersion: 0,
      ...data,
    }));
    mocks.subscriptionCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'subscription-1',
      ...data,
    }));
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      account: { create: mocks.accountCreate },
      restaurant: { create: mocks.restaurantCreate },
      restaurantConfig: { create: mocks.configCreate },
      admin: { create: mocks.adminCreate },
      platformSubscription: { create: mocks.subscriptionCreate },
    }));
  });

  it('publishes only the server-controlled trial policy', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enabled: true, trialPlan: 'starter', trialDays: 14 });
  });

  it('fails closed before rate limiting or database access when public registration is disabled', async () => {
    mocks.getSettings.mockReturnValue({ enabled: false, trialPlan: 'starter', trialDays: 14 });

    const response = await POST(request(registrationBody()));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('PUBLIC_REGISTRATION_DISABLED');
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects a client-supplied commercial plan instead of trusting the browser', async () => {
    const response = await POST(request(registrationBody({ plan: 'enterprise' })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('PUBLIC_REGISTRATION_VALIDATION_ERROR');
    expect(mocks.queryRaw).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('applies the production password policy before any database write', async () => {
    mocks.validatePassword.mockReturnValue({
      valid: false,
      errors: ['Le mot de passe doit faire au moins 12 caractères'],
    });

    const response = await POST(request(registrationBody({ ownerPassword: 'short1!' })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('PUBLIC_REGISTRATION_WEAK_PASSWORD');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects an existing owner identity before creating a tenant', async () => {
    mocks.queryRaw.mockResolvedValue([{ id: 'existing-admin' }]);

    const response = await POST(request(registrationBody()));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('PUBLIC_REGISTRATION_EMAIL_EXISTS');
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('creates Account, principal Restaurant, owner Admin, config and trialing billing subscription atomically', async () => {
    const before = Date.now();
    const response = await POST(request(registrationBody()));
    const after = Date.now();
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.account).toMatchObject({ id: 'account-1', plan: 'starter', status: 'trial' });
    expect(body.restaurant).toMatchObject({ id: 'restaurant-1', plan: 'starter', status: 'trial' });
    expect(body.trial).toMatchObject({ plan: 'starter', days: 14 });
    expect(body.token).toBe('signed-access-token');
    expect(mocks.transaction).toHaveBeenCalledOnce();

    expect(mocks.accountCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Chez Diallo',
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
        slug: 'chez-diallo',
        accountId: 'account-1',
        type: 'principal',
        plan: 'starter',
        status: 'trial',
        ownerEmail: 'owner@example.com',
      }),
    });

    expect(mocks.configCreate).toHaveBeenCalledWith({
      data: { restaurantId: 'restaurant-1' },
    });

    expect(mocks.adminCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'owner@example.com',
        accountId: 'account-1',
        restaurantId: 'restaurant-1',
        role: 'admin',
        canCreateRestaurant: true,
        restaurantCreationLimit: 1,
      }),
    });

    expect(mocks.subscriptionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'account-1',
        plan: 'starter',
        billingCycle: 'monthly',
        status: 'trialing',
        currency: 'GNF',
        unitAmount: 50_000n,
        provider: 'manual',
      }),
    });

    const subscriptionData = mocks.subscriptionCreate.mock.calls[0][0].data;
    const nextBillingAt = subscriptionData.nextBillingAt as Date;
    const currentPeriodEnd = subscriptionData.currentPeriodEnd as Date;
    const minExpected = before + 14 * 24 * 60 * 60 * 1000;
    const maxExpected = after + 14 * 24 * 60 * 60 * 1000;
    expect(nextBillingAt.getTime()).toBe(currentPeriodEnd.getTime());
    expect(nextBillingAt.getTime()).toBeGreaterThanOrEqual(minExpected);
    expect(nextBillingAt.getTime()).toBeLessThanOrEqual(maxExpected);

    expect(mocks.invalidateTenantCache).toHaveBeenCalledOnce();
    expect(mocks.invalidateConfigCache).toHaveBeenCalledOnce();
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'public_trial_registration',
      entityType: 'Account',
      entityId: 'account-1',
      accountId: 'account-1',
      restaurantId: 'restaurant-1',
    }));
    expect(mocks.generateToken).toHaveBeenCalledWith(expect.objectContaining({
      id: 'admin-1',
      type: 'admin',
      restaurantId: 'restaurant-1',
      restaurantSlug: 'chez-diallo',
      tokenVersion: 0,
    }));
  });

  it('returns a stable conflict on a transactional unique collision', async () => {
    mocks.transaction.mockRejectedValue({ code: 'P2002' });

    const response = await POST(request(registrationBody()));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('PUBLIC_REGISTRATION_CONFLICT');
  });
});

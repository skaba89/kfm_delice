import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  validatePassword: vi.fn(),
  generateSlug: vi.fn(),
  ensureUniqueSlug: vi.fn(),
  hashPassword: vi.fn(),
  generateToken: vi.fn(),
  logAudit: vi.fn(),
  adminFindFirst: vi.fn(),
  transaction: vi.fn(),
  accountCreate: vi.fn(),
  restaurantCreate: vi.fn(),
  adminCreate: vi.fn(),
  configCreate: vi.fn(),
  subscriptionCreate: vi.fn(),
}));

function bigIntToNumber(value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(bigIntToNumber);
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, bigIntToNumber(item)]),
    );
  }
  return value;
}

vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rateLimit }));
vi.mock('@/lib/password-policy', () => ({ validatePassword: mocks.validatePassword }));
vi.mock('@/lib/tenant', () => ({
  generateSlug: mocks.generateSlug,
  ensureUniqueSlug: mocks.ensureUniqueSlug,
}));
vi.mock('@/lib/auth', () => ({
  hashPassword: mocks.hashPassword,
  generateToken: mocks.generateToken,
}));
vi.mock('@/lib/audit', () => ({ logAudit: mocks.logAudit }));
vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  bigIntToNumber,
  db: {
    admin: { findFirst: mocks.adminFindFirst },
    $transaction: mocks.transaction,
  },
}));

import { POST } from '@/app/api/register-restaurant/route';

const originalEnv = {
  enabled: process.env.ENABLE_PUBLIC_RESTAURANT_REGISTRATION,
  plan: process.env.PUBLIC_REGISTRATION_TRIAL_PLAN,
  days: process.env.PUBLIC_REGISTRATION_TRIAL_DAYS,
};

function registrationBody(overrides: Record<string, unknown> = {}) {
  return {
    restaurantName: 'Bistro Conakry',
    phone: '+224600000000',
    email: 'contact@bistro.test',
    address: 'Kaloum, Conakry',
    ownerName: 'Mamadou Diallo',
    ownerEmail: 'owner@bistro.test',
    ownerPassword: 'StrongPass123!',
    ownerPhone: '+224611111111',
    ...overrides,
  };
}

function request(body: unknown = registrationBody()) {
  return new Request('https://example.test/api/register-restaurant', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10, 10.0.0.1',
    },
    body: JSON.stringify(body),
  });
}

describe('public registration account-first onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T10:00:00.000Z'));

    process.env.ENABLE_PUBLIC_RESTAURANT_REGISTRATION = 'true';
    process.env.PUBLIC_REGISTRATION_TRIAL_PLAN = 'starter';
    process.env.PUBLIC_REGISTRATION_TRIAL_DAYS = '14';

    mocks.rateLimit.mockResolvedValue({ allowed: true });
    mocks.validatePassword.mockReturnValue({ valid: true, errors: [] });
    mocks.generateSlug.mockReturnValue('bistro-conakry');
    mocks.ensureUniqueSlug.mockResolvedValue('bistro-conakry');
    mocks.hashPassword.mockResolvedValue('hashed-password');
    mocks.generateToken.mockReturnValue('jwt-token');
    mocks.logAudit.mockResolvedValue(undefined);
    mocks.adminFindFirst.mockResolvedValue(null);

    mocks.accountCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'account-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
    mocks.restaurantCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'restaurant-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
    mocks.adminCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'admin-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
    mocks.configCreate.mockResolvedValue({ id: 'config-1' });
    mocks.subscriptionCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'subscription-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      account: { create: mocks.accountCreate },
      restaurant: { create: mocks.restaurantCreate },
      admin: { create: mocks.adminCreate },
      restaurantConfig: { create: mocks.configCreate },
      platformSubscription: { create: mocks.subscriptionCreate },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalEnv.enabled === undefined) delete process.env.ENABLE_PUBLIC_RESTAURANT_REGISTRATION;
    else process.env.ENABLE_PUBLIC_RESTAURANT_REGISTRATION = originalEnv.enabled;
    if (originalEnv.plan === undefined) delete process.env.PUBLIC_REGISTRATION_TRIAL_PLAN;
    else process.env.PUBLIC_REGISTRATION_TRIAL_PLAN = originalEnv.plan;
    if (originalEnv.days === undefined) delete process.env.PUBLIC_REGISTRATION_TRIAL_DAYS;
    else process.env.PUBLIC_REGISTRATION_TRIAL_DAYS = originalEnv.days;
  });

  it('keeps public registration disabled before rate limiting or database access', async () => {
    process.env.ENABLE_PUBLIC_RESTAURANT_REGISTRATION = 'false';

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.adminFindFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects any client-supplied plan, including enterprise, before writing', async () => {
    const response = await POST(request(registrationBody({ plan: 'enterprise' })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('PUBLIC_REGISTRATION_VALIDATION_ERROR');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('creates Account, principal restaurant, owner admin, config and trialing subscription atomically', async () => {
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.account).toMatchObject({
      id: 'account-1',
      plan: 'starter',
      status: 'trial',
      trialEndsAt: '2026-08-26T10:00:00.000Z',
    });
    expect(body.subscription).toMatchObject({
      id: 'subscription-1',
      plan: 'starter',
      status: 'trialing',
      billingCycle: 'monthly',
      unitAmount: 50_000,
      nextBillingAt: null,
    });
    expect(body.token).toBe('jwt-token');

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.accountCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'trial',
        plan: 'starter',
        maxRestaurants: 2,
        maxSecondaryRestaurants: 1,
        maxAdmins: 5,
        maxUsers: 15,
        trialEndsAt: '2026-08-26T10:00:00.000Z',
      }),
    });
    expect(mocks.restaurantCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'account-1',
        type: 'principal',
        plan: 'starter',
        status: 'trial',
      }),
    });
    expect(mocks.adminCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'account-1',
        restaurantId: 'restaurant-1',
        canCreateRestaurant: true,
        restaurantCreationLimit: 1,
      }),
    });
    expect(mocks.subscriptionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'account-1',
        plan: 'starter',
        status: 'trialing',
        billingCycle: 'monthly',
        unitAmount: 50_000n,
        currentPeriodStart: new Date('2026-08-12T10:00:00.000Z'),
        currentPeriodEnd: new Date('2026-08-26T10:00:00.000Z'),
        nextBillingAt: null,
        provider: 'manual',
      }),
    });
    expect(mocks.configCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        restaurantId: 'restaurant-1',
        features: '{}',
      }),
    });
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'public_registration',
      entityType: 'Account',
      accountId: 'account-1',
      restaurantId: 'restaurant-1',
    }));
  });

  it('uses a server-controlled pro trial and pro catalog quotas without client plan input', async () => {
    process.env.PUBLIC_REGISTRATION_TRIAL_PLAN = 'pro';

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.account.plan).toBe('pro');
    expect(body.subscription.unitAmount).toBe(150_000);
    expect(mocks.accountCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        plan: 'pro',
        maxRestaurants: 5,
        maxSecondaryRestaurants: 4,
        maxAdmins: 15,
        maxUsers: 50,
      }),
    });
    expect(mocks.adminCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        canCreateRestaurant: true,
        restaurantCreationLimit: 4,
      }),
    });
  });

  it('fails closed when public trial configuration attempts enterprise', async () => {
    process.env.PUBLIC_REGISTRATION_TRIAL_PLAN = 'enterprise';

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe('PUBLIC_REGISTRATION_CONFIGURATION_ERROR');
    expect(mocks.adminFindFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects an already-used owner email without starting the transaction', async () => {
    mocks.adminFindFirst.mockResolvedValue({ id: 'existing-admin' });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('PUBLIC_REGISTRATION_EMAIL_EXISTS');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

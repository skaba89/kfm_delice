import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticatePlatformAdmin: vi.fn(),
  accountCreate: vi.fn(),
  accountFindUnique: vi.fn(),
  accountUpdate: vi.fn(),
  restaurantCount: vi.fn(),
  restaurantUpdateMany: vi.fn(),
  transaction: vi.fn(),
  logAudit: vi.fn(),
  invalidateTenantCache: vi.fn(),
  invalidateConfigCache: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authenticatePlatformAdmin: mocks.authenticatePlatformAdmin,
}));

vi.mock('@/lib/audit', () => ({
  logAudit: mocks.logAudit,
}));

vi.mock('@/lib/tenant', () => ({
  invalidateTenantCache: mocks.invalidateTenantCache,
}));

vi.mock('@/lib/constants', () => ({
  invalidateConfigCache: mocks.invalidateConfigCache,
}));

vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  bigIntToNumber: (value: unknown) => value,
  db: {
    account: {
      create: mocks.accountCreate,
      findUnique: mocks.accountFindUnique,
    },
    restaurant: { count: mocks.restaurantCount },
    $transaction: mocks.transaction,
  },
}));

import { POST as createAccount } from '@/app/api/platform/accounts/route';
import { PATCH as patchQuotas } from '@/app/api/platform/accounts/[id]/quotas/route';

const platformAdmin = { id: 'platform-1', email: 'platform@example.test', role: 'super_admin' };

function existingAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'account-1',
    name: 'Compte A',
    plan: 'starter',
    status: 'active',
    maxRestaurants: 2,
    maxSecondaryRestaurants: 1,
    maxAdmins: 5,
    maxUsers: 15,
    maxOrdersPerMonth: 1000,
    ...overrides,
  };
}

describe('platform commercial quota defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatePlatformAdmin.mockResolvedValue(platformAdmin);
    mocks.logAudit.mockResolvedValue(undefined);
    mocks.restaurantCount.mockResolvedValue(1);
    mocks.accountCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'new-account', ...data }));
    mocks.accountUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...existingAccount(), ...data }));
    mocks.restaurantUpdateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      account: { update: mocks.accountUpdate },
      restaurant: { updateMany: mocks.restaurantUpdateMany },
    }));
  });

  it('creates Starter with the quotas sold in the catalog when no overrides are supplied', async () => {
    const response = await createAccount(new Request('https://example.test/api/platform/accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Starter client', plan: 'starter' }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.accountCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        plan: 'starter',
        maxRestaurants: 2,
        maxSecondaryRestaurants: 1,
        maxAdmins: 5,
        maxUsers: 15,
        maxOrdersPerMonth: 1000,
      }),
    });
  });

  it('preserves explicit negotiated quota overrides at creation', async () => {
    const response = await createAccount(new Request('https://example.test/api/platform/accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Starter sur mesure',
        plan: 'starter',
        maxRestaurants: 3,
        maxSecondaryRestaurants: 2,
        maxAdmins: 6,
        maxUsers: 20,
      }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.accountCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        maxRestaurants: 3,
        maxSecondaryRestaurants: 2,
        maxAdmins: 6,
        maxUsers: 20,
      }),
    });
  });

  it('rejects incoherent restaurant quotas at creation', async () => {
    const response = await createAccount(new Request('https://example.test/api/platform/accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Quota invalide',
        plan: 'starter',
        maxRestaurants: 1,
        maxSecondaryRestaurants: 1,
      }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.accountCreate).not.toHaveBeenCalled();
  });

  it('adopts Pro defaults, syncs restaurant plan shadow and clears both caches', async () => {
    mocks.accountFindUnique.mockResolvedValue(existingAccount());
    mocks.restaurantCount.mockResolvedValue(2);

    const response = await patchQuotas(new Request('https://example.test/api/platform/accounts/account-1/quotas', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'pro' }),
    }), { params: Promise.resolve({ id: 'account-1' }) });

    expect(response.status).toBe(200);
    expect(mocks.accountUpdate).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: expect.objectContaining({
        plan: 'pro',
        maxRestaurants: 5,
        maxSecondaryRestaurants: 4,
        maxAdmins: 15,
        maxUsers: 50,
      }),
    });
    expect(mocks.restaurantUpdateMany).toHaveBeenCalledWith({
      where: { accountId: 'account-1' },
      data: { plan: 'pro' },
    });
    expect(mocks.invalidateTenantCache).toHaveBeenCalledOnce();
    expect(mocks.invalidateConfigCache).toHaveBeenCalledOnce();
  });

  it('marks an account over quota when a downgrade falls below current restaurant usage', async () => {
    mocks.accountFindUnique.mockResolvedValue(existingAccount({ plan: 'pro', maxRestaurants: 5, maxSecondaryRestaurants: 4, maxAdmins: 15, maxUsers: 50 }));
    mocks.restaurantCount.mockResolvedValue(2);

    const response = await patchQuotas(new Request('https://example.test/api/platform/accounts/account-1/quotas', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'free' }),
    }), { params: Promise.resolve({ id: 'account-1' }) });

    expect(response.status).toBe(200);
    expect(mocks.accountUpdate).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: expect.objectContaining({
        plan: 'free',
        maxRestaurants: 1,
        maxSecondaryRestaurants: 0,
        maxAdmins: 2,
        maxUsers: 5,
        status: 'over_quota',
      }),
    });
    expect(mocks.restaurantUpdateMany).toHaveBeenCalledWith({
      where: { accountId: 'account-1' },
      data: { plan: 'free' },
    });
    expect(mocks.invalidateTenantCache).toHaveBeenCalledOnce();
    expect(mocks.invalidateConfigCache).toHaveBeenCalledOnce();
  });

  it('automatically leaves over_quota after an upgrade restores restaurant capacity', async () => {
    mocks.accountFindUnique.mockResolvedValue(existingAccount({ status: 'over_quota', maxRestaurants: 1, maxSecondaryRestaurants: 0 }));
    mocks.restaurantCount.mockResolvedValue(2);

    const response = await patchQuotas(new Request('https://example.test/api/platform/accounts/account-1/quotas', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'pro' }),
    }), { params: Promise.resolve({ id: 'account-1' }) });

    expect(response.status).toBe(200);
    expect(mocks.accountUpdate).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: expect.objectContaining({ status: 'active' }),
    });
    expect(mocks.restaurantUpdateMany).toHaveBeenCalledWith({
      where: { accountId: 'account-1' },
      data: { plan: 'pro' },
    });
    expect(mocks.invalidateTenantCache).toHaveBeenCalledOnce();
    expect(mocks.invalidateConfigCache).toHaveBeenCalledOnce();
  });

  it('does not rewrite restaurant plan shadows for a pure quota edit', async () => {
    mocks.accountFindUnique.mockResolvedValue(existingAccount());

    const response = await patchQuotas(new Request('https://example.test/api/platform/accounts/account-1/quotas', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ maxUsers: 20 }),
    }), { params: Promise.resolve({ id: 'account-1' }) });

    expect(response.status).toBe(200);
    expect(mocks.restaurantUpdateMany).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticatePlatformAdmin: vi.fn(),
  hashPassword: vi.fn(),
  validatePassword: vi.fn(),
  ensureUniqueSlug: vi.fn(),
  generateSlug: vi.fn(),
  accountFindUnique: vi.fn(),
  restaurantFindFirst: vi.fn(),
  transaction: vi.fn(),
  txAccountCreate: vi.fn(),
  txRestaurantCreate: vi.fn(),
  txConfigCreate: vi.fn(),
  txAdminCreate: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authenticatePlatformAdmin: mocks.authenticatePlatformAdmin,
  hashPassword: mocks.hashPassword,
}));

vi.mock('@/lib/password-policy', () => ({
  validatePassword: mocks.validatePassword,
}));

vi.mock('@/lib/tenant', () => ({
  generateSlug: mocks.generateSlug,
  ensureUniqueSlug: mocks.ensureUniqueSlug,
}));

vi.mock('@/lib/audit', () => ({
  logAudit: mocks.logAudit,
}));

vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  bigIntToNumber: (value: unknown) => value,
  db: {
    account: { findUnique: mocks.accountFindUnique },
    restaurant: { findFirst: mocks.restaurantFindFirst },
    $transaction: mocks.transaction,
  },
}));

import { POST } from '@/app/api/platform/restaurants/main/route';

const platformAdmin = { id: 'platform-1', role: 'super_admin' };
const runtimePassword = ['Valid', 'Pass', '9!'].join('');

function request(body: Record<string, unknown>) {
  return new Request('https://example.test/api/platform/restaurants/main', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      restaurantName: 'Le Baobab',
      adminName: 'Admin Baobab',
      adminEmail: 'admin@example.test',
      adminPassword: runtimePassword,
      ...body,
    }),
  });
}

describe('platform principal restaurant commercial plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatePlatformAdmin.mockResolvedValue(platformAdmin);
    mocks.validatePassword.mockReturnValue({ valid: true, errors: [] });
    mocks.hashPassword.mockResolvedValue('hashed-value');
    mocks.generateSlug.mockReturnValue('le-baobab');
    mocks.ensureUniqueSlug.mockResolvedValue('le-baobab');
    mocks.logAudit.mockResolvedValue(undefined);
    mocks.restaurantFindFirst.mockResolvedValue(null);

    mocks.txAccountCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'account-new',
      plan: data.plan,
      maxSecondaryRestaurants: data.maxSecondaryRestaurants,
    }));
    mocks.txRestaurantCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'restaurant-new',
      ...data,
    }));
    mocks.txConfigCreate.mockResolvedValue({ restaurantId: 'restaurant-new' });
    mocks.txAdminCreate.mockResolvedValue({
      id: 'admin-new',
      email: 'admin@example.test',
      name: 'Admin Baobab',
    });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      account: { create: mocks.txAccountCreate },
      restaurant: { create: mocks.txRestaurantCreate },
      restaurantConfig: { create: mocks.txConfigCreate },
      admin: { create: mocks.txAdminCreate },
    }));
  });

  it('creates a new Starter account with catalog quotas inside the restaurant transaction', async () => {
    const response = await POST(request({ plan: 'starter' }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.txAccountCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        plan: 'starter',
        maxRestaurants: 2,
        maxSecondaryRestaurants: 1,
        maxAdmins: 5,
        maxUsers: 15,
      }),
      select: {
        id: true,
        plan: true,
        maxSecondaryRestaurants: true,
      },
    });
    expect(mocks.txRestaurantCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'account-new',
        plan: 'starter',
        type: 'principal',
      }),
    });
    expect(body).toMatchObject({ accountId: 'account-new', effectivePlan: 'starter' });
  });

  it('rejects a conflicting restaurant plan when an existing Account is authoritative', async () => {
    mocks.accountFindUnique.mockResolvedValue({
      id: 'account-existing',
      plan: 'pro',
      maxSecondaryRestaurants: 4,
    });

    const response = await POST(request({ accountId: 'account-existing', plan: 'starter' }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      code: 'ACCOUNT_PLAN_AUTHORITATIVE',
      accountId: 'account-existing',
      effectivePlan: 'pro',
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('inherits the existing Account plan when the client omits a restaurant plan', async () => {
    mocks.accountFindUnique.mockResolvedValue({
      id: 'account-existing',
      plan: 'pro',
      maxSecondaryRestaurants: 4,
    });

    const response = await POST(request({ accountId: 'account-existing' }));

    expect(response.status).toBe(201);
    expect(mocks.txAccountCreate).not.toHaveBeenCalled();
    expect(mocks.txRestaurantCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'account-existing',
        plan: 'pro',
      }),
    });
    expect(mocks.txAdminCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'account-existing',
        restaurantCreationLimit: 4,
      }),
    });
  });
});

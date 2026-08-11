import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateAdmin: vi.fn(),
  restaurantConfigFindUnique: vi.fn(),
  restaurantFindUnique: vi.fn(),
  transaction: vi.fn(),
  txRestaurantUpdate: vi.fn(),
  txConfigUpsert: vi.fn(),
  getRestaurantConfig: vi.fn(),
  invalidateConfigCache: vi.fn(),
  invalidateTenantCache: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authenticateAdmin: mocks.authenticateAdmin,
  authenticatePlatformAdmin: vi.fn(),
  hasRole: (role: string, allowed: readonly string[]) => allowed.includes(role),
}));

vi.mock('@/lib/constants', () => ({
  getRestaurantConfig: mocks.getRestaurantConfig,
  invalidateConfigCache: mocks.invalidateConfigCache,
}));

vi.mock('@/lib/tenant', () => ({
  getRestaurantId: vi.fn(),
  resolveTenant: vi.fn(),
  invalidateTenantCache: mocks.invalidateTenantCache,
}));

vi.mock('@/lib/audit', () => ({
  logAudit: mocks.logAudit,
}));

vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  db: {
    restaurantConfig: { findUnique: mocks.restaurantConfigFindUnique },
    restaurant: { findUnique: mocks.restaurantFindUnique, findMany: vi.fn() },
    $transaction: mocks.transaction,
  },
}));

import { PATCH } from '@/app/api/restaurant/route';

const manager = {
  id: 'admin-1',
  role: 'manager',
  restaurantId: 'restaurant-1',
  restaurantSlug: 'tenant-a',
};

function request(body: unknown) {
  return new Request('https://example.test/api/restaurant', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('restaurant settings security contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateAdmin.mockResolvedValue(manager);
    mocks.restaurantConfigFindUnique.mockResolvedValue({ customDomain: '' });
    mocks.restaurantFindUnique.mockResolvedValue({ slug: 'tenant-a' });
    mocks.getRestaurantConfig.mockResolvedValue({ slug: 'tenant-a', name: 'Tenant A' });
    mocks.logAudit.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      restaurant: { update: mocks.txRestaurantUpdate },
      restaurantConfig: { upsert: mocks.txConfigUpsert },
    }));
    mocks.txRestaurantUpdate.mockResolvedValue({ id: 'restaurant-1' });
    mocks.txConfigUpsert.mockResolvedValue({ restaurantId: 'restaurant-1' });
  });

  it('blocks cashier/staff/kitchen roles before parsing or writing settings', async () => {
    mocks.authenticateAdmin.mockResolvedValue({ ...manager, role: 'cashier' });

    const response = await PATCH(request({ restaurant: { name: 'Nouveau nom' } }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('RESTAURANT_SETTINGS_ROLE_FORBIDDEN');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects server-authoritative or unknown fields instead of silently ignoring them', async () => {
    const response = await PATCH(request({
      restaurant: { name: 'Nouveau nom', plan: 'enterprise', status: 'active' },
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('RESTAURANT_SETTINGS_VALIDATION_ERROR');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('writes only inside the authenticated restaurant and in one transaction', async () => {
    const response = await PATCH(request({
      restaurant: {
        name: 'Nouveau nom',
        deliveryFee: 5000,
        deliveryZones: ['Kaloum', 'Dixinn'],
        currency: 'GNF',
      },
      config: {
        features: { delivery: true, drivers: false },
        primaryColor: '#ea580c',
      },
    }));

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.txRestaurantUpdate).toHaveBeenCalledWith({
      where: { id: 'restaurant-1' },
      data: expect.objectContaining({
        name: 'Nouveau nom',
        deliveryZones: 'Kaloum:Dixinn',
        currency: 'GNF',
      }),
    });
    expect(mocks.txConfigUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { restaurantId: 'restaurant-1' },
      update: expect.objectContaining({
        features: '{"delivery":true,"drivers":false}',
        primaryColor: '#ea580c',
      }),
      create: expect.objectContaining({ restaurantId: 'restaurant-1' }),
    }));
    expect(mocks.invalidateConfigCache).toHaveBeenCalledOnce();
    expect(mocks.invalidateTenantCache).toHaveBeenCalledOnce();
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'admin-1',
      restaurantId: 'restaurant-1',
      entityId: 'restaurant-1',
      action: 'restaurant_settings_update',
    }));
  });

  it('refuses provisioning a new custom domain through the generic settings route', async () => {
    mocks.restaurantConfigFindUnique.mockResolvedValue({ customDomain: '' });

    const response = await PATCH(request({ config: { customDomain: 'menu.example.test' } }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('CUSTOM_DOMAIN_NOT_PROVISIONED');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('does not break old clients that echo the already stored customDomain', async () => {
    mocks.restaurantConfigFindUnique.mockResolvedValue({ customDomain: 'legacy.example.test' });

    const response = await PATCH(request({
      config: { customDomain: 'legacy.example.test', metaTitle: 'Tenant A' },
    }));

    expect(response.status).toBe(200);
    expect(mocks.txConfigUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { metaTitle: 'Tenant A' },
    }));
  });

  it('allows explicitly clearing a legacy customDomain', async () => {
    mocks.restaurantConfigFindUnique.mockResolvedValue({ customDomain: 'legacy.example.test' });

    const response = await PATCH(request({ config: { customDomain: '' } }));

    expect(response.status).toBe(200);
    expect(mocks.txConfigUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { customDomain: '' },
    }));
  });
});

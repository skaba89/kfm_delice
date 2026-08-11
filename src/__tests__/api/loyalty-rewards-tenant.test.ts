import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateCustomer: vi.fn(),
  resolveTenantFromRequest: vi.fn(),
  rewardFindMany: vi.fn(),
  transaction: vi.fn(),
  txRewardFindFirst: vi.fn(),
  txCustomerUpdateMany: vi.fn(),
  txCustomerFindFirst: vi.fn(),
  txHistoryCreate: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authenticateCustomer: mocks.authenticateCustomer,
}));

vi.mock('@/lib/tenant', () => ({
  resolveTenantFromRequest: mocks.resolveTenantFromRequest,
}));

vi.mock('@/lib/db', () => ({
  bigIntToNumber: (value: unknown) => value,
  db: {
    loyaltyReward: { findMany: mocks.rewardFindMany },
    $transaction: mocks.transaction,
  },
}));

import { GET, POST } from '@/app/api/loyalty/rewards/route';

const customer = {
  id: 'customer-1',
  email: 'client@test.local',
  name: 'Client',
  restaurantId: 'restaurant-1',
  restaurantSlug: 'tenant-a',
};

function tx() {
  return {
    loyaltyReward: { findFirst: mocks.txRewardFindFirst },
    customer: {
      updateMany: mocks.txCustomerUpdateMany,
      findFirst: mocks.txCustomerFindFirst,
    },
    loyaltyPointsHistory: { create: mocks.txHistoryCreate },
  };
}

describe('loyalty rewards tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateCustomer.mockResolvedValue(customer);
    mocks.resolveTenantFromRequest.mockResolvedValue({
      restaurantId: 'restaurant-1',
      slug: 'tenant-a',
      status: 'active',
      plan: 'starter',
      name: 'Tenant A',
      currency: 'GNF',
      locale: 'fr',
    });
    mocks.rewardFindMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (callback: (value: ReturnType<typeof tx>) => unknown) => callback(tx()));
  });

  it('ignores a client-supplied restaurantId and reads rewards from the resolved tenant', async () => {
    const response = await GET(new Request(
      'https://example.test/api/loyalty/rewards?restaurantId=restaurant-other',
      { headers: { 'x-restaurant-slug': 'tenant-a' } }
    ));

    expect(response.status).toBe(200);
    expect(mocks.rewardFindMany).toHaveBeenCalledWith({
      where: { active: true, restaurantId: 'restaurant-1' },
      orderBy: { pointsCost: 'asc' },
    });
  });

  it('does not expose rewards when the tenant cannot be resolved', async () => {
    mocks.resolveTenantFromRequest.mockResolvedValue(null);
    const response = await GET(new Request('https://example.test/api/loyalty/rewards'));

    expect(response.status).toBe(404);
    expect(mocks.rewardFindMany).not.toHaveBeenCalled();
  });

  it('queries a redemption reward inside the authenticated customer tenant', async () => {
    mocks.txRewardFindFirst.mockResolvedValue(null);

    const response = await POST(new Request('https://example.test/api/loyalty/rewards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
      body: JSON.stringify({ rewardId: 'reward-other-tenant' }),
    }));

    expect(response.status).toBe(404);
    expect(mocks.txRewardFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'reward-other-tenant',
        restaurantId: 'restaurant-1',
        active: true,
      },
    });
    expect(mocks.txCustomerUpdateMany).not.toHaveBeenCalled();
  });

  it('uses an atomic points guard so concurrent redemption cannot overspend', async () => {
    mocks.txRewardFindFirst.mockResolvedValue({
      id: 'reward-1',
      name: 'Dessert offert',
      category: 'free_item',
      value: 1,
      pointsCost: 100,
      restaurantId: 'restaurant-1',
      active: true,
    });
    mocks.txCustomerUpdateMany.mockResolvedValue({ count: 0 });
    mocks.txCustomerFindFirst.mockResolvedValue({ loyaltyPoints: 80 });

    const response = await POST(new Request('https://example.test/api/loyalty/rewards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
      body: JSON.stringify({ rewardId: 'reward-1' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: 'Points insuffisants',
      currentPoints: 80,
      requiredPoints: 100,
    });
    expect(mocks.txCustomerUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'customer-1',
        restaurantId: 'restaurant-1',
        status: 'active',
        loyaltyPoints: { gte: 100 },
      },
      data: { loyaltyPoints: { decrement: 100 } },
    });
    expect(mocks.txHistoryCreate).not.toHaveBeenCalled();
  });

  it('records history only after a successful atomic debit', async () => {
    const reward = {
      id: 'reward-1',
      name: 'Dessert offert',
      category: 'free_item',
      value: 1,
      pointsCost: 100,
      restaurantId: 'restaurant-1',
      active: true,
    };
    mocks.txRewardFindFirst.mockResolvedValue(reward);
    mocks.txCustomerUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txHistoryCreate.mockResolvedValue({ id: 'history-1', points: -100 });
    mocks.txCustomerFindFirst.mockResolvedValue({ loyaltyPoints: 50 });

    const response = await POST(new Request('https://example.test/api/loyalty/rewards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
      body: JSON.stringify({ rewardId: 'reward-1' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.remainingPoints).toBe(50);
    expect(mocks.txHistoryCreate).toHaveBeenCalledOnce();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

// This suite is intentionally replayed on the current main so loyalty tenant
// isolation is validated together with the commercial monthly-order quota.
const mocks = vi.hoisted(() => ({
  authenticateAdmin: vi.fn(),
  getRestaurantId: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authenticateAdmin: mocks.authenticateAdmin,
  hasRole: () => true,
  PERMISSION_GROUPS: { LOYALTY_MANAGE: ['admin', 'manager'] },
}));

vi.mock('@/lib/tenant', () => ({
  getRestaurantId: mocks.getRestaurantId,
}));

vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  bigIntToNumber: (value: unknown) => value,
  db: {
    loyaltyTier: {
      findMany: mocks.findMany,
      upsert: mocks.upsert,
    },
  },
}));

import { GET } from '@/app/api/loyalty/tiers/route';

describe('public loyalty tiers GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateAdmin.mockResolvedValue(null);
    mocks.getRestaurantId.mockResolvedValue('restaurant-1');
    mocks.findMany.mockResolvedValue([]);
  });

  it('returns default tiers in memory without writing to the database', async () => {
    const response = await GET(new Request('https://example.test/api/loyalty/tiers', {
      headers: { 'x-restaurant-slug': 'tenant-a' },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(4);
    expect(body.data[0]).toMatchObject({ id: 'default:bronze', name: 'bronze', active: true });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { restaurantId: 'restaurant-1' },
      orderBy: { minSpent: 'asc' },
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('returns 404 instead of exposing global tiers when no tenant is resolved', async () => {
    mocks.getRestaurantId.mockResolvedValue(null);
    const response = await GET(new Request('https://example.test/api/loyalty/tiers'));

    expect(response.status).toBe(404);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

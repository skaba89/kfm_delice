import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateAdmin: vi.fn(),
  commercialFeatureGate: vi.fn(),
  driverFindMany: vi.fn(),
  driverCount: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authenticateAdmin: mocks.authenticateAdmin,
  hasRole: (role: string, allowed: readonly string[]) => allowed.includes(role),
}));

vi.mock('@/lib/commercial-feature-gate', () => ({
  commercialFeatureGate: mocks.commercialFeatureGate,
}));

vi.mock('@/lib/db', () => ({
  dbReady: Promise.resolve(),
  bigIntToNumber: (value: unknown) => value,
  db: {
    driver: {
      findMany: mocks.driverFindMany,
      count: mocks.driverCount,
    },
  },
}));

import { GET } from '@/app/api/drivers/route';

describe('driver API error sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateAdmin.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      restaurantId: 'restaurant-1',
    });
    mocks.commercialFeatureGate.mockResolvedValue(null);
  });

  it('never returns internal database exception details to the client', async () => {
    mocks.driverFindMany.mockRejectedValue(new Error('internal database connection detail'));
    mocks.driverCount.mockResolvedValue(0);

    const response = await GET(new Request('https://example.test/api/drivers?page=1&limit=20'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Erreur serveur' });
    expect(body).not.toHaveProperty('details');
    expect(JSON.stringify(body)).not.toContain('internal database connection detail');
  });
});

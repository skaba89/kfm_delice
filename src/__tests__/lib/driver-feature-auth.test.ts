import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateDriver: vi.fn(),
  getRestaurantFeatureEntitlement: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authenticateDriver: mocks.authenticateDriver,
}));

vi.mock('@/lib/commercial-entitlements', () => ({
  getRestaurantFeatureEntitlement: mocks.getRestaurantFeatureEntitlement,
}));

import { authenticateEntitledDriver } from '@/lib/driver-feature-auth';

const driver = {
  id: 'driver-1',
  email: 'driver@example.test',
  name: 'Driver One',
  phone: '+224600000000',
  vehicle: 'moto',
  status: 'available',
  zone: 'Conakry',
  restaurantId: 'restaurant-1',
  restaurantSlug: 'tenant-a',
};

describe('authenticateEntitledDriver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the underlying driver session is invalid', async () => {
    mocks.authenticateDriver.mockResolvedValue(null);

    const result = await authenticateEntitledDriver(new Request('https://example.test/api/driver-me'));

    expect(result).toBeNull();
    expect(mocks.getRestaurantFeatureEntitlement).not.toHaveBeenCalled();
  });

  it('invalidates an already-authenticated business session after a downgrade', async () => {
    mocks.authenticateDriver.mockResolvedValue(driver);
    mocks.getRestaurantFeatureEntitlement.mockResolvedValue({
      allowed: false,
      plan: 'starter',
      feature: 'drivers',
      code: 'FEATURE_NOT_INCLUDED',
    });

    const result = await authenticateEntitledDriver(new Request('https://example.test/api/driver-orders'));

    expect(result).toBeNull();
    expect(mocks.getRestaurantFeatureEntitlement).toHaveBeenCalledWith('restaurant-1', 'drivers');
  });

  it('keeps the session usable while the drivers feature remains included', async () => {
    mocks.authenticateDriver.mockResolvedValue(driver);
    mocks.getRestaurantFeatureEntitlement.mockResolvedValue({
      allowed: true,
      plan: 'pro',
      feature: 'drivers',
    });

    const result = await authenticateEntitledDriver(new Request('https://example.test/api/driver-orders'));

    expect(result).toEqual(driver);
  });
});

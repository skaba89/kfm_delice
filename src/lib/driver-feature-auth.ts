import { authenticateDriver } from './auth';
import { getRestaurantFeatureEntitlement } from './commercial-entitlements';

/**
 * Authenticate a driver and re-check the current commercial entitlement.
 *
 * Driver access tokens intentionally remain valid for security/account flows
 * (logout, password change), but every delivery business API must call this
 * helper so a plan downgrade takes effect on the next request even when an
 * access token was issued while the `drivers` feature was still enabled.
 */
export async function authenticateEntitledDriver(request: Request) {
  const driver = await authenticateDriver(request);
  if (!driver) return null;

  const entitlement = await getRestaurantFeatureEntitlement(
    driver.restaurantId,
    'drivers'
  );

  return entitlement.allowed ? driver : null;
}

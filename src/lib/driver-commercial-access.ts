import { NextResponse } from 'next/server';
import { db } from './db';
import { getRestaurantFeatureEntitlement } from './commercial-entitlements';

/**
 * Driver-specific paid-feature gate.
 *
 * A plan downgrade prevents new driver activity immediately, but an already
 * assigned driver may finish the current delivery. Suspended/cancelled SaaS
 * accounts remain blocked regardless of currentOrderId because subscription
 * access is a harder boundary than commercial feature availability.
 */
export async function driverCommercialGate(
  driverId: string,
  restaurantId: string
): Promise<NextResponse | null> {
  const entitlement = await getRestaurantFeatureEntitlement(restaurantId, 'drivers');
  if (entitlement.allowed) return null;

  if (entitlement.code === 'FEATURE_NOT_INCLUDED') {
    const driver = await db.driver.findFirst({
      where: { id: driverId, restaurantId },
      select: { currentOrderId: true },
    });
    if (driver?.currentOrderId) return null;
  }

  const status = entitlement.code === 'RESTAURANT_NOT_FOUND' ? 404 : 403;
  const error = entitlement.code === 'FEATURE_NOT_INCLUDED'
    ? `La fonctionnalité "drivers" n'est pas incluse dans le plan ${entitlement.plan}`
    : entitlement.code === 'ACCOUNT_UNAVAILABLE'
      ? 'Le compte SaaS est indisponible'
      : 'Restaurant introuvable';

  return NextResponse.json(
    {
      error,
      code: entitlement.code,
      feature: 'drivers',
      plan: entitlement.plan,
      upgradeRequired: entitlement.code === 'FEATURE_NOT_INCLUDED',
      activeDeliveryGrace: entitlement.code === 'FEATURE_NOT_INCLUDED',
    },
    { status }
  );
}

import { NextResponse } from 'next/server';
import {
  getRestaurantFeatureEntitlement,
  type CommercialFeature,
} from './commercial-entitlements';

/**
 * Returns null when the feature is included, otherwise a stable HTTP response
 * that UI clients can use to show an upgrade CTA instead of an auth error.
 */
export async function commercialFeatureGate(
  restaurantId: string,
  feature: CommercialFeature
): Promise<NextResponse | null> {
  const entitlement = await getRestaurantFeatureEntitlement(restaurantId, feature);
  if (entitlement.allowed) return null;

  const status = entitlement.code === 'RESTAURANT_NOT_FOUND' ? 404 : 403;
  const error = entitlement.code === 'FEATURE_NOT_INCLUDED'
    ? `La fonctionnalité "${feature}" n'est pas incluse dans le plan ${entitlement.plan}`
    : entitlement.code === 'ACCOUNT_UNAVAILABLE'
      ? 'Le compte SaaS est indisponible'
      : 'Restaurant introuvable';

  return NextResponse.json(
    {
      error,
      code: entitlement.code,
      feature,
      plan: entitlement.plan,
      upgradeRequired: entitlement.code === 'FEATURE_NOT_INCLUDED',
    },
    { status }
  );
}

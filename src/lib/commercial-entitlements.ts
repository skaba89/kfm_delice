import { db } from './db';
import {
  type CommercialFeature,
  type CommercialPlan,
  planIncludesFeature,
  resolveEffectiveCommercialPlan,
} from './commercial-plan-catalog';

export type {
  CommercialFeature,
  CommercialPlan,
  CommercialPlanQuotaDefaults,
} from './commercial-plan-catalog';
export {
  getPlanFeatures,
  getPlanQuotaDefaults,
  getPlanMonthlyPriceGnf,
  planIncludesFeature,
  resolveEffectiveCommercialPlan,
} from './commercial-plan-catalog';

export interface FeatureEntitlementResult {
  allowed: boolean;
  plan: CommercialPlan;
  feature: CommercialFeature;
  code?: 'FEATURE_NOT_INCLUDED' | 'RESTAURANT_NOT_FOUND' | 'ACCOUNT_UNAVAILABLE';
}

export function normalizeCommercialPlan(
  accountPlan: string | null | undefined,
  restaurantPlan: string | null | undefined
): CommercialPlan {
  return resolveEffectiveCommercialPlan(accountPlan, restaurantPlan);
}

export async function getRestaurantFeatureEntitlement(
  restaurantId: string,
  feature: CommercialFeature
): Promise<FeatureEntitlementResult> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      plan: true,
      account: {
        select: {
          plan: true,
          status: true,
        },
      },
    },
  });

  if (!restaurant) {
    return { allowed: false, plan: 'free', feature, code: 'RESTAURANT_NOT_FOUND' };
  }

  const plan = normalizeCommercialPlan(restaurant.account?.plan, restaurant.plan);
  if (restaurant.account && ['suspended', 'cancelled'].includes(restaurant.account.status)) {
    return { allowed: false, plan, feature, code: 'ACCOUNT_UNAVAILABLE' };
  }

  if (!planIncludesFeature(plan, feature)) {
    return { allowed: false, plan, feature, code: 'FEATURE_NOT_INCLUDED' };
  }

  return { allowed: true, plan, feature };
}

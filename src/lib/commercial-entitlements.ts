import { db } from './db';

export type CommercialPlan = 'free' | 'starter' | 'pro' | 'enterprise' | 'custom';
export type CommercialFeature =
  | 'delivery'
  | 'reservations'
  | 'reviews'
  | 'pos'
  | 'loyalty'
  | 'invoices'
  | 'quotes'
  | 'expenses'
  | 'staff'
  | 'drivers'
  | 'custom_domain'
  | 'api_access'
  | 'white_label';

const PLAN_FEATURES: Record<CommercialPlan, readonly CommercialFeature[]> = {
  free: ['delivery', 'reservations', 'reviews', 'pos'],
  starter: ['delivery', 'reservations', 'reviews', 'pos', 'loyalty', 'invoices'],
  pro: [
    'delivery', 'reservations', 'reviews', 'pos', 'loyalty', 'invoices',
    'quotes', 'expenses', 'staff', 'drivers',
  ],
  enterprise: [
    'delivery', 'reservations', 'reviews', 'pos', 'loyalty', 'invoices',
    'quotes', 'expenses', 'staff', 'drivers', 'custom_domain', 'api_access', 'white_label',
  ],
  // No per-feature custom-plan override table exists yet. A custom commercial
  // contract therefore inherits the Enterprise capability baseline instead of
  // accidentally falling back to Free.
  custom: [
    'delivery', 'reservations', 'reviews', 'pos', 'loyalty', 'invoices',
    'quotes', 'expenses', 'staff', 'drivers', 'custom_domain', 'api_access', 'white_label',
  ],
};

const VALID_PLANS = new Set<CommercialPlan>(['free', 'starter', 'pro', 'enterprise', 'custom']);

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
  if (accountPlan && VALID_PLANS.has(accountPlan as CommercialPlan)) return accountPlan as CommercialPlan;
  if (restaurantPlan && VALID_PLANS.has(restaurantPlan as CommercialPlan)) return restaurantPlan as CommercialPlan;
  return 'free';
}

export function planIncludesFeature(plan: CommercialPlan, feature: CommercialFeature): boolean {
  return PLAN_FEATURES[plan].includes(feature);
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

export function getPlanFeatures(plan: CommercialPlan): readonly CommercialFeature[] {
  return PLAN_FEATURES[plan];
}

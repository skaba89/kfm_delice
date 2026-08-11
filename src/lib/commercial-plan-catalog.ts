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
  | 'advanced_analytics'
  | 'exports'
  | 'custom_domain'
  | 'api_access'
  | 'white_label';

export interface CommercialPlanQuotaDefaults {
  maxRestaurants: number;
  maxSecondaryRestaurants: number;
  maxAdmins: number;
  maxUsers: number;
}

const PLAN_FEATURES: Record<CommercialPlan, readonly CommercialFeature[]> = {
  free: ['delivery', 'reservations', 'reviews', 'pos'],
  starter: ['delivery', 'reservations', 'reviews', 'pos', 'loyalty', 'invoices'],
  pro: [
    'delivery', 'reservations', 'reviews', 'pos', 'loyalty', 'invoices',
    'quotes', 'expenses', 'staff', 'drivers', 'advanced_analytics', 'exports',
  ],
  enterprise: [
    'delivery', 'reservations', 'reviews', 'pos', 'loyalty', 'invoices',
    'quotes', 'expenses', 'staff', 'drivers', 'advanced_analytics', 'exports',
    'custom_domain', 'api_access', 'white_label',
  ],
  // Custom contracts use the Enterprise capability baseline until per-feature
  // overrides are modelled explicitly. Quotas may still be overridden per account.
  custom: [
    'delivery', 'reservations', 'reviews', 'pos', 'loyalty', 'invoices',
    'quotes', 'expenses', 'staff', 'drivers', 'advanced_analytics', 'exports',
    'custom_domain', 'api_access', 'white_label',
  ],
};

const PLAN_QUOTA_DEFAULTS: Record<CommercialPlan, CommercialPlanQuotaDefaults> = {
  free: {
    maxRestaurants: 1,
    maxSecondaryRestaurants: 0,
    maxAdmins: 2,
    maxUsers: 5,
  },
  starter: {
    maxRestaurants: 2,
    maxSecondaryRestaurants: 1,
    maxAdmins: 5,
    maxUsers: 15,
  },
  pro: {
    maxRestaurants: 5,
    maxSecondaryRestaurants: 4,
    maxAdmins: 15,
    maxUsers: 50,
  },
  enterprise: {
    maxRestaurants: 20,
    maxSecondaryRestaurants: 19,
    maxAdmins: 50,
    maxUsers: 200,
  },
  custom: {
    maxRestaurants: 20,
    maxSecondaryRestaurants: 19,
    maxAdmins: 50,
    maxUsers: 200,
  },
};

/**
 * Public catalog monthly prices in GNF. Custom contracts intentionally have no
 * synthetic price: their negotiated amount is not modelled in the database yet.
 */
const PLAN_MONTHLY_PRICE_GNF: Record<CommercialPlan, number | null> = {
  free: 0,
  starter: 50_000,
  pro: 150_000,
  enterprise: 500_000,
  custom: null,
};

const VALID_PLANS = new Set<CommercialPlan>(['free', 'starter', 'pro', 'enterprise', 'custom']);

export function normalizeCommercialPlanValue(value: string | null | undefined): CommercialPlan | null {
  return value && VALID_PLANS.has(value as CommercialPlan) ? value as CommercialPlan : null;
}

export function resolveEffectiveCommercialPlan(
  accountPlan: string | null | undefined,
  restaurantPlan: string | null | undefined
): CommercialPlan {
  return normalizeCommercialPlanValue(accountPlan)
    ?? normalizeCommercialPlanValue(restaurantPlan)
    ?? 'free';
}

export function planIncludesFeature(plan: CommercialPlan, feature: CommercialFeature): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}

export function getPlanFeatures(plan: CommercialPlan): readonly CommercialFeature[] {
  return PLAN_FEATURES[plan];
}

export function getPlanQuotaDefaults(plan: CommercialPlan): CommercialPlanQuotaDefaults {
  return { ...PLAN_QUOTA_DEFAULTS[plan] };
}

export function getPlanMonthlyPriceGnf(plan: CommercialPlan): number | null {
  return PLAN_MONTHLY_PRICE_GNF[plan];
}

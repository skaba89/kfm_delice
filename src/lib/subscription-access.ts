import { db } from './db';

export interface SubscriptionAccessState {
  allowed: boolean;
  code?: 'RESTAURANT_UNAVAILABLE' | 'ACCOUNT_UNAVAILABLE';
}

const ACTIVE_RESTAURANT_STATUSES = new Set(['active', 'trial']);
// over_quota means growth is blocked, not that an existing restaurant should
// suddenly stop serving customers or lose access to its operational data.
const ACTIVE_ACCOUNT_STATUSES = new Set(['active', 'trial', 'over_quota']);

export function evaluateSubscriptionAccess(
  restaurantStatus: string | null | undefined,
  accountStatus: string | null | undefined
): SubscriptionAccessState {
  if (!restaurantStatus || !ACTIVE_RESTAURANT_STATUSES.has(restaurantStatus)) {
    return { allowed: false, code: 'RESTAURANT_UNAVAILABLE' };
  }

  // accountStatus=null is retained for legacy restaurants that predate the
  // Account hierarchy. New commercial accounts should always be linked.
  if (accountStatus && !ACTIVE_ACCOUNT_STATUSES.has(accountStatus)) {
    return { allowed: false, code: 'ACCOUNT_UNAVAILABLE' };
  }

  return { allowed: true };
}

/**
 * Authoritative access check for an authenticated restaurant-scoped session.
 * No cache is used deliberately: platform suspension/cancellation must take
 * effect on the next protected request, even if the JWT has not expired.
 */
export async function canAccessRestaurantSubscription(restaurantId: string): Promise<boolean> {
  try {
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        status: true,
        account: { select: { status: true } },
      },
    });

    if (!restaurant) return false;
    return evaluateSubscriptionAccess(
      restaurant.status,
      restaurant.account?.status ?? null
    ).allowed;
  } catch (error) {
    console.error('[subscription-access] Failed to verify subscription state:', error);
    return false;
  }
}

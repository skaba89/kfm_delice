import { db } from './db';

export type SubscriptionAccessCode =
  | 'RESTAURANT_UNAVAILABLE'
  | 'ACCOUNT_UNAVAILABLE'
  | 'ACCOUNT_TRIAL_EXPIRED'
  | 'ACCOUNT_CONTRACT_EXPIRED';

export interface SubscriptionAccessState {
  allowed: boolean;
  code?: SubscriptionAccessCode;
}

export interface SubscriptionAccessInput {
  restaurantStatus: string | null | undefined;
  accountStatus?: string | null;
  trialEndsAt?: string | null;
  contractEndDate?: string | null;
  now?: Date;
  contractGraceDays?: number;
}

const ACTIVE_RESTAURANT_STATUSES = new Set(['active', 'trial']);
const ACTIVE_ACCOUNT_STATUSES = new Set(['active', 'trial', 'over_quota']);
const MAX_CONTRACT_GRACE_DAYS = 90;

function parseDateOnlyEndOfDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function normalizeGraceDays(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(MAX_CONTRACT_GRACE_DAYS, Math.max(0, Math.trunc(numeric)));
}

/**
 * Supports both the historical `(restaurantStatus, accountStatus)` signature
 * and the richer commercial lifecycle object. Legacy malformed/empty date
 * strings are ignored deliberately so an old record cannot be auto-suspended
 * by a parsing change; all new writes are validated by the platform contract
 * endpoint.
 */
export function evaluateSubscriptionAccess(
  inputOrRestaurantStatus: SubscriptionAccessInput | string | null | undefined,
  legacyAccountStatus?: string | null
): SubscriptionAccessState {
  const input: SubscriptionAccessInput =
    typeof inputOrRestaurantStatus === 'object' && inputOrRestaurantStatus !== null
      ? inputOrRestaurantStatus
      : {
          restaurantStatus: inputOrRestaurantStatus,
          accountStatus: legacyAccountStatus ?? null,
        };

  if (!input.restaurantStatus || !ACTIVE_RESTAURANT_STATUSES.has(input.restaurantStatus)) {
    return { allowed: false, code: 'RESTAURANT_UNAVAILABLE' };
  }

  if (input.accountStatus && !ACTIVE_ACCOUNT_STATUSES.has(input.accountStatus)) {
    return { allowed: false, code: 'ACCOUNT_UNAVAILABLE' };
  }

  const now = input.now ?? new Date();

  if (input.accountStatus === 'trial') {
    const trialEnd = parseDateOnlyEndOfDay(input.trialEndsAt);
    if (trialEnd && now.getTime() > trialEnd.getTime()) {
      return { allowed: false, code: 'ACCOUNT_TRIAL_EXPIRED' };
    }
  }

  const contractEnd = parseDateOnlyEndOfDay(input.contractEndDate);
  if (contractEnd) {
    const graceDays = normalizeGraceDays(input.contractGraceDays);
    const effectiveEnd = new Date(contractEnd.getTime() + graceDays * 24 * 60 * 60 * 1000);
    if (now.getTime() > effectiveEnd.getTime()) {
      return { allowed: false, code: 'ACCOUNT_CONTRACT_EXPIRED' };
    }
  }

  return { allowed: true };
}

export async function canAccessRestaurantSubscription(restaurantId: string): Promise<boolean> {
  try {
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        status: true,
        account: {
          select: {
            status: true,
            trialEndsAt: true,
            contractEndDate: true,
          },
        },
      },
    });

    if (!restaurant) return false;
    return evaluateSubscriptionAccess({
      restaurantStatus: restaurant.status,
      accountStatus: restaurant.account?.status ?? null,
      trialEndsAt: restaurant.account?.trialEndsAt ?? null,
      contractEndDate: restaurant.account?.contractEndDate ?? null,
      contractGraceDays: normalizeGraceDays(process.env.COMMERCIAL_CONTRACT_GRACE_DAYS),
    }).allowed;
  } catch (error) {
    console.error('[subscription-access] Failed to verify subscription state:', error);
    return false;
  }
}

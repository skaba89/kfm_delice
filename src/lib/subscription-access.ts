import { db } from './db';

export type SubscriptionAccessCode =
  | 'RESTAURANT_UNAVAILABLE'
  | 'RESTAURANT_TRIAL_EXPIRED'
  | 'ACCOUNT_UNAVAILABLE'
  | 'ACCOUNT_TRIAL_EXPIRED'
  | 'ACCOUNT_CONTRACT_EXPIRED'
  | 'ACCOUNT_BILLING_PAST_DUE'
  | 'ACCOUNT_BILLING_UNAVAILABLE';

export interface SubscriptionAccessState {
  allowed: boolean;
  code?: SubscriptionAccessCode;
}

export interface SubscriptionAccessInput {
  restaurantStatus: string | null | undefined;
  accountStatus?: string | null;
  trialEndsAt?: string | null;
  contractEndDate?: string | null;
  billingStatus?: string | null;
  billingOverdueSince?: Date | string | null;
  billingGraceDays?: number;
  billingEnforcementEnabled?: boolean;
  now?: Date;
  contractGraceDays?: number;
}

export interface BillingAccessSnapshot {
  billingStatus: string | null;
  billingOverdueSince: Date | null;
}

const ACTIVE_RESTAURANT_STATUSES = new Set(['active', 'trial']);
const ACTIVE_ACCOUNT_STATUSES = new Set(['active', 'trial', 'over_quota']);
const MAX_CONTRACT_GRACE_DAYS = 90;
const DEFAULT_BILLING_GRACE_DAYS = 7;
const MAX_BILLING_GRACE_DAYS = 90;

/**
 * Lifecycle dates exist in two historical shapes:
 * - Account contract/trial dates are generally `YYYY-MM-DD` and remain valid
 *   through the named UTC day.
 * - Standalone restaurant registration stores a full ISO timestamp and should
 *   expire at that exact instant.
 * Invalid legacy strings remain non-blocking for backward compatibility.
 */
function parseLifecycleEnd(value: string | null | undefined): Date | null {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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

  // Require an explicit timezone on full timestamps so server-local timezone
  // cannot silently alter commercial expiry semantics.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeGraceDays(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(MAX_CONTRACT_GRACE_DAYS, Math.max(0, Math.trunc(numeric)));
}

export function getBillingAccessGraceDays(
  value: number | string | null | undefined = process.env.BILLING_ACCESS_GRACE_DAYS,
): number {
  const numeric = Number(value ?? DEFAULT_BILLING_GRACE_DAYS);
  if (!Number.isFinite(numeric)) return DEFAULT_BILLING_GRACE_DAYS;
  return Math.min(MAX_BILLING_GRACE_DAYS, Math.max(0, Math.trunc(numeric)));
}

export function isBillingAccessEnforcementEnabled(
  value: string | boolean | null | undefined = process.env.BILLING_ACCESS_ENFORCEMENT,
): boolean {
  if (typeof value === 'boolean') return value;
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function parseBillingInstant(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function loadBillingAccessSnapshot(accountId: string): Promise<BillingAccessSnapshot> {
  if (!isBillingAccessEnforcementEnabled()) {
    return { billingStatus: null, billingOverdueSince: null };
  }

  const [subscription, oldestOverdue] = await Promise.all([
    db.platformSubscription.findUnique({
      where: { accountId },
      select: { status: true },
    }),
    db.platformInvoice.findFirst({
      where: { accountId, status: 'overdue' },
      orderBy: { dueAt: 'asc' },
      select: { dueAt: true },
    }),
  ]);

  return {
    billingStatus: subscription?.status ?? null,
    billingOverdueSince: oldestOverdue?.dueAt ?? null,
  };
}

/**
 * Supports both the historical `(restaurantStatus, accountStatus)` signature
 * and the richer commercial lifecycle object. When an Account exists, its
 * trial/contract lifecycle is authoritative. Billing enforcement is deliberately
 * opt-in so rollout cannot unexpectedly cut existing tenants; when enabled,
 * past-due access remains available during a bounded grace window.
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
  const trialEnd = parseLifecycleEnd(input.trialEndsAt);

  if (input.accountStatus === 'trial') {
    if (trialEnd && now.getTime() > trialEnd.getTime()) {
      return { allowed: false, code: 'ACCOUNT_TRIAL_EXPIRED' };
    }
  } else if (!input.accountStatus && input.restaurantStatus === 'trial') {
    if (trialEnd && now.getTime() > trialEnd.getTime()) {
      return { allowed: false, code: 'RESTAURANT_TRIAL_EXPIRED' };
    }
  }

  // Contract dates belong to the SaaS Account lifecycle. Legacy standalone
  // restaurants pass no contractEndDate and are governed only by trial status.
  const contractEnd = parseLifecycleEnd(input.contractEndDate);
  if (contractEnd) {
    const graceDays = normalizeGraceDays(input.contractGraceDays);
    const effectiveEnd = new Date(contractEnd.getTime() + graceDays * 24 * 60 * 60 * 1000);
    if (now.getTime() > effectiveEnd.getTime()) {
      return { allowed: false, code: 'ACCOUNT_CONTRACT_EXPIRED' };
    }
  }

  if (input.billingEnforcementEnabled) {
    if (input.billingStatus === 'paused' || input.billingStatus === 'cancelled') {
      return { allowed: false, code: 'ACCOUNT_BILLING_UNAVAILABLE' };
    }

    if (input.billingStatus === 'past_due') {
      const overdueSince = parseBillingInstant(input.billingOverdueSince);
      // Never cut access from status alone: require a concrete overdue invoice
      // timestamp so stale/manual status values cannot create an outage.
      if (overdueSince) {
        const graceDays = getBillingAccessGraceDays(input.billingGraceDays);
        const graceEnd = overdueSince.getTime() + graceDays * 24 * 60 * 60 * 1000;
        if (now.getTime() > graceEnd) {
          return { allowed: false, code: 'ACCOUNT_BILLING_PAST_DUE' };
        }
      }
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
        trialEndsAt: true,
        account: {
          select: {
            id: true,
            status: true,
            trialEndsAt: true,
            contractEndDate: true,
          },
        },
      },
    });

    if (!restaurant) return false;
    const hasAccount = Boolean(restaurant.account);
    const billing = restaurant.account
      ? await loadBillingAccessSnapshot(restaurant.account.id)
      : { billingStatus: null, billingOverdueSince: null };

    return evaluateSubscriptionAccess({
      restaurantStatus: restaurant.status,
      accountStatus: restaurant.account?.status ?? null,
      trialEndsAt: hasAccount
        ? restaurant.account?.trialEndsAt ?? null
        : restaurant.trialEndsAt ?? null,
      contractEndDate: restaurant.account?.contractEndDate ?? null,
      contractGraceDays: normalizeGraceDays(process.env.COMMERCIAL_CONTRACT_GRACE_DAYS),
      billingStatus: billing.billingStatus,
      billingOverdueSince: billing.billingOverdueSince,
      billingGraceDays: getBillingAccessGraceDays(),
      billingEnforcementEnabled: isBillingAccessEnforcementEnabled(),
    }).allowed;
  } catch (error) {
    console.error('[subscription-access] Failed to verify subscription state:', error);
    return false;
  }
}

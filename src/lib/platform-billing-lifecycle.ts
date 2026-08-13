import { db } from '@/lib/db';
import { invalidateConfigCache } from '@/lib/constants';
import { invalidateTenantCache } from '@/lib/tenant';
import {
  BillingDomainError,
  deriveSubscriptionUnitAmount,
} from '@/lib/platform-billing';
import { runPlatformBillingCycle } from '@/lib/platform-billing-cycle';
import { normalizeCommercialPlanValue } from '@/lib/commercial-plan-catalog';

export interface TrialLifecycleSkip {
  subscriptionId: string;
  accountId: string;
  code: string;
  message: string;
}

export interface TrialLifecycleResult {
  due: number;
  subscriptionsActivated: number;
  accountsActivated: number;
  restaurantsActivated: number;
  skipped: TrialLifecycleSkip[];
}

function assertTrialCommercialAlignment(subscription: {
  plan: string;
  billingCycle: string;
  unitAmount: bigint;
}, accountPlan: string): void {
  const accountPlanNormalized = normalizeCommercialPlanValue(accountPlan);
  const subscriptionPlanNormalized = normalizeCommercialPlanValue(subscription.plan);
  if (!accountPlanNormalized || accountPlanNormalized !== subscriptionPlanNormalized) {
    throw new BillingDomainError(
      'BILLING_SUBSCRIPTION_PLAN_STALE',
      'L’abonnement d’essai doit être resynchronisé avec le plan du compte.',
      409,
    );
  }
  if (subscription.billingCycle !== 'monthly' && subscription.billingCycle !== 'annual') {
    throw new BillingDomainError('BILLING_INVALID_CYCLE', 'Cycle de facturation invalide.', 409);
  }

  if (accountPlanNormalized !== 'custom') {
    const expected = deriveSubscriptionUnitAmount({
      plan: accountPlanNormalized,
      billingCycle: subscription.billingCycle,
    }).unitAmount;
    if (subscription.unitAmount !== expected) {
      throw new BillingDomainError(
        'BILLING_SUBSCRIPTION_PRICE_STALE',
        'Le montant de l’abonnement d’essai ne correspond plus au catalogue courant.',
        409,
      );
    }
  }
  if (subscription.unitAmount <= BigInt(0)) {
    throw new BillingDomainError(
      'BILLING_ZERO_AMOUNT',
      'Un essai ne peut pas basculer en facturation avec un montant nul.',
      409,
    );
  }
}

export async function activateDueTrialSubscriptions(now = new Date()): Promise<TrialLifecycleResult> {
  const candidates = await db.platformSubscription.findMany({
    where: {
      status: 'trialing',
      nextBillingAt: { lte: now },
    },
    select: { id: true, accountId: true },
    orderBy: { nextBillingAt: 'asc' },
  });

  const result: TrialLifecycleResult = {
    due: candidates.length,
    subscriptionsActivated: 0,
    accountsActivated: 0,
    restaurantsActivated: 0,
    skipped: [],
  };

  for (const candidate of candidates) {
    try {
      const transition = await db.$transaction(async (tx) => {
        const subscription = await tx.platformSubscription.findUnique({
          where: { id: candidate.id },
          select: {
            id: true,
            accountId: true,
            plan: true,
            billingCycle: true,
            status: true,
            unitAmount: true,
            nextBillingAt: true,
          },
        });
        if (
          !subscription
          || subscription.status !== 'trialing'
          || !subscription.nextBillingAt
          || subscription.nextBillingAt.getTime() > now.getTime()
        ) {
          return null;
        }

        const account = await tx.account.findUnique({
          where: { id: subscription.accountId },
          select: { id: true, plan: true, status: true },
        });
        if (!account) {
          throw new BillingDomainError('BILLING_ACCOUNT_NOT_FOUND', 'Compte SaaS introuvable.', 404);
        }
        if (!['trial', 'active', 'over_quota'].includes(account.status)) {
          throw new BillingDomainError(
            'BILLING_ACCOUNT_NOT_BILLABLE',
            'Le compte SaaS ne peut pas quitter son essai dans son état actuel.',
            409,
          );
        }

        assertTrialCommercialAlignment(subscription, account.plan);

        const claimed = await tx.platformSubscription.updateMany({
          where: {
            id: subscription.id,
            status: 'trialing',
            nextBillingAt: { lte: now },
          },
          data: { status: 'active' },
        });
        if (claimed.count !== 1) return null;

        const accountUpdate = account.status === 'trial'
          ? await tx.account.updateMany({
              where: { id: account.id, status: 'trial' },
              data: { status: 'active' },
            })
          : { count: 0 };

        const restaurantUpdate = await tx.restaurant.updateMany({
          where: { accountId: account.id, status: 'trial' },
          data: { status: 'active' },
        });

        return {
          accountActivated: accountUpdate.count,
          restaurantsActivated: restaurantUpdate.count,
        };
      });

      if (!transition) continue;
      result.subscriptionsActivated += 1;
      result.accountsActivated += transition.accountActivated;
      result.restaurantsActivated += transition.restaurantsActivated;
    } catch (error) {
      if (error instanceof BillingDomainError) {
        result.skipped.push({
          subscriptionId: candidate.id,
          accountId: candidate.accountId,
          code: error.code,
          message: error.message,
        });
        continue;
      }
      throw error;
    }
  }

  if (result.subscriptionsActivated > 0 || result.accountsActivated > 0 || result.restaurantsActivated > 0) {
    invalidateTenantCache();
    invalidateConfigCache();
  }

  return result;
}

export async function runPlatformBillingLifecycle(options: {
  now?: Date;
  dueDays?: number;
  maxCatchUp?: number;
} = {}) {
  const now = options.now ?? new Date();
  const trialLifecycle = await activateDueTrialSubscriptions(now);
  const billingCycle = await runPlatformBillingCycle({ ...options, now });
  return {
    ...billingCycle,
    trialLifecycle,
  };
}

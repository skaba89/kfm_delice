import { Prisma } from '@prisma/client';
import { db, dbReady } from '@/lib/db';
import {
  assertAccountCanIssueInvoice,
  assertSubscriptionCanIssueInvoice,
  BillingDomainError,
  generatePlatformInvoiceNumber,
} from '@/lib/platform-billing';

const ZERO = BigInt(0);
const DEFAULT_DUE_DAYS = 7;
const DEFAULT_MAX_CATCH_UP = 12;
const MAX_DUE_DAYS = 60;
const MAX_CATCH_UP = 24;

export interface BillingCycleSkip {
  subscriptionId: string;
  accountId: string;
  code: string;
  message: string;
}

export interface BillingCycleResult {
  evaluatedAt: string;
  dueDays: number;
  maxCatchUp: number;
  dueSubscriptions: number;
  invoicesCreated: number;
  invoicesReplayed: number;
  subscriptionsAdvanced: number;
  subscriptionsCancelled: number;
  invoicesMarkedOverdue: number;
  subscriptionsMarkedPastDue: number;
  cappedSubscriptions: number;
  skipped: BillingCycleSkip[];
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function getBillingDueDays(value = process.env.BILLING_DUE_DAYS): number {
  return clampInteger(value, DEFAULT_DUE_DAYS, 0, MAX_DUE_DAYS);
}

export function getBillingMaxCatchUp(value = process.env.BILLING_MAX_CATCH_UP): number {
  return clampInteger(value, DEFAULT_MAX_CATCH_UP, 1, MAX_CATCH_UP);
}

function daysInUtcMonth(year: number, monthZeroBased: number): number {
  return new Date(Date.UTC(year, monthZeroBased + 1, 0)).getUTCDate();
}

export function addBillingCycle(date: Date, billingCycle: string): Date {
  if (billingCycle === 'annual') {
    const year = date.getUTCFullYear() + 1;
    const month = date.getUTCMonth();
    const day = Math.min(date.getUTCDate(), daysInUtcMonth(year, month));
    return new Date(Date.UTC(
      year,
      month,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ));
  }
  if (billingCycle !== 'monthly') {
    throw new BillingDomainError('BILLING_INVALID_CYCLE', 'Cycle de facturation invalide.', 409);
  }

  const currentMonth = date.getUTCMonth();
  const currentYear = date.getUTCFullYear();
  const targetMonthIndex = currentMonth + 1;
  const year = currentYear + Math.floor(targetMonthIndex / 12);
  const month = targetMonthIndex % 12;
  const day = Math.min(date.getUTCDate(), daysInUtcMonth(year, month));
  return new Date(Date.UTC(
    year,
    month,
    day,
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  ));
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function billingCycleInvoiceKey(subscriptionId: string, periodStart: Date): string {
  return `billing-cycle:${subscriptionId}:${periodStart.toISOString()}`;
}

function shouldCancelAtBoundary(subscription: {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}, nextBillingAt: Date): boolean {
  return Boolean(
    subscription.cancelAtPeriodEnd
    && subscription.currentPeriodEnd
    && nextBillingAt.getTime() >= subscription.currentPeriodEnd.getTime(),
  );
}

async function markOverdueAndPastDue(now: Date) {
  const overdue = await db.platformInvoice.updateMany({
    where: {
      status: 'open',
      dueAt: { lt: now },
    },
    data: { status: 'overdue' },
  });

  const overdueInvoices = await db.platformInvoice.findMany({
    where: { status: 'overdue' },
    select: { accountId: true },
  });
  const accountIds = [...new Set(overdueInvoices.map((invoice) => invoice.accountId))];
  if (accountIds.length === 0) {
    return { invoicesMarkedOverdue: overdue.count, subscriptionsMarkedPastDue: 0 };
  }

  const pastDue = await db.platformSubscription.updateMany({
    where: {
      accountId: { in: accountIds },
      status: 'active',
    },
    data: { status: 'past_due' },
  });
  return {
    invoicesMarkedOverdue: overdue.count,
    subscriptionsMarkedPastDue: pastDue.count,
  };
}

export async function runPlatformBillingCycle(options: {
  now?: Date;
  dueDays?: number;
  maxCatchUp?: number;
} = {}): Promise<BillingCycleResult> {
  await dbReady;
  const now = options.now ?? new Date();
  const dueDays = clampInteger(options.dueDays, getBillingDueDays(), 0, MAX_DUE_DAYS);
  const maxCatchUp = clampInteger(options.maxCatchUp, getBillingMaxCatchUp(), 1, MAX_CATCH_UP);

  const dueSubscriptions = await db.platformSubscription.findMany({
    where: {
      status: { in: ['active', 'past_due'] },
      nextBillingAt: { lte: now },
    },
    orderBy: { nextBillingAt: 'asc' },
  });

  const result: BillingCycleResult = {
    evaluatedAt: now.toISOString(),
    dueDays,
    maxCatchUp,
    dueSubscriptions: dueSubscriptions.length,
    invoicesCreated: 0,
    invoicesReplayed: 0,
    subscriptionsAdvanced: 0,
    subscriptionsCancelled: 0,
    invoicesMarkedOverdue: 0,
    subscriptionsMarkedPastDue: 0,
    cappedSubscriptions: 0,
    skipped: [],
  };

  for (const subscription of dueSubscriptions) {
    try {
      const account = await db.account.findUnique({
        where: { id: subscription.accountId },
        select: { id: true, plan: true, status: true },
      });
      if (!account) {
        result.skipped.push({
          subscriptionId: subscription.id,
          accountId: subscription.accountId,
          code: 'BILLING_ACCOUNT_NOT_FOUND',
          message: 'Compte SaaS introuvable.',
        });
        continue;
      }

      assertAccountCanIssueInvoice(account.status);
      assertSubscriptionCanIssueInvoice(subscription, account.plan);

      let cursor = subscription.nextBillingAt;
      if (!cursor) continue;
      let currentPeriodStart = subscription.currentPeriodStart;
      let currentPeriodEnd = subscription.currentPeriodEnd;
      let processed = 0;
      let cancelled = false;

      while (cursor.getTime() <= now.getTime() && processed < maxCatchUp) {
        if (shouldCancelAtBoundary({
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currentPeriodEnd,
        }, cursor)) {
          await db.platformSubscription.update({
            where: { id: subscription.id },
            data: {
              status: 'cancelled',
              nextBillingAt: null,
            },
          });
          result.subscriptionsCancelled += 1;
          cancelled = true;
          break;
        }

        const periodStart = cursor;
        const periodEnd = addBillingCycle(periodStart, subscription.billingCycle);
        const dueAt = addUtcDays(periodStart, dueDays);
        const status = dueAt.getTime() < now.getTime() ? 'overdue' : 'open';
        const idempotencyKey = billingCycleInvoiceKey(subscription.id, periodStart);
        const existing = await db.platformInvoice.findUnique({ where: { idempotencyKey } });

        if (existing) {
          result.invoicesReplayed += 1;
        } else {
          try {
            await db.platformInvoice.create({
              data: {
                accountId: subscription.accountId,
                subscriptionId: subscription.id,
                number: generatePlatformInvoiceNumber(subscription.accountId, now),
                idempotencyKey,
                periodStart,
                periodEnd,
                currency: subscription.currency,
                subtotal: subscription.unitAmount,
                tax: ZERO,
                total: subscription.unitAmount,
                amountPaid: ZERO,
                status,
                dueAt,
                notes: 'Facture générée automatiquement par le cycle SaaS.',
              },
            });
            result.invoicesCreated += 1;
          } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
              throw error;
            }
            const replay = await db.platformInvoice.findUnique({ where: { idempotencyKey } });
            if (!replay) throw error;
            result.invoicesReplayed += 1;
          }
        }

        currentPeriodStart = periodStart;
        currentPeriodEnd = periodEnd;
        cursor = periodEnd;
        processed += 1;

        await db.platformSubscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart,
            currentPeriodEnd,
            nextBillingAt: cursor,
          },
        });
        result.subscriptionsAdvanced += 1;
      }

      if (!cancelled && cursor.getTime() <= now.getTime()) {
        result.cappedSubscriptions += 1;
        result.skipped.push({
          subscriptionId: subscription.id,
          accountId: subscription.accountId,
          code: 'BILLING_CATCH_UP_CAPPED',
          message: `Rattrapage limité à ${maxCatchUp} périodes sur cette exécution.`,
        });
      }
    } catch (error) {
      if (error instanceof BillingDomainError) {
        result.skipped.push({
          subscriptionId: subscription.id,
          accountId: subscription.accountId,
          code: error.code,
          message: error.message,
        });
        continue;
      }
      throw error;
    }
  }

  const overdue = await markOverdueAndPastDue(now);
  result.invoicesMarkedOverdue = overdue.invoicesMarkedOverdue;
  result.subscriptionsMarkedPastDue = overdue.subscriptionsMarkedPastDue;
  return result;
}

import { NextResponse } from 'next/server';
import { authenticatePlatformAdmin } from '@/lib/auth';
import { bigIntToNumber, db, dbReady } from '@/lib/db';
import { isBillingDunningEnabled } from '@/lib/platform-billing-dunning';
import { getPlatformEmailProvider, isPlatformEmailDeliveryConfigured } from '@/lib/platform-email';
import { isBillingAccessEnforcementEnabled } from '@/lib/subscription-access';

const ZERO = BigInt(0);
const DAY_MS = 24 * 60 * 60 * 1000;
const BILLABLE_SUBSCRIPTION_STATUSES = new Set(['active', 'past_due']);
const DUNNING_ISSUE_STATUSES = ['failed', 'skipped_unconfigured', 'skipped_invalid_recipient'];

function outstanding(total: bigint | null | undefined, paid: bigint | null | undefined): bigint {
  const value = (total ?? ZERO) - (paid ?? ZERO);
  return value > ZERO ? value : ZERO;
}

function collectionRatePct(total: bigint, paid: bigint): number | null {
  if (total <= ZERO) return null;
  const boundedPaid = paid > total ? total : paid < ZERO ? ZERO : paid;
  const basisPoints = Number((boundedPaid * BigInt(10_000)) / total);
  return basisPoints / 100;
}

export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY_MS);

    const [
      subscriptions,
      receivables,
      overdueGroups,
      recentInvoiceAgg,
      collected30dAgg,
      dunningIssuesCount,
      dunningSent30d,
      recentDunningIssues,
    ] = await Promise.all([
      db.platformSubscription.findMany({
        select: {
          id: true,
          accountId: true,
          status: true,
          billingCycle: true,
          currency: true,
          unitAmount: true,
          nextBillingAt: true,
          provider: true,
        },
      }),
      db.platformInvoice.aggregate({
        where: { status: { in: ['open', 'overdue'] } },
        _sum: { total: true, amountPaid: true },
        _count: { id: true },
      }),
      // One row per overdue Account gives an exact global account count while
      // still transferring far less data than all overdue invoices. Ranking is
      // performed after outstanding is derived (total - amountPaid), not by
      // gross invoice total which could mis-rank partially paid accounts.
      db.platformInvoice.groupBy({
        by: ['accountId'],
        where: { status: 'overdue' },
        _sum: { total: true, amountPaid: true },
        _count: { _all: true },
        _min: { dueAt: true },
      }),
      db.platformInvoice.aggregate({
        where: {
          createdAt: { gte: ninetyDaysAgo },
          status: { not: 'void' },
        },
        _sum: { total: true, amountPaid: true },
        _count: { id: true },
      }),
      db.platformPayment.aggregate({
        where: {
          status: 'paid',
          paidAt: { gte: thirtyDaysAgo },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      db.platformBillingNotice.count({
        where: { status: { in: DUNNING_ISSUE_STATUSES } },
      }),
      db.platformBillingNotice.count({
        where: {
          status: 'sent',
          sentAt: { gte: thirtyDaysAgo },
        },
      }),
      db.platformBillingNotice.findMany({
        where: { status: { in: DUNNING_ISSUE_STATUSES } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          accountId: true,
          invoiceId: true,
          stage: true,
          recipient: true,
          status: true,
          provider: true,
          errorMessage: true,
          attemptedAt: true,
          updatedAt: true,
          invoice: { select: { number: true } },
        },
      }),
    ]);

    let mrr = ZERO;
    let arr = ZERO;
    let activeSubscriptions = 0;
    let pastDueSubscriptions = 0;
    let trialingSubscriptions = 0;
    let pausedSubscriptions = 0;

    for (const subscription of subscriptions) {
      if (subscription.status === 'active') activeSubscriptions += 1;
      if (subscription.status === 'past_due') pastDueSubscriptions += 1;
      if (subscription.status === 'trialing') trialingSubscriptions += 1;
      if (subscription.status === 'paused') pausedSubscriptions += 1;

      if (!BILLABLE_SUBSCRIPTION_STATUSES.has(subscription.status) || subscription.unitAmount <= ZERO) continue;
      if (subscription.billingCycle === 'annual') {
        mrr += subscription.unitAmount / BigInt(12);
        arr += subscription.unitAmount;
      } else if (subscription.billingCycle === 'monthly') {
        mrr += subscription.unitAmount;
        arr += subscription.unitAmount * BigInt(12);
      }
    }

    const openOutstanding = outstanding(receivables._sum.total, receivables._sum.amountPaid);
    const invoice90dTotal = recentInvoiceAgg._sum.total ?? ZERO;
    const invoice90dPaid = recentInvoiceAgg._sum.amountPaid ?? ZERO;

    const accountIds = new Set<string>();
    for (const group of overdueGroups) accountIds.add(group.accountId);
    for (const issue of recentDunningIssues) accountIds.add(issue.accountId);
    const accounts = accountIds.size > 0
      ? await db.account.findMany({
          where: { id: { in: [...accountIds] } },
          select: { id: true, name: true, ownerEmail: true, plan: true, status: true },
        })
      : [];
    const accountById = new Map(accounts.map((account) => [account.id, account]));

    const overdueAccounts = overdueGroups
      .map((group) => ({
        accountId: group.accountId,
        accountName: accountById.get(group.accountId)?.name ?? 'Compte inconnu',
        plan: accountById.get(group.accountId)?.plan ?? null,
        accountStatus: accountById.get(group.accountId)?.status ?? null,
        invoiceCount: group._count._all,
        outstanding: outstanding(group._sum.total, group._sum.amountPaid),
        oldestDueAt: group._min.dueAt,
      }))
      .sort((left, right) => (left.outstanding === right.outstanding ? 0 : left.outstanding > right.outstanding ? -1 : 1))
      .slice(0, 10);

    const recentDunningIssueViews = recentDunningIssues.map((notice) => ({
      id: notice.id,
      accountId: notice.accountId,
      accountName: accountById.get(notice.accountId)?.name ?? 'Compte inconnu',
      ownerEmail: accountById.get(notice.accountId)?.ownerEmail ?? '',
      invoiceId: notice.invoiceId,
      invoiceNumber: notice.invoice.number,
      stage: notice.stage,
      recipient: notice.recipient,
      status: notice.status,
      provider: notice.provider,
      errorMessage: notice.errorMessage,
      attemptedAt: notice.attemptedAt,
      updatedAt: notice.updatedAt,
    }));

    return NextResponse.json(bigIntToNumber({
      generatedAt: now,
      runRate: {
        mrr,
        arr,
        activeSubscriptions,
        pastDueSubscriptions,
        trialingSubscriptions,
        pausedSubscriptions,
        totalSubscriptions: subscriptions.length,
      },
      receivables: {
        outstanding: openOutstanding,
        openInvoiceCount: receivables._count.id,
        overdueAccountCount: overdueGroups.length,
        topOverdueAccounts: overdueAccounts,
      },
      collection: {
        collected30d: collected30dAgg._sum.amount ?? ZERO,
        paymentCount30d: collected30dAgg._count.id,
        invoiced90d: invoice90dTotal,
        collectedAgainstInvoices90d: invoice90dPaid,
        invoiceCount90d: recentInvoiceAgg._count.id,
        collectionRate90dPct: collectionRatePct(invoice90dTotal, invoice90dPaid),
      },
      operations: {
        accessEnforcementEnabled: isBillingAccessEnforcementEnabled(),
        dunningEnabled: isBillingDunningEnabled(),
        emailProvider: getPlatformEmailProvider(),
        emailDeliveryConfigured: isPlatformEmailDeliveryConfigured(),
        dunningIssuesCount,
        dunningSent30d,
        recentDunningIssues: recentDunningIssueViews,
      },
    }));
  } catch (error) {
    console.error('[platform/billing/overview GET]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

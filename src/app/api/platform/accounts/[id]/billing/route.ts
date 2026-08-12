import { NextResponse } from 'next/server';
import { authenticatePlatformAdmin } from '@/lib/auth';
import { bigIntToNumber, db, dbReady } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const { id } = await params;
    const account = await db.account.findUnique({
      where: { id },
      select: { id: true, name: true, plan: true, status: true },
    });
    if (!account) return NextResponse.json({ error: 'Compte non trouvé' }, { status: 404 });

    const now = new Date();
    const [subscription, invoices, outstandingAgg, overdueCount, paidAgg] = await Promise.all([
      db.platformSubscription.findUnique({
        where: { accountId: id },
        select: {
          id: true,
          accountId: true,
          plan: true,
          billingCycle: true,
          status: true,
          currency: true,
          unitAmount: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          nextBillingAt: true,
          cancelAtPeriodEnd: true,
          provider: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.platformInvoice.findMany({
        where: { accountId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          accountId: true,
          subscriptionId: true,
          number: true,
          periodStart: true,
          periodEnd: true,
          currency: true,
          subtotal: true,
          tax: true,
          total: true,
          amountPaid: true,
          status: true,
          dueAt: true,
          paidAt: true,
          voidedAt: true,
          createdAt: true,
          updatedAt: true,
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
              id: true,
              invoiceId: true,
              accountId: true,
              amount: true,
              currency: true,
              method: true,
              provider: true,
              status: true,
              paidAt: true,
              createdAt: true,
            },
          },
        },
      }),
      db.platformInvoice.aggregate({
        where: { accountId: id, status: { in: ['open', 'overdue'] } },
        _sum: { total: true, amountPaid: true },
      }),
      db.platformInvoice.count({
        where: {
          accountId: id,
          status: { in: ['open', 'overdue'] },
          dueAt: { lt: now },
        },
      }),
      db.platformPayment.aggregate({
        where: { accountId: id, status: 'paid' },
        _sum: { amount: true },
      }),
    ]);

    const openTotal = outstandingAgg._sum.total ?? 0n;
    const openPaid = outstandingAgg._sum.amountPaid ?? 0n;
    const outstanding = openTotal > openPaid ? openTotal - openPaid : 0n;
    const invoiceViews = invoices.map((invoice) => ({
      ...invoice,
      status: invoice.status === 'open' && invoice.dueAt < now ? 'overdue' : invoice.status,
    }));

    return NextResponse.json(bigIntToNumber({
      account,
      subscription,
      invoices: invoiceViews,
      metrics: {
        outstanding,
        overdueCount,
        totalCollected: paidAgg._sum.amount ?? 0n,
      },
    }));
  } catch (error) {
    console.error('[platform/billing GET]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

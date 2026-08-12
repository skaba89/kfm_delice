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
      db.platformSubscription.findFirst({
        where: { accountId: id },
        orderBy: { createdAt: 'desc' },
      }),
      db.platformInvoice.findMany({
        where: { accountId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 20,
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

    return NextResponse.json(bigIntToNumber({
      account,
      subscription,
      invoices,
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

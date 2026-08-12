import { NextResponse } from 'next/server';
import { authenticatePlatformAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { bigIntToNumber, db, dbReady } from '@/lib/db';
import {
  BillingDomainError,
  generatePlatformInvoiceNumber,
  invoiceCreateSchema,
  parseMoneyToBigInt,
  parseOptionalIsoDate,
  parseRequiredIsoDate,
  validateBillingPeriod,
} from '@/lib/platform-billing';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const { id } = await params;
    const parsed = invoiceCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Données invalides', code: 'BILLING_VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    const account = await db.account.findUnique({
      where: { id },
      select: { id: true, plan: true },
    });
    if (!account) return NextResponse.json({ error: 'Compte non trouvé' }, { status: 404 });

    const subscription = await db.platformSubscription.findFirst({
      where: { accountId: id },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription) {
      throw new BillingDomainError(
        'BILLING_SUBSCRIPTION_REQUIRED',
        'Aucun abonnement de facturation n’est configuré pour ce compte.',
        409,
      );
    }
    if (!['active', 'trialing', 'past_due'].includes(subscription.status)) {
      throw new BillingDomainError(
        'BILLING_SUBSCRIPTION_NOT_BILLABLE',
        'Cet abonnement ne peut pas être facturé dans son état actuel.',
        409,
      );
    }
    if (subscription.unitAmount <= 0n) {
      throw new BillingDomainError(
        'BILLING_ZERO_AMOUNT',
        'Aucune facture payante ne peut être émise avec un montant nul.',
        409,
      );
    }

    const input = parsed.data;
    const periodStart = parseOptionalIsoDate(input.periodStart, 'periodStart');
    const periodEnd = parseOptionalIsoDate(input.periodEnd, 'periodEnd');
    validateBillingPeriod(periodStart, periodEnd);
    const dueAt = parseRequiredIsoDate(input.dueAt, 'dueAt');
    const tax = input.tax === undefined ? 0n : parseMoneyToBigInt(input.tax);
    const subtotal = subscription.unitAmount;
    const total = subtotal + tax;

    const invoice = await db.platformInvoice.create({
      data: {
        accountId: id,
        subscriptionId: subscription.id,
        number: generatePlatformInvoiceNumber(id),
        periodStart: periodStart ?? null,
        periodEnd: periodEnd ?? null,
        currency: subscription.currency,
        subtotal,
        tax,
        total,
        amountPaid: 0n,
        status: 'open',
        dueAt,
        providerInvoiceRef: input.providerInvoiceRef ?? '',
        notes: input.notes ?? '',
      },
    });

    await logAudit({
      actorId: admin.id,
      actorType: 'platform_admin',
      action: 'platform_invoice_created',
      entityType: 'PlatformInvoice',
      entityId: invoice.id,
      accountId: id,
      after: bigIntToNumber(invoice),
      request,
    });

    return NextResponse.json(bigIntToNumber(invoice), { status: 201 });
  } catch (error) {
    if (error instanceof BillingDomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    console.error('[platform/billing/invoices POST]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

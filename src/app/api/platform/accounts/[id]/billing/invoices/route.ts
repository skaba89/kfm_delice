import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { authenticatePlatformAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { bigIntToNumber, db, dbReady } from '@/lib/db';
import {
  assertAccountCanIssueInvoice,
  assertBillingWriteRole,
  assertSubscriptionCanIssueInvoice,
  BillingDomainError,
  generatePlatformInvoiceNumber,
  invoiceCreateSchema,
  parseMoneyToBigInt,
  parseOptionalIsoDate,
  parseRequiredIsoDate,
  validateBillingPeriod,
} from '@/lib/platform-billing';

function sameDate(left: Date | null, right: Date | null): boolean {
  return left?.getTime() === right?.getTime();
}

function invoiceAuditView(invoice: any) {
  return bigIntToNumber({
    id: invoice.id,
    accountId: invoice.accountId,
    subscriptionId: invoice.subscriptionId,
    number: invoice.number,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    currency: invoice.currency,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    status: invoice.status,
    dueAt: invoice.dueAt,
    paidAt: invoice.paidAt,
  });
}

function assertInvoiceReplayMatches(
  invoice: {
    accountId: string;
    periodStart: Date | null;
    periodEnd: Date | null;
    dueAt: Date;
    tax: bigint;
    notes: string;
    providerInvoiceRef: string;
  },
  expected: {
    accountId: string;
    periodStart: Date | null;
    periodEnd: Date | null;
    dueAt: Date;
    tax: bigint;
    notes: string;
    providerInvoiceRef: string;
  },
) {
  const matches = invoice.accountId === expected.accountId
    && sameDate(invoice.periodStart, expected.periodStart)
    && sameDate(invoice.periodEnd, expected.periodEnd)
    && invoice.dueAt.getTime() === expected.dueAt.getTime()
    && invoice.tax === expected.tax
    && invoice.notes === expected.notes
    && invoice.providerInvoiceRef === expected.providerInvoiceRef;

  if (!matches) {
    throw new BillingDomainError(
      'BILLING_IDEMPOTENCY_CONFLICT',
      'Cette clé d’idempotence a déjà été utilisée avec une autre facture.',
      409,
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    assertBillingWriteRole(admin);

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
      select: { id: true, plan: true, status: true },
    });
    if (!account) return NextResponse.json({ error: 'Compte non trouvé' }, { status: 404 });

    const input = parsed.data;
    const periodStart = parseOptionalIsoDate(input.periodStart, 'periodStart') ?? null;
    const periodEnd = parseOptionalIsoDate(input.periodEnd, 'periodEnd') ?? null;
    validateBillingPeriod(periodStart, periodEnd);
    const dueAt = parseRequiredIsoDate(input.dueAt, 'dueAt');
    const tax = input.tax === undefined ? 0n : parseMoneyToBigInt(input.tax);
    const expectedReplay = {
      accountId: id,
      periodStart,
      periodEnd,
      dueAt,
      tax,
      notes: input.notes ?? '',
      providerInvoiceRef: input.providerInvoiceRef ?? '',
    };

    const existing = await db.platformInvoice.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      assertInvoiceReplayMatches(existing, expectedReplay);
      return NextResponse.json(bigIntToNumber({ ...existing, replay: true }));
    }

    assertAccountCanIssueInvoice(account.status);

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
    assertSubscriptionCanIssueInvoice(subscription, account.plan);

    const subtotal = subscription.unitAmount;
    const total = subtotal + tax;
    if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new BillingDomainError(
        'BILLING_AMOUNT_TOO_LARGE',
        'Le total de la facture dépasse la limite sérialisable sans perte de précision.',
      );
    }

    let invoice;
    try {
      invoice = await db.platformInvoice.create({
        data: {
          accountId: id,
          subscriptionId: subscription.id,
          number: generatePlatformInvoiceNumber(id),
          idempotencyKey: input.idempotencyKey,
          periodStart,
          periodEnd,
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await db.platformInvoice.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (replay) {
          assertInvoiceReplayMatches(replay, expectedReplay);
          return NextResponse.json(bigIntToNumber({ ...replay, replay: true }));
        }
      }
      throw error;
    }

    await logAudit({
      actorId: admin.id,
      actorType: 'platform_admin',
      action: 'platform_invoice_created',
      entityType: 'PlatformInvoice',
      entityId: invoice.id,
      accountId: id,
      after: invoiceAuditView(invoice),
      request,
    });

    return NextResponse.json(bigIntToNumber({ ...invoice, replay: false }), { status: 201 });
  } catch (error) {
    if (error instanceof BillingDomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    console.error('[platform/billing/invoices POST]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

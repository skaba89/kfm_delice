import { NextResponse } from 'next/server';
import { authenticatePlatformAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { bigIntToNumber, db, dbReady } from '@/lib/db';
import {
  assertBillingWriteRole,
  BillingDomainError,
  assertPaymentFitsOutstanding,
  calculateOutstanding,
  parseMoneyToBigInt,
  parseOptionalIsoDate,
  paymentCreateSchema,
  serializeBillingMetadata,
} from '@/lib/platform-billing';

function invoiceView(invoice: any) {
  if (!invoice) return null;
  return bigIntToNumber({
    id: invoice.id,
    accountId: invoice.accountId,
    number: invoice.number,
    currency: invoice.currency,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    status: invoice.status,
    dueAt: invoice.dueAt,
    paidAt: invoice.paidAt,
  });
}

function paymentView(payment: any) {
  return bigIntToNumber({
    id: payment.id,
    accountId: payment.accountId,
    invoiceId: payment.invoiceId,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    provider: payment.provider,
    status: payment.status,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  });
}

function sameOptionalDate(left: Date | null | undefined, right: Date | null | undefined): boolean {
  return left?.getTime() === right?.getTime();
}

function paymentReplayMatches(
  existing: any,
  expected: {
    accountId: string;
    invoiceId: string;
    amount: bigint;
    method: string;
    provider: string;
    providerPaymentRef: string;
    metadata: string;
    requestedPaidAt: Date | null | undefined;
  },
): boolean {
  return existing.accountId === expected.accountId
    && existing.invoiceId === expected.invoiceId
    && existing.amount === expected.amount
    && (existing.method ?? expected.method) === expected.method
    && (existing.provider ?? expected.provider) === expected.provider
    && (existing.providerPaymentRef ?? expected.providerPaymentRef) === expected.providerPaymentRef
    && (existing.metadata ?? expected.metadata) === expected.metadata
    && (expected.requestedPaidAt === undefined || sameOptionalDate(existing.paidAt, expected.requestedPaidAt));
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
    const parsed = paymentCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Données invalides', code: 'BILLING_VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    const account = await db.account.findUnique({ where: { id }, select: { id: true } });
    if (!account) return NextResponse.json({ error: 'Compte non trouvé' }, { status: 404 });

    const input = parsed.data;
    const amount = parseMoneyToBigInt(input.amount);
    const requestedPaidAt = parseOptionalIsoDate(input.paidAt, 'paidAt');
    const paidAt = requestedPaidAt ?? new Date();
    const provider = input.provider ?? 'manual';
    const providerPaymentRef = input.providerPaymentRef ?? '';
    const metadata = serializeBillingMetadata(input.metadata);
    const replayExpectation = {
      accountId: id,
      invoiceId: input.invoiceId,
      amount,
      method: input.method,
      provider,
      providerPaymentRef,
      metadata,
      requestedPaidAt,
    };

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.platformPayment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        if (!paymentReplayMatches(existing, replayExpectation)) {
          throw new BillingDomainError(
            'BILLING_IDEMPOTENCY_CONFLICT',
            'Cette clé d’idempotence a déjà été utilisée avec une autre opération.',
            409,
          );
        }
        const replayInvoice = await tx.platformInvoice.findUnique({ where: { id: existing.invoiceId } });
        return { payment: existing, invoice: replayInvoice, replay: true, beforeInvoice: replayInvoice };
      }

      const invoice = await tx.platformInvoice.findUnique({ where: { id: input.invoiceId } });
      if (!invoice || invoice.accountId !== id) {
        throw new BillingDomainError('BILLING_INVOICE_NOT_FOUND', 'Facture SaaS introuvable.', 404);
      }
      if (!['open', 'overdue'].includes(invoice.status)) {
        throw new BillingDomainError(
          invoice.status === 'void' ? 'BILLING_INVOICE_VOID' : 'BILLING_INVOICE_NOT_PAYABLE',
          invoice.status === 'void'
            ? 'Une facture annulée ne peut pas être encaissée.'
            : 'Cette facture ne peut pas recevoir de nouveau paiement.',
          409,
        );
      }

      const outstanding = calculateOutstanding(invoice.total, invoice.amountPaid);
      assertPaymentFitsOutstanding(amount, outstanding);
      const nextAmountPaid = invoice.amountPaid + amount;
      const fullyPaid = nextAmountPaid >= invoice.total;
      const nextStatus = fullyPaid ? 'paid' : invoice.status === 'overdue' ? 'overdue' : 'open';

      // Optimistic concurrency guard: another payment that changes amountPaid or
      // invoice status between the read and this update makes this write fail.
      const updated = await tx.platformInvoice.updateMany({
        where: {
          id: invoice.id,
          accountId: id,
          amountPaid: invoice.amountPaid,
          status: invoice.status,
        },
        data: {
          amountPaid: nextAmountPaid,
          status: nextStatus,
          paidAt: fullyPaid ? paidAt : null,
        },
      });
      if (updated.count !== 1) {
        const concurrentReplay = await tx.platformPayment.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (concurrentReplay && paymentReplayMatches(concurrentReplay, replayExpectation)) {
          const replayInvoice = await tx.platformInvoice.findUnique({ where: { id: concurrentReplay.invoiceId } });
          return { payment: concurrentReplay, invoice: replayInvoice, replay: true, beforeInvoice: replayInvoice };
        }
        throw new BillingDomainError(
          'BILLING_CONCURRENT_PAYMENT',
          'Le solde de la facture a changé pendant l’encaissement. Rechargez la facture puis réessayez.',
          409,
        );
      }

      const payment = await tx.platformPayment.create({
        data: {
          accountId: id,
          invoiceId: invoice.id,
          amount,
          currency: invoice.currency,
          method: input.method,
          provider,
          status: 'paid',
          providerPaymentRef,
          idempotencyKey: input.idempotencyKey,
          paidAt,
          metadata,
        },
      });
      const savedInvoice = await tx.platformInvoice.findUnique({ where: { id: invoice.id } });
      return { payment, invoice: savedInvoice, replay: false, beforeInvoice: invoice };
    });

    if (!result.replay) {
      await logAudit({
        actorId: admin.id,
        actorType: 'platform_admin',
        action: 'platform_payment_recorded',
        entityType: 'PlatformPayment',
        entityId: result.payment.id,
        accountId: id,
        before: invoiceView(result.beforeInvoice),
        after: {
          payment: paymentView(result.payment),
          invoice: invoiceView(result.invoice),
        },
        request,
      });
    }

    return NextResponse.json({
      payment: paymentView(result.payment),
      invoice: invoiceView(result.invoice),
      replay: result.replay,
    }, { status: result.replay ? 200 : 201 });
  } catch (error) {
    if (error instanceof BillingDomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    console.error('[platform/billing/payments POST]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

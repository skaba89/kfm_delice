import { logger } from "@/lib/logger";
import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { isValidPaymentTransition } from "@/lib/payment-security";
import { Prisma } from "@prisma/client";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const IS_PRODUCTION = process.env.APP_MODE === "production" || process.env.NODE_ENV === "production";

type EventResult = {
  outcome: 'processed' | 'ignored' | 'failed';
  error?: string;
  restaurantId?: string;
};

export async function POST(request: Request) {
  try {
    if (IS_PRODUCTION && !STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
    }
    if (IS_PRODUCTION && !STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe API key not configured" }, { status: 503 });
    }

    const body = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
    }
    if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(STRIPE_SECRET_KEY || 'sk_test_webhook_validation_only', {
      apiVersion: "2024-06-20" as any,
    });

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      logger.warn("[stripe-webhook] Signature verification failed", error);
      return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
    }

    await dbReady;
    const providerEventId = String(event.id);
    const existing = await db.webhookEvent.findUnique({
      where: { provider_providerEventId: { provider: "stripe", providerEventId } },
    });
    if (existing?.status === 'processed' || existing?.status === 'ignored') {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const webhookEvent = await db.webhookEvent.upsert({
      where: { provider_providerEventId: { provider: "stripe", providerEventId } },
      update: {},
      create: {
        provider: "stripe",
        providerEventId,
        eventType: event.type,
        payload: body as any,
        status: "pending",
      },
    });

    const claim = await db.webhookEvent.updateMany({
      where: { id: webhookEvent.id, status: { in: ['pending', 'failed'] } },
      data: { status: 'processing', errorMessage: '' },
    });
    if (claim.count !== 1) {
      return NextResponse.json({ received: true, duplicate: true, inProgress: true });
    }

    const result = await handleEvent(event, request);
    await db.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: result.outcome === 'processed' ? 'processed' : result.outcome === 'ignored' ? 'ignored' : 'failed',
        processedAt: result.outcome === 'processed' ? new Date() : null,
        errorMessage: result.error || '',
        ...(result.restaurantId && { restaurantId: result.restaurantId }),
      },
    });

    if (result.outcome === 'failed') {
      return NextResponse.json({ error: result.error || 'Erreur transitoire', transitory: true }, { status: 500 });
    }
    if (result.outcome === 'ignored') {
      return NextResponse.json({ received: true, ignored: true, error: result.error, definitive: true });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("[stripe-webhook] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

async function handleEvent(
  event: { id: string; type: string; data: { object: any } },
  request: Request
): Promise<EventResult> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId || session.client_reference_id;
    const restaurantId = session.metadata?.restaurantId;
    if (!orderId) return { outcome: 'ignored', error: 'No orderId in session metadata' };
    if (!restaurantId) return { outcome: 'ignored', error: 'No restaurantId in session metadata' };

    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId },
      select: { id: true, total: true, paymentStatus: true, status: true, restaurantId: true },
    });
    if (!order) return { outcome: 'ignored', error: `Order ${orderId} not found`, restaurantId };

    const expectedAmount = Number(order.total);
    const receivedAmount = Number(session.amount_total || 0);
    if (expectedAmount !== receivedAmount) {
      return {
        outcome: 'ignored',
        error: `Amount mismatch: expected ${expectedAmount}, received ${receivedAmount}`,
        restaurantId,
      };
    }
    const currency = String(session.currency || '').toLowerCase();
    if (currency && currency !== 'gnf') {
      return { outcome: 'ignored', error: `Currency mismatch: expected gnf, received ${currency}`, restaurantId };
    }
    if (order.paymentStatus === 'refunded') {
      return { outcome: 'ignored', error: 'Order already refunded', restaurantId };
    }

    try {
      await db.$transaction(async tx => {
        const payment = await tx.payment.findFirst({
          where: {
            restaurantId,
            OR: [
              { transactionRef: String(session.id) },
              { orderId, method: 'card' },
            ],
          },
          orderBy: { createdAt: 'desc' },
        });

        if (payment) {
          if (payment.status !== 'paid') {
            if (!isValidPaymentTransition(payment.status, 'paid')) {
              throw new Error(`DEFINITIVE:INVALID_PAYMENT_TRANSITION:${payment.status}:paid`);
            }
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: 'paid',
                transactionRef: String(session.id),
                paidAt: new Date().toISOString(),
              },
            });
          }
        } else {
          await tx.payment.create({
            data: {
              orderId,
              restaurantId,
              method: 'card',
              amount: order.total as any,
              status: 'paid',
              transactionRef: String(session.id),
              customerName: session.customer_details?.name || '',
              phone: session.customer_details?.phone || '',
              metadata: JSON.stringify(session) as any,
              paidAt: new Date().toISOString(),
            },
          });
        }

        if (order.paymentStatus !== 'paid') {
          await tx.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: 'paid',
              ...(order.status === 'pending' && { status: 'confirmed' }),
            },
          });
        }
      }, {
        timeout: 10000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith('DEFINITIVE:')) {
        return { outcome: 'ignored', error: message, restaurantId };
      }
      return { outcome: 'failed', error: `Transaction failed: ${message}`, restaurantId };
    }

    await logAudit({
      actorId: "stripe_webhook",
      actorType: "system",
      action: "payment_confirmed",
      entityType: "Order",
      entityId: orderId,
      restaurantId,
      request,
    }).catch(() => {});

    return { outcome: 'processed', restaurantId };
  }

  if (event.type === "checkout.session.expired" || event.type === "payment_intent.payment_failed") {
    const object = event.data.object;
    const orderId = object.metadata?.orderId || object.client_reference_id;
    const restaurantId = object.metadata?.restaurantId;
    if (!orderId) return { outcome: 'ignored', error: 'No orderId in failed/expired event metadata' };

    const order = await db.order.findFirst({
      where: { id: orderId, ...(restaurantId && { restaurantId }) },
      select: { id: true, restaurantId: true, paymentStatus: true },
    });
    if (!order) return { outcome: 'ignored', error: `Order ${orderId} not found`, restaurantId };
    if (!['pending', 'processing'].includes(order.paymentStatus)) {
      return { outcome: 'ignored', error: `Refusing payment regression from ${order.paymentStatus} to failed`, restaurantId: order.restaurantId };
    }

    try {
      await db.$transaction(async tx => {
        const payment = await tx.payment.findFirst({
          where: { orderId, restaurantId: order.restaurantId, method: 'card' },
          orderBy: { createdAt: 'desc' },
        });
        if (payment && payment.status !== 'failed') {
          if (!isValidPaymentTransition(payment.status, 'failed')) {
            throw new Error(`DEFINITIVE:INVALID_PAYMENT_TRANSITION:${payment.status}:failed`);
          }
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: 'failed', failedReason: event.type },
          });
        }
        await tx.order.update({ where: { id: orderId }, data: { paymentStatus: 'failed' } });
      }, {
        timeout: 10000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith('DEFINITIVE:')) {
        return { outcome: 'ignored', error: message, restaurantId: order.restaurantId };
      }
      return { outcome: 'failed', error: `Transaction failed: ${message}`, restaurantId: order.restaurantId };
    }
    return { outcome: 'processed', restaurantId: order.restaurantId };
  }

  logger.debug(`[stripe-webhook] Unhandled event: ${event.type}`);
  return { outcome: 'processed' };
}

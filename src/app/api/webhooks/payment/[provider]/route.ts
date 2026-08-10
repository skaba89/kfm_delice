import { logger } from "@/lib/logger";
import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { createHmac, timingSafeEqual } from "crypto";
import { isValidPaymentTransition, paymentWebhookEventId } from "@/lib/payment-security";
import { Prisma } from "@prisma/client";

const VALID_PROVIDERS = ['orange_money', 'mtn_money', 'wave'] as const;

function getWebhookSecret(provider: string): string {
  switch (provider) {
    case 'orange_money': return process.env.ORANGE_MONEY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '';
    case 'mtn_money': return process.env.MTN_MOMO_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '';
    case 'wave': return process.env.WAVE_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '';
    default: return '';
  }
}

function verifySignature(provider: string, rawBody: string, signature: string): boolean {
  const secret = getWebhookSecret(provider);
  if (!secret) {
    if (process.env.APP_MODE === 'production' || process.env.NODE_ENV === 'production') {
      logger.error(`[webhook/${provider}] No webhook secret configured — refusing to process`);
      return false;
    }
    return true;
  }
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

function mapProviderStatus(status: string): 'paid' | 'failed' | 'pending' {
  const normalized = status.toLowerCase();
  if (['success', 'successful', 'paid', 'completed', 'approved'].includes(normalized)) return 'paid';
  if (['failed', 'error', 'declined', 'rejected', 'cancelled', 'expired'].includes(normalized)) return 'failed';
  return 'pending';
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Body illisible" }, { status: 400 });
  }

  const { provider } = await params;
  if (!VALID_PROVIDERS.includes(provider as any)) {
    return NextResponse.json({ error: "Provider invalide" }, { status: 400 });
  }

  const signature = request.headers.get('x-signature') ||
    request.headers.get('x-callback-signature') ||
    request.headers.get('x-hub-signature-256') || '';
  if (!verifySignature(provider, rawBody, signature)) {
    logger.warn(`[webhook/${provider}] Invalid signature`);
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  try {
    await dbReady;
    const orderId = body.orderId || body.order_id || body.externalId || body.external_id ||
      body.reference || body.metadata?.orderId || body.metadata?.order_id;
    const transactionId = body.transactionId || body.transaction_id || body.id || body.txnid || '';
    const providerStatus = String(body.status || body.payment_status || body.transactionStatus || '').toLowerCase();
    const providerEventId = paymentWebhookEventId(body, rawBody);
    const paymentStatus = mapProviderStatus(providerStatus);
    const amount = body.amount || body.amount_paid || 0;

    if (!orderId) {
      logger.warn(`[webhook/${provider}] No orderId in body`);
      return NextResponse.json({ received: true, error: "orderId manquant" });
    }

    const existingEvent = await db.webhookEvent.findUnique({
      where: { provider_providerEventId: { provider, providerEventId } },
    });
    if (existingEvent?.status === 'processed' || existingEvent?.status === 'ignored') {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const webhookEvent = await db.webhookEvent.upsert({
      where: { provider_providerEventId: { provider, providerEventId } },
      update: {},
      create: {
        provider,
        providerEventId,
        eventType: providerStatus || 'unknown',
        payload: rawBody as any,
        status: 'pending',
      },
    });

    const claim = await db.webhookEvent.updateMany({
      where: { id: webhookEvent.id, status: { in: ['pending', 'failed'] } },
      data: { status: 'processing', errorMessage: '' },
    });
    if (claim.count !== 1) {
      return NextResponse.json({ received: true, duplicate: true, inProgress: true });
    }

    const order = await db.order.findFirst({
      where: { id: String(orderId) },
      select: { id: true, restaurantId: true, total: true, paymentStatus: true, status: true },
    });
    if (!order) {
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: 'ignored', errorMessage: `Order ${orderId} not found` },
      }).catch(() => {});
      return NextResponse.json({ received: true, error: "Commande non trouvée" });
    }

    if (amount && Number(amount) !== Number(order.total)) {
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'ignored',
          restaurantId: order.restaurantId,
          errorMessage: `Amount mismatch: expected ${order.total}, got ${amount}`,
        },
      }).catch(() => {});
      logger.warn(`[webhook/${provider}] Amount mismatch for order ${orderId}`);
      return NextResponse.json({ received: true, error: "Montant incorrect" });
    }

    try {
      await db.$transaction(async (tx) => {
        const existingPayment = transactionId
          ? await tx.payment.findFirst({
              where: { restaurantId: order.restaurantId, transactionRef: String(transactionId) },
              orderBy: { createdAt: 'desc' },
            })
          : await tx.payment.findFirst({
              where: { restaurantId: order.restaurantId, orderId: order.id, method: provider },
              orderBy: { createdAt: 'desc' },
            });

        if (paymentStatus === 'paid') {
          if (existingPayment) {
            if (existingPayment.status !== 'paid' && isValidPaymentTransition(existingPayment.status, 'paid')) {
              await tx.payment.update({
                where: { id: existingPayment.id },
                data: {
                  status: 'paid',
                  ...(transactionId && { transactionRef: String(transactionId) }),
                  paidAt: new Date().toISOString(),
                },
              });
            } else if (existingPayment.status !== 'paid') {
              throw new Error(`INVALID_PROVIDER_TRANSITION:${existingPayment.status}:paid`);
            }
          } else if (!['paid', 'refunded'].includes(order.paymentStatus)) {
            await tx.payment.create({
              data: {
                orderId: order.id,
                restaurantId: order.restaurantId,
                method: provider,
                amount: order.total as any,
                status: 'paid',
                transactionRef: String(transactionId || `${provider}-${order.id}-${providerEventId.slice(-12)}`),
                metadata: rawBody as any,
                paidAt: new Date().toISOString(),
              },
            });
          }

          if (!['paid', 'refunded'].includes(order.paymentStatus)) {
            await tx.order.update({
              where: { id: order.id },
              data: {
                paymentStatus: 'paid',
                ...(order.status === 'pending' && { status: 'confirmed' }),
              },
            });
          }
        } else if (paymentStatus === 'failed') {
          if (existingPayment && existingPayment.status !== 'failed') {
            if (!isValidPaymentTransition(existingPayment.status, 'failed')) {
              throw new Error(`INVALID_PROVIDER_TRANSITION:${existingPayment.status}:failed`);
            }
            await tx.payment.update({
              where: { id: existingPayment.id },
              data: { status: 'failed', failedReason: providerStatus || 'provider_failed' },
            });
          }
          if (['pending', 'processing'].includes(order.paymentStatus)) {
            await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'failed' } });
          }
        }

        await tx.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            status: 'processed',
            processedAt: new Date(),
            restaurantId: order.restaurantId,
          },
        });
      }, {
        timeout: 10000,
        ...(process.env.DATABASE_URL?.startsWith('postgresql')
          ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
          : {}),
      });
    } catch (txError) {
      const message = txError instanceof Error ? txError.message : String(txError);
      if (message.startsWith('INVALID_PROVIDER_TRANSITION:')) {
        await db.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: { status: 'ignored', restaurantId: order.restaurantId, errorMessage: message },
        }).catch(() => {});
        return NextResponse.json({ received: true, ignored: true, reason: 'invalid_transition' });
      }

      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: 'failed', errorMessage: message.substring(0, 500) },
      }).catch(() => {});
      logger.error(`[webhook/${provider}] Transaction failed for ${order.id}: ${message}`);
      return NextResponse.json({ error: "Erreur de transaction", transitory: true }, { status: 500 });
    }

    if (paymentStatus === 'paid') {
      await logAudit({
        actorId: `${provider}_webhook`,
        actorType: 'system',
        action: 'payment_confirmed',
        entityType: 'Order',
        entityId: order.id,
        restaurantId: order.restaurantId,
        after: { provider, transactionId, amount: Number(amount) },
        request,
      }).catch(() => {});
    }

    return NextResponse.json({ received: true, status: paymentStatus });
  } catch (error) {
    logger.error(`[webhook/${provider}] Unexpected error:`, error);
    return NextResponse.json({ error: "Erreur serveur", transitory: true }, { status: 500 });
  }
}

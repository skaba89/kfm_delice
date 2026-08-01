import { logger } from "@/lib/logger";
import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { createHmac, timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";

/**
 * POST /api/webhooks/payment/[provider]
 * Universal payment webhook for Orange Money, MTN MoMo, Wave.
 *
 * Mission 6 (Phase 3) hardening:
 *   - Signature verification (HMAC-SHA256 with per-provider secret)
 *   - Idempotency via WebhookEvent table (duplicate events return 200)
 *   - Transaction for Order + Payment + WebhookEvent
 *   - Return 500 on transitory errors (DB down, timeout) → provider retries
 *   - Return 200 on definitive errors (order not found, amount mismatch)
 *   - Return 200 on success
 *
 * Configure in each provider's dashboard:
 *   Orange: https://your-domain.com/api/webhooks/payment/orange_money
 *   MTN:    https://your-domain.com/api/webhooks/payment/mtn_money
 *   Wave:   https://your-domain.com/api/webhooks/payment/wave
 *
 * Required env vars (per provider):
 *   ORANGE_MONEY_WEBHOOK_SECRET
 *   MTN_MOMO_WEBHOOK_SECRET
 *   WAVE_WEBHOOK_SECRET
 */

const VALID_PROVIDERS = ['orange_money', 'mtn_money', 'wave'];

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
    // In production, refuse if no secret is set
    if (process.env.APP_MODE === 'production') {
      logger.error(`[webhook/${provider}] No webhook secret configured — refusing to process`);
      return false;
    }
    // Dev only: allow without signature
    return true;
  }
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
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

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Provider invalide" }, { status: 400 });
  }

  // ── Mission 6: Signature verification ──
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

    // ── Extract common fields ──
    const orderId =
      body.orderId || body.order_id || body.externalId || body.external_id ||
      body.reference || body.metadata?.orderId || body.metadata?.order_id;

    const transactionId =
      body.transactionId || body.transaction_id || body.id || body.txnid || '';

    const providerEventId =
      body.eventId || body.event_id || transactionId || `${provider}-${orderId}-${Date.now()}`;

    const providerStatus = (
      body.status || body.payment_status || body.transactionStatus || ''
    ).toLowerCase();

    const amount = body.amount || body.amount_paid || 0;

    if (!orderId) {
      logger.warn(`[webhook/${provider}] No orderId in body`);
      // Definitive error — return 200 so provider doesn't retry
      return NextResponse.json({ received: true, error: "orderId manquant" });
    }

    // ── Mission 6: Idempotency — check if event already processed ──
    const existingEvent = await db.webhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider,
          providerEventId: String(providerEventId),
        },
      },
    });

    if (existingEvent?.status === 'processed') {
      logger.debug(`[webhook/${provider}] Event ${providerEventId} already processed — skipping`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Store/upsert the webhook event
    const webhookEvent = await db.webhookEvent.upsert({
      where: {
        provider_providerEventId: {
          provider,
          providerEventId: String(providerEventId),
        },
      },
      update: {},
      create: {
        provider,
        providerEventId: String(providerEventId),
        eventType: providerStatus || 'unknown',
        payload: rawBody as any,
        status: 'pending',
      },
    });

    // ── Determine payment status ──
    let paymentStatus: 'paid' | 'failed' | 'pending' = 'pending';
    if (providerStatus === 'success' || providerStatus === 'successful' ||
        providerStatus === 'paid' || providerStatus === 'completed' ||
        providerStatus === 'approved') {
      paymentStatus = 'paid';
    } else if (providerStatus === 'failed' || providerStatus === 'error' ||
               providerStatus === 'declined' || providerStatus === 'rejected' ||
               providerStatus === 'cancelled' || providerStatus === 'expired') {
      paymentStatus = 'failed';
    }

    logger.debug(`[webhook/${provider}] orderId=${orderId}, status=${providerStatus} → ${paymentStatus}, txnId=${transactionId}`);

    // ── Find the order ──
    const order = await db.order.findFirst({
      where: { id: orderId },
      select: { id: true, restaurantId: true, total: true, paymentStatus: true, status: true },
    });

    if (!order) {
      // Definitive error — return 200 so provider stops retrying
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: 'failed', errorMessage: `Order ${orderId} not found` },
      }).catch(() => {});
      return NextResponse.json({ received: true, error: "Commande non trouvée" });
    }

    // ── Mission 6: Verify amount (if provided) ──
    if (amount && Number(amount) !== Number(order.total)) {
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: 'failed', errorMessage: `Amount mismatch: expected ${order.total}, got ${amount}` },
      }).catch(() => {});
      logger.warn(`[webhook/${provider}] Amount mismatch for order ${orderId}: expected ${order.total}, got ${amount}`);
      return NextResponse.json({ received: true, error: "Montant incorrect" });
    }

    // ── Mission 6: Transaction for Order + Payment + WebhookEvent ──
    try {
      await db.$transaction(async (tx) => {
        if (paymentStatus === 'paid') {
          // Update order
          await tx.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: 'paid',
              ...(order.status === 'pending' && { status: 'confirmed' }),
            },
          });

          // Create or update Payment
          const existingPayment = await tx.payment.findFirst({
            where: { transactionRef: transactionId || `${provider}-${orderId}` },
          });

          if (existingPayment) {
            await tx.payment.update({
              where: { id: existingPayment.id },
              data: { status: 'paid', paidAt: new Date().toISOString() },
            });
          } else {
            await tx.payment.create({
              data: {
                orderId,
                restaurantId: order.restaurantId,
                method: provider,
                amount: order.total as any,
                status: 'paid',
                transactionRef: transactionId || `${provider}-${orderId}`,
                metadata: rawBody as any,
                paidAt: new Date().toISOString(),
              },
            });
          }
        } else if (paymentStatus === 'failed') {
          await tx.order.update({
            where: { id: orderId },
            data: { paymentStatus: 'failed' },
          });
        }

        // Mark webhook event as processed + link to restaurant
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
        ...(process.env.DATABASE_URL?.startsWith('postgresql') ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } : {}),
      });
    } catch (txError) {
      // ── Mission 6: Transitory error → return 500 so provider retries ──
      const errMsg = txError instanceof Error ? txError.message : String(txError);
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: 'failed', errorMessage: errMsg.substring(0, 500) },
      }).catch(() => {});
      logger.error(`[webhook/${provider}] Transaction failed for ${orderId}: ${errMsg}`);
      return NextResponse.json(
        { error: "Erreur de transaction", transitory: true },
        { status: 500 }
      );
    }

    // Audit log (non-blocking)
    if (paymentStatus === 'paid') {
      await logAudit({
        actorId: `${provider}_webhook`,
        actorType: 'system',
        action: 'payment_confirmed',
        entityType: 'Order',
        entityId: orderId,
        restaurantId: order.restaurantId,
        after: { provider, transactionId, amount: Number(amount) },
        request,
      }).catch(() => {});
    }

    logger.debug(`[webhook/${provider}] ✓ Processed ${paymentStatus} for order ${orderId}`);
    return NextResponse.json({ received: true, status: paymentStatus });
  } catch (error) {
    // ── Mission 6: Unexpected error → 500 so provider retries ──
    logger.error(`[webhook/${provider}] Unexpected error:`, error);
    return NextResponse.json(
      { error: "Erreur serveur", transitory: true },
      { status: 500 }
    );
  }
}

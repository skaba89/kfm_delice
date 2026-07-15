import { logger } from "@/lib/logger";
import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/webhooks/payment/[provider]
 * Universal payment webhook for Orange Money, MTN MoMo, Wave.
 *
 * Each provider calls this endpoint after a payment is processed.
 * The URL pattern is:
 *   /api/webhooks/payment/orange_money
 *   /api/webhooks/payment/mtn_money
 *   /api/webhooks/payment/wave
 *
 * Configure in each provider's dashboard:
 *   Orange: https://your-domain.com/api/webhooks/payment/orange_money
 *   MTN:    https://your-domain.com/api/webhooks/payment/mtn_money
 *   Wave:   https://your-domain.com/api/webhooks/payment/wave
 *
 * Body (varies by provider, we extract common fields):
 *   - orderId / external_id / reference (provider's order reference)
 *   - status: success/failed/pending
 *   - transactionId / transaction_id / id
 *   - amount
 */

const VALID_PROVIDERS = ['orange_money', 'mtn_money', 'wave'];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    await dbReady;
    const { provider } = await params;

    if (!VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: "Provider invalide" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const signature = request.headers.get('x-signature') || request.headers.get('x-callback-signature') || '';

    // ── Extract common fields (each provider uses different names) ──
    const orderId =
      body.orderId || body.order_id || body.externalId || body.external_id ||
      body.reference || body.metadata?.orderId || body.metadata?.order_id;

    const transactionId =
      body.transactionId || body.transaction_id || body.id || body.txnid || '';

    const providerStatus = (
      body.status || body.payment_status || body.transactionStatus || ''
    ).toLowerCase();

    const amount = body.amount || body.amount_paid || 0;

    if (!orderId) {
      console.warn(`[webhook/${provider}] No orderId in callback body:`, JSON.stringify(body).slice(0, 200));
      return NextResponse.json({ error: "orderId manquant" }, { status: 400 });
    }

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
      console.warn(`[webhook/${provider}] Order not found: ${orderId}`);
      return NextResponse.json({ error: "Commande non trouvée" }, { status: 404 });
    }

    // ── Update order payment status ──
    if (paymentStatus === 'paid') {
      await db.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'paid',
          // Auto-confirm the order if it was pending
          ...(order.status === 'pending' && { status: 'confirmed' }),
        },
      });

      // Create or update Payment record
      const existingPayment = await db.payment.findFirst({
        where: { transactionRef: transactionId || `${provider}-${orderId}` },
      }).catch(() => null);

      if (existingPayment) {
        await db.payment.update({
          where: { id: existingPayment.id },
          data: { status: 'paid', paidAt: new Date().toISOString() },
        }).catch(() => {});
      } else {
        await db.payment.create({
          data: {
            orderId,
            restaurantId: order.restaurantId,
            method: provider,
            amount: order.total,
            status: 'paid',
            transactionRef: transactionId || `${provider}-${orderId}`,
            metadata: JSON.stringify(body),
            paidAt: new Date().toISOString(),
          },
        }).catch(() => {});
      }

      // Audit log
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

      logger.debug(`[webhook/${provider}] ✓ Payment confirmed for order ${orderId}`);
    } else if (paymentStatus === 'failed') {
      await db.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'failed' },
      });

      logger.debug(`[webhook/${provider}] ✗ Payment failed for order ${orderId}`);
    }

    // Always return 200 to acknowledge receipt (providers retry on non-2xx)
    return NextResponse.json({ received: true, status: paymentStatus });
  } catch (error) {
    console.error("[webhook/payment] Error:", error);
    // Return 200 even on error to prevent provider retries overwhelming us
    return NextResponse.json({ received: true, error: "Processed with errors" }, { status: 200 });
  }
}

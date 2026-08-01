import { logger } from "@/lib/logger";
import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

/**
 * POST /api/webhooks/stripe
 * Stripe webhook endpoint — Mission 4: hardened, idempotent, signature-required.
 *
 * SECURITY:
 *   - In production (APP_MODE=production), STRIPE_WEBHOOK_SECRET is REQUIRED.
 *     If missing, the endpoint returns 503 (no mock mode).
 *   - The signature is verified using stripe.webhooks.constructEvent.
 *   - No JWT is required — the signature is the auth.
 *   - Each event is stored in WebhookEvent with @@unique([provider, providerEventId]).
 *   - Duplicate events return 200 without re-processing.
 *   - Payment + Order + WebhookEvent are updated in a single transaction.
 *   - The amount, currency, orderId, and restaurantId are all verified
 *     against the DB before marking any order as paid.
 *
 * Configure in Stripe Dashboard → Webhooks → Add endpoint:
 *   URL: https://your-domain.com/api/webhooks/stripe
 *   Events: checkout.session.completed, checkout.session.expired,
 *           payment_intent.payment_failed
 */

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const isProductionMode = process.env.APP_MODE === "production";

export async function POST(request: Request) {
  try {
    // ── Mission 4: In production, webhook secret is mandatory ──
    if (isProductionMode && !STRIPE_WEBHOOK_SECRET) {
      console.error("[stripe-webhook] FATAL: STRIPE_WEBHOOK_SECRET is not set in production. Refusing to process webhooks.");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 503 }
      );
    }
    if (isProductionMode && !STRIPE_SECRET_KEY) {
      console.error("[stripe-webhook] FATAL: STRIPE_SECRET_KEY is not set in production.");
      return NextResponse.json(
        { error: "Stripe API key not configured" },
        { status: 503 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    // ── If no webhook secret is set (dev only), reject ──
    if (!STRIPE_WEBHOOK_SECRET) {
      console.warn("[stripe-webhook] STRIPE_WEBHOOK_SECRET not set — rejecting webhook (dev mode).");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 503 }
      );
    }
    if (!signature) {
      console.error("[stripe-webhook] Missing stripe-signature header.");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // ── Verify Stripe signature ──
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any });

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("[stripe-webhook] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Signature invalide" },
        { status: 400 }
      );
    }

    await dbReady;

    // ── Mission 4: Idempotency — check if event already processed ──
    const providerEventId = event.id;
    const existingEvent = await db.webhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: "stripe",
          providerEventId,
        },
      },
    });

    if (existingEvent?.status === "processed") {
      // Already processed — return 200 without re-processing
      console.log(`[stripe-webhook] Event ${providerEventId} already processed — skipping.`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // ── Store/Update the webhook event record ──
    const webhookEvent = await db.webhookEvent.upsert({
      where: {
        provider_providerEventId: {
          provider: "stripe",
          providerEventId,
        },
      },
      update: {},
      create: {
        provider: "stripe",
        providerEventId,
        eventType: event.type,
        payload: body as any,
        status: "pending",
      },
    });

    // ── Process the event ──
    const result = await handleEvent(event, request);

    // ── Mark the webhook event as processed (or failed) ──
    await db.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: result.success ? "processed" : "failed",
        processedAt: result.success ? new Date() : null,
        errorMessage: result.error || "",
      },
    });

    if (!result.success) {
      console.error(`[stripe-webhook] Event ${providerEventId} processing failed: ${result.error}`);
      // Return 200 anyway so Stripe doesn't retry indefinitely for business errors
      // (e.g. amount mismatch). For signature errors we already returned 400 above.
      return NextResponse.json({ received: true, error: result.error });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe-webhook] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

async function handleEvent(
  event: { id: string; type: string; data: { object: any } },
  _request: Request
): Promise<{ success: boolean; error?: string }> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId || session.client_reference_id;
      const restaurantId = session.metadata?.restaurantId;

      if (!orderId) {
        return { success: false, error: "No orderId in session metadata" };
      }
      if (!restaurantId) {
        return { success: false, error: "No restaurantId in session metadata" };
      }

      // ── Verify the order exists and belongs to the restaurant ──
      const order = await db.order.findFirst({
        where: { id: orderId, restaurantId },
        select: { id: true, total: true, paymentStatus: true, status: true, restaurantId: true },
      });
      if (!order) {
        return { success: false, error: `Order ${orderId} not found for restaurant ${restaurantId}` };
      }

      // ── Mission 4: Verify the amount matches ──
      const expectedAmount = Number(order.total);
      const receivedAmount = Number(session.amount_total || 0);
      if (expectedAmount !== receivedAmount) {
        return {
          success: false,
          error: `Amount mismatch: expected ${expectedAmount}, received ${receivedAmount}`,
        };
      }

      // ── Mission 4: Verify the currency ──
      const expectedCurrency = "gnf";
      const receivedCurrency = (session.currency || "").toLowerCase();
      if (receivedCurrency && receivedCurrency !== expectedCurrency) {
        return {
          success: false,
          error: `Currency mismatch: expected ${expectedCurrency}, received ${receivedCurrency}`,
        };
      }

      // ── If already paid, skip (idempotency) ──
      if (order.paymentStatus === "paid") {
        return { success: true };
      }

      // ── Transaction: update Payment + Order + link WebhookEvent ──
      try {
        await db.$transaction(async (tx) => {
          // Update order payment status
          await tx.order.update({
            where: { id: orderId },
            data: { paymentStatus: "paid" },
          });

          // Find or create the payment record
          const existingPayment = await tx.payment.findFirst({
            where: { transactionRef: session.id },
          });

          if (existingPayment) {
            await tx.payment.update({
              where: { id: existingPayment.id },
              data: {
                status: "paid",
                paidAt: new Date().toISOString(),
              },
            });
          } else {
            await tx.payment.create({
              data: {
                orderId,
                restaurantId,
                method: "card",
                amount: order.total as any,
                status: "paid",
                transactionRef: session.id,
                customerName: session.customer_details?.name || "",
                phone: session.customer_details?.phone || "",
                metadata: JSON.stringify(session) as any,
                paidAt: new Date().toISOString(),
              },
            });
          }

          // Link the webhook event to the restaurant
          await tx.webhookEvent.updateMany({
            where: {
              provider: "stripe",
              providerEventId: event.id,
            },
            data: { restaurantId },
          });
        }, {
          timeout: 10000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (txError) {
        return {
          success: false,
          error: `Transaction failed: ${txError instanceof Error ? txError.message : String(txError)}`,
        };
      }

      // ── Audit log (non-blocking) ──
      await logAudit({
        actorId: "stripe_webhook",
        actorType: "system",
        action: "payment_confirmed",
        entityType: "Order",
        entityId: orderId,
        restaurantId,
        request: _request,
      }).catch(() => {});

      console.log(`[stripe-webhook] Payment confirmed for order ${orderId}`);
      return { success: true };
    }

    case "checkout.session.expired": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await db.order.update({
          where: { id: orderId },
          data: { paymentStatus: "failed" },
        }).catch(() => {});
        logger.debug(`[stripe-webhook] Payment expired for order ${orderId}`);
      }
      return { success: true };
    }

    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      const orderId = intent.metadata?.orderId;
      if (orderId) {
        await db.order.update({
          where: { id: orderId },
          data: { paymentStatus: "failed" },
        }).catch(() => {});
        logger.debug(`[stripe-webhook] Payment failed for order ${orderId}`);
      }
      return { success: true };
    }

    default:
      // Unhandled event type — log but don't error
      logger.debug(`[stripe-webhook] Unhandled event: ${event.type}`);
      return { success: true };
  }
}

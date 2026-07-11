import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/webhooks/stripe
 * Stripe webhook endpoint — confirms payments automatically.
 *
 * Configure in Stripe Dashboard → Webhooks → Add endpoint:
 *   URL: https://your-domain.com/api/webhooks/stripe
 *   Events: checkout.session.completed, checkout.session.expired,
 *           payment_intent.payment_failed
 *
 * Set STRIPE_WEBHOOK_SECRET in your env vars (from Stripe dashboard).
 */

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!STRIPE_WEBHOOK_SECRET) {
      console.warn("[stripe-webhook] STRIPE_WEBHOOK_SECRET not set — skipping verification (mock mode)");
      // In mock mode, just parse the body as JSON
      const event = JSON.parse(body);
      return handleEvent(event, request);
    }

    // Verify Stripe signature
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-06-20" as any });

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature || "", STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("[stripe-webhook] Signature verification failed:", err);
      return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
    }

    return handleEvent(event, request);
  } catch (error) {
    console.error("[stripe-webhook] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

async function handleEvent(event: any, request: Request) {
  await dbReady;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId || session.client_reference_id;

      if (orderId) {
        // Update the order's payment status to "paid"
        await db.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: "paid",
          },
        }).catch(() => {});

        // Create or update the payment record
        // Note: transactionRef is not unique, so we query first then create/update
        const existingPayment = await db.payment.findFirst({
          where: { transactionRef: session.id },
        }).catch(() => null);

        if (existingPayment) {
          await db.payment.update({
            where: { id: existingPayment.id },
            data: {
              status: "paid",
              paidAt: new Date().toISOString(),
            },
          }).catch(() => {});
        } else {
          // Fetch restaurantId from the order
          const order = await db.order.findUnique({
            where: { id: orderId },
            select: { restaurantId: true },
          }).catch(() => null);

          if (order) {
            await db.payment.create({
              data: {
                orderId,
                restaurantId: order.restaurantId,
                method: "card",
                amount: Number(session.amount_total || 0) as any,
                status: "paid",
                transactionRef: session.id,
                customerName: session.customer_details?.name || "",
                phone: session.customer_details?.phone || "",
                metadata: JSON.stringify(session),
                paidAt: new Date().toISOString(),
              },
            }).catch(() => {});
          }
        }

        // Audit log
        await logAudit({
          actorId: "stripe_webhook",
          actorType: "system",
          action: "payment_confirmed",
          entityType: "Order",
          entityId: orderId,
          request,
        }).catch(() => {});

        console.log(`[stripe-webhook] Payment confirmed for order ${orderId}`);
      }
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await db.order.update({
          where: { id: orderId },
          data: { paymentStatus: "failed" },
        }).catch(() => {});
        console.log(`[stripe-webhook] Payment expired for order ${orderId}`);
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      const orderId = intent.metadata?.orderId;
      if (orderId) {
        await db.order.update({
          where: { id: orderId },
          data: { paymentStatus: "failed" },
        }).catch(() => {});
        console.log(`[stripe-webhook] Payment failed for order ${orderId}`);
      }
      break;
    }

    default:
      // Unhandled event type — log but don't error
      console.log(`[stripe-webhook] Unhandled event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

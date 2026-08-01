import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateAny, hasRole } from "@/lib/auth";
import { paymentSchema, paymentStatusSchema, webhookSignatureSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch, parseStatusFilter } from "@/lib/pagination";
import { createHmac, timingSafeEqual } from "crypto";
import { initiatePayment, type PaymentMethod } from "@/lib/payments";

// Simulated processing delay (ms) — set to 0 in production
const SIMULATED_DELAY = process.env.NODE_ENV === "production" ? 0 : 2000;

// Webhook secret for HMAC signature verification
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

/**
 * Generate an HMAC-SHA256 signature for a payment ID using the webhook secret.
 */
function generateWebhookSignature(paymentId: string): string {
  if (!WEBHOOK_SECRET) return "";
  return createHmac("sha256", WEBHOOK_SECRET).update(paymentId).digest("hex");
}

/**
 * Verify that a webhook signature matches the expected HMAC-SHA256 of the payment ID.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifyWebhookSignature(paymentId: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return false;
  const expected = generateWebhookSignature(paymentId);
  if (!expected || expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// GET: List payments (admin/manager)
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager", "cashier", "accountant"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const sp = new URL(request.url).searchParams;
    const { page, limit } = parsePagination(sp);
    const { sortBy, sortOrder } = parseSorting(sp, ["createdAt", "amount", "method", "status"] as const, "createdAt");
    const search = parseSearch(sp);
    const statusFilter = parseStatusFilter(sp, ["pending", "processing", "paid", "failed", "refunded"]);
    const methodFilter = parseStatusFilter(sp, ["cash", "orange_money", "mtn_money", "wave", "card"], "method");
    const orderId = sp.get("orderId");

    const where = {
      restaurantId: admin.restaurantId,
      ...(statusFilter && { status: statusFilter }),
      ...(methodFilter && { method: methodFilter }),
      ...(orderId && { orderId }),
      ...(search && {
        OR: [
          { customerName: { contains: search } },
          { phone: { contains: search } },
          { transactionRef: { contains: search } },
        ],
      }),
    };

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        include: { order: { select: { id: true, customerName: true, status: true, total: true } } },
        skip: prismaSkip(page, limit),
        take: prismaTake(limit),
      }),
      db.payment.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: bigIntToNumber(payments),
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Initiate a payment for an order
export async function POST(request: Request) {
  try {
    await dbReady;
    const auth = await authenticateAny(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const validation = paymentSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { orderId, method, phone, customerName } = validation.data;

    // ── Multi-tenant isolation: scope order lookup by user type ──
    // Customer: must own the order (customerId === auth.id)
    // Admin: order must belong to admin's restaurant
    // Driver: not allowed to initiate payments (return 403)
    // Without this, any authenticated user could pay for ANY order by
    // guessing an orderId — leading to unauthorized payment charges
    // and cross-tenant data access.
    if (auth.type === "driver") {
      return NextResponse.json({ error: "Les livreurs ne peuvent pas initier de paiement" }, { status: 403 });
    }

    const orderWhere: Record<string, unknown> = { id: orderId };
    if (auth.type === "customer") {
      orderWhere.customerId = auth.id;
    } else if (auth.type === "admin" && auth.restaurantId) {
      orderWhere.restaurantId = auth.restaurantId;
    }

    const order = await db.order.findFirst({ where: orderWhere });
    if (!order) {
      return NextResponse.json({ error: "Commande non trouvée" }, { status: 404 });
    }

    // Verify order isn't already paid
    if (order.paymentStatus === "paid") {
      return NextResponse.json({ error: "Cette commande est déjà payée" }, { status: 400 });
    }

    // For mobile money, phone is required
    if ((method === "orange_money" || method === "mtn_money" || method === "wave") && !phone) {
      return NextResponse.json(
        { error: "Numéro de téléphone requis pour le paiement mobile" },
        { status: 400 }
      );
    }

    // Process the payment via the payment gateway abstraction
    const result = await initiatePayment({
      method: method as PaymentMethod,
      phone: phone || "",
      amount: Number(order.total),
      orderId,
      restaurantId: order.restaurantId, // Mission 4: for Stripe metadata
    });

    if (!result.success) {
      // Create failed payment record
      await db.payment.create({
        data: {
          orderId,
          amount: Number(order.total),
          method,
          status: "failed",
          phone: phone || "",
          customerName: customerName || order.customerName,
          failedReason: result.error || "Échec du paiement",
          restaurantId: order.restaurantId,
        },
      });

      return NextResponse.json({ error: result.error || "Échec du paiement" }, { status: 400 });
    }

    // Create payment record
    const payment = await db.payment.create({
      data: {
        orderId,
        amount: Number(order.total),
        method,
        status: result.status || "processing",
        transactionRef: result.transactionRef || "",
        phone: phone || "",
        customerName: customerName || order.customerName,
        metadata: JSON.stringify({ otpRequired: result.otpRequired, message: result.message }),
        ...(result.status === "paid" && { paidAt: new Date().toISOString() }),
        restaurantId: order.restaurantId,
      },
    });

    // Update order payment status
    await db.order.update({
      where: { id: orderId },
      data: {
        paymentMethod: method,
        paymentStatus: result.status,
        ...(result.status === "paid" && { status: order.status === "pending" ? "confirmed" : order.status }),
      },
    });

    // For mobile money, simulate async confirmation after a delay (dev only)
    if (result.status === "processing" && SIMULATED_DELAY > 0) {
      // Simulate payment confirmation callback (in production, this would be a real webhook)
      // Generate the HMAC signature for the simulated webhook call
      const webhookSignature = generateWebhookSignature(payment.id);
      setTimeout(async () => {
        try {
          const confirmed = Math.random() > 0.1; // 90% confirmation rate
          // Call the PATCH endpoint with proper webhook signature
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
          await fetch(`${baseUrl}/api/payment`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-webhook-signature": webhookSignature,
            },
            body: JSON.stringify({
              id: payment.id,
              status: confirmed ? "paid" : "failed",
              failedReason: confirmed ? undefined : "Paiement non confirmé par le client.",
              webhook: true,
            }),
          });

          // WebSocket notification
          if (confirmed) {
            try {
              const { broadcastToType } = await import("@/lib/websocket-server");
              const { WSEvents } = await import("@/lib/ws-events");
              broadcastToType("admin", WSEvents.ADMIN_NOTIFICATION, {
                type: "payment_confirmed",
                orderId,
                amount: Number(order.total),
                method,
              });
            } catch {}
          }
        } catch (e) {
          console.error("[Payment] Async confirmation error:", e);
        }
      }, SIMULATED_DELAY);
    }

    // WebSocket: notify admin of new payment
    try {
      const { broadcastToType } = await import("@/lib/websocket-server");
      const { WSEvents } = await import("@/lib/ws-events");
      broadcastToType("admin", WSEvents.ADMIN_NOTIFICATION, {
        type: "payment_initiated",
        orderId,
        amount: Number(order.total),
        method,
        status: result.status,
      });
    } catch {}

    return NextResponse.json({
      payment: bigIntToNumber(payment),
      message: result.message,
      otpRequired: result.otpRequired,
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH: Update payment status (admin confirms/cancels, or webhook callback)
export async function PATCH(request: Request) {
  try {
    await dbReady;
    const body = await request.json();

    // Support both admin manual update and webhook callback
    const isWebhook = body.webhook === true;

    let adminRestaurantId: string | undefined;

    if (isWebhook) {
      // Verify webhook signature
      const signature = request.headers.get("x-webhook-signature");
      const sigValidation = webhookSignatureSchema.safeParse(signature);
      if (!sigValidation.success || !signature || !verifyWebhookSignature(String(body.id), signature)) {
        return NextResponse.json({ error: "Signature webhook invalide" }, { status: 401 });
      }
      // Webhook has no tenant scope — it's a gateway callback. The payment
      // will be found by ID (below) and its restaurantId determines scope.
    } else {
      // Admin manual update
      const admin = await authenticateAdmin(request);
      if (!admin) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      }
      if (!hasRole(admin.role, ["admin", "manager", "cashier", "accountant"])) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      adminRestaurantId = admin.restaurantId;
    }

    const validation = paymentStatusSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { id, status, transactionRef, failedReason } = validation.data;

    // ── Multi-tenant isolation ──────────────────────────────────
    // For admin updates: findFirst by id + admin.restaurantId.
    // For webhooks: findUnique by id (gateway callback, no tenant scope).
    // Without this, an admin of restaurant A could update a payment of
    // restaurant B by guessing a payment UUID — potentially marking
    // another restaurant's payment as 'paid' or 'failed'.
    const payment = adminRestaurantId
      ? await db.payment.findFirst({ where: { id, restaurantId: adminRestaurantId } })
      : await db.payment.findUnique({ where: { id } });

    if (!payment) {
      return NextResponse.json({ error: "Paiement non trouvé" }, { status: 404 });
    }

    // Update payment
    const updatedPayment = await db.payment.update({
      where: { id },
      data: {
        status,
        ...(transactionRef && { transactionRef }),
        ...(failedReason && { failedReason }),
        ...(status === "paid" && { paidAt: new Date().toISOString() }),
      },
    });

    // Update order payment status
    await db.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: status },
    });

    // If payment confirmed, update order status
    if (status === "paid") {
      const order = await db.order.findUnique({ where: { id: payment.orderId } });
      if (order && order.status === "pending") {
        await db.order.update({
          where: { id: payment.orderId },
          data: { status: "confirmed" },
        });
      }
    }

    // WebSocket notification
    try {
      const { broadcastToType } = await import("@/lib/websocket-server");
      const { WSEvents } = await import("@/lib/ws-events");
      broadcastToType("admin", WSEvents.ADMIN_NOTIFICATION, {
        type: "payment_status_changed",
        paymentId: id,
        orderId: payment.orderId,
        status,
      });
    } catch {}

    return NextResponse.json(bigIntToNumber(updatedPayment));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

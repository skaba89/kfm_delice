import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateAny, hasRole } from "@/lib/auth";
import { paymentSchema, paymentStatusSchema, webhookSignatureSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch, parseStatusFilter } from "@/lib/pagination";
import { createHmac, timingSafeEqual } from "crypto";

// ============================================================
// Orange Money & MTN Money Payment Integration
// ============================================================
// This implements a payment flow simulation that mirrors the real
// Orange Money / MTN Money API structure. In production, you would
// replace the simulate* functions with actual API calls to:
//   - Orange Money API: https://api.orange.com/om/sandbox/
//   - MTN MoMo API: https://momodeveloper.mtn.com/
// ============================================================

const PAYMENT_CONFIG = {
  // In production, these would be environment variables
  ORANGE_MONEY_MERCHANT_CODE: process.env.ORANGE_MONEY_MERCHANT_CODE || "KFM_DELICE",
  MTN_MONEY_SUBSCRIPTION_KEY: process.env.MTN_MONEY_SUBSCRIPTION_KEY || "demo_key",
  // Simulated processing delay (ms) — set to 0 in production
  SIMULATED_DELAY: process.env.NODE_ENV === "production" ? 0 : 2000,
};

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

/**
 * Simulate Orange Money payment initiation.
 * In production, this would call the Orange Money Web Payment API:
 * POST https://api.orange.com/orange-money-webpay/dev/v1/webpay
 */
async function initiateOrangeMoneyPayment(phone: string, amount: number, orderId: string) {
  // Simulate API call delay
  if (PAYMENT_CONFIG.SIMULATED_DELAY > 0) {
    await new Promise((r) => setTimeout(r, 500));
  }

  // Validate phone format (Guinea: starts with +224 6XX)
  const cleanPhone = phone.replace(/\s/g, "");
  if (!cleanPhone.startsWith("+224") && !cleanPhone.startsWith("224") && !cleanPhone.startsWith("6")) {
    return {
      success: false,
      error: "Numéro Orange Money invalide. Format attendu : +224 6XX XXX XXX",
    };
  }

  // Simulate success (95% success rate in demo)
  const isSuccess = Math.random() > 0.05;

  if (isSuccess) {
    return {
      success: true,
      transactionRef: `OM_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      status: "processing" as const,
      message: "Paiement Orange Money initié. Confirmez sur votre téléphone.",
      otpRequired: true,
    };
  }

  return {
    success: false,
    error: "Solde insuffisant ou service Orange Money temporairement indisponible.",
  };
}

/**
 * Simulate MTN Mobile Money payment initiation.
 * In production, this would call the MTN MoMo API:
 * POST https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay
 */
async function initiateMTNMoneyPayment(phone: string, amount: number, orderId: string) {
  if (PAYMENT_CONFIG.SIMULATED_DELAY > 0) {
    await new Promise((r) => setTimeout(r, 500));
  }

  const cleanPhone = phone.replace(/\s/g, "");
  if (!cleanPhone.startsWith("+224") && !cleanPhone.startsWith("224") && !cleanPhone.startsWith("6")) {
    return {
      success: false,
      error: "Numéro MTN Money invalide. Format attendu : +224 6XX XXX XXX",
    };
  }

  const isSuccess = Math.random() > 0.05;

  if (isSuccess) {
    return {
      success: true,
      transactionRef: `MTN_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      status: "processing" as const,
      message: "Paiement MTN Money initié. Confirmez sur votre téléphone.",
      otpRequired: true,
    };
  }

  return {
    success: false,
    error: "Solde insuffisant ou service MTN Money temporairement indisponible.",
  };
}

/**
 * Simulate Wave Sénégal/Guinée payment initiation.
 * In production, this would call the Wave Business API:
 * POST https://api.wave.com/v1/checkout/sessions
 */
async function initiateWavePayment(phone: string, amount: number, orderId: string) {
  if (PAYMENT_CONFIG.SIMULATED_DELAY > 0) {
    await new Promise((r) => setTimeout(r, 500));
  }

  const cleanPhone = phone.replace(/\s/g, "");
  if (!cleanPhone.startsWith("+224") && !cleanPhone.startsWith("224") && !cleanPhone.startsWith("6")) {
    return {
      success: false,
      error: "Numéro Wave invalide. Format attendu : +224 6XX XXX XXX",
    };
  }

  const isSuccess = Math.random() > 0.03; // Wave has slightly higher success rate

  if (isSuccess) {
    return {
      success: true,
      transactionRef: `WAVE_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      status: "processing" as const,
      message: "Paiement Wave initié. Confirmez via notification Wave sur votre téléphone.",
      otpRequired: true,
    };
  }

  return {
    success: false,
    error: "Solde insuffisant ou service Wave temporairement indisponible.",
  };
}

/**
 * Process a payment based on the method.
 * Cash and card payments are marked as paid immediately.
 * Mobile money (Orange/MTN/Wave) initiates the payment flow.
 */
async function processPayment(method: string, amount: number, orderId: string, phone: string) {
  switch (method) {
    case "cash":
      return {
        success: true,
        transactionRef: `CASH_${Date.now()}`,
        status: "paid" as const,
        message: "Paiement en espèces enregistré.",
        otpRequired: false,
      };

    case "card":
      return {
        success: true,
        transactionRef: `CARD_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        status: "paid" as const,
        message: "Paiement par carte enregistré.",
        otpRequired: false,
      };

    case "orange_money":
      return initiateOrangeMoneyPayment(phone, amount, orderId);

    case "mtn_money":
      return initiateMTNMoneyPayment(phone, amount, orderId);

    case "wave":
      return initiateWavePayment(phone, amount, orderId);

    default:
      return { success: false, error: `Méthode de paiement non supportée : ${method}` };
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
      data: payments,
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

    // Find the order
    const order = await db.order.findUnique({ where: { id: orderId } });
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

    // Process the payment
    const result = await processPayment(method, order.total, orderId, phone || "");

    if (!result.success) {
      // Create failed payment record
      await db.payment.create({
        data: {
          orderId,
          amount: order.total,
          method,
          status: "failed",
          phone: phone || "",
          customerName: customerName || order.customerName,
          failedReason: ('error' in result ? result.error : null) || "Échec du paiement",
          restaurantId: order.restaurantId,
        },
      });

      return NextResponse.json({ error: ('error' in result ? result.error : "Échec du paiement") }, { status: 400 });
    }

    // Create payment record
    const payment = await db.payment.create({
      data: {
        orderId,
        amount: order.total,
        method,
        status: result.status,
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

    // For mobile money, simulate async confirmation after a delay
    if (result.status === "processing" && PAYMENT_CONFIG.SIMULATED_DELAY > 0) {
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
                amount: order.total,
                method,
              });
            } catch {}
          }
        } catch (e) {
          console.error("[Payment] Async confirmation error:", e);
        }
      }, PAYMENT_CONFIG.SIMULATED_DELAY);
    }

    // WebSocket: notify admin of new payment
    try {
      const { broadcastToType } = await import("@/lib/websocket-server");
      const { WSEvents } = await import("@/lib/ws-events");
      broadcastToType("admin", WSEvents.ADMIN_NOTIFICATION, {
        type: "payment_initiated",
        orderId,
        amount: order.total,
        method,
        status: result.status,
      });
    } catch {}

    return NextResponse.json({
      payment,
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
    const body = await request.json();

    // Support both admin manual update and webhook callback
    const isWebhook = body.webhook === true;

    if (isWebhook) {
      // Verify webhook signature
      const signature = request.headers.get("x-webhook-signature");
      const sigValidation = webhookSignatureSchema.safeParse(signature);
      if (!sigValidation.success || !signature || !verifyWebhookSignature(String(body.id), signature)) {
        return NextResponse.json({ error: "Signature webhook invalide" }, { status: 401 });
      }
    } else {
      // Admin manual update
      const admin = await authenticateAdmin(request);
      if (!admin) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      }
      if (!hasRole(admin.role, ["admin", "manager", "cashier", "accountant"])) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const validation = paymentStatusSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { id, status, transactionRef, failedReason } = validation.data;

    const payment = await db.payment.findUnique({ where: { id } });
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

    return NextResponse.json(updatedPayment);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

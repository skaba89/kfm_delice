import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateAny, hasRole } from "@/lib/auth";
import { paymentSchema, paymentStatusSchema, webhookSignatureSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch, parseStatusFilter } from "@/lib/pagination";
import { createHmac, timingSafeEqual, createHash } from "crypto";
import { initiatePayment, type PaymentMethod } from "@/lib/payments";
import { Prisma } from "@prisma/client";

// Simulated processing delay (ms) — set to 0 in production
const SIMULATED_DELAY = process.env.NODE_ENV === "production" ? 0 : 2000;

// Webhook secret for HMAC signature verification
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

const PAYMENT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function generateWebhookSignature(paymentId: string): string {
  if (!WEBHOOK_SECRET) return "";
  return createHmac("sha256", WEBHOOK_SECRET).update(paymentId).digest("hex");
}

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
// Mission 1 (Phase 3):
//   - Idempotency via PaymentIdempotencyKey (x-idempotency-key header)
//   - Payment + Order update in a single transaction
//   - cash → pending, card → processing, mobile money → processing
//   - No simulation in production
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

    // ── Multi-tenant isolation ──
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

    // ── Mission 1: Payment idempotency ──
    const idempotencyKey =
      request.headers.get("x-idempotency-key") ||
      (body as { idempotencyKey?: string }).idempotencyKey;

    if (idempotencyKey && typeof idempotencyKey === "string") {
      const requestHash = createHash("sha256")
        .update(JSON.stringify({ orderId, method, phone: phone || "", amount: Number(order.total) }))
        .digest("hex");

      // Check for an existing payment with this key
      const existing = await db.paymentIdempotencyKey.findUnique({
        where: {
          restaurantId_key: { restaurantId: order.restaurantId, key: idempotencyKey },
        },
        include: { payment: true },
      });

      if (existing) {
        const isExpired = existing.expiresAt < new Date();
        if (existing.paymentId && existing.payment) {
          // Idempotent replay — return the existing payment
          if (existing.requestHash && existing.requestHash !== requestHash) {
            // Hash mismatch — reject (different payload, same key)
            return NextResponse.json(
              { error: "Clé d'idempotence utilisée avec un payload différent", code: "IDEMPOTENCY_HASH_MISMATCH" },
              { status: 409 }
            );
          }
          return NextResponse.json({
            payment: bigIntToNumber(existing.payment),
            created: false,
            message: "Paiement déjà initié (replay idempotent)",
          }, { status: 200 });
        }
        if (!isExpired && existing.status === "pending") {
          // Concurrent request in flight
          return NextResponse.json(
            { error: "Un paiement avec cette clé est en cours de traitement", code: "IDEMPOTENCY_IN_FLIGHT" },
            { status: 409 }
          );
        }
        // Expired or failed — delete and allow re-creation
        await db.paymentIdempotencyKey.delete({ where: { id: existing.id } }).catch(() => {});
      }

      // Create the idempotency key record (atomic dedup)
      let idempotencyRecordId: string | null = null;
      try {
        const created = await db.paymentIdempotencyKey.create({
          data: {
            key: idempotencyKey,
            restaurantId: order.restaurantId,
            orderId,
            requestHash,
            status: "pending",
            expiresAt: new Date(Date.now() + PAYMENT_IDEMPOTENCY_TTL_MS),
          },
        });
        idempotencyRecordId = created.id;
      } catch (createErr) {
        // P2002 = unique constraint violation = concurrent request won the race
        if (createErr instanceof Prisma.PrismaClientKnownRequestError && createErr.code === "P2002") {
          const existing2 = await db.paymentIdempotencyKey.findUnique({
            where: {
              restaurantId_key: { restaurantId: order.restaurantId, key: idempotencyKey },
            },
            include: { payment: true },
          });
          if (existing2?.payment) {
            return NextResponse.json({
              payment: bigIntToNumber(existing2.payment),
              created: false,
            }, { status: 200 });
          }
          return NextResponse.json(
            { error: "Conflit d'idempotence", code: "IDEMPOTENCY_CONFLICT" },
            { status: 409 }
          );
        }
        throw createErr;
      }

      // ── Initiate the payment via the provider ──
      const result = await initiatePayment({
        method: method as PaymentMethod,
        phone: phone || "",
        amount: Number(order.total),
        orderId,
        restaurantId: order.restaurantId,
        idempotencyKey,
      });

      if (!result.success) {
        // Mark idempotency key as failed
        if (idempotencyRecordId) {
          await db.paymentIdempotencyKey.update({
            where: { id: idempotencyRecordId },
            data: { status: "failed" },
          }).catch(() => {});
        }
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

      // ── Mission 1: Create payment + update order in a TRANSACTION ──
      const payment = await db.$transaction(async (tx) => {
        const created = await tx.payment.create({
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
        await tx.order.update({
          where: { id: orderId },
          data: {
            paymentMethod: method,
            paymentStatus: result.status,
            // Only advance order status to 'confirmed' when paid (cash confirmed by cashier)
            ...(result.status === "paid" && { status: order.status === "pending" ? "confirmed" : order.status }),
          },
        });

        // Link idempotency key to the payment
        if (idempotencyRecordId) {
          await tx.paymentIdempotencyKey.update({
            where: { id: idempotencyRecordId },
            data: { paymentId: created.id, status: "completed" },
          });
        }

        return created;
      }, {
        timeout: 10000,
        ...(process.env.DATABASE_URL?.startsWith("postgresql") ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } : {}),
      });

      // ── Side effects (non-transactional, non-blocking) ──
      // Simulate async confirmation for mobile money (dev only)
      if (result.status === "processing" && SIMULATED_DELAY > 0) {
        const webhookSignature = generateWebhookSignature(payment.id);
        setTimeout(async () => {
          try {
            const confirmed = Math.random() > 0.1;
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
          } catch (e) {
            console.error("[Payment] Async confirmation error:", e);
          }
        }, SIMULATED_DELAY);
      }

      // WebSocket notification
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
        created: true,
        message: result.message,
        otpRequired: result.otpRequired,
      }, { status: 201 });
    }

    // ── No idempotency key — process normally (legacy path) ──
    const result = await initiatePayment({
      method: method as PaymentMethod,
      phone: phone || "",
      amount: Number(order.total),
      orderId,
      restaurantId: order.restaurantId,
    });

    if (!result.success) {
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

    // Create payment + update order in a transaction
    const payment = await db.$transaction(async (tx) => {
      const created = await tx.payment.create({
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
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentMethod: method,
          paymentStatus: result.status,
          ...(result.status === "paid" && { status: order.status === "pending" ? "confirmed" : order.status }),
        },
      });
      return created;
    }, {
      timeout: 10000,
      ...(process.env.DATABASE_URL?.startsWith("postgresql") ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } : {}),
    });

    return NextResponse.json({
      payment: bigIntToNumber(payment),
      created: true,
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

    const isWebhook = body.webhook === true;
    let adminRestaurantId: string | undefined;

    if (isWebhook) {
      const signature = request.headers.get("x-webhook-signature");
      const sigValidation = webhookSignatureSchema.safeParse(signature);
      if (!sigValidation.success || !signature || !verifyWebhookSignature(String(body.id), signature)) {
        return NextResponse.json({ error: "Signature webhook invalide" }, { status: 401 });
      }
    } else {
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

    const payment = adminRestaurantId
      ? await db.payment.findFirst({ where: { id, restaurantId: adminRestaurantId } })
      : await db.payment.findUnique({ where: { id } });

    if (!payment) {
      return NextResponse.json({ error: "Paiement non trouvé" }, { status: 404 });
    }

    // ── Mission 1: Update payment + order in a transaction ──
    const updatedPayment = await db.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: {
          status,
          ...(transactionRef && { transactionRef }),
          ...(failedReason && { failedReason }),
          ...(status === "paid" && { paidAt: new Date().toISOString() }),
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: status },
      });

      // If payment confirmed, advance order status
      if (status === "paid") {
        const order = await tx.order.findUnique({ where: { id: payment.orderId } });
        if (order && order.status === "pending") {
          await tx.order.update({
            where: { id: payment.orderId },
            data: { status: "confirmed" },
          });
        }
      }

      return updated;
    }, {
      timeout: 10000,
      ...(process.env.DATABASE_URL?.startsWith("postgresql") ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } : {}),
    });

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

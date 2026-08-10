import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateAny, hasRole } from "@/lib/auth";
import { paymentSchema, paymentStatusSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch, parseStatusFilter } from "@/lib/pagination";
import { initiatePayment, type PaymentMethod } from "@/lib/payments";
import {
  computePaymentRequestHash,
  isValidPaymentTransition,
  resolvePaymentIdempotencyKey,
  signInternalPaymentUpdate,
  verifyInternalPaymentUpdate,
} from "@/lib/payment-security";
import { Prisma } from "@prisma/client";

const IS_PRODUCTION = process.env.APP_MODE === "production" || process.env.NODE_ENV === "production";
const SIMULATED_DELAY = IS_PRODUCTION ? 0 : 2000;
const PAYMENT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const INTERNAL_SIMULATION_SECRET = process.env.WEBHOOK_SECRET || (IS_PRODUCTION ? "" : "kfm-dev-payment-simulation-secret");

export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
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
      ...(search && { OR: [
        { customerName: { contains: search } },
        { phone: { contains: search } },
        { transactionRef: { contains: search } },
      ] }),
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
    console.error("[payment:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbReady;
    const auth = await authenticateAny(request);
    if (!auth) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (auth.type === "driver" || auth.type === "platform_admin") {
      return NextResponse.json({ error: "Ce type de compte ne peut pas initier de paiement" }, { status: 403 });
    }

    const body = await request.json();
    const validation = paymentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }
    const { orderId, method, phone, customerName } = validation.data;

    const orderWhere: Record<string, unknown> = { id: orderId };
    if (auth.type === "customer") orderWhere.customerId = auth.id;
    if (auth.type === "admin") orderWhere.restaurantId = auth.restaurantId;
    const order = await db.order.findFirst({ where: orderWhere });
    if (!order) return NextResponse.json({ error: "Commande non trouvée" }, { status: 404 });

    if (["orange_money", "mtn_money", "wave"].includes(method) && !phone) {
      return NextResponse.json({ error: "Numéro de téléphone requis pour le paiement mobile" }, { status: 400 });
    }

    const suppliedKey = request.headers.get("x-idempotency-key") || (body as { idempotencyKey?: unknown }).idempotencyKey;
    const idempotencyKey = resolvePaymentIdempotencyKey(suppliedKey, orderId, method);
    const requestHash = computePaymentRequestHash({
      orderId,
      method,
      phone,
      customerName,
      amount: Number(order.total),
      restaurantId: order.restaurantId,
      customerId: auth.type === "customer" ? auth.id : undefined,
    });

    // Idempotent replay is checked BEFORE global order payment state so the
    // exact same retry still returns the original payment after it became
    // processing or paid.
    const existing = await db.paymentIdempotencyKey.findUnique({
      where: { restaurantId_key: { restaurantId: order.restaurantId, key: idempotencyKey } },
      include: { payment: true },
    });
    if (existing) {
      const isExpired = existing.expiresAt < new Date();
      if (existing.paymentId && existing.payment) {
        if (existing.requestHash && existing.requestHash !== requestHash) {
          return NextResponse.json(
            { error: "Clé d'idempotence utilisée avec un payload différent", code: "IDEMPOTENCY_HASH_MISMATCH" },
            { status: 409 }
          );
        }
        return NextResponse.json({
          payment: bigIntToNumber(existing.payment),
          created: false,
          message: "Paiement déjà initié (replay idempotent)",
        });
      }
      if (!isExpired && existing.status === "pending") {
        return NextResponse.json(
          { error: "Un paiement avec cette clé est en cours de traitement", code: "IDEMPOTENCY_IN_FLIGHT" },
          { status: 409 }
        );
      }
      await db.paymentIdempotencyKey.delete({ where: { id: existing.id } }).catch(() => {});
    }

    if (order.paymentStatus === "paid" || order.paymentStatus === "refunded") {
      return NextResponse.json(
        { error: "Cette commande ne peut plus recevoir un nouveau paiement", code: "PAYMENT_ALREADY_FINAL" },
        { status: 409 }
      );
    }
    if (order.paymentStatus === "processing") {
      return NextResponse.json(
        { error: "Un autre paiement est déjà en cours pour cette commande", code: "PAYMENT_IN_PROGRESS" },
        { status: 409 }
      );
    }

    let idempotencyRecordId: string;
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const raced = await db.paymentIdempotencyKey.findUnique({
          where: { restaurantId_key: { restaurantId: order.restaurantId, key: idempotencyKey } },
          include: { payment: true },
        });
        if (raced?.payment) {
          if (raced.requestHash && raced.requestHash !== requestHash) {
            return NextResponse.json(
              { error: "Clé d'idempotence utilisée avec un payload différent", code: "IDEMPOTENCY_HASH_MISMATCH" },
              { status: 409 }
            );
          }
          return NextResponse.json({ payment: bigIntToNumber(raced.payment), created: false });
        }
        return NextResponse.json({ error: "Conflit d'idempotence", code: "IDEMPOTENCY_CONFLICT" }, { status: 409 });
      }
      throw error;
    }

    const providerResult = await initiatePayment({
      method: method as PaymentMethod,
      phone: phone || "",
      amount: Number(order.total),
      orderId,
      restaurantId: order.restaurantId,
      idempotencyKey,
    });

    if (!providerResult.success) {
      await db.paymentIdempotencyKey.update({
        where: { id: idempotencyRecordId },
        data: { status: "failed" },
      }).catch(() => {});
      await db.payment.create({
        data: {
          orderId,
          amount: Number(order.total),
          method,
          status: "failed",
          phone: phone || "",
          customerName: customerName || order.customerName,
          failedReason: providerResult.error || "Échec du paiement",
          restaurantId: order.restaurantId,
        },
      });
      return NextResponse.json({ error: providerResult.error || "Échec du paiement" }, { status: 400 });
    }

    const payment = await db.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          orderId,
          amount: Number(order.total),
          method,
          status: providerResult.status || "processing",
          transactionRef: providerResult.transactionRef || "",
          phone: phone || "",
          customerName: customerName || order.customerName,
          metadata: JSON.stringify({ otpRequired: providerResult.otpRequired, message: providerResult.message }),
          ...(providerResult.status === "paid" && { paidAt: new Date().toISOString() }),
          restaurantId: order.restaurantId,
        },
      });
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentMethod: method,
          paymentStatus: providerResult.status || "processing",
          ...(providerResult.status === "paid" && order.status === "pending" ? { status: "confirmed" } : {}),
        },
      });
      await tx.paymentIdempotencyKey.update({
        where: { id: idempotencyRecordId },
        data: { paymentId: created.id, status: "completed" },
      });
      return created;
    }, {
      timeout: 10000,
      ...(process.env.DATABASE_URL?.startsWith("postgresql")
        ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        : {}),
    });

    if (providerResult.status === "processing" && SIMULATED_DELAY > 0) {
      const updateBody = { id: payment.id, status: Math.random() > 0.1 ? "paid" : "failed" };
      const timestamp = Date.now();
      const signature = signInternalPaymentUpdate(updateBody, timestamp, INTERNAL_SIMULATION_SECRET);
      setTimeout(async () => {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
          const res = await fetch(`${baseUrl}/api/payment`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-internal-payment-timestamp": String(timestamp),
              "x-internal-payment-signature": signature,
            },
            body: JSON.stringify({ ...updateBody, webhook: true }),
          });
          if (!res.ok) console.error("[payment] Dev simulation callback rejected:", res.status);
        } catch (error) {
          console.error("[payment] Dev simulation callback failed:", error);
        }
      }, SIMULATED_DELAY);
    }

    try {
      const { broadcastToType } = await import("@/lib/websocket-server");
      const { WSEvents } = await import("@/lib/ws-events");
      broadcastToType("admin", WSEvents.ADMIN_NOTIFICATION, {
        type: "payment_initiated",
        orderId,
        amount: Number(order.total),
        method,
        status: providerResult.status,
      });
    } catch {}

    return NextResponse.json({
      payment: bigIntToNumber(payment),
      created: true,
      message: providerResult.message,
      otpRequired: providerResult.otpRequired,
    }, { status: 201 });
  } catch (error) {
    console.error("[payment:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await dbReady;
    const body = await request.json();
    const validation = paymentStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    const { id, status, transactionRef, failedReason } = validation.data;
    const internalSimulation = (body as { webhook?: boolean }).webhook === true;
    let adminRestaurantId: string | undefined;

    if (internalSimulation) {
      if (IS_PRODUCTION) {
        return NextResponse.json(
          { error: "Les callbacks internes sont désactivés en production", code: "INTERNAL_CALLBACK_DISABLED" },
          { status: 403 }
        );
      }
      const valid = verifyInternalPaymentUpdate(
        { id, status, transactionRef, failedReason },
        request.headers.get("x-internal-payment-timestamp"),
        request.headers.get("x-internal-payment-signature"),
        INTERNAL_SIMULATION_SECRET
      );
      if (!valid) return NextResponse.json({ error: "Signature interne invalide" }, { status: 401 });
    } else {
      const admin = await authenticateAdmin(request);
      if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      if (!hasRole(admin.role, ["admin", "manager", "cashier", "accountant"])) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      adminRestaurantId = admin.restaurantId;
    }

    const payment = adminRestaurantId
      ? await db.payment.findFirst({ where: { id, restaurantId: adminRestaurantId } })
      : await db.payment.findUnique({ where: { id } });
    if (!payment) return NextResponse.json({ error: "Paiement non trouvé" }, { status: 404 });

    if (payment.status === status) return NextResponse.json(bigIntToNumber(payment));
    if (!isValidPaymentTransition(payment.status, status)) {
      return NextResponse.json(
        { error: `Transition de paiement invalide: ${payment.status} → ${status}`, code: "PAYMENT_INVALID_TRANSITION" },
        { status: 409 }
      );
    }
    if (status === "refunded" && payment.method !== "cash") {
      return NextResponse.json(
        { error: "Le remboursement fournisseur doit être confirmé par son flux dédié", code: "PROVIDER_REFUND_REQUIRED" },
        { status: 409 }
      );
    }

    const txResult = await db.$transaction(async (tx) => {
      const changed = await tx.payment.updateMany({
        where: { id, status: payment.status, ...(adminRestaurantId && { restaurantId: adminRestaurantId }) },
        data: {
          status,
          ...(transactionRef && { transactionRef }),
          ...(failedReason && { failedReason }),
          ...(status === "paid" && { paidAt: new Date().toISOString() }),
        },
      });
      if (changed.count !== 1) return { conflict: true as const };

      const order = await tx.order.findUnique({ where: { id: payment.orderId }, select: { status: true } });
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: status,
          ...(status === "paid" && order?.status === "pending" ? { status: "confirmed" } : {}),
        },
      });
      const updated = await tx.payment.findUnique({ where: { id } });
      return { conflict: false as const, updated };
    }, {
      timeout: 10000,
      ...(process.env.DATABASE_URL?.startsWith("postgresql")
        ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        : {}),
    });

    if (txResult.conflict) {
      const current = await db.payment.findUnique({ where: { id } });
      if (current?.status === status) return NextResponse.json(bigIntToNumber(current));
      return NextResponse.json({ error: "Paiement modifié en parallèle", code: "PAYMENT_CONCURRENT_UPDATE" }, { status: 409 });
    }

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

    return NextResponse.json(bigIntToNumber(txResult.updated));
  } catch (error) {
    console.error("[payment:PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

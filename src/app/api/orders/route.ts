import { logger } from "@/lib/logger";
import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateAny, hasRole } from "@/lib/auth";
import { orderSchema, orderPatchSchema, isValidOrderTransition, ORDER_TRANSITIONS, publicOrderSchema, detectForbiddenOrderFields } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch, parseStatusFilter } from "@/lib/pagination";
import { isRestaurantOpen } from "@/lib/constants";
import { getRestaurantId, extractSlug, resolveTenant } from "@/lib/tenant";
import { resolveTableQrToken, verifyTableBelongsToRestaurant } from "@/lib/table-qr";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { createOrderAtomically } from "@/lib/order-service";
import { createHash } from "crypto";

// GET: Admin auth required OR customer auth (customers only see their own orders)
export async function GET(request: Request) {
  try {
    await dbReady;
    const auth = await authenticateAny(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const sp = new URL(request.url).searchParams;
    const { page, limit } = parsePagination(sp);
    const { sortBy, sortOrder } = parseSorting(sp, ['createdAt', 'total', 'status', 'orderType'] as const, 'createdAt');
    const search = parseSearch(sp);
    const statusFilter = parseStatusFilter(sp, ['pending', 'confirmed', 'preparing', 'ready', 'picking_up', 'delivering', 'delivered', 'cancelled']);
    const orderTypeFilter = parseStatusFilter(sp, ['dine_in', 'takeaway', 'delivery'], 'orderType');
    const tableFilter = sp.get("tableNumber");

    // Use restaurantId from authenticated user (all auth types include it)
    const restaurantId = auth.restaurantId || await getRestaurantId(request);
    if (!restaurantId) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });

    // Build base where clause with filters
    const buildWhere = (extraFilter: Record<string, unknown> = {}) => ({
      restaurantId,
      ...(statusFilter && { status: statusFilter }),
      ...(orderTypeFilter && { orderType: orderTypeFilter }),
      ...(tableFilter && { tableNumber: parseInt(tableFilter, 10) }),
      ...(search && {
        OR: [
          { customerName: { contains: search } },
          { phone: { contains: search } },
          { deliveryAddress: { contains: search } },
        ],
      }),
      ...extraFilter,
    });

    // If customer, filter by customerId (prefer FK) with fallback to customerName
    if (auth.type === "customer") {
      const customer = await db.customer.findUnique({ where: { id: auth.id } });
      if (!customer) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });

      const where = buildWhere({ OR: [{ customerId: customer.id }, { customerName: customer.name, customerId: null }] });
      const [orders, total] = await Promise.all([
        db.order.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          include: { driver: true, customer: { select: { id: true, name: true, email: true } } },
          skip: prismaSkip(page, limit),
          take: prismaTake(limit),
        }),
        db.order.count({ where }),
      ]);
      const totalPages = Math.ceil(total / limit);
      return NextResponse.json({
        data: bigIntToNumber(orders),
        pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
      });
    }

    // Admin: see all orders with filters
    const where = buildWhere();
    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        include: { driver: true, customer: { select: { id: true, name: true, email: true } } },
        skip: prismaSkip(page, limit),
        take: prismaTake(limit),
      }),
      db.order.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: bigIntToNumber(orders),
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Public (for new orders from public site) or authenticated
// Mission 1/2/3: Server-authoritative order creation with atomic idempotency.
export async function POST(request: Request) {
  try {
    await dbReady;

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const { allowed } = await rateLimit(`order-create:${clientIp}`, 10, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Trop de commandes. Reessayez dans une minute." },
        { status: 429 }
      );
    }

    const rawBody = await request.json();

    const forbidden = detectForbiddenOrderFields(rawBody);
    if (forbidden.length > 0) {
      return NextResponse.json(
        { error: `Champs interdits: ${forbidden.join(", ")}`, code: "FORBIDDEN_FIELDS", forbidden },
        { status: 400 }
      );
    }

    const validation = publicOrderSchema.safeParse(rawBody);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Donnees invalides";
      return NextResponse.json(
        { error: firstError, code: "VALIDATION_ERROR", details: validation.error.issues },
        { status: 400 }
      );
    }
    const body = validation.data;

    const authResult = await authenticateAdmin(request).catch(() => null);
    const isAdminOverride = (rawBody as { adminOverride?: boolean }).adminOverride === true && authResult;
    if ((body.orderType === "dine_in" || body.orderType === "takeaway") && !isRestaurantOpen() && !isAdminOverride) {
      return NextResponse.json(
        { error: "Le restaurant est actuellement ferme.", code: "RESTAURANT_CLOSED" },
        { status: 400 }
      );
    }

    let restaurantId: string | null = null;
    let tableId: string | null = null;
    let tableNumberStr = "";

    if (body.tableQrToken && body.tableQrToken.length > 0) {
      const resolved = await resolveTableQrToken(body.tableQrToken, { trackScan: false });
      if (!resolved) {
        return NextResponse.json(
          { error: "QR code de table invalide ou desactive", code: "QR_INVALID" },
          { status: 400 }
        );
      }
      const headerSlug = extractSlug(request);
      if (headerSlug && headerSlug !== resolved.restaurantSlug) {
        return NextResponse.json(
          { error: "Invalid restaurant/table context", code: "TENANT_MISMATCH" },
          { status: 400 }
        );
      }
      if (body.orderType !== "dine_in") {
        return NextResponse.json(
          { error: "Une commande depuis une table doit etre de type dine_in", code: "ORDER_TYPE_MISMATCH" },
          { status: 400 }
        );
      }
      restaurantId = resolved.restaurantId;
      tableId = resolved.tableId;
      tableNumberStr = resolved.tableNumber;
    } else {
      restaurantId = await getRestaurantId(request);
    }

    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant non trouve", code: "RESTAURANT_NOT_FOUND" }, { status: 404 });
    }

    if (tableId && !(await verifyTableBelongsToRestaurant(tableId, restaurantId))) {
      return NextResponse.json(
        { error: "Cette table n'appartient pas a ce restaurant", code: "TABLE_TENANT_MISMATCH" },
        { status: 400 }
      );
    }

    let customerId: string | undefined;
    try {
      const auth = await authenticateAny(request);
      if (auth?.type === "customer") {
        customerId = auth.id;
      }
    } catch { /* walk-in order */ }

    const rawBodyHash = createHash("sha256")
      .update(JSON.stringify({ items: body.items, orderType: body.orderType, promoCode: body.promoCode }))
      .digest("hex");

    const result = await createOrderAtomically(
      {
        items: body.items,
        orderType: body.orderType,
        customerName: body.customerName,
        phone: body.phone,
        deliveryAddress: body.deliveryAddress,
        paymentMethod: body.paymentMethod,
        ...(body.tableQrToken && { tableQrToken: body.tableQrToken }),
        ...(body.promoCode && { promoCode: body.promoCode }),
        tip: body.tip,
        note: body.note,
        ...(body.idempotencyKey && { idempotencyKey: body.idempotencyKey }),
      },
      {
        restaurantId,
        ...(tableId && { tableId }),
        ...(tableNumberStr && { tableNumberStr }),
        ...(customerId && { customerId }),
        clientIp,
        rawBodyHash,
      }
    );

    if (!result.success || !result.order) {
      return NextResponse.json(
        { error: result.error || "Erreur de creation de commande", code: result.code || "ORDER_CREATE_FAILED" },
        { status: result.status }
      );
    }

    const order = result.order as { id: string; customerName: string; orderType: string; status: string; tableNumber?: number; total: unknown; items: unknown };

    if (tableId) {
      await logAudit({
        actorId: customerId || "anonymous",
        actorType: customerId ? "customer" : "public",
        action: "table_order_create",
        entityType: "Order",
        entityId: order.id,
        restaurantId,
        after: { tableId, tableNumberStr, orderId: order.id },
        request,
      }).catch(() => {});
    }

    try {
      const { broadcastToType } = await import("@/lib/websocket-server");
      const { WSEvents } = await import("@/lib/ws-events");
      broadcastToType("admin", WSEvents.ORDER_NEW, {
        orderId: order.id,
        customerName: order.customerName,
        orderType: order.orderType,
        status: order.status,
        tableNumberStr,
      });
      if (tableId) {
        broadcastToType("admin", "TABLE_ORDER_NEW", { restaurantId, orderId: order.id, tableNumber: tableNumberStr });
      }
    } catch { /* WS not available */ }

    try {
      const { notifyNewOrder } = await import("@/lib/notifications-service");
      notifyNewOrder(restaurantId, {
        id: order.id,
        customerName: order.customerName,
        total: Number(order.total),
        orderType: order.orderType,
        tableNumber: order.tableNumber,
        items: typeof order.items === "string" ? order.items : JSON.stringify(order.items),
      });
    } catch { /* email failed */ }

    try {
      const { decrementStockForOrder } = await import("@/lib/stock-manager");
      const orderedItems = JSON.parse(
        typeof order.items === "string" ? order.items : JSON.stringify(order.items)
      ) as { name: string; qty: number }[];
      decrementStockForOrder(order.id, restaurantId, orderedItems);
    } catch { /* stock decrement failed */ }

    return NextResponse.json(bigIntToNumber(order), { status: result.status });
  } catch (error) {
    console.error("[orders:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}


// PATCH: Admin/Manager/Staff auth required
export async function PATCH(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager", "staff", "cashier", "kitchen", "delivery_manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validation = orderPatchSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { id, driverId, ...data } = validation.data;
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    // ── Multi-tenant isolation ──────────────────────────────────
    // Verify the order belongs to the admin's restaurant BEFORE updating.
    // Prevents cross-tenant modifications (admin of restaurant A must not
    // be able to mutate orders of restaurant B by guessing an order UUID).
    const existingOrder = await db.order.findFirst({
      where: { id, restaurantId: admin.restaurantId },
      select: { id: true, driverId: true, total: true, deliveryFee: true, status: true },
    });
    if (!existingOrder) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    }

    // ── State machine: validate status transition ──────────────
    if (data.status && data.status !== existingOrder.status) {
      if (!isValidOrderTransition(existingOrder.status, data.status)) {
        return NextResponse.json(
          {
            error: `Transition invalide: ${existingOrder.status} → ${data.status}. Transitions autorisées depuis "${existingOrder.status}": ${ORDER_TRANSITIONS[existingOrder.status]?.join(', ') || 'aucune (statut terminal)'}`,
          },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = { ...data };
    if (driverId !== undefined) updateData.driverId = driverId || null;
    const order = await db.order.update({ where: { id }, data: updateData });
    // Update driver status if assigned
    if (driverId) {
      // Also verify the driver belongs to the same restaurant (defense in depth).
      const driver = await db.driver.findFirst({
        where: { id: driverId, restaurantId: admin.restaurantId },
        select: { id: true, commissionRate: true },
      });
      if (driver) {
        await db.driver.update({ where: { id: driverId }, data: { status: "busy" } });
      }
    }
    // If order delivered or cancelled, free up driver + credit driver earnings on delivery
    if (data.status === "delivered" || data.status === "cancelled") {
      if (existingOrder.driverId) {
        const driver = await db.driver.findFirst({
          where: { id: existingOrder.driverId, restaurantId: admin.restaurantId },
          select: { id: true, commissionRate: true },
        });
        if (driver) {
          // Convert BigInt fields to Number before arithmetic — PostgreSQL
          // returns BigInt for monetary fields; SQLite returns number.
          // Number() is a no-op on number and wraps BigInt safely.
          const orderTotal = Number(existingOrder.total);
          const orderDeliveryFee = Number(existingOrder.deliveryFee);
          const commissionRate = Number(driver.commissionRate);
          const computedEarning = Math.max(
            Math.round(orderTotal * (commissionRate / 100)),
            orderDeliveryFee
          );
          await db.driver.update({
            where: { id: existingOrder.driverId },
            data: {
              status: "available",
              totalDeliveries: { increment: 1 },
              // Credit earnings on delivery: commission % of order total (or delivery fee, whichever is higher)
              ...(data.status === "delivered" ? {
                totalEarnings: { increment: computedEarning },
              } : {}),
            },
          });
          // Persist the earning on the order for history
          if (data.status === "delivered") {
            await db.order.update({ where: { id }, data: { driverEarning: computedEarning } });
          }
        }
      }
    }

    // ── Restore stock on cancellation ──
    if (data.status === "cancelled") {
      try {
        const { restoreStockForOrder } = await import('@/lib/stock-manager');
        const fullOrderForStock = await db.order.findUnique({
          where: { id },
          select: { items: true },
        });
        if (fullOrderForStock) {
          const orderedItems = JSON.parse(
            typeof fullOrderForStock.items === 'string'
              ? fullOrderForStock.items
              : JSON.stringify(fullOrderForStock.items)
          ) as { name: string; qty: number }[];
          restoreStockForOrder(id, admin.restaurantId, orderedItems);
        }
      } catch { /* stock restore failed — non-blocking */ }
    }

    // ── Award loyalty points + update customer stats on delivery ──
    if (data.status === "delivered") {
      try {
        // Fetch the full order to get customerId + total
        const fullOrder = await db.order.findUnique({
          where: { id },
          select: { id: true, customerId: true, total: true, restaurantId: true },
        });

        if (fullOrder?.customerId) {
          // Get restaurant's loyalty rate (default 1 point per 1000 GNF)
          const restaurant = await db.restaurant.findUnique({
            where: { id: fullOrder.restaurantId },
            select: { loyaltyPointsRate: true },
          });
          const rate = restaurant?.loyaltyPointsRate ?? 1;
          const orderTotal = Number(fullOrder.total);
          const pointsEarned = Math.floor(orderTotal / 1000) * rate;

          if (pointsEarned > 0) {
            // Increment customer loyalty points + totalOrders + totalSpent
            await db.customer.update({
              where: { id: fullOrder.customerId },
              data: {
                loyaltyPoints: { increment: pointsEarned },
                totalOrders: { increment: 1 },
                totalSpent: { increment: fullOrder.total },
              },
            });

            // Create loyalty history entry
            await db.loyaltyPointsHistory.create({
              data: {
                customerId: fullOrder.customerId,
                referenceId: fullOrder.id,
                points: pointsEarned,
                type: "earned",
                description: `Commande #${fullOrder.id.slice(-8).toUpperCase()}`,
              },
            }).catch(() => {}); // non-blocking — table may not exist on some setups
          } else {
            // Even if no points (order < 1000 GNF), still update totalOrders + totalSpent
            await db.customer.update({
              where: { id: fullOrder.customerId },
              data: {
                totalOrders: { increment: 1 },
                totalSpent: { increment: fullOrder.total },
              },
            });
          }

          // ── Mission P3.8: Update customer's loyalty tier ──
          // After totalSpent increases, check if the customer qualifies
          // for a higher tier. Non-blocking — failures are logged but
          // don't fail the order.
          try {
            const { updateCustomerTier } = await import("@/lib/loyalty-tiers");
            const newTier = await updateCustomerTier(fullOrder.customerId, fullOrder.restaurantId);
            if (newTier) {
              logger.debug(`[orders] Customer ${fullOrder.customerId} promoted to tier: ${newTier}`);
              // Broadcast tier upgrade via WebSocket (non-blocking)
              try {
                const { broadcastToType } = await import("@/lib/websocket-server");
                broadcastToType("customer", "tier:upgraded", {
                  customerId: fullOrder.customerId,
                  newTier,
                });
              } catch { /* WS not available */ }
            }
          } catch (e) {
            console.warn("[orders] Tier update failed (non-blocking):", e instanceof Error ? e.message : String(e));
          }
        }
      } catch (e) {
        console.warn("[orders] Loyalty award failed (non-blocking):", e instanceof Error ? e.message : String(e));
      }
    }

    // ── Auto-generate invoice on delivery ──
    if (data.status === "delivered") {
      try {
        const { autoGenerateInvoice } = await import('@/lib/invoice-utils');
        autoGenerateInvoice(id, admin.restaurantId, admin.id, request);
      } catch { /* invoice generation failed — non-blocking */ }
    }

    // WebSocket: broadcast order status change
    try {
      const { broadcastToType, sendToUser } = await import('@/lib/websocket-server');
      const { WSEvents } = await import('@/lib/ws-events');
      broadcastToType('admin', WSEvents.ORDER_STATUS_CHANGED, { orderId: order.id, status: order.status, customerName: order.customerName });
      broadcastToType('customer', WSEvents.TRACKING_UPDATE, { orderId: order.id, status: order.status });
      if (order.driverId) {
        sendToUser(order.driverId, 'driver', WSEvents.ORDER_STATUS_CHANGED, { orderId: order.id, status: order.status });
      }
      if (driverId && data.status !== 'delivered' && data.status !== 'cancelled') {
        sendToUser(driverId, 'driver', WSEvents.ORDER_ASSIGNED, { orderId: order.id, customerName: order.customerName });
      }
    } catch (e) { /* WS not available, fall back to polling */ }

    return NextResponse.json(bigIntToNumber(order));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

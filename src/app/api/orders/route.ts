import { logger } from "@/lib/logger";
import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateAny, hasRole } from "@/lib/auth";
import { orderSchema, orderPatchSchema, isValidOrderTransition, ORDER_TRANSITIONS, publicOrderSchema, detectForbiddenOrderFields } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch, parseStatusFilter } from "@/lib/pagination";
import { getRestaurantOrderingAvailability } from "@/lib/restaurant-availability";
import { getRestaurantId, extractSlug, resolveTenant, resolveTenantFromRequest } from "@/lib/tenant";
import { resolveTableQrToken, verifyTableBelongsToRestaurant } from "@/lib/table-qr";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { createOrderAtomically } from "@/lib/order-service";

// GET: Role-based order listing (Mission 4 — Phase 3)
//   - customer: only their own orders (by customerId, NEVER by customerName)
//   - driver: only orders assigned to them (driverId) or proposed (proposedToDriverId)
//   - kitchen: minimal view (status, items, table) — no customer PII
//   - admin/manager/cashier/etc.: all orders in their restaurant
//   - platform_admin: 403 here (use /api/platform/... endpoints)
export async function GET(request: Request) {
  try {
    await dbReady;
    const auth = await authenticateAny(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Platform admins must use their own endpoints
    if (auth.type === "platform_admin") {
      return NextResponse.json(
        { error: "Les administrateurs de plateforme doivent utiliser /api/platform/orders", code: "USE_PLATFORM_ENDPOINT" },
        { status: 403 }
      );
    }

    const sp = new URL(request.url).searchParams;
    const { page, limit } = parsePagination(sp);
    const { sortBy, sortOrder } = parseSorting(sp, ['createdAt', 'total', 'status', 'orderType'] as const, 'createdAt');
    const search = parseSearch(sp);
    const statusFilter = parseStatusFilter(sp, ['pending', 'confirmed', 'preparing', 'ready', 'picking_up', 'delivering', 'delivered', 'cancelled']);
    const orderTypeFilter = parseStatusFilter(sp, ['dine_in', 'takeaway', 'delivery'], 'orderType');
    const tableFilter = sp.get("tableNumber");

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

    // ── Mission 4: Customer — customerId ONLY, never customerName ──
    if (auth.type === "customer") {
      // Filter strictly by customerId — no customerName fallback (that was a security hole)
      const where = buildWhere({ customerId: auth.id });
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

    // ── Mission 4: Driver — only assigned or proposed orders ──
    if (auth.type === "driver") {
      const where = buildWhere({
        OR: [
          { driverId: auth.id },
          { proposedToDriverId: auth.id },
        ],
      });
      const [orders, total] = await Promise.all([
        db.order.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          select: {
            id: true, status: true, orderType: true, paymentStatus: true,
            total: true, deliveryAddress: true, deliveryFee: true,
            customerName: true, phone: true, tableNumber: true, tableNumberStr: true,
            createdAt: true, updatedAt: true,
            driverId: true, assignmentStatus: true, proposedAt: true,
            estimatedDeliveryTime: true, deliveryLat: true, deliveryLng: true,
          },
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

    // ── Mission 4: Kitchen — minimal view (no customer PII) ──
    if (auth.type === "admin" && auth.role === "kitchen") {
      const where = buildWhere({
        status: { in: ['confirmed', 'preparing', 'ready'] },
      });
      const [orders, total] = await Promise.all([
        db.order.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          select: {
            id: true, status: true, orderType: true, items: true,
            tableNumber: true, tableNumberStr: true, note: true,
            createdAt: true, updatedAt: true,
          },
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

    // ── Admin/manager/cashier/etc.: all orders in their restaurant ──
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
      // QR resolution must not bypass SaaS lifecycle enforcement. Resolve the
      // QR's restaurant slug through the central active/trial tenant gate.
      const tenant = await resolveTenant(resolved.restaurantSlug);
      if (!tenant || tenant.restaurantId !== resolved.restaurantId) {
        return NextResponse.json(
          { error: "Restaurant indisponible", code: "TENANT_UNAVAILABLE" },
          { status: 404 }
        );
      }
      restaurantId = tenant.restaurantId;
      tableId = resolved.tableId;
      tableNumberStr = resolved.tableNumber;
    } else {
      const tenant = await resolveTenantFromRequest(request);
      restaurantId = tenant?.restaurantId || null;
    }

    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant non trouve", code: "RESTAURANT_NOT_FOUND" }, { status: 404 });
    }

    // Preserve the existing business rule (opening-hours gate for dine-in and
    // takeaway) but use the tenant's actual RestaurantConfig instead of the
    // global KFM 11h-23h fallback.
    if (body.orderType === "dine_in" || body.orderType === "takeaway") {
      const availability = await getRestaurantOrderingAvailability(restaurantId);
      if (!availability.open) {
        return NextResponse.json(
          { error: "Le restaurant est actuellement ferme.", code: "RESTAURANT_CLOSED" },
          { status: 400 }
        );
      }
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
      }
    );

    if (!result.success || !result.order) {
      return NextResponse.json(
        { error: result.error || "Erreur de creation de commande", code: result.code || "ORDER_CREATE_FAILED" },
        { status: result.status }
      );
    }

    const order = result.order as { id: string; customerName: string; orderType: string; status: string; tableNumber?: number; total: unknown; items: unknown };

    // ── Mission 3: Skip side-effects on idempotent replay ──
    // When created === false, the order already existed (replay of the same
    // idempotency key with the same payload). We must NOT:
    //   - re-send the confirmation email
    //   - re-broadcast the WebSocket "new order" notification
    //   - re-decrement stock (would double-deduct)
    //   - re-create an audit log entry
    const isNewlyCreated = result.created !== false;

    if (isNewlyCreated) {
      // Audit table-order creation
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

      // WebSocket: notify admin of new order
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

      // Email notification to restaurant admins (non-blocking)
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

      // Decrement stock for ordered items (non-blocking)
      try {
        const { decrementStockForOrder } = await import("@/lib/stock-manager");
        const orderedItems = JSON.parse(
          typeof order.items === "string" ? order.items : JSON.stringify(order.items)
        ) as { name: string; qty: number }[];
        decrementStockForOrder(order.id, restaurantId, orderedItems);
      } catch { /* stock decrement failed */ }
    }

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
    const existingOrder = await db.order.findFirst({
      where: { id, restaurantId: admin.restaurantId },
      select: { id: true, driverId: true, total: true, deliveryFee: true, status: true },
    });
    if (!existingOrder) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    }

    const requestedStatus = data.status;
    const statusChanged = Boolean(requestedStatus && requestedStatus !== existingOrder.status);

    // ── State machine: validate status transition ──────────────
    if (statusChanged && requestedStatus) {
      if (!isValidOrderTransition(existingOrder.status, requestedStatus)) {
        return NextResponse.json(
          {
            error: `Transition invalide: ${existingOrder.status} → ${requestedStatus}. Transitions autorisées depuis "${existingOrder.status}": ${ORDER_TRANSITIONS[existingOrder.status]?.join(', ') || 'aucune (statut terminal)'}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate cross-tenant references BEFORE writing them to the order.
    let validatedDriver: { id: string; commissionRate: number } | null = null;
    if (driverId) {
      validatedDriver = await db.driver.findFirst({
        where: { id: driverId, restaurantId: admin.restaurantId },
        select: { id: true, commissionRate: true },
      });
      if (!validatedDriver) {
        return NextResponse.json(
          { error: "Livreur introuvable pour ce restaurant", code: "DRIVER_TENANT_MISMATCH" },
          { status: 400 }
        );
      }
    }

    if (data.customerId) {
      const customer = await db.customer.findFirst({
        where: { id: data.customerId, restaurantId: admin.restaurantId },
        select: { id: true },
      });
      if (!customer) {
        return NextResponse.json(
          { error: "Client introuvable pour ce restaurant", code: "CUSTOMER_TENANT_MISMATCH" },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = { ...data };
    if (driverId !== undefined) updateData.driverId = driverId || null;

    let order;

    if (statusChanged && requestedStatus) {
      // Atomic compare-and-set: only one concurrent request can win a given
      // transition. This prevents duplicate financial/stock/loyalty effects
      // when two workers process `delivering -> delivered` at the same time.
      const transition = await db.order.updateMany({
        where: {
          id,
          restaurantId: admin.restaurantId,
          status: existingOrder.status,
        },
        data: updateData,
      });

      if (transition.count === 0) {
        const current = await db.order.findFirst({
          where: { id, restaurantId: admin.restaurantId },
        });
        if (!current) {
          return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
        }
        // Idempotent replay: another request already completed exactly the
        // requested transition. Return current state WITHOUT side effects.
        if (current.status === requestedStatus) {
          return NextResponse.json(bigIntToNumber(current));
        }
        return NextResponse.json(
          { error: "La commande a été modifiée simultanément. Rechargez puis réessayez.", code: "ORDER_CONCURRENT_UPDATE" },
          { status: 409 }
        );
      }

      order = await db.order.findFirst({ where: { id, restaurantId: admin.restaurantId } });
      if (!order) {
        return NextResponse.json({ error: "Commande introuvable après mise à jour" }, { status: 404 });
      }
    } else {
      order = await db.order.update({ where: { id }, data: updateData });
    }

    const becameDelivered = statusChanged && requestedStatus === "delivered";
    const becameCancelled = statusChanged && requestedStatus === "cancelled";
    const isTerminalTransition = becameDelivered || becameCancelled;
    const effectiveDriverId = driverId !== undefined ? (driverId || null) : existingOrder.driverId;

    // If the assignment changed, release the previous driver first.
    if (driverId !== undefined && existingOrder.driverId && existingOrder.driverId !== driverId) {
      await db.driver.updateMany({
        where: { id: existingOrder.driverId, restaurantId: admin.restaurantId },
        data: { status: "available" },
      });
    }

    // Mark a newly assigned driver busy only for a non-terminal order.
    if (driverId && validatedDriver && !isTerminalTransition) {
      await db.driver.update({ where: { id: driverId }, data: { status: "busy" } });
    }

    // Terminal driver effects happen ONCE because the status CAS above has a
    // single winner. Cancellation does not count as a completed delivery.
    if (isTerminalTransition && effectiveDriverId) {
      const driver = await db.driver.findFirst({
        where: { id: effectiveDriverId, restaurantId: admin.restaurantId },
        select: { id: true, commissionRate: true },
      });
      if (driver) {
        const orderTotal = Number(existingOrder.total);
        const orderDeliveryFee = Number(existingOrder.deliveryFee);
        const commissionRate = Number(driver.commissionRate);
        const computedEarning = Math.max(
          Math.round(orderTotal * (commissionRate / 100)),
          orderDeliveryFee
        );

        await db.driver.update({
          where: { id: effectiveDriverId },
          data: {
            status: "available",
            ...(becameDelivered ? {
              totalDeliveries: { increment: 1 },
              totalEarnings: { increment: computedEarning },
            } : {}),
          },
        });

        if (becameDelivered) {
          await db.order.update({ where: { id }, data: { driverEarning: computedEarning } });
        }
      }
    }

    // ── Restore stock on cancellation — transition-only, never on replay ──
    if (becameCancelled) {
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
          await restoreStockForOrder(id, admin.restaurantId, orderedItems);
        }
      } catch { /* stock restore failed — non-blocking */ }
    }

    // ── Award loyalty points + update customer stats on delivery ONCE ──
    if (becameDelivered) {
      try {
        const fullOrder = await db.order.findUnique({
          where: { id },
          select: { id: true, customerId: true, total: true, restaurantId: true },
        });

        if (fullOrder?.customerId) {
          const restaurant = await db.restaurant.findUnique({
            where: { id: fullOrder.restaurantId },
            select: { loyaltyPointsRate: true },
          });
          const rate = restaurant?.loyaltyPointsRate ?? 1;
          const orderTotal = Number(fullOrder.total);
          const pointsEarned = Math.floor(orderTotal / 1000) * rate;

          if (pointsEarned > 0) {
            await db.customer.update({
              where: { id: fullOrder.customerId },
              data: {
                loyaltyPoints: { increment: pointsEarned },
                totalOrders: { increment: 1 },
                totalSpent: { increment: fullOrder.total },
              },
            });

            await db.loyaltyPointsHistory.create({
              data: {
                customerId: fullOrder.customerId,
                referenceId: fullOrder.id,
                points: pointsEarned,
                type: "earned",
                description: `Commande #${fullOrder.id.slice(-8).toUpperCase()}`,
              },
            }).catch(() => {});
          } else {
            await db.customer.update({
              where: { id: fullOrder.customerId },
              data: {
                totalOrders: { increment: 1 },
                totalSpent: { increment: fullOrder.total },
              },
            });
          }

          try {
            const { updateCustomerTier } = await import("@/lib/loyalty-tiers");
            const newTier = await updateCustomerTier(fullOrder.customerId, fullOrder.restaurantId);
            if (newTier) {
              logger.debug(`[orders] Customer ${fullOrder.customerId} promoted to tier: ${newTier}`);
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

    // ── Auto-generate invoice on delivery ONCE ──
    if (becameDelivered) {
      try {
        const { autoGenerateInvoice } = await import('@/lib/invoice-utils');
        await autoGenerateInvoice(id, admin.restaurantId, admin.id, request);
      } catch { /* invoice generation failed — non-blocking */ }
    }

    // WebSocket: broadcast the resulting order state.
    try {
      const { broadcastToType, sendToUser } = await import('@/lib/websocket-server');
      const { WSEvents } = await import('@/lib/ws-events');
      broadcastToType('admin', WSEvents.ORDER_STATUS_CHANGED, { orderId: order.id, status: order.status, customerName: order.customerName });
      broadcastToType('customer', WSEvents.TRACKING_UPDATE, { orderId: order.id, status: order.status });
      if (order.driverId) {
        sendToUser(order.driverId, 'driver', WSEvents.ORDER_STATUS_CHANGED, { orderId: order.id, status: order.status });
      }
      if (driverId && !isTerminalTransition) {
        sendToUser(driverId, 'driver', WSEvents.ORDER_ASSIGNED, { orderId: order.id, customerName: order.customerName });
      }
    } catch (e) { /* WS not available, fall back to polling */ }

    return NextResponse.json(bigIntToNumber(order));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

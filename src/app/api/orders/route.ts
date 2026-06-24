import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateAny, hasRole } from "@/lib/auth";
import { orderSchema, orderPatchSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch, parseStatusFilter } from "@/lib/pagination";
import { isRestaurantOpen } from "@/lib/constants";
import { getRestaurantId } from "@/lib/tenant";

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
    const statusFilter = parseStatusFilter(sp, ['pending', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled']);
    const orderTypeFilter = parseStatusFilter(sp, ['dine_in', 'takeaway', 'delivery'], 'orderType');

    // Use restaurantId from authenticated user (all auth types include it)
    const restaurantId = auth.restaurantId || await getRestaurantId(request);
    if (!restaurantId) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });

    // Build base where clause with filters
    const buildWhere = (extraFilter: Record<string, unknown> = {}) => ({
      restaurantId,
      ...(statusFilter && { status: statusFilter }),
      ...(orderTypeFilter && { orderType: orderTypeFilter }),
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
        data: orders,
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
      data: orders,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Public (for new orders from public site) or authenticated
export async function POST(request: Request) {
  try {
    await dbReady;
    const body = await request.json();
    const validation = orderSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    // Check if restaurant is open (for dine-in and takeaway, not delivery which can be pre-ordered)
    // Admin/Manager can bypass this check by passing adminOverride: true
    const authResult = await authenticateAdmin(request).catch(() => null);
    const isAdminOverride = body.adminOverride === true && authResult;
    if ((body.orderType === 'dine_in' || body.orderType === 'takeaway') && !isRestaurantOpen() && !isAdminOverride) {
      return NextResponse.json({ error: 'Le restaurant est actuellement fermé. Nos heures d\'ouverture sont de 11h à 23h.' }, { status: 400 });
    }

    const restaurantId = await getRestaurantId(request);
    if (!restaurantId) return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });

    // Server-side price verification
    // Accept both `qty` and `quantity` for backward compatibility
    const orderedItems = JSON.parse(body.items || "[]") as { name: string; price: number; qty?: number; quantity?: number; note?: string }[];
    const menuItemsFromDB = await db.menuItem.findMany({ where: { available: true, restaurantId } });

    let recalculatedTotal = 0;
    const verifiedItems = orderedItems.map(item => {
      const itemQty = item.qty ?? item.quantity ?? 1;
      const dbItem = menuItemsFromDB.find(m => m.name === item.name);
      if (dbItem) {
        // Use the DB price, not the client-sent price
        recalculatedTotal += dbItem.price * itemQty;
        return { ...item, qty: itemQty, price: dbItem.price };
      }
      // If item not found in DB, keep client price but flag it
      recalculatedTotal += (item.price || 0) * itemQty;
      return { ...item, qty: itemQty };
    });

    // Add delivery fee if applicable
    if (body.orderType === 'delivery') {
      const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId } });
      recalculatedTotal += body.deliveryFee || restaurant?.deliveryFee || 0;
    }

    // Subtract discount
    recalculatedTotal = Math.max(0, recalculatedTotal - (body.discount || 0));

    // Use the recalculated total (trust server calculation over client)
    const verifiedTotal = recalculatedTotal;

    // Try to attach customerId if authenticated as customer
    let customerId: string | undefined = validation.data.customerId;
    try {
      const auth = await authenticateAny(request);
      if (auth?.type === "customer") {
        customerId = auth.id;
      }
    } catch { /* not authenticated – walk-in order */ }

    const order = await db.order.create({
      data: {
        ...validation.data,
        items: JSON.stringify(verifiedItems),
        total: verifiedTotal,
        restaurantId,
        ...(customerId && { customerId }),
      },
    });

    // WebSocket: notify admin of new order
    try {
      const { broadcastToType } = await import('@/lib/websocket-server');
      const { WSEvents } = await import('@/lib/ws-events');
      broadcastToType('admin', WSEvents.ORDER_NEW, { orderId: order.id, customerName: order.customerName, orderType: order.orderType, status: order.status });
    } catch (e) { /* WS not available, fall back to polling */ }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error(error);
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

    const updateData: Record<string, unknown> = { ...data };
    if (driverId !== undefined) updateData.driverId = driverId || null;
    const order = await db.order.update({ where: { id }, data: updateData });
    // Update driver status if assigned
    if (driverId) {
      await db.driver.update({ where: { id: driverId }, data: { status: "busy" } });
    }
    // If order delivered or cancelled, free up driver + credit driver earnings on delivery
    if (data.status === "delivered" || data.status === "cancelled") {
      const existingOrder = await db.order.findUnique({ where: { id } });
      if (existingOrder?.driverId) {
        const driver = await db.driver.findUnique({ where: { id: existingOrder.driverId } });
        await db.driver.update({
          where: { id: existingOrder.driverId },
          data: {
            status: "available",
            totalDeliveries: { increment: 1 },
            // Credit earnings on delivery: commission % of order total (or delivery fee, whichever is higher)
            ...(data.status === "delivered" && driver ? {
              totalEarnings: { increment: Math.max(
                Math.round(existingOrder.total * (driver.commissionRate / 100)),
                existingOrder.deliveryFee
              ) },
            } : {}),
          },
        });
        // Persist the earning on the order for history
        if (data.status === "delivered" && driver) {
          const earning = Math.max(
            Math.round(existingOrder.total * (driver.commissionRate / 100)),
            existingOrder.deliveryFee
          );
          await db.order.update({ where: { id }, data: { driverEarning: earning } });
        }
      }
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

    return NextResponse.json(order);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

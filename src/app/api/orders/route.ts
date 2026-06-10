import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateAny, hasRole } from "@/lib/auth";
import { orderSchema, orderPatchSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch, parseStatusFilter } from "@/lib/pagination";
import { isRestaurantOpen } from "@/lib/constants";

// GET: Admin auth required OR customer auth (customers only see their own orders)
export async function GET(request: Request) {
  try {
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

    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });

    // Build base where clause with filters
    const buildWhere = (extraFilter: Record<string, unknown> = {}) => ({
      restaurantId: restaurant.id,
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

    // If customer, filter by customer name (server-side filtering)
    if (auth.type === "customer") {
      const customer = await db.customer.findUnique({ where: { id: auth.id } });
      if (!customer) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });

      const where = buildWhere({ customerName: customer.name });
      const [orders, total] = await Promise.all([
        db.order.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          include: { driver: true },
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
        include: { driver: true },
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
    const body = await request.json();
    const validation = orderSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    // Check if restaurant is open (for dine-in and takeaway, not delivery which can be pre-ordered)
    if ((body.orderType === 'dine_in' || body.orderType === 'takeaway') && !isRestaurantOpen()) {
      return NextResponse.json({ error: 'Le restaurant est actuellement fermé. Nos heures d\'ouverture sont de 11h à 23h.' }, { status: 400 });
    }

    const restaurant = await db.restaurant.findFirst();
    if (!restaurant) return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });

    // Server-side price verification
    const orderedItems = JSON.parse(body.items || "[]") as { name: string; price: number; qty: number; note?: string }[];
    const menuItemsFromDB = await db.menuItem.findMany({ where: { available: true } });

    let recalculatedTotal = 0;
    const verifiedItems = orderedItems.map(item => {
      const dbItem = menuItemsFromDB.find(m => m.name === item.name);
      if (dbItem) {
        // Use the DB price, not the client-sent price
        recalculatedTotal += dbItem.price * item.qty;
        return { ...item, price: dbItem.price };
      }
      // If item not found in DB, keep client price but flag it
      recalculatedTotal += item.price * item.qty;
      return item;
    });

    // Add delivery fee if applicable
    if (body.orderType === 'delivery') {
      recalculatedTotal += body.deliveryFee || restaurant?.deliveryFee || 0;
    }

    // Subtract discount
    recalculatedTotal = Math.max(0, recalculatedTotal - (body.discount || 0));

    // Use the recalculated total (trust server calculation over client)
    const verifiedTotal = recalculatedTotal;

    const order = await db.order.create({
      data: {
        ...validation.data,
        items: JSON.stringify(verifiedItems),
        total: verifiedTotal,
        restaurantId: restaurant.id,
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
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager", "staff"])) {
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
    // If order delivered or cancelled, free up driver
    if (data.status === "delivered" || data.status === "cancelled") {
      const existingOrder = await db.order.findUnique({ where: { id } });
      if (existingOrder?.driverId) {
        await db.driver.update({ where: { id: existingOrder.driverId }, data: { status: "available" } });
        await db.driver.update({ where: { id: existingOrder.driverId }, data: { totalDeliveries: { increment: 1 } } });
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

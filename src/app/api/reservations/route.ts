import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateAny, hasRole } from "@/lib/auth";
import { getRestaurantId } from "@/lib/tenant";
import { reservationSchema, reservationPatchSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch, parseStatusFilter } from "@/lib/pagination";

// GET: Admin auth OR customer auth (customers only see their own)
export async function GET(request: Request) {
  try {
    const auth = await authenticateAny(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const sp = new URL(request.url).searchParams;
    const { page, limit } = parsePagination(sp);
    const { sortBy, sortOrder } = parseSorting(sp, ['createdAt', 'date', 'time', 'guests', 'status'] as const, 'createdAt');
    const search = parseSearch(sp);
    const statusFilter = parseStatusFilter(sp, ['pending', 'confirmed', 'cancelled', 'completed']);

    // Resolve tenant: prefer authenticated user's restaurantId, fallback to request-based resolution
    const restaurantId = auth.restaurantId || await getRestaurantId(request);
    if (!restaurantId) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });

    const buildWhere = (extraFilter: Record<string, unknown> = {}) => ({
      restaurantId,
      ...(statusFilter && { status: statusFilter }),
      ...(search && {
        OR: [
          { customerName: { contains: search } },
          { phone: { contains: search } },
          { notes: { contains: search } },
        ],
      }),
      ...extraFilter,
    });

    // If customer, filter by customerId (prefer FK) with fallback to customerName
    if (auth.type === "customer") {
      const customer = await db.customer.findUnique({ where: { id: auth.id } });
      if (!customer) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });

      const where = buildWhere({ OR: [{ customerId: customer.id }, { customerName: customer.name, customerId: null }] });
      const [reservations, total] = await Promise.all([
        db.reservation.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          include: { customer: { select: { id: true, name: true, email: true } } },
          skip: prismaSkip(page, limit),
          take: prismaTake(limit),
        }),
        db.reservation.count({ where }),
      ]);
      const totalPages = Math.ceil(total / limit);
      return NextResponse.json({
        data: reservations,
        pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
      });
    }

    // Admin: see all reservations with filters
    const where = buildWhere();
    const [reservations, total] = await Promise.all([
      db.reservation.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        include: { customer: { select: { id: true, name: true, email: true } } },
        skip: prismaSkip(page, limit),
        take: prismaTake(limit),
      }),
      db.reservation.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: reservations,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Public (reservation form)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = reservationSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    // Resolve tenant from request (public endpoint)
    const restaurantId = await getRestaurantId(request);
    if (!restaurantId) return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });

    // Try to attach customerId if authenticated as customer
    let customerId: string | undefined = validation.data.customerId;
    try {
      const auth = await authenticateAny(request);
      if (auth?.type === "customer") {
        customerId = auth.id;
      }
    } catch { /* not authenticated */ }

    const reservation = await db.reservation.create({
      data: {
        customerName: validation.data.customerName,
        phone: validation.data.phone ?? "",
        date: validation.data.date,
        time: validation.data.time,
        guests: validation.data.guests ?? 2,
        zone: validation.data.zone ?? "interieur",
        notes: validation.data.notes ?? "",
        status: validation.data.status ?? "pending",
        restaurantId,
        ...(customerId && { customerId }),
      },
    });

    // WebSocket: notify admin of new reservation
    try {
      const { broadcastToType } = await import('@/lib/websocket-server');
      const { WSEvents } = await import('@/lib/ws-events');
      broadcastToType('admin', WSEvents.RESERVATION_NEW, { reservationId: reservation.id, customerName: reservation.customerName, date: reservation.date, time: reservation.time });
    } catch (e) { /* WS not available, fall back to polling */ }

    return NextResponse.json(reservation, { status: 201 });
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
    const validation = reservationPatchSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { id, ...rawData } = validation.data;
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    // Build update data with only provided fields
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawData)) {
      if (value !== undefined) updateData[key] = value;
    }

    const reservation = await db.reservation.update({
      where: { id },
      data: updateData,
    });

    // WebSocket: notify admin of reservation status change
    try {
      const { broadcastToType } = await import('@/lib/websocket-server');
      const { WSEvents } = await import('@/lib/ws-events');
      if (updateData.status) {
        broadcastToType('admin', WSEvents.RESERVATION_STATUS_CHANGED, { reservationId: reservation.id, status: reservation.status, customerName: reservation.customerName });
      }
    } catch (e) { /* WS not available, fall back to polling */ }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

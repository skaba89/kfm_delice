import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateDriver } from "@/lib/auth";
import { parsePagination, prismaSkip, prismaTake } from "@/lib/pagination";
import { driverOrderPatchSchema } from "@/lib/validations";
import { applyOrderPatchAtomically } from "@/lib/order-transition-service";

const DRIVER_TRANSITIONS = new Set(["picking_up", "delivering", "delivered"]);
const OPEN_ASSIGNMENT_STATES = ["none", "rejected", "expired"];

// GET /api/driver-orders — Get orders assigned to the logged-in driver plus
// genuinely unassigned ready deliveries. Orders already proposed to another
// driver are intentionally excluded from the shared pool.
export async function GET(request: Request) {
  try {
    await dbReady;
    const driverAuth = await authenticateDriver(request);
    if (!driverAuth) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { page, limit } = parsePagination(new URL(request.url).searchParams);
    const restaurantId = driverAuth.restaurantId;
    if (!restaurantId) {
      return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } });
    }

    const where = {
      restaurantId,
      orderType: "delivery" as const,
      OR: [
        { driverId: driverAuth.id },
        {
          status: "ready",
          driverId: null,
          assignmentStatus: { in: OPEN_ASSIGNMENT_STATES },
        },
      ],
    };

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
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
    console.error("[driver-orders:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/driver-orders — Driver progresses an assigned delivery or claims
// an unassigned READY delivery. All state/terminal financial effects go through
// the same atomic service as admin order transitions.
export async function PATCH(request: Request) {
  try {
    await dbReady;
    const driverAuth = await authenticateDriver(request);
    if (!driverAuth) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const validation = driverOrderPatchSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { orderId, status, lat, lng } = validation.data;
    if (status && !DRIVER_TRANSITIONS.has(status)) {
      return NextResponse.json(
        { error: "Transition livreur non autorisée", code: "DRIVER_ORDER_STATUS_FORBIDDEN" },
        { status: 403 }
      );
    }
    if ((lat === undefined) !== (lng === undefined)) {
      return NextResponse.json({ error: "Latitude et longitude doivent être fournies ensemble" }, { status: 400 });
    }
    if (!status && lat === undefined) {
      return NextResponse.json({ error: "Aucune modification demandée" }, { status: 400 });
    }

    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId: driverAuth.restaurantId, orderType: "delivery" },
      select: { id: true, driverId: true, status: true, assignmentStatus: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Commande non trouvée" }, { status: 404 });
    }

    const isAssignedToSelf = order.driverId === driverAuth.id;
    const isOpenUnassigned =
      order.driverId === null &&
      order.status === "ready" &&
      OPEN_ASSIGNMENT_STATES.includes(order.assignmentStatus);

    if (!isAssignedToSelf && !isOpenUnassigned) {
      return NextResponse.json(
        { error: "Commande non assignée à ce livreur", code: "DRIVER_ORDER_OWNERSHIP_REQUIRED" },
        { status: 403 }
      );
    }

    // A free/unassigned delivery may only be claimed by entering picking_up.
    // It cannot jump straight to delivering/delivered.
    if (isOpenUnassigned && status !== "picking_up") {
      return NextResponse.json(
        { error: "Une commande libre doit d'abord être récupérée", code: "DRIVER_ORDER_CLAIM_REQUIRED" },
        { status: 409 }
      );
    }

    let responseOrder: unknown = order;
    if (status) {
      const result = await applyOrderPatchAtomically(
        {
          id: orderId,
          status,
          ...(isOpenUnassigned ? { driverId: driverAuth.id } : {}),
        },
        {
          restaurantId: driverAuth.restaurantId,
          actorId: driverAuth.id,
          // Reuse the delivery-scoped field policy; authentication and
          // ownership were already established above for the driver itself.
          actorRole: "delivery_manager",
        }
      );

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, code: result.code },
          { status: result.status }
        );
      }
      responseOrder = result.order;
    }

    if (lat !== undefined && lng !== undefined) {
      const located = await db.order.updateMany({
        where: { id: orderId, restaurantId: driverAuth.restaurantId, driverId: driverAuth.id },
        data: { driverLat: lat, driverLng: lng },
      });
      if (located.count !== 1) {
        return NextResponse.json(
          { error: "La commande n'est plus assignée à ce livreur", code: "DRIVER_ORDER_ASSIGNMENT_CHANGED" },
          { status: 409 }
        );
      }
      await db.driver.updateMany({
        where: { id: driverAuth.id, restaurantId: driverAuth.restaurantId },
        data: { lat, lng, lastLocationUpdate: new Date() },
      });
      const refreshed = await db.order.findFirst({
        where: { id: orderId, restaurantId: driverAuth.restaurantId },
      });
      if (refreshed) responseOrder = refreshed;
    }

    return NextResponse.json(bigIntToNumber(responseOrder));
  } catch (error) {
    console.error("[driver-orders:PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

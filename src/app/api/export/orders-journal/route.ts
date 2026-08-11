import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { commercialFeatureGate } from "@/lib/commercial-feature-gate";
import { generateOrderJournalPDF } from "@/lib/pdf-order-journal";

/**
 * GET /api/export/orders-journal?date=2026-07-13
 * Generates a PDF journal of all orders for a given day.
 */
export async function GET(request: Request) {
  try {
    await dbReady;

    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager", "cashier", "accountant"])) {
      return NextResponse.json(
        { error: "Accès refusé — rôle insuffisant pour l'export du journal" },
        { status: 403 }
      );
    }
    const featureDenied = await commercialFeatureGate(admin.restaurantId, 'exports');
    if (featureDenied) return featureDenied;

    const sp = new URL(request.url).searchParams;
    const dateStr = sp.get("date");

    let targetDate: Date;
    let startOfDay: Date;
    let endOfDay: Date;
    if (dateStr) {
      targetDate = new Date(dateStr + "T00:00:00");
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json(
          { error: "Date invalide. Format attendu: YYYY-MM-DD" },
          { status: 400 }
        );
      }
      startOfDay = new Date(targetDate);
      endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
    } else {
      targetDate = new Date();
      startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
    }

    const orders = await db.order.findMany({
      where: {
        restaurantId: admin.restaurantId,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { createdAt: "asc" },
    });

    const restaurant = await db.restaurant.findUnique({
      where: { id: admin.restaurantId },
      select: {
        name: true,
        address: true,
        phone: true,
        email: true,
        currency: true,
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant introuvable" }, { status: 404 });
    }

    const safeOrders = bigIntToNumber(orders) as Array<{
      id: string;
      customerName: string;
      phone: string;
      items: string;
      total: number;
      status: string;
      orderType: string;
      paymentMethod: string;
      paymentStatus: string;
      tableNumber: number;
      tableNumberStr?: string;
      deliveryAddress: string;
      note: string;
      createdAt: string | Date;
    }>;

    const pdfBuffer = await generateOrderJournalPDF(
      safeOrders,
      {
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
        email: restaurant.email,
        currency: restaurant.currency || "GNF",
      },
      targetDate
    );

    const dateSlug = targetDate.toISOString().slice(0, 10);
    const filename = `journal-commandes-${dateSlug}.pdf`;
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[export/orders-journal]", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du PDF" },
      { status: 500 }
    );
  }
}

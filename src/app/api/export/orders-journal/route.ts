import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { generateOrderJournalPDF } from "@/lib/pdf-order-journal";

/**
 * GET /api/export/orders-journal?date=2026-07-13
 *
 * Generates a PDF journal of all orders for a given day.
 * Accessible by admin, manager, cashier, accountant (roles that
 * need end-of-day reconciliation).
 *
 * Query params:
 *   date: ISO date string (YYYY-MM-DD). Defaults to today.
 *
 * Returns: application/pdf (Buffer)
 */
export async function GET(request: Request) {
  try {
    await dbReady;

    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (
      !hasRole(admin.role, ["admin", "manager", "cashier", "accountant"])
    ) {
      return NextResponse.json(
        { error: "Accès refusé — rôle insuffisant pour l'export du journal" },
        { status: 403 }
      );
    }

    const sp = new URL(request.url).searchParams;
    const dateStr = sp.get("date");

    // Parse the date (defaults to today in the server's timezone)
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

    // Fetch all orders for the day belonging to the admin's restaurant
    const orders = await db.order.findMany({
      where: {
        restaurantId: admin.restaurantId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Fetch restaurant info
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
      return NextResponse.json(
        { error: "Restaurant introuvable" },
        { status: 404 }
      );
    }

    // Convert BigInt fields to numbers (PostgreSQL returns BigInt for
    // monetary fields; SQLite returns number — bigIntToNumber handles both)
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

    // Generate the PDF
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

    // Return as PDF download
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

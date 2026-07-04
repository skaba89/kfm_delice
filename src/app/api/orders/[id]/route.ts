import { NextResponse } from "next/server";
import { db, bigIntToNumber } from "@/lib/db";
import { generateReceiptPDF } from "@/lib/pdf-receipt";
import { authenticateAdmin } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const order = await db.order.findUnique({ where: { id }, include: { driver: true } });
    if (!order) {
      return NextResponse.json({ error: "Commande non trouvée" }, { status: 404 });
    }

    // Check if PDF format requested
    const url = new URL(request.url);
    const format = url.searchParams.get("format");

    if (format === "pdf") {
      // Auth required for PDF download
      const admin = await authenticateAdmin(request);
      if (!admin) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      }

      // ── Multi-tenant isolation ────────────────────────────────
      // Verify the order belongs to the admin's restaurant before
      // generating a PDF receipt. Prevents cross-tenant PDF leakage.
      if (order.restaurantId !== admin.restaurantId) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      const restaurant = await db.restaurant.findUnique({ where: { id: admin.restaurantId } });
      if (!restaurant) {
        return NextResponse.json({ error: "Restaurant non configuré" }, { status: 500 });
      }

      const pdfBuffer = await generateReceiptPDF(
        {
          id: order.id,
          customerName: order.customerName,
          phone: order.phone || undefined,
          // Convert Json (PostgreSQL) or String (SQLite) to string for PDF.
          // generateReceiptPDF expects a JSON string, not a parsed object.
          items: typeof order.items === 'string' ? order.items : JSON.stringify(order.items),
          // Number() wraps BigInt fields (PostgreSQL) for PDF rendering.
          // pdfkit's text() can't handle BigInt directly.
          total: Number(order.total),
          discount: Number(order.discount),
          tax: Number(order.tax),
          status: order.status,
          orderType: order.orderType,
          paymentMethod: order.paymentMethod,
          tableNumber: order.tableNumber || undefined,
          deliveryAddress: order.deliveryAddress || undefined,
          note: order.note || undefined,
          createdAt: order.createdAt,
        },
        {
          name: restaurant.name,
          address: restaurant.address,
          phone: restaurant.phone,
          email: restaurant.email,
          tagline: restaurant.tagline || undefined,
        }
      );

      const orderNum = order.id.slice(-6).toUpperCase();
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="recu-${orderNum}.pdf"`,
        },
      });
    }

    // Default: return order as JSON
    // bigIntToNumber wraps BigInt fields (total, deliveryFee, discount, tax,
    // driverEarning, driver.commissionRate, driver.totalEarnings) for JSON
    // serialization. On SQLite these are already number (no-op).
    return NextResponse.json(bigIntToNumber(order));
  } catch (error) {
    console.error("[orders/[id]] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

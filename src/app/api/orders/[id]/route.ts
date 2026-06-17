import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRestaurantId } from "@/lib/tenant";
import { generateReceiptPDF } from "@/lib/pdf-receipt";
import { authenticateAdmin, hasRole } from "@/lib/auth";

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

      const rid = await getRestaurantId(request);
      if (!rid) {
        return NextResponse.json({ error: "Restaurant non configuré" }, { status: 500 });
      }

      const restaurant = await db.restaurant.findUnique({ where: { id: rid } });
      if (!restaurant) {
        return NextResponse.json({ error: "Restaurant non configuré" }, { status: 500 });
      }

      const pdfBuffer = await generateReceiptPDF(
        {
          id: order.id,
          customerName: order.customerName,
          phone: order.phone || undefined,
          items: order.items,
          total: order.total,
          discount: order.discount,
          tax: order.tax,
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
    return NextResponse.json(order);
  } catch (error) {
    console.error("[orders/[id]] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

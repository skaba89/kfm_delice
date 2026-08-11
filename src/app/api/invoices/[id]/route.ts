import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { commercialFeatureGate } from "@/lib/commercial-feature-gate";
import { generateInvoicePDF } from "@/lib/pdf-invoice";

/**
 * GET /api/invoices/[id] — invoice JSON or PDF (?format=pdf)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "cashier", "accountant"])) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }
    const featureGate = await commercialFeatureGate(admin.restaurantId, 'invoices');
    if (featureGate) return featureGate;

    const { id } = await params;
    const invoice = await db.invoice.findFirst({ where: { id, restaurantId: admin.restaurantId } });
    if (!invoice) return NextResponse.json({ error: "Facture non trouvee" }, { status: 404 });

    const restaurant = await db.restaurant.findUnique({ where: { id: admin.restaurantId } });
    if (!restaurant) return NextResponse.json({ error: "Restaurant non trouve" }, { status: 404 });

    const url = new URL(request.url);
    if (url.searchParams.get("format") === "pdf") {
      let orderTip = 0;
      if (invoice.orderId) {
        const linkedOrder = await db.order.findFirst({
          where: { id: invoice.orderId, restaurantId: admin.restaurantId },
          select: { tip: true },
        });
        if (linkedOrder) orderTip = Number(linkedOrder.tip);
      }

      const pdfBuffer = await generateInvoicePDF(
        {
          ...invoice,
          items: typeof invoice.items === 'string' ? invoice.items : JSON.stringify(invoice.items),
          subtotal: Number(invoice.subtotal),
          tax: Number(invoice.tax),
          total: Number(invoice.total),
          tip: orderTip,
        },
        {
          name: restaurant.name,
          address: restaurant.address,
          phone: restaurant.phone,
          email: restaurant.email,
          tagline: restaurant.tagline || undefined,
        }
      );

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="facture-${invoice.number}.pdf"`,
          "Content-Length": String(pdfBuffer.length),
        },
      });
    }

    return NextResponse.json(bigIntToNumber(invoice));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

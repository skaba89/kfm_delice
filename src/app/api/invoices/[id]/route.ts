import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { generateInvoicePDF } from "@/lib/pdf-invoice";

/**
 * GET /api/invoices/[id]/pdf — Download invoice as PDF
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager", "cashier", "accountant"])) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id } = await params;
    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return NextResponse.json({ error: "Facture non trouvee" }, { status: 404 });
    }

    // ── Multi-tenant isolation ──────────────────────────────────
    if (invoice.restaurantId !== admin.restaurantId) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const restaurant = await db.restaurant.findUnique({ where: { id: admin.restaurantId } });
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant non trouve" }, { status: 404 });
    }

    // Check if this is a PDF request (via ?format=pdf)
    const url = new URL(request.url);
    if (url.searchParams.get("format") === "pdf") {
      // ── Mission P2.5: fetch the tip from the linked order (if any) ──
      // The Invoice model doesn't have a tip column (tips live on Order),
      // so we look up the linked order to display the tip on the PDF.
      let orderTip = 0;
      if (invoice.orderId) {
        try {
          const linkedOrder = await db.order.findFirst({
            where: { id: invoice.orderId, restaurantId: admin.restaurantId },
            select: { tip: true },
          });
          if (linkedOrder) {
            orderTip = Number(linkedOrder.tip);
          }
        } catch {
          /* tip column may not exist yet on legacy DBs — non-blocking */
        }
      }

      // Convert BigInt fields to Number and Json to string for PDF rendering.
      // pdfkit + generateInvoicePDF expect number/string, not bigint/Json.
      const pdfBuffer = await generateInvoicePDF(
        {
          ...invoice,
          items: typeof invoice.items === 'string' ? invoice.items : JSON.stringify(invoice.items),
          subtotal: Number(invoice.subtotal),
          tax: Number(invoice.tax),
          total: Number(invoice.total),
          tip: orderTip, // Mission P2.5: pourboire from linked order
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

    // Default: return invoice data as JSON (with BigInt converted to Number)
    return NextResponse.json(bigIntToNumber(invoice));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

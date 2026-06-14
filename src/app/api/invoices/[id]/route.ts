import { db, getRestaurantId } from "@/lib/db";
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
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id } = await params;
    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return NextResponse.json({ error: "Facture non trouvee" }, { status: 404 });
    }

    const rid = await getRestaurantId();
    if (!rid) {
      return NextResponse.json({ error: "Restaurant non trouve" }, { status: 404 });
    }

    const restaurant = await db.restaurant.findUnique({ where: { id: rid } });
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant non trouve" }, { status: 404 });
    }

    // Check if this is a PDF request (via ?format=pdf)
    const url = new URL(request.url);
    if (url.searchParams.get("format") === "pdf") {
      const pdfBuffer = await generateInvoicePDF(invoice, {
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
        email: restaurant.email,
        tagline: restaurant.tagline || undefined,
      });

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="facture-${invoice.number}.pdf"`,
          "Content-Length": String(pdfBuffer.length),
        },
      });
    }

    // Default: return invoice data as JSON
    return NextResponse.json(invoice);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

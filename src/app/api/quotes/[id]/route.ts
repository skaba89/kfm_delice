import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { generateQuotePDF } from "@/lib/pdf-quote";

/**
 * GET /api/quotes/[id] — Quote detail + PDF download
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
    if (!hasRole(admin.role, ["admin", "manager", "accountant"])) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id } = await params;
    const quote = await db.quote.findUnique({ where: { id } });
    if (!quote) {
      return NextResponse.json({ error: "Devis non trouve" }, { status: 404 });
    }

    // ── Multi-tenant isolation ──────────────────────────────────
    if (quote.restaurantId !== admin.restaurantId) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const restaurant = await db.restaurant.findUnique({ where: { id: admin.restaurantId } });
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant non trouve" }, { status: 404 });
    }

    // Check if this is a PDF request (via ?format=pdf)
    const url = new URL(request.url);
    if (url.searchParams.get("format") === "pdf") {
      // Convert BigInt fields to Number and Json to string for PDF rendering.
      const pdfBuffer = await generateQuotePDF(
        {
          ...quote,
          items: typeof quote.items === 'string' ? quote.items : JSON.stringify(quote.items),
          subtotal: Number(quote.subtotal),
          discount: Number(quote.discount),
          total: Number(quote.total),
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
          "Content-Disposition": `inline; filename="devis-${quote.number}.pdf"`,
          "Content-Length": String(pdfBuffer.length),
        },
      });
    }

    // Default: return quote data as JSON
    return NextResponse.json(quote);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

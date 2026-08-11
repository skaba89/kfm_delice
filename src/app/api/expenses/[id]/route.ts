import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { commercialFeatureGate } from "@/lib/commercial-feature-gate";
import PDFDocument from "pdfkit";

function generateExpensePDF(expense: {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  paidBy: string;
  notes: string;
  createdAt: Date | string;
}, restaurant: {
  name: string;
  address: string;
  phone: string;
  email: string;
  tagline?: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Recu de depense EXP-${expense.id.slice(-6).toUpperCase()}`,
        Author: restaurant.name,
        Subject: `Depense - ${expense.description}`,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const ORANGE = "#f97316";
    const DARK = "#1f2937";
    const GRAY = "#6b7280";
    const fmt = (n: number) => n.toLocaleString("fr-FR") + " GNF";
    const categoryLabels: Record<string, string> = {
      ingredients: "Ingredients", utilities: "Services publics", rent: "Loyer",
      salary: "Salaires", equipment: "Equipement", transport: "Transport", other: "Autre",
    };

    doc.rect(0, 0, doc.page.width, 100).fill(ORANGE);
    doc.fontSize(24).font("Helvetica-Bold").fillColor("#ffffff").text(restaurant.name, 50, 30);
    if (restaurant.tagline) doc.fontSize(10).font("Helvetica").fillColor("#ffffff").text(restaurant.tagline, 50, 58);
    doc.fontSize(8).font("Helvetica").fillColor("#ffffff")
      .text(restaurant.address, 350, 30, { width: 200, align: "right" })
      .text(restaurant.phone, 350, 44, { width: 200, align: "right" })
      .text(restaurant.email, 350, 58, { width: 200, align: "right" });

    let y = 120;
    doc.fontSize(20).font("Helvetica-Bold").fillColor(DARK).text("RECU DE DEPENSE", 50, y);
    doc.fontSize(12).font("Helvetica-Bold").fillColor(DARK).text(`EXP-${expense.id.slice(-6).toUpperCase()}`, 50, y + 28);
    y += 70;
    doc.rect(50, y, 495, 140).fill("#fef3c7");
    doc.fontSize(10).font("Helvetica-Bold").fillColor(DARK);
    const createdDate = new Date(expense.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const expenseDate = new Date(expense.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    doc.text("Description:", 60, y + 15);
    doc.font("Helvetica").fillColor(GRAY).text(expense.description, 200, y + 15);
    doc.font("Helvetica-Bold").fillColor(DARK).text("Montant:", 60, y + 35);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#dc2626").text(fmt(expense.amount), 200, y + 33);
    doc.fontSize(10);
    doc.font("Helvetica-Bold").fillColor(DARK).text("Categorie:", 60, y + 57);
    doc.font("Helvetica").fillColor(GRAY).text(categoryLabels[expense.category] || expense.category, 200, y + 57);
    doc.font("Helvetica-Bold").fillColor(DARK).text("Date:", 60, y + 77);
    doc.font("Helvetica").fillColor(GRAY).text(expenseDate, 200, y + 77);
    doc.font("Helvetica-Bold").fillColor(DARK).text("Paye par:", 60, y + 97);
    doc.font("Helvetica").fillColor(GRAY).text(expense.paidBy || "-", 200, y + 97);
    doc.font("Helvetica-Bold").fillColor(DARK).text("Enregistre le:", 60, y + 117);
    doc.font("Helvetica").fillColor(GRAY).text(createdDate, 200, y + 117);
    y += 160;
    if (expense.notes) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor(GRAY).text("Notes:", 50, y);
      doc.font("Helvetica").text(expense.notes, 50, y + 14, { width: 495 });
      y += 40;
    }
    y += 30;
    doc.moveTo(50, y).lineTo(220, y).strokeColor(GRAY).lineWidth(0.5).stroke();
    doc.moveTo(350, y).lineTo(520, y).strokeColor(GRAY).lineWidth(0.5).stroke();
    y += 8;
    doc.fontSize(8).font("Helvetica").fillColor(GRAY);
    doc.text("Signature du beneficiaire", 50, y, { width: 170, align: "center" });
    doc.text("Visa du responsable", 350, y, { width: 170, align: "center" });
    doc.rect(0, 760, doc.page.width, 82).fill(ORANGE);
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff").text(restaurant.name, 50, 772);
    doc.fontSize(8).font("Helvetica").fillColor("#ffffff")
      .text(`${restaurant.address} | ${restaurant.phone} | ${restaurant.email}`, 50, 788);
    doc.fontSize(7).fillColor("#ffffff").text("Document interne — KFM Delice", 50, 808);
    doc.end();
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "accountant"])) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }
    const featureGate = await commercialFeatureGate(admin.restaurantId, 'expenses');
    if (featureGate) return featureGate;

    const { id } = await params;
    const expense = await db.expense.findFirst({ where: { id, restaurantId: admin.restaurantId } });
    if (!expense) return NextResponse.json({ error: "Depense non trouvee" }, { status: 404 });

    const restaurant = await db.restaurant.findUnique({ where: { id: admin.restaurantId } });
    if (!restaurant) return NextResponse.json({ error: "Restaurant non trouve" }, { status: 404 });

    const url = new URL(request.url);
    if (url.searchParams.get("format") === "pdf") {
      const pdfBuffer = await generateExpensePDF(
        { ...expense, amount: Number(expense.amount) },
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
          "Content-Disposition": `inline; filename="depense-EXP-${expense.id.slice(-6).toUpperCase()}.pdf"`,
          "Content-Length": String(pdfBuffer.length),
        },
      });
    }

    return NextResponse.json(expense);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

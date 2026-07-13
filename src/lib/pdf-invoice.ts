import PDFDocument from "pdfkit";
import { parseJsonField } from "./parse-json";

/**
 * Generates a professional invoice PDF for KFM Delice
 * Returns a Buffer containing the PDF data
 */
export async function generateInvoicePDF(invoice: {
  number: string;
  customerName: string;
  customerPhone?: string;
  items: string; // JSON string
  subtotal: number;
  tax: number;
  total: number;
  tip?: number; // Mission P2.5: pourboire (optional, default 0)
  status: string;
  dueDate?: string;
  notes?: string;
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
        Title: `Facture ${invoice.number}`,
        Author: restaurant.name,
        Subject: `Facture ${invoice.number} - ${invoice.customerName}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ─── Colors ───
    const ORANGE = "#f97316";
    const DARK = "#1f2937";
    const GRAY = "#6b7280";
    const LIGHT_BG = "#fef3c7";

    // ─── Helper: format price ───
    const fmt = (n: number) => n.toLocaleString("fr-FR") + " GNF";

    // ─── Header: Restaurant branding ───
    // Orange header band
    doc.rect(0, 0, doc.page.width, 100).fill(ORANGE);

    doc.fontSize(24).font("Helvetica-Bold")
      .fillColor("#ffffff")
      .text(restaurant.name, 50, 30);

    if (restaurant.tagline) {
      doc.fontSize(10).font("Helvetica")
        .fillColor("#ffffff")
        .text(restaurant.tagline, 50, 58);
    }

    // Restaurant info on right side of header
    doc.fontSize(8).font("Helvetica")
      .fillColor("#ffffff")
      .text(restaurant.address, 350, 30, { width: 200, align: "right" })
      .text(restaurant.phone, 350, 44, { width: 200, align: "right" })
      .text(restaurant.email, 350, 58, { width: 200, align: "right" });

    // ─── Invoice title & status ───
    let y = 120;
    doc.fontSize(20).font("Helvetica-Bold")
      .fillColor(DARK)
      .text("FACTURE", 50, y);

    doc.fontSize(12).font("Helvetica-Bold")
      .fillColor(DARK)
      .text(invoice.number, 50, y + 28);

    // Status badge
    const statusLabels: Record<string, string> = {
      pending: "EN ATTENTE", paid: "PAYEE", cancelled: "ANNULEE", overdue: "EN RETARD",
    };
    const statusColors: Record<string, string> = {
      pending: "#f59e0b", paid: "#22c55e", cancelled: "#ef4444", overdue: "#ef4444",
    };
    const statusText = statusLabels[invoice.status] || invoice.status.toUpperCase();
    const statusColor = statusColors[invoice.status] || GRAY;

    const statusWidth = doc.widthOfString(statusText) + 20;
    doc.roundedRect(450, y, statusWidth, 24, 4).fill(statusColor);
    doc.fontSize(10).font("Helvetica-Bold")
      .fillColor("#ffffff")
      .text(statusText, 455, y + 7);

    y += 60;

    // ─── Invoice details ───
    const createdDate = new Date(invoice.createdAt).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
    });

    doc.fontSize(10).font("Helvetica").fillColor(GRAY);
    doc.text(`Date d'emission: ${createdDate}`, 50, y);
    if (invoice.dueDate) {
      doc.text(`Date d'echeance: ${new Date(invoice.dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`, 50, y + 16);
    }

    // Customer info on right
    doc.fontSize(10).font("Helvetica-Bold").fillColor(DARK);
    doc.text("Facturer a:", 350, y);
    doc.font("Helvetica").fillColor(GRAY);
    doc.text(invoice.customerName, 350, y + 16);
    if (invoice.customerPhone) {
      doc.text(invoice.customerPhone, 350, y + 30);
    }

    y += 60;

    // ─── Items table ───
    // Table header
    doc.rect(50, y, 495, 28).fill(ORANGE);
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
    doc.text("Description", 58, y + 9, { width: 200 });
    doc.text("Qte", 310, y + 9, { width: 50, align: "center" });
    doc.text("Prix unitaire", 365, y + 9, { width: 90, align: "right" });
    doc.text("Total", 465, y + 9, { width: 80, align: "right" });

    y += 28;

    // Parse line items
    let lineItems: { description: string; qty: number; unitPrice: number; total: number }[] = [];
    try {
      lineItems = parseJsonField(invoice.items, []) as typeof lineItems;
    } catch { /* empty */ }

    // Table rows
    if (lineItems.length > 0) {
      lineItems.forEach((item, i) => {
        // Alternate row background
        if (i % 2 === 0) {
          doc.rect(50, y, 495, 24).fill("#fffbeb");
        }

        doc.fontSize(9).font("Helvetica").fillColor(DARK);
        doc.text(item.description, 58, y + 7, { width: 200 });
        doc.text(String(item.qty), 310, y + 7, { width: 50, align: "center" });
        doc.text(fmt(item.unitPrice), 365, y + 7, { width: 90, align: "right" });
        doc.text(fmt(item.total), 465, y + 7, { width: 80, align: "right" });
        y += 24;
      });
    } else {
      doc.fontSize(9).font("Helvetica").fillColor(GRAY);
      doc.text("(Aucun article detaille)", 58, y + 7);
      y += 24;
    }

    // Table bottom border
    doc.moveTo(50, y).lineTo(545, y).strokeColor(ORANGE).lineWidth(1).stroke();

    y += 15;

    // ─── Totals ───
    const totalsX = 350;
    doc.fontSize(10).font("Helvetica").fillColor(GRAY);
    doc.text("Sous-total", totalsX, y);
    doc.text(fmt(invoice.subtotal), 465, y, { width: 80, align: "right" });
    y += 20;

    doc.text("Taxe", totalsX, y);
    doc.text(fmt(invoice.tax), 465, y, { width: 80, align: "right" });
    y += 20;

    // ── Mission P2.5: Tip line (only shown if tip > 0) ──
    const tipAmount = Number(invoice.tip || 0);
    if (tipAmount > 0) {
      doc.fillColor(GRAY);
      doc.text("Pourboire", totalsX, y);
      doc.text(fmt(tipAmount), 465, y, { width: 80, align: "right" });
      y += 20;
    }

    // Total with accent
    doc.rect(totalsX - 5, y - 3, 195, 26).fill(LIGHT_BG);
    doc.fontSize(12).font("Helvetica-Bold").fillColor(DARK);
    doc.text("TOTAL", totalsX, y + 3);
    doc.text(fmt(invoice.total), 465, y + 3, { width: 80, align: "right" });
    y += 40;

    // ─── Notes ───
    if (invoice.notes) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor(GRAY);
      doc.text("Notes:", 50, y);
      doc.font("Helvetica").text(invoice.notes, 50, y + 14, { width: 495 });
      y += 40;
    }

    // ─── Payment info footer ───
    y = Math.max(y + 20, 620);
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 12;

    doc.fontSize(8).font("Helvetica").fillColor(GRAY);
    doc.text("Mode de paiement accepte: Especes, Orange Money, MTN Money, Carte bancaire", 50, y);
    y += 14;
    doc.text("Tout retard de paiement entrainera des penalites de 2% par mois de retard.", 50, y);
    y += 14;

    // ─── Bottom footer band ───
    doc.rect(0, 760, doc.page.width, 82).fill(ORANGE);
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff")
      .text(restaurant.name, 50, 772);
    doc.fontSize(8).font("Helvetica").fillColor("#ffffff")
      .text(`${restaurant.address} | ${restaurant.phone} | ${restaurant.email}`, 50, 788);
    doc.fontSize(7).fillColor("#ffffff")
      .text("Merci pour votre confiance. L'Art du Gout Guineen.", 50, 808);

    doc.end();
  });
}

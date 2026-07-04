import PDFDocument from "pdfkit";
import { parseJsonField } from "./parse-json";

/**
 * Generates a professional quote PDF for KFM Delice
 * Returns a Buffer containing the PDF data
 */
export async function generateQuotePDF(quote: {
  number: string;
  customerName: string;
  customerPhone?: string;
  items: string; // JSON string
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  validUntil?: string;
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
        Title: `Devis ${quote.number}`,
        Author: restaurant.name,
        Subject: `Devis ${quote.number} - ${quote.customerName}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Colors
    const ORANGE = "#f97316";
    const DARK = "#1f2937";
    const GRAY = "#6b7280";
    const LIGHT_BG = "#fef3c7";

    // Helper: format price
    const fmt = (n: number) => n.toLocaleString("fr-FR") + " GNF";

    // Header: Restaurant branding
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

    // Quote title & status
    let y = 120;
    doc.fontSize(20).font("Helvetica-Bold")
      .fillColor(DARK)
      .text("DEVIS", 50, y);

    doc.fontSize(12).font("Helvetica-Bold")
      .fillColor(DARK)
      .text(quote.number, 50, y + 28);

    // Status badge
    const statusLabels: Record<string, string> = {
      draft: "BOUILLON", sent: "ENVOYE", accepted: "ACCEPTE", refused: "REFUSE", expired: "EXPIRE",
    };
    const statusColors: Record<string, string> = {
      draft: "#6b7280", sent: "#3b82f6", accepted: "#22c55e", refused: "#ef4444", expired: "#f59e0b",
    };
    const statusText = statusLabels[quote.status] || quote.status.toUpperCase();
    const statusColor = statusColors[quote.status] || GRAY;

    const statusWidth = doc.widthOfString(statusText) + 20;
    doc.roundedRect(450, y, statusWidth, 24, 4).fill(statusColor);
    doc.fontSize(10).font("Helvetica-Bold")
      .fillColor("#ffffff")
      .text(statusText, 455, y + 7);

    y += 60;

    // Quote details
    const createdDate = new Date(quote.createdAt).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
    });

    doc.fontSize(10).font("Helvetica").fillColor(GRAY);
    doc.text(`Date d'emission: ${createdDate}`, 50, y);
    if (quote.validUntil) {
      doc.text(`Valide jusqu'au: ${new Date(quote.validUntil).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`, 50, y + 16);
    }

    // Customer info on right
    doc.fontSize(10).font("Helvetica-Bold").fillColor(DARK);
    doc.text("Client:", 350, y);
    doc.font("Helvetica").fillColor(GRAY);
    doc.text(quote.customerName, 350, y + 16);
    if (quote.customerPhone) {
      doc.text(quote.customerPhone, 350, y + 30);
    }

    y += 60;

    // Items table
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
      lineItems = parseJsonField(quote.items, []) as typeof lineItems;
    } catch { /* empty */ }

    // Table rows
    if (lineItems.length > 0) {
      lineItems.forEach((item, i) => {
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

    // Totals
    const totalsX = 350;
    doc.fontSize(10).font("Helvetica").fillColor(GRAY);
    doc.text("Sous-total", totalsX, y);
    doc.text(fmt(quote.subtotal), 465, y, { width: 80, align: "right" });
    y += 20;

    if (quote.discount > 0) {
      doc.fillColor("#22c55e");
      doc.text("Remise", totalsX, y);
      doc.text(`-${fmt(quote.discount)}`, 465, y, { width: 80, align: "right" });
      y += 20;
    }

    // Total with accent
    doc.rect(totalsX - 5, y - 3, 195, 26).fill(LIGHT_BG);
    doc.fontSize(12).font("Helvetica-Bold").fillColor(DARK);
    doc.text("TOTAL", totalsX, y + 3);
    doc.text(fmt(quote.total), 465, y + 3, { width: 80, align: "right" });
    y += 40;

    // Notes
    if (quote.notes) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor(GRAY);
      doc.text("Notes:", 50, y);
      doc.font("Helvetica").text(quote.notes, 50, y + 14, { width: 495 });
      y += 40;
    }

    // Validity notice
    y = Math.max(y + 20, 560);
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 12;

    doc.fontSize(8).font("Helvetica").fillColor(GRAY);
    if (quote.validUntil) {
      doc.text(`Ce devis est valable jusqu'au ${new Date(quote.validUntil).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}.`, 50, y);
      y += 14;
    }
    doc.text("Acceptation du devis : Veuillez nous retourner ce document signe avec la mention \"Bon pour accord\".", 50, y);
    y += 14;

    // Signature areas
    y += 20;
    doc.moveTo(50, y).lineTo(220, y).strokeColor(GRAY).lineWidth(0.5).stroke();
    doc.moveTo(350, y).lineTo(520, y).strokeColor(GRAY).lineWidth(0.5).stroke();
    y += 8;
    doc.fontSize(8).font("Helvetica").fillColor(GRAY);
    doc.text("Signature du client", 50, y, { width: 170, align: "center" });
    doc.text("Cachet et signature", 350, y, { width: 170, align: "center" });

    // Bottom footer band
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

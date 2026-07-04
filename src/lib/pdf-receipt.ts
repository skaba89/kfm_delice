import PDFDocument from "pdfkit";
import { parseJsonField } from "./parse-json";

/**
 * Generates a professional receipt PDF for KFM Delice orders
 * Returns a Buffer containing the PDF data
 */
export async function generateReceiptPDF(order: {
  id: string;
  customerName: string;
  phone?: string;
  items: string; // JSON string
  total: number;
  discount?: number;
  tax?: number;
  status: string;
  orderType: string;
  paymentMethod: string;
  tableNumber?: number;
  deliveryAddress?: string;
  note?: string;
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
      size: [226.77, 600], // ~80mm width receipt (thermal printer style)
      margins: { top: 15, bottom: 15, left: 12, right: 12 },
      info: {
        Title: `Recu ${order.id.slice(-6).toUpperCase()}`,
        Author: restaurant.name,
        Subject: `Recu commande - ${order.customerName}`,
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
    const W = 226.77 - 24; // usable width (after margins)

    // ─── Helper: format price ───
    const fmt = (n: number) => n.toLocaleString("fr-FR") + " GNF";

    // ─── Center text helper ───
    const centerText = (text: string, y: number, opts?: { font?: string; size?: number; color?: string }) => {
      doc.font(opts?.font || "Helvetica").fontSize(opts?.size || 9).fillColor(opts?.color || DARK);
      doc.text(text, 12, y, { width: W, align: "center" });
    };

    // ─── Dashed line ───
    const dashedLine = (y: number) => {
      doc.moveTo(12, y).lineTo(12 + W, y).dash(3, { space: 2 }).strokeColor("#d1d5db").lineWidth(0.5).stroke();
      doc.undash();
    };

    // ─── Header: Restaurant branding ───
    let y = 15;
    doc.rect(0, 0, 226.77, 50).fill(ORANGE);

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#ffffff");
    doc.text(restaurant.name, 12, 12, { width: W, align: "center" });

    if (restaurant.tagline) {
      doc.fontSize(7).font("Helvetica").fillColor("#ffffff");
      doc.text(restaurant.tagline, 12, 30, { width: W, align: "center" });
    }

    y = 58;

    // ─── Receipt title ───
    centerText("RECU DE COMMANDE", y, { font: "Helvetica-Bold", size: 11 });
    y += 16;

    // ─── Order info ───
    const orderDate = new Date(order.createdAt).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    const orderNum = order.id.slice(-6).toUpperCase();

    const orderTypeLabels: Record<string, string> = { dine_in: "Sur place", takeaway: "A emporter", delivery: "Livraison" };
    const paymentLabels: Record<string, string> = { cash: "Especes", orange_money: "Orange Money", mtn_money: "MTN Money", card: "Carte" };

    doc.fontSize(8).font("Helvetica").fillColor(GRAY);
    doc.text(`N°: ${orderNum}`, 12, y, { width: W });
    y += 12;
    doc.text(`Date: ${orderDate}`, 12, y, { width: W });
    y += 12;
    doc.text(`Type: ${orderTypeLabels[order.orderType] || order.orderType}`, 12, y, { width: W });
    y += 12;
    doc.text(`Paiement: ${paymentLabels[order.paymentMethod] || order.paymentMethod}`, 12, y, { width: W });
    y += 12;

    if (order.tableNumber && order.tableNumber > 0) {
      doc.text(`Table: N° ${order.tableNumber}`, 12, y, { width: W });
      y += 12;
    }

    doc.text(`Client: ${order.customerName || "Client"}`, 12, y, { width: W });
    y += 12;

    if (order.phone) {
      doc.text(`Tel: ${order.phone}`, 12, y, { width: W });
      y += 12;
    }

    if (order.deliveryAddress) {
      doc.text(`Adresse: ${order.deliveryAddress}`, 12, y, { width: W });
      y += 12;
    }

    y += 4;
    dashedLine(y);
    y += 8;

    // ─── Items ───
    centerText("ARTICLES", y, { font: "Helvetica-Bold", size: 9 });
    y += 14;

    let items: { name: string; price: number; qty: number; note?: string }[] = [];
    // parseJsonField handles both SQLite (String) and PostgreSQL (Json)
    items = parseJsonField(order.items, []) as typeof items;

    let subtotal = 0;
    for (const item of items) {
      const lineTotal = item.price * item.qty;
      subtotal += lineTotal;

      // Item name + qty
      doc.fontSize(8).font("Helvetica-Bold").fillColor(DARK);
      doc.text(item.name, 12, y, { width: W - 8 });
      y += 11;

      doc.fontSize(8).font("Helvetica").fillColor(GRAY);
      doc.text(`  ${item.qty} x ${fmt(item.price)}`, 12, y, { width: W - 30 });
      doc.font("Helvetica-Bold").fillColor(DARK);
      doc.text(fmt(lineTotal), 12, y, { width: W, align: "right" });
      y += 12;
    }

    y += 2;
    dashedLine(y);
    y += 8;

    // ─── Totals ───
    const discount = order.discount || 0;
    const tax = order.tax || 0;

    doc.fontSize(8).font("Helvetica").fillColor(GRAY);
    doc.text("Sous-total", 12, y);
    doc.text(fmt(subtotal), 12, y, { width: W, align: "right" });
    y += 13;

    if (discount > 0) {
      doc.fillColor("#22c55e");
      doc.text("Remise", 12, y);
      doc.text(`-${fmt(discount)}`, 12, y, { width: W, align: "right" });
      y += 13;
    }

    if (tax > 0) {
      doc.fillColor(GRAY);
      doc.text("Taxe", 12, y);
      doc.text(fmt(tax), 12, y, { width: W, align: "right" });
      y += 13;
    }

    y += 2;
    // Total with accent
    doc.rect(12, y - 2, W, 18).fill("#fef3c7");
    doc.fontSize(11).font("Helvetica-Bold").fillColor(DARK);
    doc.text("TOTAL", 16, y + 1);
    doc.text(fmt(order.total), 12, y + 1, { width: W, align: "right" });
    y += 24;

    // ─── Note ───
    if (order.note) {
      dashedLine(y);
      y += 6;
      doc.fontSize(7).font("Helvetica-Bold").fillColor(GRAY);
      doc.text("Note:", 12, y, { width: W });
      y += 10;
      doc.font("Helvetica").text(order.note, 12, y, { width: W });
      y += 14;
    }

    // ─── Footer ───
    y = Math.max(y + 8, 450);
    dashedLine(y);
    y += 8;

    centerText("Merci de votre visite !", y, { font: "Helvetica-Bold", size: 9 });
    y += 13;
    centerText(restaurant.name, y, { font: "Helvetica", size: 7, color: GRAY });
    y += 10;
    centerText(restaurant.address, y, { font: "Helvetica", size: 6, color: GRAY });
    y += 9;
    centerText(restaurant.phone, y, { font: "Helvetica", size: 6, color: GRAY });

    // Bottom orange stripe
    doc.rect(0, 580, 226.77, 20).fill(ORANGE);
    doc.fontSize(6).font("Helvetica").fillColor("#ffffff");
    doc.text(restaurant.tagline || "", 12, 585, { width: W, align: "center" });

    doc.end();
  });
}

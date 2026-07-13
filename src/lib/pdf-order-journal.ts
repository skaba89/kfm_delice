import PDFDocument from "pdfkit";
import { parseJsonField } from "./parse-json";

// ────────────────────────────────────────────────────────────────
// Workaround: PDFKit uses `__dirname + '/data/Helvetica.afm'` to
// locate its font metric files, but Next.js/Turbopack rewrites
// `__dirname` to `/ROOT` (or similar) which breaks the path.
//
// Solution: intercept `fs.readFileSync` for the broken path pattern
// and redirect to the real pdfkit data directory. This is a runtime
// patch applied once per process.
// ────────────────────────────────────────────────────────────────
import path from "path";
import fs from "fs";

let _pdfkitPatched = false;
function patchPdfkitFontPaths(): void {
  if (_pdfkitPatched) return;
  _pdfkitPatched = true;

  // Find the real pdfkit data directory
  const candidates = [
    path.join(process.cwd(), "node_modules", "pdfkit", "js", "data"),
    path.join(process.cwd(), "..", "node_modules", "pdfkit", "js", "data"),
    path.resolve(process.cwd(), "node_modules/pdfkit/js/data"),
  ];
  const realDataDir = candidates.find((c) => {
    try {
      return fs.existsSync(path.join(c, "Helvetica.afm"));
    } catch {
      return false;
    }
  });
  if (!realDataDir) return; // can't patch — let PDFKit fail with its own error

  // Monkey-patch fs.readFileSync to redirect broken pdfkit paths
  const originalReadFileSync = fs.readFileSync;
  (fs as unknown as { readFileSync: typeof fs.readFileSync }).readFileSync = function patchedReadFileSync(
    filePath: fs.PathOrFileDescriptor,
    options?: fs.ObjectEncodingOptions & { flag?: string } | BufferEncoding | null
  ) {
    const fp = typeof filePath === "string" ? filePath : String(filePath);
    // Match patterns like:
    //   /ROOT/node_modules/pdfkit/js/data/Helvetica.afm
    //   /some/broken/path/node_modules/pdfkit/js/data/Helvetica.afm
    const match = fp.match(/node_modules[\/\\]pdfkit[\/\\]js[\/\\]data[\/\\]([^/\\]+\.afm)$/);
    if (match) {
      const fontFile = match[1];
      const realPath = path.join(realDataDir, fontFile);
      if (fs.existsSync(realPath)) {
        return originalReadFileSync(realPath, options as BufferEncoding);
      }
    }
    return originalReadFileSync(filePath, options as BufferEncoding);
  } as typeof fs.readFileSync;
}

/**
 * Generates a daily order journal PDF for KFM Delice.
 *
 * Used by the admin dashboard's Orders tab to export all orders from a
 * given day as a printable PDF — useful for end-of-day reconciliation,
 * accounting, and audits.
 *
 * Output format (A4 portrait):
 *   - Header: restaurant name + "Journal des commandes" + date
 *   - Summary box: total orders, total revenue, breakdown by type
 *   - Table: one row per order
 *       N° | Heure | Client/Table | Type | Articles | Total | Statut | Paiement
 *   - Footer: generated at + page numbers
 */

interface OrderJournalEntry {
  id: string;
  customerName: string;
  phone: string;
  items: string; // JSON string of [{name, price, qty}]
  total: number;
  status: string;
  orderType: string; // dine_in, takeaway, delivery
  paymentMethod: string;
  paymentStatus: string;
  tableNumber: number;
  tableNumberStr?: string;
  deliveryAddress: string;
  note: string;
  createdAt: string | Date;
}

interface RestaurantInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  currency?: string;
}

export async function generateOrderJournalPDF(
  orders: OrderJournalEntry[],
  restaurant: RestaurantInfo,
  date: Date
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Apply the PDFKit font path patch (idempotent — no-op if already patched)
    patchPdfkitFontPaths();

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 50, left: 40, right: 40 },
      info: {
        Title: `Journal des commandes — ${date.toLocaleDateString("fr-FR")}`,
        Author: restaurant.name,
        Subject: `Journal du ${date.toLocaleDateString("fr-FR")}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ─── Colors ───
    const ORANGE = "#ea580c";
    const DARK = "#1f2937";
    const GRAY = "#6b7280";
    const LIGHT_BG = "#fff7ed";
    const BORDER = "#e5e7eb";

    const currency = restaurant.currency || "GNF";
    const fmt = (n: number) => `${Number(n).toLocaleString("fr-FR")} ${currency}`;

    // ─── Status labels (FR) ───
    const statusLabels: Record<string, string> = {
      pending: "En attente",
      confirmed: "Confirmée",
      preparing: "En préparation",
      ready: "Prête",
      picking_up: "Récupération",
      delivering: "En livraison",
      delivered: "Livrée",
      cancelled: "Annulée",
    };
    const orderTypeLabels: Record<string, string> = {
      dine_in: "Sur place",
      takeaway: "À emporter",
      delivery: "Livraison",
    };
    const paymentLabels: Record<string, string> = {
      cash: "Espèces",
      orange_money: "Orange Money",
      mtn_money: "MTN Money",
      wave: "Wave",
      card: "Carte",
    };

    // ─── Page width helpers ───
    const PAGE_WIDTH = 595.28; // A4 width in points
    const MARGIN = 40;
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

    // ─── Header ───
    doc
      .fillColor(ORANGE)
      .rect(0, 0, PAGE_WIDTH, 8)
      .fill();

    doc
      .fillColor(DARK)
      .fontSize(18)
      .font("Helvetica-Bold")
      .text(restaurant.name, MARGIN, 30);

    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor(GRAY)
      .text(restaurant.address, MARGIN, 52)
      .text(`${restaurant.phone}  ·  ${restaurant.email}`, MARGIN, 66);

    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor(DARK)
      .text("Journal des commandes", MARGIN, 90);

    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor(GRAY)
      .text(
        date.toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        MARGIN,
        108
      );

    // ─── Summary box ───
    const totalOrders = orders.length;
    const totalRevenue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + Number(o.total), 0);
    const dineInCount = orders.filter((o) => o.orderType === "dine_in").length;
    const takeawayCount = orders.filter((o) => o.orderType === "takeaway").length;
    const deliveryCount = orders.filter((o) => o.orderType === "delivery").length;
    const cancelledCount = orders.filter((o) => o.status === "cancelled").length;

    const summaryY = 130;
    doc
      .fillColor(LIGHT_BG)
      .rect(MARGIN, summaryY, CONTENT_WIDTH, 60)
      .fill();

    const colW = CONTENT_WIDTH / 4;
    const summaries = [
      { label: "Commandes", value: String(totalOrders), color: DARK },
      { label: "Chiffre du jour", value: fmt(totalRevenue), color: ORANGE },
      { label: "Sur place / Emporter", value: `${dineInCount} / ${takeawayCount}`, color: DARK },
      { label: "Livraison / Annulées", value: `${deliveryCount} / ${cancelledCount}`, color: DARK },
    ];
    summaries.forEach((s, i) => {
      const x = MARGIN + i * colW;
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor(GRAY)
        .text(s.label.toUpperCase(), x + 10, summaryY + 12, { width: colW - 20 });
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor(s.color)
        .text(s.value, x + 10, summaryY + 28, { width: colW - 20 });
    });

    // ─── Table header ───
    let y = summaryY + 80;
    const tableTop = y;

    // Column widths (must sum to CONTENT_WIDTH)
    const cols = [
      { key: "num", label: "N°", width: 55 },
      { key: "time", label: "Heure", width: 50 },
      { key: "client", label: "Client / Table", width: 120 },
      { key: "type", label: "Type", width: 60 },
      { key: "items", label: "Articles", width: 110 },
      { key: "total", label: "Total", width: 75 },
      { key: "status", label: "Statut", width: 85 },
    ];

    // Header row background
    doc
      .fillColor(DARK)
      .rect(MARGIN, y, CONTENT_WIDTH, 22)
      .fill();
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor("#ffffff");
    let x = MARGIN;
    for (const col of cols) {
      doc.text(col.label, x + 4, y + 7, { width: col.width - 8 });
      x += col.width;
    }
    y += 22;

    // ─── Table rows ───
    doc.font("Helvetica").fontSize(7.5);

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];

      // Page break if needed
      if (y > 780) {
        doc.addPage();
        y = 40;
        // Re-draw header on new page
        doc
          .fillColor(DARK)
          .rect(MARGIN, y, CONTENT_WIDTH, 22)
          .fill();
        doc
          .fontSize(8)
          .font("Helvetica-Bold")
          .fillColor("#ffffff");
        let hx = MARGIN;
        for (const col of cols) {
          doc.text(col.label, hx + 4, y + 7, { width: col.width - 8 });
          hx += col.width;
        }
        y += 22;
        doc.font("Helvetica").fontSize(7.5);
      }

      // Alternate row background
      if (i % 2 === 1) {
        doc
          .fillColor("#f9fafb")
          .rect(MARGIN, y, CONTENT_WIDTH, 28)
          .fill();
      }

      // Row content
      const time = new Date(order.createdAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const shortId = order.id.slice(-6).toUpperCase();
      const clientLabel =
        order.orderType === "dine_in"
          ? `Table ${order.tableNumberStr || order.tableNumber || "?"}`
          : order.customerName || "Client";
      const itemsList = parseJsonField(order.items, []) as Array<{ name: string; qty?: number }>;
      const itemsSummary = itemsList
        .slice(0, 2)
        .map((it) => `${it.qty || 1}× ${it.name.substring(0, 18)}`)
        .join(", ");
      const itemsExtra = itemsList.length > 2 ? ` +${itemsList.length - 2}` : "";
      const typeLabel = orderTypeLabels[order.orderType] || order.orderType;
      const statusLabel = statusLabels[order.status] || order.status;
      const totalLabel = fmt(Number(order.total));
      const isCancelled = order.status === "cancelled";

      // Draw cells
      x = MARGIN;
      const cells = [
        { text: `#${shortId}`, color: GRAY },
        { text: time, color: DARK },
        { text: clientLabel, color: DARK },
        { text: typeLabel, color: DARK },
        { text: itemsSummary + itemsExtra, color: DARK },
        { text: totalLabel, color: isCancelled ? GRAY : ORANGE },
        { text: statusLabel, color: isCancelled ? "#dc2626" : DARK },
      ];
      for (let c = 0; c < cells.length; c++) {
        doc
          .fillColor(cells[c].color)
          .font(isCancelled && c === 5 ? "Helvetica" : "Helvetica")
          .text(cells[c].text, x + 4, y + 5, {
            width: cols[c].width - 8,
            ellipsis: true,
          });
        x += cols[c].width;
      }

      y += 28;

      // Row separator
      doc
        .strokeColor(BORDER)
        .lineWidth(0.5)
        .moveTo(MARGIN, y)
        .lineTo(MARGIN + CONTENT_WIDTH, y)
        .stroke();
    }

    // ─── Footer ───
    const footerY = Math.max(y + 20, 800);
    if (footerY < 820) {
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor(GRAY)
        .text(
          `Généré le ${new Date().toLocaleString("fr-FR")} — ${totalOrders} commande(s) — ${restaurant.name}`,
          MARGIN,
          footerY,
          { align: "center", width: CONTENT_WIDTH }
        );
    }

    // ─── Page numbers ───
    const pageCount = doc.bufferedPageRange ? doc.bufferedPageRange() : { count: 1 };
    const range = doc.bufferedPageRange();
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p);
      doc
        .fontSize(7)
        .fillColor(GRAY)
        .text(
          `Page ${p + 1} / ${range.count}`,
          MARGIN,
          820,
          { align: "right", width: CONTENT_WIDTH }
        );
    }

    doc.end();
  });
}

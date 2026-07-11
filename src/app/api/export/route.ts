import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticatePlatformAdmin, hasRole } from "@/lib/auth";

/**
 * GET /api/export?type=orders|customers|invoices|menu|accounts
 *
 * Exports data as CSV. Admins can export their restaurant's data.
 * Platform admins can export accounts (SaaS-level).
 *
 * Query params:
 *   type: orders | customers | invoices | menu | accounts | reservations
 *   format: csv (default)
 *   from: ISO date (optional, for orders)
 *   to: ISO date (optional, for orders)
 */
export async function GET(request: Request) {
  try {
    await dbReady;

    const sp = new URL(request.url).searchParams;
    const type = sp.get("type") || "orders";
    const from = sp.get("from");
    const to = sp.get("to");

    // Try platform admin first, fall back to restaurant admin
    let platformAdmin = await authenticatePlatformAdmin(request).catch(() => null);
    let restaurantAdmin = null;
    if (!platformAdmin) {
      restaurantAdmin = await authenticateAdmin(request).catch(() => null);
      if (!restaurantAdmin) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      }
    }

    const restaurantId = restaurantAdmin?.restaurantId;
    let csv = "";
    let filename = "";

    switch (type) {
      case "orders": {
        if (!restaurantAdmin) {
          return NextResponse.json({ error: "Réservé aux admins restaurant" }, { status: 403 });
        }
        const where: Record<string, unknown> = { restaurantId };
        if (from || to) {
          where.createdAt = {};
          if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
          if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to);
        }
        const orders = await db.order.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 5000,
        });
        csv = toCSV(orders.map((o) => bigIntToNumber(o)), [
          "id", "customerName", "phone", "items", "total", "status",
          "orderType", "paymentMethod", "paymentStatus", "tableNumber",
          "createdAt",
        ]);
        filename = `commandes-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      case "customers": {
        if (!restaurantAdmin) {
          return NextResponse.json({ error: "Réservé aux admins restaurant" }, { status: 403 });
        }
        const customers = await db.customer.findMany({
          where: { restaurantId },
          orderBy: { createdAt: "desc" },
          take: 5000,
        });
        csv = toCSV(customers.map((c) => bigIntToNumber(c)), [
          "id", "name", "email", "phone", "address",
          "loyaltyPoints", "totalOrders", "totalSpent", "status", "createdAt",
        ]);
        filename = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      case "invoices": {
        if (!restaurantAdmin) {
          return NextResponse.json({ error: "Réservé aux admins restaurant" }, { status: 403 });
        }
        const invoices = await db.invoice.findMany({
          where: { restaurantId },
          orderBy: { createdAt: "desc" },
          take: 5000,
        });
        csv = toCSV(invoices.map((i) => bigIntToNumber(i)), [
          "id", "number", "customerName", "customerEmail",
          "subtotal", "tax", "total", "status", "issueDate", "dueDate",
        ]);
        filename = `factures-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      case "menu": {
        if (!restaurantAdmin) {
          return NextResponse.json({ error: "Réservé aux admins restaurant" }, { status: 403 });
        }
        const menu = await db.menuItem.findMany({
          where: { restaurantId },
          orderBy: { category: "asc" },
          take: 1000,
        });
        csv = toCSV(menu.map((m) => bigIntToNumber(m)), [
          "id", "name", "description", "price", "category",
          "badge", "popular", "available", "order",
        ]);
        filename = `menu-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      case "reservations": {
        if (!restaurantAdmin) {
          return NextResponse.json({ error: "Réservé aux admins restaurant" }, { status: 403 });
        }
        const reservations = await db.reservation.findMany({
          where: { restaurantId },
          orderBy: { createdAt: "desc" },
          take: 5000,
        });
        csv = toCSV(reservations.map((r) => bigIntToNumber(r)), [
          "id", "customerName", "phone", "date", "time",
          "guests", "zone", "status", "notes", "createdAt",
        ]);
        filename = `reservations-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      case "accounts": {
        if (!platformAdmin) {
          return NextResponse.json({ error: "Réservé aux platform admins" }, { status: 403 });
        }
        const accounts = await db.account.findMany({
          include: { _count: { select: { restaurants: true, admins: true } } },
          orderBy: { createdAt: "desc" },
        });
        csv = toCSV(accounts.map((a) => bigIntToNumber(a)), [
          "id", "name", "ownerName", "ownerEmail", "ownerPhone",
          "plan", "status", "maxRestaurants", "maxSecondaryRestaurants",
          "maxAdmins", "maxUsers", "createdAt",
        ]);
        filename = `comptes-saas-${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      default:
        return NextResponse.json({ error: "Type d'export invalide" }, { status: 400 });
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[export] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── CSV helper ─────────────────────────────────────────────────
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  // Replace newlines and quotes
  str = str.replace(/\r?\n/g, " ");
  if (str.includes(",") || str.includes('"') || str.includes(";")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(rows: unknown[], columns: string[]): string {
  const header = columns.join(",");
  const lines = rows.map((row) => {
    const r = (typeof row === "object" && row !== null ? row : {}) as Record<string, unknown>;
    return columns.map((col) => escapeCSV(r[col])).join(",");
  });
  return [header, ...lines].join("\n");
}

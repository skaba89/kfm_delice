import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";

// GET /api/email-campaigns — list customer segments for targeting
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Build customer segments
    const customers = await db.customer.findMany({
      where: { restaurantId: admin.restaurantId, status: "active" },
      select: { id: true, name: true, email: true, phone: true, totalOrders: true, totalSpent: true, tier: true, loyaltyPoints: true, birthday: true, createdAt: true },
    });

    const segments = {
      all: { count: customers.length, label: "Tous les clients", customers },
      newCustomers: {
        count: customers.filter(c => c.totalOrders === 0).length,
        label: "Nouveaux clients (0 commande)",
        customers: customers.filter(c => c.totalOrders === 0),
      },
      vip: {
        count: customers.filter(c => c.tier === "gold" || c.tier === "platinum").length,
        label: "VIP (Gold + Platine)",
        customers: customers.filter(c => c.tier === "gold" || c.tier === "platinum"),
      },
      inactive: {
        count: customers.filter(c => c.totalOrders > 0 && c.totalOrders < 3).length,
        label: "Inactifs (1-2 commandes)",
        customers: customers.filter(c => c.totalOrders > 0 && c.totalOrders < 3),
      },
      birthdayThisMonth: {
        count: customers.filter(c => {
          if (!c.birthday) return false;
          const month = new Date(c.birthday).getMonth();
          return month === new Date().getMonth();
        }).length,
        label: "Anniversaire ce mois",
        customers: customers.filter(c => {
          if (!c.birthday) return false;
          return new Date(c.birthday).getMonth() === new Date().getMonth();
        }),
      },
    };

    return NextResponse.json({ segments });
  } catch (error) {
    console.error("[email-campaigns:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/email-campaigns — send a campaign to a segment
// Body: { segment: "vip", subject: "...", message: "..." }
export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { segment, subject, message } = body as { segment?: string; subject?: string; message?: string };

    if (!segment || !subject || !message) {
      return NextResponse.json({ error: "segment, subject et message requis" }, { status: 400 });
    }

    // Build the segment query
    const where: Record<string, unknown> = { restaurantId: admin.restaurantId, status: "active" };
    switch (segment) {
      case "newCustomers": where.totalOrders = 0; break;
      case "vip": where.tier = { in: ["gold", "platinum"] }; break;
      case "inactive": where.totalOrders = { gt: 0, lt: 3 }; break;
      case "all": break; // no filter
    }

    const recipients = await db.customer.findMany({
      where: where as never,
      select: { email: true, name: true },
    });

    // In production, this would use the email service (src/lib/email.ts)
    // For now, we return the list of recipients + the message
    const restaurant = await db.restaurant.findUnique({
      where: { id: admin.restaurantId },
      select: { name: true },
    });

    return NextResponse.json({
      ok: true,
      segment,
      recipientsCount: recipients.length,
      subject: `[${restaurant?.name || "KFM Delice"}] ${subject}`,
      message,
      recipients: recipients.map(r => ({ email: r.email, name: r.name })),
      note: "En production, les emails seraient envoyés via le service email configuré.",
    });
  } catch (error) {
    console.error("[email-campaigns:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

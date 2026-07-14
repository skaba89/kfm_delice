import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";

// POST /api/notify/whatsapp — send WhatsApp notification to customer
// Body: { orderId: "...", message: "optional custom message" }
// Uses WhatsApp Business API (or a simple wa.me link fallback)
export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "staff", "cashier"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { orderId, message } = body as { orderId?: string; message?: string };

    if (!orderId) return NextResponse.json({ error: "orderId requis" }, { status: 400 });

    // Fetch the order + restaurant
    const order = await db.order.findFirst({
      where: { id: orderId, restaurantId: admin.restaurantId },
      select: { id: true, customerName: true, phone: true, status: true, total: true, orderType: true },
    });
    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

    const restaurant = await db.restaurant.findUnique({
      where: { id: admin.restaurantId },
      select: { name: true, whatsapp: true },
    });

    // Build the WhatsApp message
    const statusMessages: Record<string, string> = {
      pending: "Votre commande est en attente de confirmation.",
      confirmed: "✅ Votre commande est confirmée et en préparation.",
      preparing: "🍳 Votre commande est en cours de préparation.",
      ready: "🍽️ Votre commande est prête ! Vous pouvez venir la récupérer.",
      delivering: "🚗 Votre commande est en cours de livraison.",
      delivered: "✅ Votre commande a été livrée. Merci de votre confiance !",
      cancelled: "❌ Votre commande a été annulée.",
    };

    const msg = message || statusMessages[order.status] || "Mise à jour de votre commande.";
    const fullMessage = `*${restaurant?.name || "KFM Delice"}*\n\nBonjour ${order.customerName},\n\n${msg}\n\nCommande #${order.id.slice(-8).toUpperCase()}\nTotal: ${Number(order.total).toLocaleString("fr-FR")} GNF\n\nMerci de votre confiance !`;

    // If the customer has a phone number, generate a wa.me link
    // In production, this would use WhatsApp Business API to send automatically
    const phone = order.phone?.replace(/[^0-9]/g, "") || "";
    if (phone) {
      const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(fullMessage)}`;
      return NextResponse.json({
        ok: true,
        waLink,
        message: fullMessage,
        phone,
        method: "wa.me link (manual send)",
      });
    }

    // No phone — return the message for manual copy
    return NextResponse.json({
      ok: true,
      message: fullMessage,
      method: "no phone — copy message manually",
    });
  } catch (error) {
    console.error("[notify/whatsapp:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

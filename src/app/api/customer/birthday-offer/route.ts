import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateCustomer } from "@/lib/auth";

// GET /api/customer/birthday-offer — check if customer has a birthday offer
// Returns a promo code valid for the customer's birthday month
export async function GET(request: Request) {
  try {
    await dbReady;
    const customer = await authenticateCustomer(request);
    if (!customer) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const c = await db.customer.findUnique({
      where: { id: customer.id },
      select: { birthday: true, name: true, restaurantId: true },
    });
    if (!c) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    if (!c.birthday) {
      return NextResponse.json({
        hasOffer: false,
        message: "Ajoutez votre date de naissance dans votre profil pour recevoir une offre d'anniversaire !",
      });
    }

    const now = new Date();
    const birthday = new Date(c.birthday);
    const isBirthdayMonth = now.getMonth() === birthday.getMonth();

    if (!isBirthdayMonth) {
      return NextResponse.json({
        hasOffer: false,
        message: `Revenez en ${birthday.toLocaleString("fr-FR", { month: "long" })} pour votre cadeau d'anniversaire !`,
      });
    }

    // Generate or find existing birthday promo code
    const birthdayCode = `ANNIV${now.getFullYear()}${customer.id.slice(-4).toUpperCase()}`;
    let promo = await db.promoCode.findFirst({
      where: { restaurantId: c.restaurantId, code: birthdayCode },
    });

    if (!promo) {
      promo = await db.promoCode.create({
        data: {
          restaurantId: c.restaurantId,
          code: birthdayCode,
          description: `Joyeux anniversaire ${c.name}! 🎂`,
          discountType: "percent",
          discountValue: 15,
          minOrderTotal: 0,
          maxUses: 1,
          maxUsesPerUser: 1,
          active: true,
          expiresAt: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
        },
      });
    }

    return NextResponse.json({
      hasOffer: true,
      promoCode: birthdayCode,
      discount: "15%",
      message: `🎉 Joyeux anniversaire ${c.name}! Utilisez le code ${birthdayCode} pour 15% de remise!`,
      expiresAt: promo.expiresAt,
    });
  } catch (error) {
    console.error("[birthday-offer:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

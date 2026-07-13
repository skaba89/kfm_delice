import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { getRestaurantId } from "@/lib/tenant";

// ────────────────────────────────────────────────────────────────
// POST /api/promo-codes/validate — public validation of a promo code
//
// Body: { code: "BIENVENUE10", cartTotal: 50000 }
// Returns: { valid: true, discountType, discountValue, discountAmount, newTotal }
//       or: { valid: false, error: "Code expiré" }
//
// This route is PUBLIC (no auth required) — the checkout page calls
// it to preview the discount before submitting the order.
// The actual discount is applied server-side in POST /api/orders
// (the client-sent discount is NEVER trusted).
// ────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    await dbReady;

    const body = await request.json();
    const { code, cartTotal } = body as { code?: string; cartTotal?: number };

    if (!code || typeof code !== "string") {
      return NextResponse.json({ valid: false, error: "Code requis" }, { status: 400 });
    }
    if (typeof cartTotal !== "number" || cartTotal < 0) {
      return NextResponse.json({ valid: false, error: "Total panier invalide" }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase();

    // Resolve the restaurant from the request (slug header or query)
    const restaurantId = await getRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ valid: false, error: "Restaurant non trouvé" }, { status: 404 });
    }

    // Look up the promo code
    const promoCode = await db.promoCode.findFirst({
      where: { restaurantId, code: normalizedCode },
    });

    if (!promoCode) {
      return NextResponse.json({ valid: false, error: "Code introuvable" }, { status: 404 });
    }

    if (!promoCode.active) {
      return NextResponse.json({ valid: false, error: "Code désactivé" }, { status: 400 });
    }

    const now = new Date();
    if (promoCode.startsAt && now < promoCode.startsAt) {
      return NextResponse.json({ valid: false, error: "Code pas encore actif" }, { status: 400 });
    }
    if (promoCode.expiresAt && now > promoCode.expiresAt) {
      return NextResponse.json({ valid: false, error: "Code expiré" }, { status: 400 });
    }

    // Check max uses (0 = unlimited)
    if (promoCode.maxUses > 0 && promoCode.usedCount >= promoCode.maxUses) {
      return NextResponse.json({ valid: false, error: "Code épuisé (limite atteinte)" }, { status: 400 });
    }

    // Check minimum order total
    const minTotal = Number(promoCode.minOrderTotal);
    if (minTotal > 0 && cartTotal < minTotal) {
      return NextResponse.json({
        valid: false,
        error: `Commande minimum de ${minTotal.toLocaleString("fr-FR")} GNF requise`,
      }, { status: 400 });
    }

    // Calculate discount
    const value = Number(promoCode.discountValue);
    let discountAmount = 0;
    if (promoCode.discountType === "percent") {
      discountAmount = Math.round(cartTotal * (value / 100));
    } else {
      // fixed
      discountAmount = Math.min(value, cartTotal); // can't exceed cart total
    }

    const newTotal = Math.max(0, cartTotal - discountAmount);

    return NextResponse.json({
      valid: true,
      code: promoCode.code,
      description: promoCode.description,
      discountType: promoCode.discountType,
      discountValue: value,
      discountAmount,
      cartTotal,
      newTotal,
    });
  } catch (error) {
    console.error("[promo-codes:validate]", error);
    return NextResponse.json({ valid: false, error: "Erreur serveur" }, { status: 500 });
  }
}

import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateCustomer } from "@/lib/auth";
import crypto from "crypto";

// GET /api/customer/referral — get customer's referral code + stats
export async function GET(request: Request) {
  try {
    await dbReady;
    const customer = await authenticateCustomer(request);
    if (!customer) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const c = await db.customer.findUnique({
      where: { id: customer.id },
      select: { referralCode: true, referredBy: true, name: true, restaurantId: true },
    });
    if (!c) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    // Generate referral code if not set
    let referralCode = c.referralCode;
    if (!referralCode) {
      referralCode = `KFM${customer.id.slice(-6).toUpperCase()}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
      await db.customer.update({ where: { id: customer.id }, data: { referralCode } });
    }

    // Count referrals made by this customer
    const referralsCount = await db.customer.count({
      where: { referredBy: referralCode, restaurantId: c.restaurantId },
    });

    return NextResponse.json({
      referralCode,
      referralsCount,
      reward: "5000 GNF pour chaque ami qui commande",
      shareText: `Découvre ${c.name} sur KFM Delice! Utilise mon code ${referralCode} et gagne 5000 GNF sur ta première commande.`,
      shareUrl: `https://kfm-delice-ggb4.onrender.com/r/kfm-delice?ref=${referralCode}`,
    });
  } catch (error) {
    console.error("[referral:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/customer/referral — apply a referral code (first order only)
// Body: { code: "KFM..." }
export async function POST(request: Request) {
  try {
    await dbReady;
    const customer = await authenticateCustomer(request);
    if (!customer) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { code } = body as { code?: string };
    if (!code) return NextResponse.json({ error: "Code requis" }, { status: 400 });

    const normalizedCode = code.trim().toUpperCase();

    // Check if customer already has a referral
    const c = await db.customer.findUnique({
      where: { id: customer.id },
      select: { referredBy: true, totalOrders: true },
    });
    if (!c) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    if (c.referredBy) return NextResponse.json({ error: "Vous avez déjà utilisé un code de parrainage" }, { status: 400 });
    if (c.totalOrders > 0) return NextResponse.json({ error: "Le parrainage n'est valable que sur le premier compte" }, { status: 400 });

    // Verify the referral code exists
    const referrer = await db.customer.findFirst({
      where: { referralCode: normalizedCode },
      select: { id: true, name: true },
    });
    if (!referrer) return NextResponse.json({ error: "Code de parrainage invalide" }, { status: 404 });
    if (referrer.id === customer.id) return NextResponse.json({ error: "Vous ne pouvez pas vous parrainer vous-même" }, { status: 400 });

    // Apply the referral — give both customer and referrer 5000 GNF loyalty points
    await db.customer.update({
      where: { id: customer.id },
      data: { referredBy: normalizedCode, loyaltyPoints: { increment: 5000 } },
    });
    await db.customer.update({
      where: { id: referrer.id },
      data: { loyaltyPoints: { increment: 5000 } },
    });

    return NextResponse.json({
      ok: true,
      message: `Code appliqué ! Vous et ${referrer.name} gagnez 5000 points de fidélité chacun.`,
      rewardPoints: 5000,
    });
  } catch (error) {
    console.error("[referral:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

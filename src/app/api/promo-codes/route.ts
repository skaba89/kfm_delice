import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole, PERMISSION_GROUPS } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// ────────────────────────────────────────────────────────────────
// GET /api/promo-codes — list promo codes for the admin's restaurant
// ────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, PERMISSION_GROUPS.LOYALTY_MANAGE)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const codes = await db.promoCode.findMany({
      where: { restaurantId: admin.restaurantId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: codes.map((c) => ({
        id: c.id,
        code: c.code,
        description: c.description,
        discountType: c.discountType,
        discountValue: Number(c.discountValue),
        minOrderTotal: Number(c.minOrderTotal),
        maxUses: c.maxUses,
        usedCount: c.usedCount,
        maxUsesPerUser: c.maxUsesPerUser,
        active: c.active,
        startsAt: c.startsAt,
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[promo-codes:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────────
// POST /api/promo-codes — create a new promo code
// ────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, PERMISSION_GROUPS.LOYALTY_MANAGE)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { code, description, discountType, discountValue, minOrderTotal, maxUses, maxUsesPerUser, active, startsAt, expiresAt } = body as {
      code?: string;
      description?: string;
      discountType?: string;
      discountValue?: number;
      minOrderTotal?: number;
      maxUses?: number;
      maxUsesPerUser?: number;
      active?: boolean;
      startsAt?: string;
      expiresAt?: string;
    };

    // Validation
    if (!code || typeof code !== "string" || code.trim().length < 3) {
      return NextResponse.json({ error: "Code requis (min 3 caractères)" }, { status: 400 });
    }
    const normalizedCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(normalizedCode)) {
      return NextResponse.json(
        { error: "Code invalide — lettres majuscules, chiffres, tirets et underscores uniquement" },
        { status: 400 }
      );
    }
    if (discountType !== "percent" && discountType !== "fixed") {
      return NextResponse.json({ error: "Type de remise invalide (percent ou fixed)" }, { status: 400 });
    }
    if (typeof discountValue !== "number" || discountValue <= 0) {
      return NextResponse.json({ error: "Valeur de remise requise (positive)" }, { status: 400 });
    }
    if (discountType === "percent" && discountValue > 100) {
      return NextResponse.json({ error: "La remise en pourcentage ne peut pas dépasser 100%" }, { status: 400 });
    }

    // Check uniqueness within this restaurant
    const existing = await db.promoCode.findFirst({
      where: { restaurantId: admin.restaurantId, code: normalizedCode },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Le code "${normalizedCode}" existe déjà` },
        { status: 409 }
      );
    }

    const promoCode = await db.promoCode.create({
      data: {
        restaurantId: admin.restaurantId,
        code: normalizedCode,
        description: typeof description === "string" ? description.trim() : "",
        discountType,
        discountValue,
        minOrderTotal: typeof minOrderTotal === "number" ? minOrderTotal : 0,
        maxUses: typeof maxUses === "number" ? maxUses : 0,
        maxUsesPerUser: typeof maxUsesPerUser === "number" ? maxUsesPerUser : 1,
        active: typeof active === "boolean" ? active : true,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    await logAudit({
      actorId: admin.id,
      actorType: "admin",
      action: "promocode_create",
      entityType: "PromoCode",
      entityId: promoCode.id,
      restaurantId: admin.restaurantId,
      after: { code: normalizedCode, discountType, discountValue },
      request,
    }).catch(() => {});

    return NextResponse.json(bigIntToNumber(promoCode), { status: 201 });
  } catch (error) {
    console.error("[promo-codes:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

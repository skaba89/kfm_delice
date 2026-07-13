import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole, PERMISSION_GROUPS } from "@/lib/auth";
import { ensureDefaultTiers, DEFAULT_TIERS } from "@/lib/loyalty-tiers";

// ────────────────────────────────────────────────────────────────
// GET /api/loyalty/tiers — list tiers for the restaurant
//
// Public-readable (the customer profile needs to display tiers).
// If no tiers are configured, seed the defaults automatically.
// ────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    await dbReady;

    // Try admin auth first; if not admin, fall back to customer auth
    // to resolve the restaurantId (both can read tiers).
    let restaurantId: string | null = null;
    const admin = await authenticateAdmin(request).catch(() => null);
    if (admin) {
      restaurantId = admin.restaurantId;
    } else {
      // Try customer auth via the tenant header
      const { getRestaurantId } = await import("@/lib/tenant");
      restaurantId = await getRestaurantId(request);
    }

    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
    }

    // Ensure default tiers exist (idempotent)
    await ensureDefaultTiers(restaurantId);

    const tiers = await db.loyaltyTier.findMany({
      where: { restaurantId },
      orderBy: { minSpent: "asc" },
    });

    return NextResponse.json({
      data: tiers.map((t) => ({
        id: t.id,
        name: t.name,
        label: t.label,
        minSpent: Number(t.minSpent),
        discountPercent: t.discountPercent,
        freeDelivery: t.freeDelivery,
        freeDish: t.freeDish,
        color: t.color,
        icon: t.icon,
        active: t.active,
      })),
    });
  } catch (error) {
    console.error("[loyalty/tiers:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────────
// POST /api/loyalty/tiers — create or update a tier
//
// Admin/manager only. Used by the Settings UI to configure tiers.
// Body: { name, label, minSpent, discountPercent, freeDelivery, freeDish, color, icon, active }
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
    const { name, label, minSpent, discountPercent, freeDelivery, freeDish, color, icon, active } = body as {
      name?: string;
      label?: string;
      minSpent?: number;
      discountPercent?: number;
      freeDelivery?: boolean;
      freeDish?: boolean;
      color?: string;
      icon?: string;
      active?: boolean;
    };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Nom de palier requis" }, { status: 400 });
    }
    const normalizedName = name.trim().toLowerCase();
    if (!/^[a-z0-9_]+$/.test(normalizedName)) {
      return NextResponse.json(
        { error: "Nom invalide — minuscules, chiffres, underscores uniquement" },
        { status: 400 }
      );
    }
    if (typeof discountPercent === "number" && (discountPercent < 0 || discountPercent > 100)) {
      return NextResponse.json({ error: "Pourcentage de remise invalide (0-100)" }, { status: 400 });
    }

    // Upsert (create or update) the tier
    const tier = await db.loyaltyTier.upsert({
      where: { restaurantId_name: { restaurantId: admin.restaurantId, name: normalizedName } },
      create: {
        restaurantId: admin.restaurantId,
        name: normalizedName,
        label: typeof label === "string" ? label : "",
        minSpent: typeof minSpent === "number" ? minSpent : 0,
        discountPercent: typeof discountPercent === "number" ? discountPercent : 0,
        freeDelivery: typeof freeDelivery === "boolean" ? freeDelivery : false,
        freeDish: typeof freeDish === "boolean" ? freeDish : false,
        color: typeof color === "string" ? color : "#cd7f32",
        icon: typeof icon === "string" ? icon : "",
        active: typeof active === "boolean" ? active : true,
      },
      update: {
        label: typeof label === "string" ? label : undefined,
        minSpent: typeof minSpent === "number" ? minSpent : undefined,
        discountPercent: typeof discountPercent === "number" ? discountPercent : undefined,
        freeDelivery: typeof freeDelivery === "boolean" ? freeDelivery : undefined,
        freeDish: typeof freeDish === "boolean" ? freeDish : undefined,
        color: typeof color === "string" ? color : undefined,
        icon: typeof icon === "string" ? icon : undefined,
        active: typeof active === "boolean" ? active : undefined,
      },
    });

    return NextResponse.json(bigIntToNumber(tier), { status: 201 });
  } catch (error) {
    console.error("[loyalty/tiers:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────────
// PATCH /api/loyalty/tiers — bulk update tiers (used by the Settings UI
// to save all tiers at once)
// ────────────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
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
    const { tiers } = body as { tiers?: Array<Record<string, unknown>> };

    if (!Array.isArray(tiers)) {
      return NextResponse.json({ error: "Format invalide — attendu: { tiers: [...] }" }, { status: 400 });
    }

    // Update each tier
    const results = [];
    for (const tier of tiers) {
      if (!tier.name || typeof tier.name !== "string") continue;
      const name = tier.name.trim().toLowerCase();
      try {
        const updated = await db.loyaltyTier.upsert({
          where: { restaurantId_name: { restaurantId: admin.restaurantId, name } },
          create: {
            restaurantId: admin.restaurantId,
            name,
            label: typeof tier.label === "string" ? tier.label : "",
            minSpent: typeof tier.minSpent === "number" ? tier.minSpent : 0,
            discountPercent: typeof tier.discountPercent === "number" ? tier.discountPercent : 0,
            freeDelivery: typeof tier.freeDelivery === "boolean" ? tier.freeDelivery : false,
            freeDish: typeof tier.freeDish === "boolean" ? tier.freeDish : false,
            color: typeof tier.color === "string" ? tier.color : "#cd7f32",
            icon: typeof tier.icon === "string" ? tier.icon : "",
            active: typeof tier.active === "boolean" ? tier.active : true,
          },
          update: {
            label: typeof tier.label === "string" ? tier.label : undefined,
            minSpent: typeof tier.minSpent === "number" ? tier.minSpent : undefined,
            discountPercent: typeof tier.discountPercent === "number" ? tier.discountPercent : undefined,
            freeDelivery: typeof tier.freeDelivery === "boolean" ? tier.freeDelivery : undefined,
            freeDish: typeof tier.freeDish === "boolean" ? tier.freeDish : undefined,
            color: typeof tier.color === "string" ? tier.color : undefined,
            icon: typeof tier.icon === "string" ? tier.icon : undefined,
            active: typeof tier.active === "boolean" ? tier.active : undefined,
          },
        });
        results.push(bigIntToNumber(updated));
      } catch (e) {
        console.error(`[loyalty/tiers:PATCH] Failed to upsert ${name}:`, e);
      }
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error("[loyalty/tiers:PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

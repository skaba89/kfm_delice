import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { getRestaurantConfig, invalidateConfigCache } from "@/lib/constants";
import { getRestaurantId, invalidateTenantCache, resolveTenant } from "@/lib/tenant";
import { authenticateAdmin, authenticatePlatformAdmin, hasRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  normalizeRestaurantConfigData,
  normalizeRestaurantSettingsData,
  restaurantSettingsPatchSchema,
} from "@/lib/restaurant-settings";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    await dbReady;
    const sp = new URL(request.url).searchParams;
    const slug =
      request.headers.get('x-restaurant-slug') ||
      sp.get('restaurant') ||
      sp.get('slug');

    if (slug) {
      const tenant = await resolveTenant(slug);
      if (!tenant) {
        return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
      }
      const config = await getRestaurantConfig(tenant.slug);
      if (!config) {
        return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
      }
      return NextResponse.json(config);
    }

    const restaurantId = await getRestaurantId(request);
    if (!restaurantId) {
      return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
    }

    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      include: { config: true },
    });
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
    }

    return NextResponse.json(await getRestaurantConfig(restaurant.slug));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json(
        { error: "Accès refusé", code: "RESTAURANT_SETTINGS_ROLE_FORBIDDEN" },
        { status: 403 }
      );
    }

    const validation = restaurantSettingsPatchSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        {
          error: validation.error.issues[0]?.message || "Données invalides",
          code: "RESTAURANT_SETTINGS_VALIDATION_ERROR",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const restaurantInput = validation.data.restaurant;
    const configInput = validation.data.config;
    const restaurantUpdate = restaurantInput
      ? normalizeRestaurantSettingsData(restaurantInput)
      : {};
    const configUpdate = configInput
      ? normalizeRestaurantConfigData(configInput)
      : {};

    if (configInput?.customDomain !== undefined) {
      const currentConfig = await db.restaurantConfig.findUnique({
        where: { restaurantId: admin.restaurantId },
        select: { customDomain: true },
      });
      const requestedDomain = configInput.customDomain.trim();
      const currentDomain = currentConfig?.customDomain?.trim() || "";
      if (requestedDomain && requestedDomain !== currentDomain) {
        return NextResponse.json(
          {
            error: "Le domaine personnalisé nécessite un provisioning dédié non disponible sur cet endpoint.",
            code: "CUSTOM_DOMAIN_NOT_PROVISIONED",
          },
          { status: 409 }
        );
      }
      if (requestedDomain === currentDomain) {
        delete configUpdate.customDomain;
      }
    }

    await db.$transaction(async (tx) => {
      if (Object.keys(restaurantUpdate).length > 0) {
        await tx.restaurant.update({
          where: { id: admin.restaurantId },
          data: restaurantUpdate as unknown as Prisma.RestaurantUpdateInput,
        });
      }

      if (Object.keys(configUpdate).length > 0) {
        await tx.restaurantConfig.upsert({
          where: { restaurantId: admin.restaurantId },
          update: configUpdate as unknown as Prisma.RestaurantConfigUpdateInput,
          create: {
            restaurantId: admin.restaurantId,
            ...(configUpdate as unknown as Omit<Prisma.RestaurantConfigUncheckedCreateInput, 'restaurantId'>),
          },
        });
      }
    });

    invalidateConfigCache();
    invalidateTenantCache();

    await logAudit({
      actorId: admin.id,
      actorType: "admin",
      action: "restaurant_settings_update",
      entityType: "Restaurant",
      entityId: admin.restaurantId,
      restaurantId: admin.restaurantId,
      after: {
        restaurantFields: Object.keys(restaurantUpdate),
        configFields: Object.keys(configUpdate),
      },
      request,
    }).catch(() => {});

    const restaurant = await db.restaurant.findUnique({
      where: { id: admin.restaurantId },
      select: { slug: true },
    });
    const config = restaurant ? await getRestaurantConfig(restaurant.slug) : null;
    return NextResponse.json(config);
  } catch (error) {
    console.error("[restaurant PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function LIST(request: Request) {
  try {
    await dbReady;
    const platformAdmin = await authenticatePlatformAdmin(request);
    if (!platformAdmin) {
      return NextResponse.json({ error: "Accès plateforme requis" }, { status: 403 });
    }

    const restaurants = await db.restaurant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        config: { select: { primaryColor: true, logo: true } },
        _count: { select: { orders: true, customers: true, admins: true, menuItems: true } },
      },
    });
    return NextResponse.json({ data: restaurants });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

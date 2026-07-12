import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { getRestaurantConfig } from "@/lib/constants";
import { getRestaurantId } from "@/lib/tenant";
import { authenticateAdmin, authenticatePlatformAdmin } from "@/lib/auth";

// ────────────────────────────────────────────────────────────────
// GET /api/restaurant — Public: get current restaurant info
// ────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    await dbReady;
    // Accept slug from header (middleware) OR query (?restaurant= / ?slug=)
    const sp = new URL(request.url).searchParams;
    const slug =
      request.headers.get('x-restaurant-slug') ||
      sp.get('restaurant') ||
      sp.get('slug');

    if (slug) {
      const config = await getRestaurantConfig(slug);
      if (!config) {
        return NextResponse.json({ error: "Restaurant non trouvé" }, { status: 404 });
      }
      return NextResponse.json(config);
    }

    // Fallback: try to resolve from request
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

    const config = await getRestaurantConfig(restaurant.slug);
    return NextResponse.json(config);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────────
// PATCH /api/restaurant — Admin: update restaurant info & config
// ────────────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { restaurant: restaurantData, config: configData } = body;

    // Update restaurant basic info
    if (restaurantData) {
      const allowedFields = ['name', 'tagline', 'description', 'phone', 'whatsapp', 'email', 'address', 'hours', 'tables', 'deliveryFee', 'minDelivery', 'deliveryZones', 'currency', 'locale'];
      const updateData: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (restaurantData[field] !== undefined) {
          updateData[field] = restaurantData[field];
        }
      }

      if (Object.keys(updateData).length > 0) {
        await db.restaurant.update({
          where: { id: admin.restaurantId },
          data: updateData,
        });
      }
    }

    // Update restaurant config (branding, features, etc.)
    if (configData) {
      const allowedConfigFields = ['logo', 'heroImage', 'primaryColor', 'accentColor', 'fontFamily', 'menuCategories', 'features', 'openingHours', 'socialLinks', 'customDomain', 'metaTitle', 'metaDescription'];
      const configUpdateData: Record<string, unknown> = {};
      for (const field of allowedConfigFields) {
        if (configData[field] !== undefined) {
          // JSON stringify objects/arrays
          if (typeof configData[field] === 'object') {
            configUpdateData[field] = JSON.stringify(configData[field]);
          } else {
            configUpdateData[field] = configData[field];
          }
        }
      }

      if (Object.keys(configUpdateData).length > 0) {
        // Upsert config
        await db.restaurantConfig.upsert({
          where: { restaurantId: admin.restaurantId },
          update: configUpdateData,
          create: {
            restaurantId: admin.restaurantId,
            ...configUpdateData,
          },
        });
      }
    }

    // Invalidate caches
    const { invalidateConfigCache } = await import('@/lib/constants');
    const { invalidateTenantCache } = await import('@/lib/tenant');
    invalidateConfigCache();
    invalidateTenantCache();

    // Return updated config
    const restaurant = await db.restaurant.findUnique({
      where: { id: admin.restaurantId },
    });
    const config = restaurant ? await getRestaurantConfig(restaurant.slug) : null;

    return NextResponse.json(config);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────────
// GET /api/restaurant/list — Platform Admin: list all restaurants
// ────────────────────────────────────────────────────────────────
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
        _count: {
          select: {
            orders: true,
            customers: true,
            admins: true,
            menuItems: true,
          },
        },
      },
    });

    return NextResponse.json({ data: restaurants });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { listRestaurants } from "@/lib/db";
import { resolveTenant } from "@/lib/tenant";

// GET /api/restaurants — public directory of commercially available tenants.
// listRestaurants() provides the minimal projection; resolveTenant() applies
// the authoritative restaurant/account status + trial/contract lifecycle.
export async function GET() {
  try {
    const restaurants = await listRestaurants();
    const availability = await Promise.all(
      restaurants.map(async (restaurant) => ({
        restaurant,
        tenant: await resolveTenant(restaurant.slug),
      }))
    );

    return NextResponse.json(
      availability
        .filter(({ tenant }) => tenant !== null)
        .map(({ restaurant }) => restaurant)
    );
  } catch (error) {
    console.error("[API GET /api/restaurants]", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

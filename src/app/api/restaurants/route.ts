import { NextResponse } from "next/server";
import { listRestaurants } from "@/lib/db";

// GET /api/restaurants — List all restaurants (public, no auth needed)
export async function GET() {
  try {
    const restaurants = await listRestaurants();
    return NextResponse.json(restaurants);
  } catch (error) {
    console.error("[API GET /api/restaurants]", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

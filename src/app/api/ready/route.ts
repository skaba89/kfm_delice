import { NextResponse } from "next/server";
import { db, dbReady } from "@/lib/db";

/**
 * GET /api/ready — deployment readiness probe.
 *
 * Unlike /api/status (liveness), this endpoint MUST fail when the database or
 * critical schema columns are unavailable. Render should use this endpoint as
 * its health check so a process that started with a broken migration cannot be
 * promoted as healthy.
 */
export async function GET() {
  try {
    await dbReady;

    // These read-only probes deliberately reference columns that previously
    // drifted out of sync with the migration history. LIMIT 0 validates the
    // schema without reading tenant data.
    await db.$queryRawUnsafe('SELECT "id", "plan", "status" FROM "Restaurant" LIMIT 0');
    await db.$queryRawUnsafe('SELECT "id", "restaurantId", "tokenVersion" FROM "Admin" LIMIT 0');
    await db.$queryRawUnsafe('SELECT "id", "restaurantId", "tokenVersion" FROM "Customer" LIMIT 0');
    await db.$queryRawUnsafe('SELECT "id", "restaurantId", "status" FROM "Order" LIMIT 0');

    return NextResponse.json(
      { status: "ready", timestamp: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[ready] Readiness check failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { status: "not_ready", timestamp: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

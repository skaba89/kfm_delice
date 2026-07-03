import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/diagnose — Lightweight diagnostic endpoint.
 *
 * SECURITY: This endpoint is intentionally public (used by dev scripts)
 * but only exposes COUNTS, not user data. In production it returns
 * minimal info (DB connection status + counts), never admin emails
 * or schema introspection (those leak info about the DB structure).
 */
export async function GET() {
  await dbReady;
  const checks: Record<string, unknown> = {};

  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Check DATABASE_URL — log provider only, never the full URL
  const url = process.env.DATABASE_URL || "";
  const provider = url.startsWith('postgresql://') || url.startsWith('postgres://')
    ? 'postgres'
    : url.startsWith('file:')
      ? 'sqlite'
      : 'unknown';
  checks.databaseProvider = provider;
  checks.databaseUrlSet = !!url;

  // 2. Check DB connection
  try {
    await db.$connect();
    checks.dbConnection = "ok";
  } catch (e: unknown) {
    checks.dbConnection = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    return NextResponse.json({ status: "error", checks });
  }

  // 3. Check restaurants count
  try {
    checks.restaurants = await db.restaurant.count();
  } catch (e: unknown) {
    checks.restaurants = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 4. Check admins count
  try {
    checks.admins = await db.admin.count();
  } catch (e: unknown) {
    checks.admins = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 5. List admin emails — DEV ONLY. In production, leaking the list of
  // admin emails would make brute-force attacks much easier.
  if (!isProduction) {
    try {
      const admins = await db.admin.findMany({
        select: { email: true, role: true, status: true },
      });
      checks.adminList = admins;
    } catch (e: unknown) {
      checks.adminList = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    checks.adminList = "hidden in production";
  }

  // 6. Schema introspection — SQLite-only (PRAGMA). Skipped on PostgreSQL.
  if (provider === 'sqlite' && !isProduction) {
    try {
      const columns = await db.$queryRawUnsafe<Array<{ name: string }>>(
        'PRAGMA table_info(Admin)'
      );
      checks.adminColumns = columns.map((c) => c.name);
    } catch (e: unknown) {
      checks.adminColumns = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }

    try {
      const columns = await db.$queryRawUnsafe<Array<{ name: string }>>(
        'PRAGMA table_info(Driver)'
      );
      checks.driverColumns = columns.map((c) => c.name);
    } catch (e: unknown) {
      checks.driverColumns = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    checks.adminColumns = 'skipped (postgres or production)';
    checks.driverColumns = 'skipped (postgres or production)';
  }

  // 7. Check NODE_ENV
  checks.nodeEnv = process.env.NODE_ENV;

  const overall = Object.values(checks).every(
    (v) => typeof v !== "string" || !v.toString().startsWith("ERROR")
  );

  try {
    await db.$disconnect();
  } catch {
    // ignore
  }

  return NextResponse.json({ status: overall ? "ok" : "error", checks });
}

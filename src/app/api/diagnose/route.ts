import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, unknown> = {};

  // 1. Check DATABASE_URL (hide full path for security)
  const url = process.env.DATABASE_URL || "NOT SET";
  checks.databaseUrl = url.startsWith('file:') ? `${url.substring(0, 15)}...` : `INVALID: ${url}`;
  checks.databaseUrlValid = url.startsWith('file:');

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
    const count = await db.restaurant.count();
    checks.restaurants = count;
  } catch (e: unknown) {
    checks.restaurants = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 4. Check admins count (use raw query to avoid schema mismatch)
  try {
    const result = await db.$queryRaw<Array<{count: bigint}>>`SELECT COUNT(*) as count FROM Admin`;
    checks.admins = Number(result[0]?.count ?? 0);
  } catch (e: unknown) {
    checks.admins = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 5. List admin emails (use raw query)
  try {
    const admins = await db.$queryRaw<Array<{email: string; role: string; status: string}>>`SELECT email, role, status FROM Admin`;
    checks.adminList = admins;
  } catch (e: unknown) {
    checks.adminList = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 6. Check Admin table columns
  try {
    const columns = await db.$queryRaw<Array<{name: string}>>`PRAGMA table_info(Admin)`;
    checks.adminColumns = columns.map(c => c.name);
  } catch (e: unknown) {
    checks.adminColumns = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
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

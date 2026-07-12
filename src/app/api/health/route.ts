import { NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth';
import { db, testDatabaseConnection } from '@/lib/db';
import { getAppMode } from '@/lib/runtime-mode';

// GET /api/health — Diagnostic endpoint (public in dev, admin only in production)
export async function GET(request: Request) {
  // In production, require admin auth
  if (process.env.NODE_ENV === 'production') {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
  }

  const checks: Record<string, unknown> = {};
  let overallOk = true;

  // 1. Environment check
  checks.env = {
    DATABASE_URL: !!process.env.DATABASE_URL ? 'set' : 'MISSING',
    JWT_SECRET: !!process.env.JWT_SECRET ? 'set' : 'MISSING',
    NODE_ENV: process.env.NODE_ENV || 'undefined',
    APP_MODE: getAppMode(),
  };
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    overallOk = false;
  }

  // 2. Database connection + latency
  const dbCheck = await testDatabaseConnection();
  checks.database = {
    ok: dbCheck.ok,
    latencyMs: dbCheck.latencyMs,
    ...(dbCheck.error ? { error: 'Connection error' } : {}),
  };
  if (!dbCheck.ok) overallOk = false;

  // 3. Data check
  try {
    const adminCount = await db.admin.count();
    checks.hasAdmins = adminCount > 0;
  } catch {
    checks.hasAdmins = false;
    overallOk = false;
  }

  try {
    const restaurantCount = await db.restaurant.count();
    checks.hasRestaurant = restaurantCount > 0;
  } catch {
    checks.hasRestaurant = false;
    overallOk = false;
  }

  // 4. Migration status
  try {
    const pendingMigrations = await db.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int as count FROM "_prisma_migrations" WHERE "finished_at" IS NULL`
    ).catch(() => [{ count: -1 }]);
    checks.migrations = {
      pending: pendingMigrations[0]?.count ?? -1,
      status: (pendingMigrations[0]?.count ?? -1) === 0 ? 'ok' : 'unknown',
    };
  } catch {
    checks.migrations = { status: 'unknown' };
  }

  // 5. App info
  checks.app = {
    version: process.env.npm_package_version || 'unknown',
    uptime: process.uptime ? `${Math.floor(process.uptime())}s` : 'unknown',
    provider: process.env.DATABASE_URL?.startsWith('postgresql://') || process.env.DATABASE_URL?.startsWith('postgres://') ? 'postgres' : 'sqlite',
  };

  return NextResponse.json({
    status: overallOk ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    checks,
  }, { status: overallOk ? 200 : 500 });
}

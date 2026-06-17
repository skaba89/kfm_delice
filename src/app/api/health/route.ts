import { NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth';
import { db, testDatabaseConnection } from '@/lib/db';

// GET /api/health — Diagnostic endpoint (public in dev, admin only in production)
export async function GET(request: Request) {
  // In production, require admin auth
  if (process.env.NODE_ENV === 'production') {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
  }
  // Dev mode: open access for health checks

  const checks: Record<string, unknown> = {};
  let overallOk = true;

  // 1. Environment check — don't expose values, only set/missing
  checks.env = {
    DATABASE_URL: !!process.env.DATABASE_URL ? 'set' : 'MISSING',
    JWT_SECRET: !!process.env.JWT_SECRET ? 'set' : 'MISSING',
    NODE_ENV: process.env.NODE_ENV || 'undefined',
  };
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    overallOk = false;
  }

  // 2. Database connection check
  const dbCheck = await testDatabaseConnection();
  checks.database = {
    ok: dbCheck.ok,
    latencyMs: dbCheck.latencyMs,
    ...(dbCheck.error ? { error: 'Connection error' } : {}),
  };
  if (!dbCheck.ok) {
    overallOk = false;
  }

  // 3. Simple data check — don't expose IDs, names, or counts to potential attackers
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
    if (restaurantCount === 0) {
      checks.hint = 'Database may need seeding. Admin: POST /api/seed';
    }
  } catch {
    checks.hasRestaurant = false;
    overallOk = false;
  }

  return NextResponse.json({
    status: overallOk ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    checks,
  }, { status: overallOk ? 200 : 500 });
}

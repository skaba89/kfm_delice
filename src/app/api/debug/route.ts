import { NextResponse } from 'next/server';
import { db, testDatabaseConnection } from '@/lib/db';
import { authenticateAdmin, hasRole } from '@/lib/auth';

const IS_PRODUCTION = process.env.APP_MODE === 'production' || process.env.NODE_ENV === 'production';

// Detailed diagnostics are development-only. Production exposes only a
// tenant-admin health summary and never schema/table enumeration.
export async function GET(request: Request) {
  const admin = await authenticateAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  if (!hasRole(admin.role, ['admin', 'manager'])) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const dbCheck = await testDatabaseConnection().catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }));

  if (IS_PRODUCTION) {
    return NextResponse.json(
      { status: dbCheck.ok ? 'ok' : 'error', database: dbCheck.ok ? 'connected' : 'unavailable' },
      { status: dbCheck.ok ? 200 : 503 }
    );
  }

  const [restaurantCount, adminCount, menuCount] = await Promise.all([
    db.restaurant.count(),
    db.admin.count(),
    db.menuItem.count(),
  ]);

  return NextResponse.json({
    status: dbCheck.ok ? 'ok' : 'error',
    database: dbCheck,
    environment: {
      databaseUrlSet: Boolean(process.env.DATABASE_URL),
      jwtSecretSet: Boolean(process.env.JWT_SECRET),
      nodeEnv: process.env.NODE_ENV || 'undefined',
    },
    counts: { restaurants: restaurantCount, admins: adminCount, menuItems: menuCount },
  }, { status: dbCheck.ok ? 200 : 503 });
}

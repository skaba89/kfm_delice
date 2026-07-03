import { NextResponse } from 'next/server';
import { db, testDatabaseConnection } from '@/lib/db';
import { authenticateAdmin } from '@/lib/auth';

// GET /api/debug — Detailed diagnostic endpoint (admin auth required)
export async function GET(req: Request) {
  const admin = await authenticateAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const diagnostics: Record<string, unknown> = {};
  let overallOk = true;

  // 1. Environment variables
  diagnostics.env = {
    DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'MISSING',
    JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'MISSING',
    NODE_ENV: process.env.NODE_ENV || 'undefined',
  };
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    overallOk = false;
  }

  // 2. Database connection test
  try {
    const dbCheck = await testDatabaseConnection();
    diagnostics.database = dbCheck;
    if (!dbCheck.ok) {
      overallOk = false;
    }
  } catch (error) {
    diagnostics.database = `connection error: ${error instanceof Error ? error.message : String(error)}`;
    overallOk = false;
  }

  // 3. Check each table exists. Use information_schema on PostgreSQL,
  //    sqlite_master on SQLite. (The previous raw SQL used sqlite_master
  //    unconditionally, which fails on PostgreSQL.)
  const requiredTables = ['Admin', 'Customer', 'Restaurant', 'MenuItem', 'Reservation', 'Order', 'Driver', 'Review', 'Staff', 'Invoice', 'Quote', 'Expense', 'Payment', 'LoyaltyPointsHistory', 'LoyaltyReward'];

  const dbUrl = process.env.DATABASE_URL || '';
  const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

  try {
    let existingTables = new Set<string>();
    if (isPostgres) {
      // information_schema.tables — PostgreSQL standard catalog.
      // Prisma creates tables with quoted CamelCase names, so we look
      // them up by their exact name in the current schema.
      const rows = await db.$queryRawUnsafe<Array<{ table_name: string }>>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = current_schema()
         AND table_type = 'BASE TABLE'`
      );
      existingTables = new Set(rows.map((r) => r.table_name));
    } else {
      // SQLite — sqlite_master is the canonical source.
      const rows = await db.$queryRawUnsafe<Array<{ name: string }>>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name`
      );
      existingTables = new Set(rows.map((r) => r.name));
    }

    const tableChecks: Record<string, unknown> = {};
    for (const table of requiredTables) {
      const exists = existingTables.has(table);
      tableChecks[table] = exists ? 'exists' : 'MISSING';
      if (!exists) overallOk = false;
    }
    diagnostics.tables = tableChecks;
    diagnostics.existingTables = Array.from(existingTables);
  } catch (error) {
    diagnostics.tables = `error checking tables: ${error instanceof Error ? error.message : String(error)}`;
    overallOk = false;
  }

  // 4. Check critical data
  try {
    const [adminCount, restaurantCount, menuCount] = await Promise.all([
      db.admin.count(),
      db.restaurant.count(),
      db.menuItem.count(),
    ]);
    diagnostics.data = { adminCount, restaurantCount, menuCount };
    if (restaurantCount === 0) {
      diagnostics.dataHint = 'No restaurant found! Try POST /api/seed to seed the database.';
      overallOk = false;
    }
  } catch (error) {
    diagnostics.data = `error: ${error instanceof Error ? error.message : String(error)}`;
    overallOk = false;
  }

  // 5. Check Restaurant table columns — SQLite only (PRAGMA).
  //    On PostgreSQL, the Prisma schema IS the source of truth, so
  //    column introspection is unnecessary.
  if (!isPostgres) {
    try {
      const columns = await db.$queryRawUnsafe<Array<{ name: string; type: string }>>(
        'PRAGMA table_info(Restaurant)'
      );
      const columnNames = new Set(columns.map((c) => c.name));
      const criticalColumns = ['logo', 'primaryColor', 'secondaryColor', 'taxRate', 'currency', 'whatsapp', 'slug', 'tagline', 'latitude', 'longitude'];
      const missingColumns = criticalColumns.filter((c) => !columnNames.has(c));
      if (missingColumns.length > 0) {
        diagnostics.missingColumns = missingColumns;
        overallOk = false;
      } else {
        diagnostics.restaurantColumns = 'all critical columns present';
      }
    } catch (error) {
      // Non-critical
      diagnostics.restaurantColumns = `check failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else {
    diagnostics.restaurantColumns = 'managed by Prisma migrations (PostgreSQL)';
  }

  return NextResponse.json({
    status: overallOk ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    diagnostics,
  }, { status: overallOk ? 200 : 500 });
}

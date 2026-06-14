import { NextResponse } from 'next/server';
import { db, testDatabaseConnection } from '@/lib/db';
import { authenticateAdmin } from '@/lib/auth';

// GET /api/debug — Detailed diagnostic endpoint (no auth required)
// This helps diagnose 500 errors on Render/Neon
export async function GET(req: Request) {
  const admin = await authenticateAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const diagnostics: Record<string, unknown> = {};
  let overallOk = true;

  // 1. Environment variables — don't expose partial credentials
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
      diagnostics.databaseHint = 'Check DATABASE_URL format for Neon: postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require';
    }
  } catch (error) {
    diagnostics.database = `connection error: ${error instanceof Error ? error.message : String(error)}`;
    overallOk = false;
  }

  // 3. Check each table exists
  const requiredTables = ['Admin', 'Customer', 'Restaurant', 'MenuItem', 'Reservation', 'Order', 'Driver', 'Review', 'Staff', 'Invoice', 'Quote', 'Expense', 'Payment', 'LoyaltyPointsHistory', 'LoyaltyReward'];
  
  try {
    const tables = await db.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    const existingTables = new Set(tables.map(t => t.tablename.toLowerCase()));
    const tableChecks: Record<string, unknown> = {};
    
    for (const table of requiredTables) {
      const exists = existingTables.has(table.toLowerCase());
      tableChecks[table] = exists ? 'exists' : 'MISSING';
      if (!exists) overallOk = false;
    }
    diagnostics.tables = tableChecks;
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

  // 5. Check Restaurant table columns
  try {
    const columns = await db.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'Restaurant' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    const columnNames = new Set(columns.map(c => c.column_name));
    const criticalColumns = ['logo', 'primaryColor', 'secondaryColor', 'taxRate', 'currency', 'whatsapp', 'slug', 'tagline', 'latitude', 'longitude'];
    const missingColumns = criticalColumns.filter(c => !columnNames.has(c));
    if (missingColumns.length > 0) {
      diagnostics.missingColumns = missingColumns;
      overallOk = false;
    }
  } catch (error) {
    // Non-critical
  }

  return NextResponse.json({
    status: overallOk ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    diagnostics,
  }, { status: overallOk ? 200 : 500 });
}

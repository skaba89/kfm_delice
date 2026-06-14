import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateAdmin } from '@/lib/auth';

// POST /api/fix-schema — Fix missing database columns (no auth for bootstrap fix)
// This adds any missing columns to the Restaurant table that were in the second migration
export async function POST(req: Request) {
  const admin = await authenticateAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const results: string[] = [];

  // Check and add missing columns to Restaurant table
  const missingColumns = [
    { name: 'logo', sql: `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "logo" TEXT NOT NULL DEFAULT ''` },
    { name: 'primaryColor', sql: `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT NOT NULL DEFAULT '#ea580c'` },
    { name: 'secondaryColor', sql: `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT NOT NULL DEFAULT '#dc2626'` },
    { name: 'taxRate', sql: `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 15.0` },
    { name: 'currency', sql: `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'GNF'` },
    { name: 'facebook', sql: `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "facebook" TEXT NOT NULL DEFAULT ''` },
    { name: 'instagram', sql: `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "instagram" TEXT NOT NULL DEFAULT ''` },
    { name: 'twitter', sql: `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "twitter" TEXT NOT NULL DEFAULT ''` },
    { name: 'latitude', sql: `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION NOT NULL DEFAULT 9.5092` },
    { name: 'longitude', sql: `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION NOT NULL DEFAULT -13.7122` },
    // Review table missing column
    { name: 'Review.status', sql: `ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'visible'` },
  ];

  for (const col of missingColumns) {
    try {
      await db.$executeRawUnsafe(col.sql);
      results.push(`✓ Added column: ${col.name}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('already exists')) {
        results.push(`→ Column already exists: ${col.name}`);
      } else {
        results.push(`✗ Failed to add ${col.name}: ${msg}`);
      }
    }
  }

  // Verify the fix by trying to query the restaurant
  let verifyOk = false;
  try {
    const restaurant = await db.restaurant.findFirst();
    verifyOk = !!restaurant;
    if (restaurant) {
      results.push(`✓ Verification passed: Restaurant "${restaurant.name}" found with all columns`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    results.push(`✗ Verification failed: ${msg}`);
  }

  return NextResponse.json({
    success: verifyOk,
    results,
    message: verifyOk ? 'Schema fix completed successfully' : 'Schema fix attempted but verification failed',
  });
}

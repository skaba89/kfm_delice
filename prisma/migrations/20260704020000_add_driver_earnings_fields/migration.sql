-- Migration: Add missing Driver columns (commissionRate, totalEarnings)
--
-- The application code (src/app/api/orders/route.ts, driver-earnings/route.ts,
-- DriverEarnings.tsx) references driver.commissionRate and driver.totalEarnings
-- but these fields were NEVER declared in the Prisma schema nor created in
-- the database.
--
-- Without this migration, every route that reads Driver records crashes with:
--   "The column main.Driver.commissionRate does not exist in the current database"
--
-- Affected routes:
--   - GET /api/drivers (returns all drivers → crashes)
--   - GET /api/dashboard (includes drivers in response → crashes)
--   - GET /api/tracking (includes driver in orders → crashes)
--   - PATCH /api/orders (reads commissionRate to compute driver earning)
--   - GET /api/driver-earnings (reads commissionRate + totalEarnings)
--
-- This migration is IDEMPOTENT (uses IF NOT EXISTS) — safe to re-run.

-- commissionRate: percentage commission on each delivery (default 10%)
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10;

-- totalEarnings: cumulative GNF earnings from all deliveries
-- BigInt in Prisma = BIGINT in PostgreSQL (allows values > Int32 max)
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "totalEarnings" BIGINT NOT NULL DEFAULT 0;

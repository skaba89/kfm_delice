-- Migration: Add driverEarning column to Order table
--
-- The application code (src/app/api/orders/route.ts, driver-earnings/route.ts,
-- DriverEarnings.tsx) references order.driverEarning but the field was never
-- declared in the Prisma schema nor created in the database.
--
-- Without this migration, db.order.update({ data: { driverEarning: ... } })
-- silently fails (Prisma ignores unknown fields), so driver earnings are
-- never persisted. The driver earnings dashboard then shows 0 for all
-- delivered orders.
--
-- Type: BigInt (PostgreSQL) to match the other monetary fields (total,
-- deliveryFee, discount, tax). On SQLite the same field is Int (sufficient
-- for the dev DB).

-- Add column with safe IF NOT EXISTS (PostgreSQL 9.6+)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "driverEarning" BIGINT NOT NULL DEFAULT 0;

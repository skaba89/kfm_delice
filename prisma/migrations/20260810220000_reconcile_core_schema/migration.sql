-- P0 reconciliation migration — forward-only and idempotent.
--
-- Root cause: the Prisma production schema evolved faster than the historical
-- PostgreSQL migration chain. A fresh `prisma migrate deploy` could therefore
-- report success while core columns such as Restaurant.plan and
-- Admin.restaurantId were still absent.
--
-- Safety rules:
--   * Never drop business data.
--   * Add missing columns with backwards-compatible defaults.
--   * Backfill tenant relations only when ownership can be inferred safely.
--   * Promote legacy INTEGER monetary columns to BIGINT (lossless widening).
--   * Add FK/index objects only when they do not already exist.

-- ────────────────────────────────────────────────────────────────
-- Restaurant: subscription + tenant runtime fields
-- ────────────────────────────────────────────────────────────────
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "trialEndsAt" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'fr';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "ownerEmail" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "ownerName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "ownerPhone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'GNF';
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "deliveryRadiusKm" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "loyaltyPointsRate" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION NOT NULL DEFAULT 9.5092;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION NOT NULL DEFAULT -13.7122;

CREATE INDEX IF NOT EXISTS "Restaurant_status_idx" ON "Restaurant"("status");
CREATE INDEX IF NOT EXISTS "Restaurant_plan_idx" ON "Restaurant"("plan");

-- Lossless widening for GNF amounts.
ALTER TABLE "Restaurant" ALTER COLUMN "deliveryFee" TYPE BIGINT USING "deliveryFee"::BIGINT;
ALTER TABLE "Restaurant" ALTER COLUMN "minDelivery" TYPE BIGINT USING "minDelivery"::BIGINT;

-- ────────────────────────────────────────────────────────────────
-- Admin: tenant relation + password lifecycle
-- ────────────────────────────────────────────────────────────────
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "restaurantId" TEXT;
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Best-effort deterministic backfill:
-- 1) use the principal restaurant only when an Account has EXACTLY ONE;
-- 2) otherwise, use the only restaurant when this is a legacy single-tenant DB.
-- Ambiguous multi-tenant rows deliberately remain NULL and are caught by the
-- blocking readiness check instead of being assigned to a random tenant.
WITH unique_principal AS (
  SELECT "accountId", MIN("id") AS "restaurantId"
  FROM "Restaurant"
  WHERE "accountId" IS NOT NULL AND "type" = 'principal'
  GROUP BY "accountId"
  HAVING COUNT(*) = 1
)
UPDATE "Admin" a
SET "restaurantId" = up."restaurantId"
FROM unique_principal up
WHERE a."restaurantId" IS NULL
  AND a."accountId" = up."accountId";

DO $$
DECLARE
  restaurant_count INTEGER;
  only_restaurant_id TEXT;
BEGIN
  SELECT COUNT(*), MIN("id") INTO restaurant_count, only_restaurant_id FROM "Restaurant";
  IF restaurant_count = 1 THEN
    UPDATE "Admin" SET "restaurantId" = only_restaurant_id WHERE "restaurantId" IS NULL;
  END IF;

  -- Fresh databases have no Admin rows at migration time, so the column can
  -- immediately become NOT NULL. Existing ambiguous multi-tenant rows are
  -- intentionally left nullable instead of being assigned to the wrong tenant.
  IF NOT EXISTS (SELECT 1 FROM "Admin" WHERE "restaurantId" IS NULL) THEN
    ALTER TABLE "Admin" ALTER COLUMN "restaurantId" SET NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Admin_restaurantId_fkey') THEN
    ALTER TABLE "Admin"
      ADD CONSTRAINT "Admin_restaurantId_fkey"
      FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "Admin_restaurantId_idx" ON "Admin"("restaurantId");

-- ────────────────────────────────────────────────────────────────
-- Customer: tenant relation + loyalty/security fields
-- ────────────────────────────────────────────────────────────────
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "restaurantId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'bronze';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

DO $$
DECLARE
  restaurant_count INTEGER;
  only_restaurant_id TEXT;
BEGIN
  SELECT COUNT(*), MIN("id") INTO restaurant_count, only_restaurant_id FROM "Restaurant";
  IF restaurant_count = 1 THEN
    UPDATE "Customer" SET "restaurantId" = only_restaurant_id WHERE "restaurantId" IS NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Customer" WHERE "restaurantId" IS NULL) THEN
    ALTER TABLE "Customer" ALTER COLUMN "restaurantId" SET NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Customer_restaurantId_fkey') THEN
    ALTER TABLE "Customer"
      ADD CONSTRAINT "Customer_restaurantId_fkey"
      FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- The current Prisma model scopes customer identity by restaurant.
DROP INDEX IF EXISTS "Customer_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_email_restaurantId_key"
  ON "Customer"("email", "restaurantId");
CREATE INDEX IF NOT EXISTS "Customer_restaurantId_idx" ON "Customer"("restaurantId");
CREATE INDEX IF NOT EXISTS "Customer_restaurantId_email_idx" ON "Customer"("restaurantId", "email");
ALTER TABLE "Customer" ALTER COLUMN "totalSpent" TYPE BIGINT USING "totalSpent"::BIGINT;

-- ────────────────────────────────────────────────────────────────
-- Driver: password lifecycle + tenant-scoped identity
-- ────────────────────────────────────────────────────────────────
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
DROP INDEX IF EXISTS "Driver_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Driver_email_restaurantId_key"
  ON "Driver"("email", "restaurantId");

-- ────────────────────────────────────────────────────────────────
-- Optional customer links used by current Prisma relations
-- ────────────────────────────────────────────────────────────────
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_customerId_fkey') THEN
    ALTER TABLE "Reservation"
      ADD CONSTRAINT "Reservation_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Review_customerId_fkey') THEN
    ALTER TABLE "Review"
      ADD CONSTRAINT "Review_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_customerId_fkey') THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "Reservation_customerId_idx" ON "Reservation"("customerId");
CREATE INDEX IF NOT EXISTS "Review_customerId_idx" ON "Review"("customerId");
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");

-- ────────────────────────────────────────────────────────────────
-- Lossless widening of legacy monetary INTEGER columns
-- ────────────────────────────────────────────────────────────────
ALTER TABLE "MenuItem" ALTER COLUMN "price" TYPE BIGINT USING "price"::BIGINT;
ALTER TABLE "Order" ALTER COLUMN "total" TYPE BIGINT USING "total"::BIGINT;
ALTER TABLE "Order" ALTER COLUMN "deliveryFee" TYPE BIGINT USING "deliveryFee"::BIGINT;
ALTER TABLE "Order" ALTER COLUMN "discount" TYPE BIGINT USING "discount"::BIGINT;
ALTER TABLE "Order" ALTER COLUMN "tax" TYPE BIGINT USING "tax"::BIGINT;
ALTER TABLE "Staff" ALTER COLUMN "salary" TYPE BIGINT USING "salary"::BIGINT;
ALTER TABLE "Invoice" ALTER COLUMN "subtotal" TYPE BIGINT USING "subtotal"::BIGINT;
ALTER TABLE "Invoice" ALTER COLUMN "tax" TYPE BIGINT USING "tax"::BIGINT;
ALTER TABLE "Invoice" ALTER COLUMN "total" TYPE BIGINT USING "total"::BIGINT;
ALTER TABLE "Quote" ALTER COLUMN "subtotal" TYPE BIGINT USING "subtotal"::BIGINT;
ALTER TABLE "Quote" ALTER COLUMN "discount" TYPE BIGINT USING "discount"::BIGINT;
ALTER TABLE "Quote" ALTER COLUMN "total" TYPE BIGINT USING "total"::BIGINT;
ALTER TABLE "Expense" ALTER COLUMN "amount" TYPE BIGINT USING "amount"::BIGINT;
ALTER TABLE "Payment" ALTER COLUMN "amount" TYPE BIGINT USING "amount"::BIGINT;
ALTER TABLE "LoyaltyReward" ALTER COLUMN "value" TYPE BIGINT USING "value"::BIGINT;

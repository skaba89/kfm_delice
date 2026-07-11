-- Migration: Add delivery assignment system + driver radius
-- Idempotent (uses IF NOT EXISTS)

-- Restaurant: delivery radius config
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "deliveryRadiusKm" INTEGER NOT NULL DEFAULT 10;

-- Order: delivery assignment fields
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "assignmentStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "proposedToDriverId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "proposedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryLat" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryLng" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Index for finding proposed deliveries
CREATE INDEX IF NOT EXISTS "Order_assignmentStatus_idx" ON "Order"("assignmentStatus");
CREATE INDEX IF NOT EXISTS "Order_proposedToDriverId_idx" ON "Order"("proposedToDriverId");
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION NOT NULL DEFAULT 9.5092;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION NOT NULL DEFAULT -13.7122;
-- Loyalty points rate (configurable by admin)
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "loyaltyPointsRate" INTEGER NOT NULL DEFAULT 1;

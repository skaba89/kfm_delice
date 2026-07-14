-- ────────────────────────────────────────────────────────────────────
-- Mission P3.8: LoyaltyTier table + Customer.tier column
-- ────────────────────────────────────────────────────────────────────
-- Configurable loyalty tiers per restaurant. Each tier defines:
--   - minSpent: minimum totalSpent to reach this tier
--   - discountPercent: % discount on all orders
--   - freeDelivery: free delivery for this tier
--   - freeDish: free dish per month
--   - color + icon: UI customization

CREATE TABLE IF NOT EXISTS "LoyaltyTier" (
  "id"              TEXT NOT NULL,
  "restaurantId"    TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "label"           TEXT NOT NULL DEFAULT '',
  "minSpent"        BIGINT NOT NULL DEFAULT 0,
  "discountPercent" INTEGER NOT NULL DEFAULT 0,
  "freeDelivery"    BOOLEAN NOT NULL DEFAULT false,
  "freeDish"        BOOLEAN NOT NULL DEFAULT false,
  "color"           TEXT NOT NULL DEFAULT '#cd7f32',
  "icon"            TEXT NOT NULL DEFAULT '',
  "active"          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyTier_restaurantId_name_key"
  ON "LoyaltyTier"("restaurantId", "name");
CREATE INDEX IF NOT EXISTS "LoyaltyTier_restaurantId_active_idx"
  ON "LoyaltyTier"("restaurantId", "active");

ALTER TABLE "LoyaltyTier"
  ADD CONSTRAINT "LoyaltyTier_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
  ON DELETE CASCADE;

-- Add tier column to Customer
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'bronze';
CREATE INDEX IF NOT EXISTS "Customer_tier_idx" ON "Customer"("tier");

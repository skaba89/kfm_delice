-- ────────────────────────────────────────────────────────────────────
-- Mission P2.6: PromoCode table — discount codes for checkout
-- ────────────────────────────────────────────────────────────────────
-- Each promo code is scoped to a restaurant (multi-tenant isolation).
-- Codes can be:
--   - percent (discountValue = percentage, e.g. 10 = 10% off)
--   - fixed   (discountValue = amount in GNF, e.g. 5000 = 5000 GNF off)
-- Limits:
--   - minOrderTotal : minimum cart total to apply the code
--   - maxUses       : total uses allowed (0 = unlimited)
--   - maxUsesPerUser: per-customer limit
--   - startsAt/expiresAt: validity window

CREATE TABLE IF NOT EXISTS "PromoCode" (
  "id"              TEXT NOT NULL,
  "code"            TEXT NOT NULL,
  "description"     TEXT NOT NULL DEFAULT '',
  "discountType"    TEXT NOT NULL DEFAULT 'percent',
  "discountValue"   BIGINT NOT NULL DEFAULT 0,
  "minOrderTotal"   BIGINT NOT NULL DEFAULT 0,
  "maxUses"         INTEGER NOT NULL DEFAULT 0,
  "usedCount"       INTEGER NOT NULL DEFAULT 0,
  "maxUsesPerUser"  INTEGER NOT NULL DEFAULT 1,
  "active"          BOOLEAN NOT NULL DEFAULT true,
  "startsAt"        TIMESTAMP(3),
  "expiresAt"       TIMESTAMP(3),
  "restaurantId"    TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PromoCode_restaurantId_code_key"
  ON "PromoCode"("restaurantId", "code");
CREATE INDEX IF NOT EXISTS "PromoCode_restaurantId_active_idx"
  ON "PromoCode"("restaurantId", "active");
CREATE INDEX IF NOT EXISTS "PromoCode_code_idx"
  ON "PromoCode"("code");

ALTER TABLE "PromoCode"
  ADD CONSTRAINT "PromoCode_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
  ON DELETE CASCADE;

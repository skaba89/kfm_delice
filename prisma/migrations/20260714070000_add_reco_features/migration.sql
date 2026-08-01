-- ────────────────────────────────────────────────────────────────────
-- Reco 1-5: Commission + Marges + Favoris + Analytics columns
-- ────────────────────────────────────────────────────────────────────

-- Reco 1: Commission plateforme
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "platformCommission" BIGINT NOT NULL DEFAULT 0;

-- Reco 2: Coût recettes & marges
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "ingredientCost" BIGINT NOT NULL DEFAULT 0;

-- Reco 3: Favoris client
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "favoriteItemIds" TEXT NOT NULL DEFAULT '[]';

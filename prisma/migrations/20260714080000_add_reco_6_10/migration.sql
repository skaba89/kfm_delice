-- Reco 6-10: Birthday, autoAlert, audit logs access
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "birthday" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "autoAlert" BOOLEAN NOT NULL DEFAULT true;

-- Reco 11-15: Parrainage, Planning staff, Fournisseurs, Photos
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "referralCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "referredBy" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "weeklySchedule" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "totalHours" REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "Supplier" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL DEFAULT 'general',
  "notes" TEXT NOT NULL DEFAULT '',
  "restaurantId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Supplier_restaurantId_idx" ON "Supplier"("restaurantId");
CREATE INDEX IF NOT EXISTS "Supplier_restaurantId_category_idx" ON "Supplier"("restaurantId", "category");
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;

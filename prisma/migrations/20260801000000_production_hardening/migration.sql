-- Mission 1-4-7-9: Production hardening migration
-- Adds: OrderItem, IdempotencyKey, PromotionRedemption, WebhookEvent,
--       CustomerFavorite, RefreshToken, RevokedToken models
-- Adds: tokenVersion, mustChangePassword, loginAttempts, lockedUntil to PlatformAdmin
-- Adds: tokenVersion to Admin and Customer

-- ── Alter PlatformAdmin: add session security fields ──
ALTER TABLE "PlatformAdmin" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlatformAdmin" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformAdmin" ADD COLUMN IF NOT EXISTS "loginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlatformAdmin" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- ── Alter Admin: add tokenVersion ──
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- ── Alter Customer: add tokenVersion ──
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- ── Mission 1: OrderItem — normalized line items ──
CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPrice" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "lineTotal" BIGINT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");
CREATE INDEX IF NOT EXISTS "OrderItem_restaurantId_idx" ON "OrderItem"("restaurantId");
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;

-- ── Mission 2: IdempotencyKey ──
CREATE TABLE IF NOT EXISTS "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT,
    "requestHash" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyKey_restaurantId_key_key" ON "IdempotencyKey"("restaurantId", "key");
CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyKey_orderId_key" ON "IdempotencyKey"("orderId");
CREATE INDEX IF NOT EXISTS "IdempotencyKey_restaurantId_status_idx" ON "IdempotencyKey"("restaurantId", "status");
CREATE INDEX IF NOT EXISTS "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL;

-- ── Mission 3: PromotionRedemption ──
CREATE TABLE IF NOT EXISTS "PromotionRedemption" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerFingerprint" TEXT NOT NULL DEFAULT '',
    "discountAmount" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PromotionRedemption_orderId_key" ON "PromotionRedemption"("orderId");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_promoCodeId_createdAt_idx" ON "PromotionRedemption"("promoCodeId", "createdAt");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_restaurantId_createdAt_idx" ON "PromotionRedemption"("restaurantId", "createdAt");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_customerId_idx" ON "PromotionRedemption"("customerId");
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_promoCodeId_fkey"
    FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE CASCADE;
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE;
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;

-- ── Mission 4: WebhookEvent ──
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "restaurantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_provider_providerEventId_key" ON "WebhookEvent"("provider", "providerEventId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_provider_status_idx" ON "WebhookEvent"("provider", "status");
CREATE INDEX IF NOT EXISTS "WebhookEvent_restaurantId_createdAt_idx" ON "WebhookEvent"("restaurantId", "createdAt");
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL;

-- ── Mission 9: CustomerFavorite ──
CREATE TABLE IF NOT EXISTS "CustomerFavorite" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerFavorite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerFavorite_customerId_menuItemId_key" ON "CustomerFavorite"("customerId", "menuItemId");
CREATE INDEX IF NOT EXISTS "CustomerFavorite_customerId_idx" ON "CustomerFavorite"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerFavorite_restaurantId_idx" ON "CustomerFavorite"("restaurantId");
ALTER TABLE "CustomerFavorite" ADD CONSTRAINT "CustomerFavorite_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE;
ALTER TABLE "CustomerFavorite" ADD CONSTRAINT "CustomerFavorite_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE;
ALTER TABLE "CustomerFavorite" ADD CONSTRAINT "CustomerFavorite_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;

-- ── Mission 7: RefreshToken ──
CREATE TABLE IF NOT EXISTS "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "restaurantId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "rotatedFrom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_userType_idx" ON "RefreshToken"("userId", "userType");
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- ── Mission 7: RevokedToken ──
CREATE TABLE IF NOT EXISTS "RevokedToken" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'revoked',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RevokedToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RevokedToken_jti_key" ON "RevokedToken"("jti");
CREATE INDEX IF NOT EXISTS "RevokedToken_expiresAt_idx" ON "RevokedToken"("expiresAt");

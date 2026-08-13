-- KFM Delice — Enterprise custom domain provisioning state
-- Deliberately separate from RestaurantConfig.customDomain, which remains a
-- compatibility shadow populated only after provider verification.

CREATE TABLE "CustomDomainMapping" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "accountId" TEXT,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "provider" TEXT NOT NULL DEFAULT 'render',
    "providerDomainId" TEXT NOT NULL DEFAULT '',
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "lastCheckedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomDomainMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomDomainMapping_restaurantId_key" ON "CustomDomainMapping"("restaurantId");
CREATE UNIQUE INDEX "CustomDomainMapping_domain_key" ON "CustomDomainMapping"("domain");
CREATE INDEX "CustomDomainMapping_accountId_status_idx" ON "CustomDomainMapping"("accountId", "status");
CREATE INDEX "CustomDomainMapping_status_updatedAt_idx" ON "CustomDomainMapping"("status", "updatedAt");

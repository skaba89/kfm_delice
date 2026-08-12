-- KFM Delice — pending public onboarding email verification
-- No SaaS Account/Restaurant/Admin exists before this intent is consumed.

CREATE TABLE "PublicRegistrationIntent" (
    "id" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PublicRegistrationIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicRegistrationIntent_ownerEmail_key" ON "PublicRegistrationIntent"("ownerEmail");
CREATE UNIQUE INDEX "PublicRegistrationIntent_tokenHash_key" ON "PublicRegistrationIntent"("tokenHash");
CREATE INDEX "PublicRegistrationIntent_status_expiresAt_idx" ON "PublicRegistrationIntent"("status", "expiresAt");
CREATE INDEX "PublicRegistrationIntent_expiresAt_idx" ON "PublicRegistrationIntent"("expiresAt");

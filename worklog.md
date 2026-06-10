---
Task ID: 1
Agent: Super Z (Main)
Task: Générer un audit technique complet et amélioré de KFM Delice en PDF

Work Log:
- Explored codebase with two parallel agents (architecture/security + UX/functionality)
- Collected detailed evidence for all 7 audit dimensions
- Generated radar chart visualization (radar_chart.png)
- Created cover page HTML with Template 03 (Monolith) style, rendered via html2poster.js
- Built comprehensive ReportLab PDF body with 10 sections, 9 tables, color-coded callout boxes
- Merged cover + body PDFs via pypdf with metadata
- Ran pdf_qa.py quality checks (8 passed, 4 minor warnings)

Stage Summary:
- Final PDF: /home/z/my-project/download/KFM-Delice-Audit-Technique.pdf (412 KB, ~14 pages)
- Cover HTML: /home/z/my-project/download/cover.html
- Radar chart: /home/z/my-project/download/radar_chart.png
- All 7 dimensions analyzed with detailed findings, evidence, and actionable recommendations
- 4-phase production roadmap defined (~11 weeks total)

---
Task ID: 1.2 + 1.3
Agent: Security Fix Agent
Task: Two Security Fixes — Admin Password Verification + Seed Endpoint Protection

Work Log:

### Fix 1 (Task 1.2): Admin Password Change Without Verification
- Updated `adminPatchSchema` in `src/lib/validations.ts`:
  - Added `currentPassword` optional field
  - Added `.refine()` that enforces: if `password` is provided, `currentPassword` must also be present
  - Error message: "Mot de passe actuel requis pour changer le mot de passe"
- Updated PATCH handler in `src/app/api/admins/route.ts`:
  - Imported `verifyPassword` from `@/lib/auth`
  - When password is provided and the target admin ID matches the requesting admin's ID (self-change), verify `currentPassword` against stored hash
  - If verification fails, return 400 with "Mot de passe actuel incorrect"
  - If a different admin changes another admin's password, currentPassword is not required (admin-to-admin override)
  - Added admin existence check with 404 response if target not found

### Fix 2 (Task 1.3): Protect Seed Endpoint in Production
- Added `SEED_TOKEN` environment variable check in `src/app/api/seed/route.ts`:
  - In production bootstrap mode (no admin exists), requires `seedToken` from query param or request body
  - If `SEED_TOKEN` env var is not configured in production, returns 500 with guidance message
  - If provided token doesn't match, returns 401 with "Token d'initialisation invalide"
  - In development, allows unauthenticated bootstrap for convenience
- Added in-memory rate limiter for seed endpoint:
  - Max 3 attempts per IP per 60-second window
  - Returns 429 with "Trop de tentatives" and Retry-After header when exceeded
  - Uses `x-forwarded-for` / `x-real-ip` headers for client IP detection

Files Modified:
- `src/lib/validations.ts` — adminPatchSchema with currentPassword + refine
- `src/app/api/admins/route.ts` — PATCH handler password verification logic
- `src/app/api/seed/route.ts` — SEED_TOKEN check, production bootstrap protection, rate limiter

Lint: No new errors introduced by changes (all pre-existing)

---
Task ID: 1.4
Agent: Rate Limit Fix Agent
Task: Rate Limiting Persistence Fix

Work Log:

### Problem
- `src/middleware.ts` used an in-memory `Map<string, RateEntry>` for rate limiting
- Counters reset on server restart
- In multi-instance deployments, each instance had separate counters (effectively multiplying the rate limit)

### Fix Implementation

1. **Created `src/lib/rate-limit.ts`** — Complete rewrite with store abstraction:
   - `RateLimitStore` interface with `increment(key, windowMs)` → `Promise<{ count, ttl }>`
   - `MemoryRateLimitStore` — in-memory Map implementation (preserves existing behavior, used by default)
   - `UpstashRateLimitStore` — persistent via Upstash Redis REST API (`fetch`-only, fully Edge-compatible)
     - Uses Redis pipeline: INCR + EVAL (Lua: set EXPIRE only on first request) + TTL
     - Graceful fallback: if Upstash is unreachable, allows the request rather than blocking everyone
   - `createRateLimitStore()` factory — auto-detects `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` env vars, falls back to in-memory when not set
   - `rateLimit()` convenience helper — async version replacing the old sync function, returns `{ allowed, remaining }`

2. **Updated `src/middleware.ts`**:
   - Removed inline rate-limit code (Map, cleanup, `rateLimit` function)
   - Imported `rateLimit` from `@/lib/rate-limit`
   - Changed both rate-limit calls to `await rateLimit(...)` (now async)
   - Changed return field from `success` to `allowed` (matching new API)

3. **Updated 4 API route files** (sync → async + `success` → `allowed`):
   - `src/app/api/login/route.ts`
   - `src/app/api/customer-login/route.ts`
   - `src/app/api/customer-register/route.ts`
   - `src/app/api/driver-login/route.ts`

### Key Design Decisions
- **Backward-compatible**: Zero config changes needed for existing deployments (falls back to in-memory)
- **Edge-compatible**: All code uses `fetch` (no Node.js `net`, `fs`, etc.)
- **Fail-open**: If Upstash is unreachable, the request is allowed (avoids blocking all users on infra failure)
- **Singleton store**: Factory caches the store instance to avoid re-creating on every middleware invocation

Files Modified:
- `src/lib/rate-limit.ts` — Rewritten with RateLimitStore interface + MemoryRateLimitStore + UpstashRateLimitStore + factory + async rateLimit helper
- `src/middleware.ts` — Removed inline rate-limit code, uses imported async `rateLimit`
- `src/app/api/login/route.ts` — `await rateLimit()`, `allowed` instead of `success`
- `src/app/api/customer-login/route.ts` — same
- `src/app/api/customer-register/route.ts` — same
- `src/app/api/driver-login/route.ts` — same

Lint: No new errors introduced by changes

---
Task ID: 1.1
Agent: Security Fix Agent
Task: Critical Security Fix — Payment Webhook Bypass via HMAC Signature Verification

Work Log:

### Problem
The PATCH handler in `src/app/api/payment/route.ts` had a critical vulnerability: anyone could send `{ webhook: true, id: "...", status: "paid" }` to mark any payment as paid without authentication. The `webhook` flag in the request body bypassed all auth checks.

### Fix Applied

1. **Added HMAC-SHA256 signature verification** to `src/app/api/payment/route.ts`:
   - Imported `createHmac` and `timingSafeEqual` from Node.js `crypto` module
   - Added `WEBHOOK_SECRET` environment variable (graceful — empty string if not set, making webhook auth fail)
   - Created `generateWebhookSignature(paymentId)`: computes HMAC-SHA256 of payment ID using WEBHOOK_SECRET
   - Created `verifyWebhookSignature(paymentId, signature)`: validates signature with timing-safe comparison to prevent timing attacks
   - Returns `false` if WEBHOOK_SECRET is not configured (fail-closed)

2. **Updated PATCH handler** webhook path:
   - When `body.webhook === true`, extracts `x-webhook-signature` header
   - Validates header format via `webhookSignatureSchema` (must be 64-char hex string)
   - Verifies HMAC-SHA256 signature against payment ID
   - Returns 401 "Signature webhook invalide" if signature is missing, malformed, or invalid
   - Admin manual update path (non-webhook) remains unchanged

3. **Updated POST handler** simulated webhook callback:
   - Replaced direct database updates in setTimeout with a proper internal PATCH request
   - Generates HMAC signature via `generateWebhookSignature(payment.id)`
   - Calls the PATCH endpoint with `x-webhook-signature` header and `webhook: true` body flag
   - This ensures the webhook simulation goes through the same auth verification as real webhooks

4. **Added validation schemas** to `src/lib/validations.ts`:
   - `webhookSignatureSchema`: validates signature header format (64-char hex SHA-256)
   - `webhookPaymentStatusSchema`: extends `paymentStatusSchema` with `webhook: z.literal(true)`

5. **Added WEBHOOK_SECRET** to `.env`:
   - `WEBHOOK_SECRET=WEBHOOK_SECRET_REDACTED`

Files Modified:
- `src/app/api/payment/route.ts` — HMAC functions, PATCH handler fix, POST webhook simulation fix
- `src/lib/validations.ts` — webhookSignatureSchema, webhookPaymentStatusSchema
- `.env` — WEBHOOK_SECRET added

Lint: No new errors introduced (all pre-existing)

---
Task ID: 1.5
Agent: Customer Relations FK Migration Agent
Task: Fix Customer Relations — customerName → customerId Foreign Key

Work Log:

### Problem
Order, Reservation, and Review models used `customerName` (string) instead of `customerId` (FK) to link to customers. This broke with duplicate names and prevented proper relational queries.

### Migration Approach (Backward Compatible)
- Added `customerId` as an OPTIONAL field to Order, Reservation, and Review
- Kept `customerName` as a fallback/display field
- Updated API routes to set `customerId` when a customer is authenticated
- Updated Prisma schema with new relations and indexes
- Existing data with only `customerName` continues to work

### Changes Made

1. **Prisma Schema** (`prisma/schema.prisma`):
   - Added `customerId String?` and `customer Customer? @relation(...)` to Order, Reservation, Review
   - Added `@@index([customerId])` to Order, Reservation, Review
   - Added reverse relations `orders Order[]`, `reservations Reservation[]`, `reviews Review[]` to Customer model

2. **Prisma Migration**: Ran `npx prisma db push` — database synced successfully

3. **API Routes**:
   - `src/app/api/orders/route.ts`:
     - GET (customer): Filters by `customerId` FK with fallback to `customerName` where `customerId` is null
     - GET (admin): Includes `customer: { select: { id, name, email } }` relation
     - POST: Tries `authenticateAny` to set `customerId` on the order when authenticated as customer
   - `src/app/api/reservations/route.ts`:
     - Same pattern as orders: FK-based filtering for customers, include customer relation, set customerId on POST
   - `src/app/api/reviews/route.ts`:
     - GET: Includes `customer: { select: { id, name, email } }` relation
     - POST: Sets `customerId: customer.id` alongside `customerName: customer.name` (already authenticated via `authenticateCustomer`)

4. **Seed Data** (`src/app/api/seed/route.ts`):
   - Captured customer IDs from upserts into a `customerMap` (name→id)
   - Added `customerId: customerMap.get("Name") ?? null` to all matching reservation, order, and review seed entries
   - Walk-in/non-matching customers (e.g., "Walk-in Client", "Aissatou Touré") correctly remain without customerId

5. **Validation Schemas** (`src/lib/validations.ts`):
   - Added `customerId: z.string().optional()` to: `orderSchema`, `reservationSchema`, `reviewSchema`, `orderPatchSchema`, `reservationPatchSchema`

### Backward Compatibility
- `customerName` remains as a field (used for display and fallback)
- `customerId` is optional (walk-in orders without customer account still work)
- Existing data with only `customerName` continues to work
- Customer GET queries use `OR: [{ customerId: id }, { customerName: name, customerId: null }]` to catch both FK-linked and legacy records

Lint: No new errors introduced by changes

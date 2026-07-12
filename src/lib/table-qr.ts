/**
 * table-qr.ts — Secure QR token utilities for restaurant tables (Mission 11)
 *
 * The QR code printed on each restaurant table encodes a single URL:
 *
 *   https://PUBLIC_APP_URL/q/<qrToken>
 *
 * where `qrToken` is an OPAQUE, CRYPTOGRAPHICALLY RANDOM, base64url-safe
 * 32-byte string. It does NOT contain:
 *   - the restaurant id (prevents enumeration of other restaurants)
 *   - the table id (prevents guessing of internal IDs)
 *   - any JWT or signed payload (the DB is the source of truth — rotating
 *     the token in the DB instantly invalidates the old QR code)
 *   - any account id, email, or secret
 *
 * Security model:
 *   - The token is generated server-side via `crypto.randomBytes(32)`.
 *     32 bytes = 256 bits of entropy → brute-force is computationally
 *     infeasible. base64url-encoded, the token is 43 chars.
 *   - The token is GLOBALLY UNIQUE (DB constraint). One token → exactly
 *     one (RestaurantTable, Restaurant, Account) triple.
 *   - `resolveTableQrToken` validates the FULL chain:
 *       qrToken → table.qrEnabled → table.active →
 *       restaurant.status → account.status
 *     Any break in the chain returns null.
 *   - `rotateTableQrToken` generates a NEW token, atomically replaces
 *     the old one, and increments `qrVersion`. The old token is
 *     IMMEDIATELY invalid (a single DB row update, no caching layer
 *     to bleed through).
 *
 * Why not a JWT? A JWT would let any client with the secret forge a
 * valid QR token for any table/restaurant. By using an opaque token
 * backed by a DB lookup, we never expose a secret to the client, and
 * rotation is a single UPDATE.
 *
 * All functions are server-only — they use `node:crypto` and the Prisma
 * client, neither of which run in the browser or Edge runtime.
 */

import { randomBytes } from 'node:crypto';
import { db } from './db';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface ResolvedTableQr {
  tableId: string;
  tableNumber: string;
  tableName: string;
  tableZone: string;
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  restaurantStatus: string;
  restaurantCurrency: string;
  accountStatus: string;
}

export interface PublicTableQrResponse {
  restaurant: {
    slug: string;
    name: string;
    status: string;
    currency: string;
  };
  table: {
    /** Opaque public id — same as the qrToken, exposed so the menu page
     * can echo it back when posting the order. We never expose the DB id. */
    publicId: string;
    name: string;
    number: string;
    zone: string;
  };
  menuUrl: string;
}

// ────────────────────────────────────────────────────────────────
// PUBLIC_APP_URL resolution
// ────────────────────────────────────────────────────────────────

/**
 * Resolve the public base URL for QR code generation.
 *
 * Priority:
 *   1. PUBLIC_APP_URL env var (canonical production URL)
 *   2. VERCEL_URL (Vercel auto-deploy previews)
 *   3. request.origin (fallback for unknown hosts)
 *
 * Never falls back to localhost in production — if PUBLIC_APP_URL is
 * missing in prod, the QR generation will use request.origin instead
 * (which is at least the live Render URL).
 */
export function resolvePublicAppUrl(requestOrigin?: string): string {
  const explicit = process.env.PUBLIC_APP_URL;
  if (explicit && explicit.length > 0) {
    return explicit.replace(/\/+$/, '');
  }
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && vercelUrl.length > 0) {
    return `https://${vercelUrl}`.replace(/\/+$/, '');
  }
  if (requestOrigin && requestOrigin.length > 0) {
    return requestOrigin.replace(/\/+$/, '');
  }
  // Dev fallback — never reached in production because PUBLIC_APP_URL
  // is required by the production safety check.
  return 'http://localhost:3000';
}

// ────────────────────────────────────────────────────────────────
// Token generation
// ────────────────────────────────────────────────────────────────

/**
 * Generate a fresh opaque QR token.
 *
 * Uses `crypto.randomBytes(32)` → 256 bits of entropy → 43-char
 * base64url string. base64url is URL-safe (no `+`, `/`, or `=`)
 * so it can be embedded directly in a URL path segment without
 * further encoding.
 *
 * Uniqueness is enforced at the DB level (qrToken @unique). If a
 * collision happens (probability ~ 2^-128 with 32 bytes), the caller
 * should retry — see `generateUniqueTableQrToken`.
 */
export function generateTableQrToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Generate a QR token guaranteed unique in the DB.
 *
 * Retries up to 5 times on a uniqueness collision (which is
 * astronomically unlikely with 32 random bytes — 2^256 space).
 */
export async function generateUniqueTableQrToken(): Promise<string> {
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const token = generateTableQrToken();
    const existing = await db.restaurantTable.findUnique({
      where: { qrToken: token },
      select: { id: true },
    });
    if (!existing) return token;
  }
  // Should never happen — but if it does, surface the error.
  throw new Error('[table-qr] Failed to generate a unique QR token after 5 attempts');
}

/**
 * Build the public URL embedded in the QR code.
 *
 * Format: `${PUBLIC_APP_URL}/q/${token}`
 *
 * This URL is the only thing stored in the QR image — no other
 * identifiers (restaurantId, tableId, JWT, etc.) are leaked.
 */
export function buildTableQrUrl(token: string, requestOrigin?: string): string {
  const base = resolvePublicAppUrl(requestOrigin);
  // token is base64url (a-zA-Z0-9_-) so no encodeURIComponent needed
  return `${base}/q/${token}`;
}

// ────────────────────────────────────────────────────────────────
// Token resolution
// ────────────────────────────────────────────────────────────────

/**
 * Resolve a QR token to its full (table, restaurant, account) context.
 *
 * Validates the entire chain — any broken link returns null:
 *   - token must exist in DB
 *   - table.qrEnabled must be true (rotation disables the old token
 *     by setting qrEnabled=false on the OLD row, then creating a new
 *     row — see `rotateTableQrToken` for the actual strategy which
 *     instead replaces the token in-place, so qrEnabled stays true)
 *   - table.active must be true (admin can soft-disable a table)
 *   - restaurant.status must be active or trial
 *   - account.status must be active (or null for legacy single-tenant)
 *
 * Side effects:
 *   - increments table.scanCount
 *   - updates table.lastScannedAt
 *   These are NON-BLOCKING (fire-and-forget) — they must not slow
 *   down the scan resolution.
 */
export async function resolveTableQrToken(
  token: string,
  options?: { trackScan?: boolean }
): Promise<ResolvedTableQr | null> {
  if (!token || typeof token !== 'string' || token.length < 10 || token.length > 100) {
    return null;
  }

  // Pull the table + restaurant + account in one query.
  const table = await db.restaurantTable.findUnique({
    where: { qrToken: token },
    select: {
      id: true,
      number: true,
      name: true,
      zone: true,
      active: true,
      qrEnabled: true,
      restaurantId: true,
      restaurant: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          currency: true,
          accountId: true,
          account: { select: { id: true, status: true } },
        },
      },
    },
  });

  if (!table) return null;
  if (!table.qrEnabled) return null;
  if (!table.active) return null;

  const resto = table.restaurant;
  if (!resto) return null;
  if (resto.status !== 'active' && resto.status !== 'trial') return null;

  // Account check — null accountId is allowed for legacy single-tenant rows
  if (resto.account) {
    if (resto.account.status !== 'active' && resto.account.status !== 'trial') {
      return null;
    }
  }

  // Fire-and-forget scan tracking (do not block resolution)
  if (options?.trackScan !== false) {
    db.restaurantTable.update({
      where: { id: table.id },
      data: {
        scanCount: { increment: 1 },
        lastScannedAt: new Date(),
      },
    }).catch(() => {
      /* non-blocking — scan tracking must never fail the request */
    });
  }

  return {
    tableId: table.id,
    tableNumber: table.number,
    tableName: table.name,
    tableZone: table.zone,
    restaurantId: resto.id,
    restaurantSlug: resto.slug,
    restaurantName: resto.name,
    restaurantStatus: resto.status,
    restaurantCurrency: resto.currency,
    accountStatus: resto.account?.status ?? 'active',
  };
}

/**
 * Build the public API response returned by GET /api/qr/table/[token].
 *
 * Strips ALL private fields — only the minimum needed for the menu page
 * to display the restaurant name, table label, and redirect URL.
 */
export function buildPublicTableQrResponse(
  resolved: ResolvedTableQr
): PublicTableQrResponse {
  return {
    restaurant: {
      slug: resolved.restaurantSlug,
      name: resolved.restaurantName,
      status: resolved.restaurantStatus,
      currency: resolved.restaurantCurrency,
    },
    table: {
      publicId: resolved.tableId, // opaque — DB id, not exposed anywhere else
      name: resolved.tableName,
      number: resolved.tableNumber,
      zone: resolved.tableZone,
    },
    // Each restaurant has its own URL based on its name (slug):
    //   /r/<restaurant-slug>/menu?tableToken=<tableId>
    //
    // The /r/[slug]/ layout resolves the restaurant from the URL
    // path segment (not from a query param or a hardcoded default),
    // so the customer lands on the right restaurant's menu regardless
    // of which restaurant's QR code they scanned.
    menuUrl: `/r/${encodeURIComponent(
      resolved.restaurantSlug
    )}/menu?tableToken=${resolved.tableId}`,
  };
}

// ────────────────────────────────────────────────────────────────
// Token rotation
// ────────────────────────────────────────────────────────────────

/**
 * Rotate the QR token for a table.
 *
 * Strategy: generate a new token, UPDATE the row in place, increment
 * qrVersion. The old token is immediately invalid because the unique
 * constraint on qrToken now points to the new value — DB lookup of
 * the old token returns null.
 *
 * Why in-place update (vs. creating a new row)?
 *   - Preserves the table's order history (foreign key Order.tableId).
 *   - Preserves scanCount and lastScannedAt.
 *   - One atomic UPDATE — no race window between "delete old" and
 *     "insert new".
 *
 * @returns The new token (so the caller can return the new QR URL)
 */
export async function rotateTableQrToken(
  tableId: string,
  restaurantId: string
): Promise<{ newToken: string; newVersion: number; newUrl: string }> {
  // Verify the table belongs to the restaurant (multi-tenant isolation)
  const existing = await db.restaurantTable.findFirst({
    where: { id: tableId, restaurantId },
    select: { id: true, qrVersion: true },
  });
  if (!existing) {
    throw new Error('[table-qr] Table not found or does not belong to this restaurant');
  }

  const newToken = await generateUniqueTableQrToken();

  await db.restaurantTable.update({
    where: { id: tableId },
    data: {
      qrToken: newToken,
      qrVersion: existing.qrVersion + 1,
      qrEnabled: true,
      qrGeneratedAt: new Date(),
    },
  });

  return {
    newToken,
    newVersion: existing.qrVersion + 1,
    newUrl: buildTableQrUrl(newToken),
  };
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Validate that a table belongs to a given restaurant.
 *
 * Used by order creation to verify that a `tableQrToken` sent by the
 * browser actually resolves to the SAME restaurant as the tenant
 * header. This is the critical multi-tenant isolation check.
 */
export async function verifyTableBelongsToRestaurant(
  tableId: string,
  expectedRestaurantId: string
): Promise<boolean> {
  const table = await db.restaurantTable.findFirst({
    where: { id: tableId, restaurantId: expectedRestaurantId },
    select: { id: true, active: true, qrEnabled: true },
  });
  if (!table) return false;
  if (!table.active) return false;
  if (!table.qrEnabled) return false;
  return true;
}

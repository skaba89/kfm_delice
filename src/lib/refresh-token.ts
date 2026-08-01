/**
 * Refresh Token Service — Mission 7
 *
 * Implements rotatable refresh tokens with:
 *   - SHA-256 hashed storage (plaintext never stored)
 *   - Rotation: each use invalidates the old token and issues a new one
 *   - Revocation: explicit revoke by userId (logout, password change)
 *   - Expiration: tokens expire after REFRESH_TOKEN_TTL_DAYS (default 30)
 *   - Audit trail: rotatedFrom links the chain
 *
 * Flow:
 *   1. Login → issue access JWT (15min) + refresh token (30 days)
 *   2. Access JWT expires → client calls /api/refresh with refresh token
 *   3. Server verifies refresh token → issues new access JWT + new refresh token
 *   4. Old refresh token is revoked (rotatedFrom set on new token)
 *   5. Logout → revoke all refresh tokens for the user
 */

import { db } from './db';
import { createHash, randomBytes } from 'crypto';
import { generateToken } from './auth';

const REFRESH_TOKEN_TTL_DAYS = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10);
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface RefreshTokenPayload {
  userId: string;
  userType: 'admin' | 'customer' | 'driver' | 'platform_admin';
  email: string;
  role: string;
  restaurantId?: string;
  restaurantSlug?: string;
  tokenVersion?: number; // Mission 5: for session revocation
}

/**
 * Issue a new refresh token + access JWT for a user.
 * Stores the SHA-256 hash of the refresh token in the DB.
 */
export async function issueTokenPair(payload: RefreshTokenPayload): Promise<TokenPair> {
  // Generate a cryptographically random refresh token
  const refreshToken = randomBytes(48).toString('base64url');
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  // Store the hash (never the plaintext)
  await db.refreshToken.create({
    data: {
      tokenHash,
      userId: payload.userId,
      userType: payload.userType,
      restaurantId: payload.restaurantId || null,
      expiresAt,
    },
  });

  // Issue a short-lived access JWT — Mission 5: include tokenVersion
  const accessToken = generateToken({
    id: payload.userId,
    email: payload.email,
    role: payload.role,
    type: payload.userType,
    restaurantId: payload.restaurantId,
    restaurantSlug: payload.restaurantSlug,
    tokenVersion: payload.tokenVersion,
  });

  return { accessToken, refreshToken, expiresAt };
}

/**
 * Verify a refresh token and issue a new token pair (rotation).
 *
 * Mission 5 (Phase 3): The rotation is now TRANSACTIONAL.
 *   1. Atomically revoke the old token (UPDATE ... WHERE revokedAt IS NULL)
 *      — if 0 rows updated, another concurrent request already rotated it.
 *   2. Create the new refresh token in the same transaction.
 *   3. Read tokenVersion from the user record to include in the new JWT.
 *
 * Returns null if the token is invalid, expired, or already revoked.
 */
export async function rotateRefreshToken(
  refreshToken: string
): Promise<TokenPair | null> {
  const tokenHash = hashToken(refreshToken);

  // Find the token in the DB
  const stored = await db.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!stored) return null;
  if (stored.revokedAt) return null; // already used/revoked
  if (stored.expiresAt < new Date()) return null; // expired

  // Load the user to build the new access JWT payload — Mission 5: include tokenVersion
  let payload: RefreshTokenPayload | null = null;
  if (stored.userType === 'admin') {
    const admin = await db.admin.findUnique({
      where: { id: stored.userId },
      select: { id: true, email: true, role: true, restaurantId: true, status: true, tokenVersion: true },
    });
    if (!admin || admin.status === 'inactive') return null;
    const restaurant = await db.restaurant.findUnique({
      where: { id: admin.restaurantId },
      select: { slug: true },
    });
    payload = {
      userId: admin.id,
      userType: 'admin',
      email: admin.email,
      role: admin.role,
      restaurantId: admin.restaurantId,
      restaurantSlug: restaurant?.slug || '',
      tokenVersion: admin.tokenVersion,
    };
  } else if (stored.userType === 'customer') {
    const customer = await db.customer.findUnique({
      where: { id: stored.userId },
      select: { id: true, email: true, restaurantId: true, status: true, tokenVersion: true },
    });
    if (!customer || customer.status === 'inactive') return null;
    const restaurant = await db.restaurant.findUnique({
      where: { id: customer.restaurantId },
      select: { slug: true },
    });
    payload = {
      userId: customer.id,
      userType: 'customer',
      email: customer.email,
      role: 'customer',
      restaurantId: customer.restaurantId,
      restaurantSlug: restaurant?.slug || '',
      tokenVersion: customer.tokenVersion,
    };
  } else if (stored.userType === 'driver') {
    const driver = await db.driver.findUnique({
      where: { id: stored.userId },
      select: { id: true, email: true, restaurantId: true, status: true },
    });
    if (!driver) return null;
    const restaurant = await db.restaurant.findUnique({
      where: { id: driver.restaurantId },
      select: { slug: true },
    });
    payload = {
      userId: driver.id,
      userType: 'driver',
      email: driver.email,
      role: 'driver',
      restaurantId: driver.restaurantId,
      restaurantSlug: restaurant?.slug || '',
    };
  } else if (stored.userType === 'platform_admin') {
    const platformAdmin = await db.platformAdmin.findUnique({
      where: { id: stored.userId },
      select: { id: true, email: true, role: true, status: true, tokenVersion: true },
    });
    if (!platformAdmin || platformAdmin.status === 'inactive') return null;
    payload = {
      userId: platformAdmin.id,
      userType: 'platform_admin',
      email: platformAdmin.email,
      role: platformAdmin.role,
      tokenVersion: platformAdmin.tokenVersion,
    };
  }

  if (!payload) return null;

  // ── Mission 5: Transactional rotation ──
  // Atomically revoke the old token ONLY IF it's not already revoked.
  // This prevents race conditions where two concurrent requests try to
  // rotate the same token. The `updateMany` with `where: { revokedAt: null }`
  // ensures only one of them succeeds.
  try {
    const result = await db.$transaction(async (tx) => {
      // Conditional update: only revokes if not already revoked
      const updateResult = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (updateResult.count === 0) {
        // Another concurrent request already rotated this token
        throw new Error('TOKEN_ALREADY_ROTATED');
      }

      // Issue the new refresh token
      const newRefreshToken = randomBytes(48).toString('base64url');
      const newTokenHash = hashToken(newRefreshToken);
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

      await tx.refreshToken.create({
        data: {
          tokenHash: newTokenHash,
          userId: stored.userId,
          userType: stored.userType,
          restaurantId: stored.restaurantId || null,
          expiresAt,
          rotatedFrom: tokenHash,
        },
      });

      return { newRefreshToken, newTokenHash, expiresAt };
    }, {
      timeout: 10000,
    });

    // Issue the new access JWT (outside the transaction — stateless)
    const accessToken = generateToken({
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      type: payload.userType,
      restaurantId: payload.restaurantId,
      restaurantSlug: payload.restaurantSlug,
      tokenVersion: payload.tokenVersion,
    });

    return {
      accessToken,
      refreshToken: result.newRefreshToken,
      expiresAt: result.expiresAt,
    };
  } catch (e) {
    if (e instanceof Error && e.message === 'TOKEN_ALREADY_ROTATED') {
      return null; // Token was already rotated by a concurrent request
    }
    throw e;
  }
}

/**
 * Revoke all refresh tokens for a user (logout / password change).
 */
export async function revokeAllUserTokens(
  userId: string,
  userType: string
): Promise<number> {
  const result = await db.refreshToken.updateMany({
    where: {
      userId,
      userType,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/**
 * Clean up expired refresh tokens (cron job / scheduled task).
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await db.refreshToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}

/**
 * Set a secure HTTP-only cookie for the refresh token.
 */
export function setRefreshTokenCookie(
  response: Response,
  refreshToken: string,
  expiresAt: Date
): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

  response.headers.append(
    'Set-Cookie',
    `refresh_token=${refreshToken}; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Strict; Path=/api/refresh; Max-Age=${maxAge}`
  );
}

/**
 * Clear the refresh token cookie (logout).
 */
export function clearRefreshTokenCookie(response: Response): void {
  const isProduction = process.env.NODE_ENV === 'production';
  response.headers.append(
    'Set-Cookie',
    `refresh_token=; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Strict; Path=/api/refresh; Max-Age=0`
  );
}

/**
 * Extract the refresh token from the cookie or Authorization header.
 */
export function extractRefreshToken(request: Request): string | null {
  // 1. Check cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/refresh_token=([^;]+)/);
  if (match) return match[1];

  // 2. Check Authorization header (Bearer)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 3. Check body
  return null;
}

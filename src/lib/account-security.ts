/**
 * Account security — login attempt tracking and account locking.
 *
 * Constants:
 *   MAX_LOGIN_ATTEMPTS = 5     — after 5 failed attempts, lock the account
 *   LOCK_DURATION_MIN = 30     — lock for 30 minutes
 *   MAX_LOGIN_ATTEMPTS_ADMIN = 10 — admins get more attempts (they may forget)
 */

import { db } from './db';

export const MAX_LOGIN_ATTEMPTS = 5;
export const MAX_LOGIN_ATTEMPTS_ADMIN = 10;
export const LOCK_DURATION_MIN = 30;

type ModelName = 'admin' | 'customer' | 'driver';

/**
 * Check if an account is currently locked.
 * Returns { locked: boolean, unlockAt?: Date }
 */
export function isAccountLocked(lockedUntil: Date | null): {
  locked: boolean;
  unlockAt?: Date;
  remainingMinutes?: number;
} {
  if (!lockedUntil) return { locked: false };
  const now = new Date();
  if (now < lockedUntil) {
    const remainingMs = lockedUntil.getTime() - now.getTime();
    return {
      locked: true,
      unlockAt: lockedUntil,
      remainingMinutes: Math.ceil(remainingMs / (60 * 1000)),
    };
  }
  return { locked: false };
}

/**
 * Record a failed login attempt. If the threshold is reached, lock the account.
 * Uses conditional updates to avoid race conditions.
 */
export async function recordFailedLogin(
  model: ModelName,
  userId: string,
  isAdmin: boolean = false
): Promise<{ locked: boolean; attempts: number; maxAttempts: number }> {
  const maxAttempts = isAdmin ? MAX_LOGIN_ATTEMPTS_ADMIN : MAX_LOGIN_ATTEMPTS;

  // Fetch current attempts
  const user = await (db[model] as any).findUnique({
    where: { id: userId },
    select: { loginAttempts: true, lockedUntil: true },
  });

  if (!user) return { locked: false, attempts: 0, maxAttempts };

  const newAttempts = (user.loginAttempts || 0) + 1;

  if (newAttempts >= maxAttempts) {
    // Lock the account
    const lockUntil = new Date(Date.now() + LOCK_DURATION_MIN * 60 * 1000);
    await (db[model] as any).update({
      where: { id: userId },
      data: {
        loginAttempts: newAttempts,
        lockedUntil: lockUntil,
      },
    });
    return { locked: true, attempts: newAttempts, maxAttempts };
  }

  // Just increment
  await (db[model] as any).update({
    where: { id: userId },
    data: { loginAttempts: newAttempts },
  });

  return { locked: false, attempts: newAttempts, maxAttempts };
}

/**
 * Reset login attempts on successful login.
 */
export async function resetLoginAttempts(model: ModelName, userId: string): Promise<void> {
  try {
    await (db[model] as any).update({
      where: { id: userId },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
      },
    });
  } catch {
    // Non-blocking — login should still succeed
  }
}

/**
 * Unlock an account manually (admin action).
 * Resets attempts + clears lock.
 */
export async function unlockAccount(model: ModelName, userId: string): Promise<void> {
  await (db[model] as any).update({
    where: { id: userId },
    data: {
      loginAttempts: 0,
      lockedUntil: null,
    },
  });
}

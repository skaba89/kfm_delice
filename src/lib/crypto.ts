/**
 * AES-256-GCM encryption utilities for sensitive data at rest.
 *
 * Used by:
 *   - two-factor.ts — encrypting TOTP secrets (Mission 7)
 *   - Any future module that needs to store secrets in the DB
 *
 * The encryption key is read from TOTP_ENCRYPTION_KEY (32 bytes, base64-encoded).
 * In production, the key MUST be set. In dev, a derived dev key is used with a warning.
 *
 * Ciphertext format: base64(iv || ciphertext || authTag)
 *   - iv: 12 bytes (GCM standard)
 *   - ciphertext: same length as plaintext
 *   - authTag: 16 bytes (GCM authentication tag)
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const DEV_FALLBACK_KEY_MATERIAL = 'kfm-delice-dev-encryption-key-do-not-use-in-prod';

function resolveEncryptionKey(): Buffer {
  const envKey = process.env.TOTP_ENCRYPTION_KEY;
  if (envKey) {
    // Accept raw 32-byte keys or base64-encoded 32-byte keys
    if (envKey.length === 32) {
      return Buffer.from(envKey, 'utf8');
    }
    try {
      const decoded = Buffer.from(envKey, 'base64');
      if (decoded.length === 32) return decoded;
    } catch {
      // fall through
    }
    // If not 32 bytes, derive a 32-byte key via SHA-256 (acceptable for dev, not prod)
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[crypto] TOTP_ENCRYPTION_KEY must be exactly 32 bytes (raw or base64-encoded) in production. ' +
        'Generate one with: openssl rand -base64 32'
      );
    }
    console.warn('[crypto] TOTP_ENCRYPTION_KEY is not 32 bytes — deriving via SHA-256 (dev only).');
    return createHash('sha256').update(envKey).digest();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[crypto] FATAL: TOTP_ENCRYPTION_KEY is not set. TOTP secrets cannot be encrypted. ' +
      'Generate one with: openssl rand -base64 32 and set TOTP_ENCRYPTION_KEY.'
    );
  }
  console.warn('[crypto] TOTP_ENCRYPTION_KEY not set — using insecure dev fallback. DO NOT use in production.');
  return createHash('sha256').update(DEV_FALLBACK_KEY_MATERIAL).digest();
}

let _cachedKey: Buffer | null = null;
function getEncryptionKey(): Buffer {
  if (_cachedKey === null) {
    _cachedKey = resolveEncryptionKey();
  }
  return _cachedKey;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns base64(iv || ciphertext || authTag).
 */
export function encryptString(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]).toString('base64');
}

/**
 * Decrypt a value produced by encryptString().
 * Returns null if decryption fails (wrong key, tampered data, etc.)
 */
export function decryptString(encryptedBase64: string): string | null {
  try {
    const key = getEncryptionKey();
    const data = Buffer.from(encryptedBase64, 'base64');
    if (data.length < 12 + 16) return null; // iv + authTag minimum
    const iv = data.subarray(0, 12);
    const authTag = data.subarray(data.length - 16);
    const ciphertext = data.subarray(12, data.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Hash a fingerprint (e.g. for anonymous promo abuse prevention).
 * Uses SHA-256 — returns hex string.
 */
export function hashFingerprint(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

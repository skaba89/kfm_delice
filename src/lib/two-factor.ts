/**
 * 2FA TOTP utility — generate secrets, verify codes, create backup codes.
 *
 * Uses otpauth (RFC 6238) + qrcode (data URL for QR image).
 * All functions are server-only (require Node crypto).
 */

import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";
import { createHash, randomBytes } from "crypto";

// ── Secret generation ──────────────────────────────────────────

export function generateTwoFactorSecret(email: string): {
  secret: string;
  uri: string;
} {
  // Generate a random 20-byte secret for TOTP
  const secretObj = new Secret({ size: 20 });
  const totp = new TOTP({
    issuer: "KFM Delice",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: secretObj,
  });
  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  };
}

// ── QR Code generation (data URL) ──────────────────────────────

export async function generateQRCodeDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, {
    width: 256,
    margin: 2,
    color: { dark: "#1f2937", light: "#ffffff" },
  });
}

// ── Code verification ──────────────────────────────────────────

export function verifyTwoFactorCode(secretBase32: string, code: string): boolean {
  if (!code || code.length !== 6) return false;
  const totp = new TOTP({
    issuer: "KFM Delice",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
  // window=1 allows 30s clock drift in either direction
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

// ── Backup codes ───────────────────────────────────────────────

/**
 * Generate 10 one-time backup codes.
 * Returns the plaintext codes (to show to user once) + their SHA-256 hashes (to store).
 */
export function generateBackupCodes(): {
  codes: string[]; // plaintext, show to user once
  hashes: string; // JSON array of SHA-256 hashes, store in DB
} {
  const codes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const raw = randomBytes(5).toString("hex").toUpperCase();
    const formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    codes.push(formatted);
    hashes.push(hashBackupCode(formatted));
  }
  return { codes, hashes: JSON.stringify(hashes) };
}

function hashBackupCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Verify a backup code against stored hashes.
 * Returns the index of the used code (to remove it) or -1 if not found.
 */
export function verifyBackupCode(
  code: string,
  storedHashesJson: string
): number {
  try {
    const hashes: string[] = JSON.parse(storedHashesJson);
    const hashed = hashBackupCode(code.trim().toUpperCase());
    return hashes.indexOf(hashed);
  } catch {
    return -1;
  }
}

/**
 * Remove a used backup code from the JSON array.
 */
export function removeBackupCode(
  storedHashesJson: string,
  indexToRemove: number
): string {
  try {
    const hashes: string[] = JSON.parse(storedHashesJson);
    hashes.splice(indexToRemove, 1);
    return JSON.stringify(hashes);
  } catch {
    return storedHashesJson;
  }
}

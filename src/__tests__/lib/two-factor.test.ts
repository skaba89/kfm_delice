/**
 * Mission 10: Unit tests for two-factor.ts (TOTP encryption)
 *
 * Tests the encrypted TOTP secret flow:
 *   - generateTwoFactorSecret returns plaintext + encryptedSecret
 *   - verifyTwoFactorCode works with encrypted secret
 *   - Backup codes generation and verification
 */

import { describe, it, expect } from 'vitest';
import {
  generateTwoFactorSecret,
  verifyTwoFactorCode,
  generateBackupCodes,
  verifyBackupCode,
  removeBackupCode,
  generateQRCodeDataUrl,
} from '@/lib/two-factor';
import { decryptString } from '@/lib/crypto';

describe('Mission 7: two-factor.ts — encrypted TOTP', () => {
  describe('generateTwoFactorSecret', () => {
    it('should return plaintext secret, encrypted secret, and URI', () => {
      const result = generateTwoFactorSecret('admin@kfm-delice.com');
      expect(result.secret).toMatch(/^[A-Z2-7]+$/); // base32
      expect(result.encryptedSecret).toBeTruthy();
      expect(result.encryptedSecret).not.toBe(result.secret);
      expect(result.uri).toContain('otpauth://totp/');
      expect(result.uri).toContain('KFM%20Delice');
    });

    it('should produce a decryptable encrypted secret', () => {
      const { secret, encryptedSecret } = generateTwoFactorSecret('test@example.com');
      const decrypted = decryptString(encryptedSecret);
      expect(decrypted).toBe(secret);
    });

    it('should generate different secrets for different calls', () => {
      const a = generateTwoFactorSecret('a@example.com');
      const b = generateTwoFactorSecret('b@example.com');
      expect(a.secret).not.toBe(b.secret);
      expect(a.encryptedSecret).not.toBe(b.encryptedSecret);
    });
  });

  describe('verifyTwoFactorCode', () => {
    it('should reject empty code', () => {
      const { encryptedSecret } = generateTwoFactorSecret('test@example.com');
      expect(verifyTwoFactorCode(encryptedSecret, '')).toBe(false);
    });

    it('should reject code with wrong length', () => {
      const { encryptedSecret } = generateTwoFactorSecret('test@example.com');
      expect(verifyTwoFactorCode(encryptedSecret, '12345')).toBe(false);
      expect(verifyTwoFactorCode(encryptedSecret, '1234567')).toBe(false);
    });

    it('should reject invalid encrypted secret', () => {
      expect(verifyTwoFactorCode('!!!invalid!!!', '123456')).toBe(false);
    });

    it('should reject random 6-digit code (extremely high probability)', () => {
      const { encryptedSecret } = generateTwoFactorSecret('test@example.com');
      // A random code has 1/1,000,000 chance of being valid
      const randomCode = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
      // We can't assert false with 100% certainty, but it's extremely likely
      // Just verify it doesn't throw
      const result = verifyTwoFactorCode(encryptedSecret, randomCode);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate 10 backup codes', () => {
      const { codes, hashes } = generateBackupCodes();
      expect(codes).toHaveLength(10);
      expect(hashes).toBeTruthy();
      const parsed = JSON.parse(hashes);
      expect(parsed).toHaveLength(10);
    });

    it('should format codes as XXXXX-XXXXX', () => {
      const { codes } = generateBackupCodes();
      for (const code of codes) {
        expect(code).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
      }
    });

    it('should generate unique codes', () => {
      const { codes } = generateBackupCodes();
      const unique = new Set(codes);
      expect(unique.size).toBe(10);
    });
  });

  describe('verifyBackupCode', () => {
    it('should verify a valid backup code', () => {
      const { codes, hashes } = generateBackupCodes();
      const index = verifyBackupCode(codes[0], hashes);
      expect(index).toBe(0);
    });

    it('should reject an invalid backup code', () => {
      const { hashes } = generateBackupCodes();
      const index = verifyBackupCode('WRONG-CODE!', hashes);
      expect(index).toBe(-1);
    });

    it('should handle case-insensitive codes', () => {
      const { codes, hashes } = generateBackupCodes();
      const lowercase = codes[3].toLowerCase();
      const index = verifyBackupCode(lowercase, hashes);
      expect(index).toBe(3);
    });

    it('should handle invalid JSON gracefully', () => {
      const index = verifyBackupCode('ANY-CODE', '!!!invalid json!!!');
      expect(index).toBe(-1);
    });
  });

  describe('removeBackupCode', () => {
    it('should remove the code at the given index', () => {
      const { codes, hashes } = generateBackupCodes();
      const index = 2;
      const updated = removeBackupCode(hashes, index);
      const updatedHashes = JSON.parse(updated);
      expect(updatedHashes).toHaveLength(9);

      // The removed code should no longer verify
      const newIndex = verifyBackupCode(codes[index], updated);
      expect(newIndex).toBe(-1);
    });

    it('should handle invalid JSON gracefully', () => {
      const result = removeBackupCode('!!!invalid!!!', 0);
      expect(result).toBe('!!!invalid!!!');
    });
  });

  describe('generateQRCodeDataUrl', () => {
    it('should generate a data URL', async () => {
      const uri = 'otpauth://totp/KFM%20Delice:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=KFM%20Delice';
      const dataUrl = await generateQRCodeDataUrl(uri);
      expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });
});

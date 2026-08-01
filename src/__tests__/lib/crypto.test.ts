/**
 * Mission 10: Unit tests for crypto.ts (AES-256-GCM)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptString, decryptString, hashFingerprint } from '@/lib/crypto';

describe('Mission 7: crypto.ts — AES-256-GCM encryption', () => {
  describe('encryptString / decryptString', () => {
    it('should encrypt and decrypt a simple string', () => {
      const plaintext = 'hello world';
      const encrypted = encryptString(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(decryptString(encrypted)).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const encrypted = encryptString('');
      expect(decryptString(encrypted)).toBe('');
    });

    it('should handle unicode characters', () => {
      const plaintext = 'KFM Délice 🍽️ — Commande café à 5000 GNF';
      const encrypted = encryptString(plaintext);
      expect(decryptString(encrypted)).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = encryptString(plaintext);
      expect(decryptString(encrypted)).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext (random IV)', () => {
      const plaintext = 'same-secret';
      const enc1 = encryptString(plaintext);
      const enc2 = encryptString(plaintext);
      expect(enc1).not.toBe(enc2);
      expect(decryptString(enc1)).toBe(plaintext);
      expect(decryptString(enc2)).toBe(plaintext);
    });

    it('should return null for tampered ciphertext', () => {
      const plaintext = 'secret-data';
      const encrypted = encryptString(plaintext);
      // Flip the last character
      const tampered = encrypted.slice(0, -1) + (encrypted.endsWith('A') ? 'B' : 'A');
      expect(decryptString(tampered)).toBeNull();
    });

    it('should return null for invalid base64', () => {
      expect(decryptString('!!!not-valid-base64!!!')).toBeNull();
    });

    it('should return null for too-short input', () => {
      expect(decryptString('dG9v')).toBeNull(); // 4 bytes, needs min 28
    });

    it('should return null for empty input', () => {
      expect(decryptString('')).toBeNull();
    });
  });

  describe('hashFingerprint', () => {
    it('should produce a 64-char hex string (SHA-256)', () => {
      const hash = hashFingerprint('+224612345678|192.168.1.1');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be deterministic (same input = same hash)', () => {
      const input = '+224612345678|10.0.0.1';
      expect(hashFingerprint(input)).toBe(hashFingerprint(input));
    });

    it('should produce different hashes for different inputs', () => {
      const h1 = hashFingerprint('input1');
      const h2 = hashFingerprint('input2');
      expect(h1).not.toBe(h2);
    });

    it('should handle empty input', () => {
      const hash = hashFingerprint('');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle unicode input', () => {
      const hash = hashFingerprint('KFM Délice');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});

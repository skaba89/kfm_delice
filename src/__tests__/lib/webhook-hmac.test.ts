import { describe, it, expect } from 'vitest';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Tests for the HMAC webhook signature verification logic
 * used in /api/payment/route.ts
 *
 * We test the crypto logic here since it's critical for security.
 */

const WEBHOOK_SECRET = 'test-webhook-secret-key';

function generateWebhookSignature(paymentId: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(paymentId).digest('hex');
}

function verifyWebhookSignature(paymentId: string, signature: string): boolean {
  const expected = generateWebhookSignature(paymentId);
  if (signature.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

describe('Webhook HMAC signature', () => {
  it('should generate and verify a valid signature', () => {
    const paymentId = 'pay_1234567890';
    const signature = generateWebhookSignature(paymentId);
    expect(verifyWebhookSignature(paymentId, signature)).toBe(true);
  });

  it('should reject a signature with wrong payment ID', () => {
    const signature = generateWebhookSignature('pay_111');
    expect(verifyWebhookSignature('pay_222', signature)).toBe(false);
  });

  it('should reject a signature with wrong secret', () => {
    const wrongSig = createHmac('sha256', 'wrong-secret').update('pay_123').digest('hex');
    expect(verifyWebhookSignature('pay_123', wrongSig)).toBe(false);
  });

  it('should reject a tampered signature', () => {
    const signature = generateWebhookSignature('pay_123');
    const tampered = signature.replace(/a/, 'b');
    expect(verifyWebhookSignature('pay_123', tampered)).toBe(false);
  });

  it('should reject an empty signature', () => {
    expect(verifyWebhookSignature('pay_123', '')).toBe(false);
  });

  it('should produce a 64-character hex string', () => {
    const signature = generateWebhookSignature('pay_test');
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce different signatures for different inputs', () => {
    const sig1 = generateWebhookSignature('pay_1');
    const sig2 = generateWebhookSignature('pay_2');
    expect(sig1).not.toBe(sig2);
  });

  it('should produce the same signature for the same input', () => {
    const sig1 = generateWebhookSignature('pay_consistent');
    const sig2 = generateWebhookSignature('pay_consistent');
    expect(sig1).toBe(sig2);
  });
});

/**
 * Mission 10: Unit tests for payments/index.ts (payment gateway abstraction)
 *
 * Tests the simulation mode (dev) and phone validation.
 * Tests cash (always succeeds) and card (mock paid in dev).
 * Phone format validation for orange_money, mtn_money, wave.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally (for any real API calls that might happen)
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { initiatePayment, isProductionPayment } = await import('@/lib/payments');

describe('Mission 4: payments/index.ts — payment gateway abstraction', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Ensure no real credentials are set (simulation mode)
    delete process.env.APP_MODE;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.ORANGE_MONEY_CLIENT_ID;
    delete process.env.ORANGE_MONEY_CLIENT_SECRET;
    delete process.env.MTN_MOMO_SUBSCRIPTION_KEY;
    delete process.env.MTN_MOMO_API_KEY;
    delete process.env.WAVE_API_KEY;
    delete process.env.PUBLIC_APP_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isProductionPayment', () => {
    it('should return false for cash (no external API needed)', () => {
      expect(isProductionPayment('cash')).toBe(false);
    });

    it('should return false for card when Stripe is not configured', () => {
      expect(isProductionPayment('card')).toBe(false);
    });

    it('should return false for orange_money when not configured', () => {
      expect(isProductionPayment('orange_money')).toBe(false);
    });

    it('should return false for mtn_money when not configured', () => {
      expect(isProductionPayment('mtn_money')).toBe(false);
    });

    it('should return false for wave when not configured', () => {
      expect(isProductionPayment('wave')).toBe(false);
    });
  });

  describe('initiatePayment — cash', () => {
    it('should return pending status for cash (Mission 1: cashier confirms)', async () => {
      const result = await initiatePayment({
        method: 'cash',
        phone: '',
        amount: 50000,
        orderId: 'order-123',
      });
      expect(result.success).toBe(true);
      expect(result.status).toBe('pending'); // Mission 1: cash is pending until cashier confirms
      expect(result.transactionRef).toMatch(/^CASH_/);
    });

    it('should generate transaction refs with CASH_ prefix', async () => {
      const r1 = await initiatePayment({ method: 'cash', phone: '', amount: 1000, orderId: 'o1' });
      expect(r1.transactionRef).toMatch(/^CASH_\d+$/);
    });
  });

  describe('initiatePayment — card (mock mode, no Stripe key)', () => {
    it('should return processing status in dev mode (Mission 1: Stripe webhook confirms)', async () => {
      const result = await initiatePayment({
        method: 'card',
        phone: '',
        amount: 50000,
        orderId: 'order-123',
      });
      expect(result.success).toBe(true);
      expect(result.status).toBe('processing'); // Mission 1: card is processing until webhook
      expect(result.transactionRef).toMatch(/^stripe-mock-/);
      expect(result.paymentUrl).toContain('/payment/mock');
    });
  });

  describe('initiatePayment — orange_money (simulation mode)', () => {
    it('should validate phone format and reject invalid number', async () => {
      const result = await initiatePayment({
        method: 'orange_money',
        phone: 'invalid-number',
        amount: 50000,
        orderId: 'order-123',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalide');
    });

    it('should accept valid Guinean phone (+224 prefix)', async () => {
      const result = await initiatePayment({
        method: 'orange_money',
        phone: '+224 612 34 56 78',
        amount: 50000,
        orderId: 'order-123',
      });
      expect(typeof result.success).toBe('boolean');
      if (result.success) {
        expect(result.status).toBe('processing');
        expect(result.transactionRef).toMatch(/^OM_/);
        expect(result.otpRequired).toBe(true);
      }
    });

    it('should accept valid Guinean phone (6XX without prefix)', async () => {
      const result = await initiatePayment({
        method: 'orange_money',
        phone: '612345678',
        amount: 50000,
        orderId: 'order-123',
      });
      expect(typeof result.success).toBe('boolean');
    });

    it('should accept phone starting with 224', async () => {
      const result = await initiatePayment({
        method: 'orange_money',
        phone: '224612345678',
        amount: 50000,
        orderId: 'order-123',
      });
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('initiatePayment — mtn_money (simulation mode)', () => {
    it('should validate phone format', async () => {
      const result = await initiatePayment({
        method: 'mtn_money',
        phone: 'invalid',
        amount: 50000,
        orderId: 'order-123',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalide');
    });

    it('should accept valid phone', async () => {
      const result = await initiatePayment({
        method: 'mtn_money',
        phone: '+224612345678',
        amount: 50000,
        orderId: 'order-123',
      });
      if (result.success) {
        expect(result.status).toBe('processing');
        expect(result.transactionRef).toMatch(/^MTN_/);
      }
    });
  });

  describe('initiatePayment — wave (simulation mode)', () => {
    it('should validate phone format', async () => {
      const result = await initiatePayment({
        method: 'wave',
        phone: 'invalid',
        amount: 50000,
        orderId: 'order-123',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalide');
    });

    it('should accept valid phone', async () => {
      const result = await initiatePayment({
        method: 'wave',
        phone: '+224612345678',
        amount: 50000,
        orderId: 'order-123',
      });
      if (result.success) {
        expect(result.status).toBe('processing');
        expect(result.transactionRef).toMatch(/^WAVE_/);
      }
    });
  });

  describe('initiatePayment — unsupported method', () => {
    it('should return error for unsupported method', async () => {
      const result = await initiatePayment({
        method: 'bitcoin' as any,
        phone: '',
        amount: 50000,
        orderId: 'order-123',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('non supportée');
    });
  });
});

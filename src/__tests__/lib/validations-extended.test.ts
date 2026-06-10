import { describe, it, expect } from 'vitest';
import {
  orderSchema,
  reservationSchema,
  reviewSchema,
  adminSchema,
  adminPatchSchema,
  webhookSignatureSchema,
  webhookPaymentStatusSchema,
} from '@/lib/validations';

describe('orderSchema', () => {
  it('should validate a valid order', () => {
    const result = orderSchema.safeParse({
      customerName: 'Jean Dupont',
      phone: '+224 621 00 00 00',
      items: JSON.stringify([{ name: 'Riz sauce arachide', price: 25000, qty: 2 }]),
      total: 50000,
      orderType: 'dine_in',
      paymentMethod: 'cash',
    });
    expect(result.success).toBe(true);
  });

  it('should accept order with empty customerName (optional)', () => {
    const result = orderSchema.safeParse({
      customerName: '',
      phone: '+224 621 00 00 00',
      items: '[]',
      total: 0,
      orderType: 'dine_in',
    });
    expect(result.success).toBe(true); // customerName is optional
  });

  it('should accept any orderType string (not enum-validated)', () => {
    const result = orderSchema.safeParse({
      customerName: 'Test',
      phone: '123',
      items: '[]',
      total: 0,
      orderType: 'custom_type',
    });
    expect(result.success).toBe(true); // orderType is a free string, not an enum
  });

  it('should accept order with optional fields missing', () => {
    const result = orderSchema.safeParse({
      customerName: 'Test',
      items: '[]',
      total: 10000,
    });
    expect(result.success).toBe(true);
  });
});

describe('reservationSchema', () => {
  it('should validate a valid reservation', () => {
    const result = reservationSchema.safeParse({
      customerName: 'Marie Curie',
      phone: '+224 621 00 00 00',
      date: '2025-06-15',
      time: '19:00',
      guests: 4,
    });
    expect(result.success).toBe(true);
  });

  it('should reject reservation with 0 guests', () => {
    const result = reservationSchema.safeParse({
      customerName: 'Test',
      phone: '123',
      date: '2025-06-15',
      time: '19:00',
      guests: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject reservation with empty date', () => {
    const result = reservationSchema.safeParse({
      customerName: 'Test',
      phone: '123',
      date: '',
      time: '19:00',
      guests: 2,
    });
    expect(result.success).toBe(false);
  });
});

describe('reviewSchema', () => {
  it('should validate a valid review', () => {
    const result = reviewSchema.safeParse({
      customerName: 'Jean Dupont',
      rating: 5,
      comment: 'Excellent repas !',
      date: '2025-06-15',
    });
    expect(result.success).toBe(true);
  });

  it('should reject review with rating > 5', () => {
    const result = reviewSchema.safeParse({
      customerName: 'Test',
      rating: 6,
      comment: 'Trop bien',
      date: '2025-06-15',
    });
    expect(result.success).toBe(false);
  });

  it('should reject review with rating < 1', () => {
    const result = reviewSchema.safeParse({
      customerName: 'Test',
      rating: 0,
      comment: 'Nul',
      date: '2025-06-15',
    });
    expect(result.success).toBe(false);
  });
});

describe('adminSchema', () => {
  it('should validate a valid admin', () => {
    const result = adminSchema.safeParse({
      email: 'admin@kfm.com',
      name: 'Admin Principal',
      password: 'securePass123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject admin with short password', () => {
    const result = adminSchema.safeParse({
      email: 'admin@kfm.com',
      name: 'Admin',
      password: '123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject admin with invalid email', () => {
    const result = adminSchema.safeParse({
      email: 'not-an-email',
      name: 'Admin',
      password: 'securePass123',
    });
    expect(result.success).toBe(false);
  });
});

describe('adminPatchSchema', () => {
  it('should require currentPassword when password is provided', () => {
    const result = adminPatchSchema.safeParse({
      id: 'clxxx',
      password: 'newPassword123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0]?.message || '';
      expect(message).toContain('Mot de passe actuel');
    }
  });

  it('should accept password change with currentPassword', () => {
    const result = adminPatchSchema.safeParse({
      id: 'clxxx',
      password: 'newPassword123',
      currentPassword: 'oldPassword123',
    });
    expect(result.success).toBe(true);
  });

  it('should accept patch without password change', () => {
    const result = adminPatchSchema.safeParse({
      id: 'clxxx',
      name: 'New Name',
    });
    expect(result.success).toBe(true);
  });
});

describe('webhookSignatureSchema', () => {
  it('should validate a 64-char hex signature', () => {
    const result = webhookSignatureSchema.safeParse(
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
    );
    expect(result.success).toBe(true);
  });

  it('should reject non-hex characters', () => {
    const result = webhookSignatureSchema.safeParse(
      'g1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
    );
    expect(result.success).toBe(false);
  });

  it('should reject too-short signature', () => {
    const result = webhookSignatureSchema.safeParse('abc123');
    expect(result.success).toBe(false);
  });
});

describe('webhookPaymentStatusSchema', () => {
  it('should validate a valid webhook payment status', () => {
    const result = webhookPaymentStatusSchema.safeParse({
      id: 'clxxx',
      status: 'paid',
      webhook: true,
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-webhook payment status', () => {
    const result = webhookPaymentStatusSchema.safeParse({
      id: 'clxxx',
      status: 'paid',
      webhook: false,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid status', () => {
    const result = webhookPaymentStatusSchema.safeParse({
      id: 'clxxx',
      status: 'invalid_status',
      webhook: true,
    });
    expect(result.success).toBe(false);
  });
});

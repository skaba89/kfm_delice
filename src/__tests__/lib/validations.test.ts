import { describe, it, expect } from 'vitest';
import { loginSchema, customerRegisterSchema, menuItemSchema, orderSchema, paymentSchema, paymentStatusSchema } from '@/lib/validations';

describe('loginSchema', () => {
  it('should validate correct login data', () => {
    const result = loginSchema.safeParse({ email: 'test@test.com', password: 'pass123' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'pass123' });
    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const result = loginSchema.safeParse({ email: 'test@test.com', password: '' });
    expect(result.success).toBe(false);
  });
});

describe('customerRegisterSchema', () => {
  it('should validate correct registration data', () => {
    const result = customerRegisterSchema.safeParse({
      name: 'Test User', email: 'test@test.com', password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject short password', () => {
    const result = customerRegisterSchema.safeParse({
      name: 'Test', email: 'test@test.com', password: '12345',
    });
    expect(result.success).toBe(false);
  });

  it('should reject short name', () => {
    const result = customerRegisterSchema.safeParse({
      name: 'T', email: 'test@test.com', password: 'password123',
    });
    expect(result.success).toBe(false);
  });
});

describe('menuItemSchema', () => {
  it('should validate correct menu item', () => {
    const result = menuItemSchema.safeParse({
      name: 'Riz Jollof', price: 35000, category: 'plats',
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative price', () => {
    const result = menuItemSchema.safeParse({
      name: 'Test', price: -100, category: 'plats',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = menuItemSchema.safeParse({
      name: '', price: 1000, category: 'plats',
    });
    expect(result.success).toBe(false);
  });
});

describe('orderSchema', () => {
  it('should validate correct order', () => {
    const result = orderSchema.safeParse({
      items: '[]', total: 35000,
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative total', () => {
    const result = orderSchema.safeParse({
      items: '[]', total: -1000,
    });
    expect(result.success).toBe(false);
  });

  it('should validate valid payment methods', () => {
    for (const method of ['cash', 'orange_money', 'mtn_money', 'card'] as const) {
      const result = orderSchema.safeParse({
        items: '[]', total: 1000, paymentMethod: method,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid payment method', () => {
    const result = orderSchema.safeParse({
      items: '[]', total: 1000, paymentMethod: 'bitcoin',
    });
    expect(result.success).toBe(false);
  });

  it('should validate valid payment statuses', () => {
    for (const status of ['pending', 'processing', 'paid', 'failed', 'refunded'] as const) {
      const result = orderSchema.safeParse({
        items: '[]', total: 1000, paymentStatus: status,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid payment status', () => {
    const result = orderSchema.safeParse({
      items: '[]', total: 1000, paymentStatus: 'unknown',
    });
    expect(result.success).toBe(false);
  });
});

describe('paymentSchema', () => {
  it('should validate correct payment data', () => {
    const result = paymentSchema.safeParse({
      orderId: 'order_123',
      method: 'orange_money',
      phone: '+224 620 11 22 33',
      customerName: 'Aminata Camara',
    });
    expect(result.success).toBe(true);
  });

  it('should validate minimal payment data', () => {
    const result = paymentSchema.safeParse({
      orderId: 'order_123',
      method: 'cash',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing orderId', () => {
    const result = paymentSchema.safeParse({
      method: 'cash',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid payment method', () => {
    const result = paymentSchema.safeParse({
      orderId: 'order_123',
      method: 'crypto',
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid payment methods', () => {
    for (const method of ['cash', 'orange_money', 'mtn_money', 'card'] as const) {
      const result = paymentSchema.safeParse({
        orderId: 'order_123',
        method,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('paymentStatusSchema', () => {
  it('should validate correct status update', () => {
    const result = paymentStatusSchema.safeParse({
      id: 'pay_123',
      status: 'paid',
      transactionRef: 'OM_12345678',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing id', () => {
    const result = paymentStatusSchema.safeParse({
      status: 'paid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid status', () => {
    const result = paymentStatusSchema.safeParse({
      id: 'pay_123',
      status: 'unknown',
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid statuses', () => {
    for (const status of ['pending', 'processing', 'paid', 'failed', 'refunded'] as const) {
      const result = paymentStatusSchema.safeParse({
        id: 'pay_123',
        status,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should accept failedReason for failed payments', () => {
    const result = paymentStatusSchema.safeParse({
      id: 'pay_123',
      status: 'failed',
      failedReason: 'Solde insuffisant',
    });
    expect(result.success).toBe(true);
  });
});

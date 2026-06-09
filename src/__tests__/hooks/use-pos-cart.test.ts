import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePosCart } from '@/lib/hooks/use-pos-cart';
import type { MenuItemDB } from '@/lib/types';

// ── Fixtures ──────────────────────────────────────────────────

const mockMenuItem: MenuItemDB = {
  id: 'item-1',
  name: 'Riz Jollof',
  description: 'Delicious jollof rice',
  price: 35000,
  category: 'plats',
  image: '/rice.jpg',
  badge: '',
  popular: true,
  available: true,
  order: 1,
};

const mockMenuItem2: MenuItemDB = {
  id: 'item-2',
  name: 'Poulet Braisé',
  description: 'Grilled chicken',
  price: 25000,
  category: 'plats',
  image: '/chicken.jpg',
  badge: 'populaire',
  popular: true,
  available: true,
  order: 2,
};

// ── Mocks ─────────────────────────────────────────────────────

const mockLoadData = vi.fn().mockResolvedValue(undefined);
const mockApiFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadData.mockResolvedValue(undefined);
  mockApiFetch.mockReset();
});

// ── Tests ─────────────────────────────────────────────────────

describe('usePosCart – initial state', () => {
  it('should start with an empty cart', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));
    expect(result.current.posCart).toEqual([]);
  });

  it('should default to table 1', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));
    expect(result.current.posTable).toBe(1);
  });

  it('should default to cash payment', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));
    expect(result.current.posPayment).toBe('cash');
  });

  it('should default to dine_in order type', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));
    expect(result.current.posOrderType).toBe('dine_in');
  });

  it('should have zero total for empty cart', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));
    expect(result.current.posTotal).toBe(0);
  });

  it('should have zero discount', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));
    expect(result.current.posDiscount).toBe(0);
  });

  it('should have empty customer name', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));
    expect(result.current.posCustomerName).toBe('');
  });

  it('should have no receipt', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));
    expect(result.current.posReceipt).toBeNull();
  });

  it('should not be submitting', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));
    expect(result.current.posSubmitting).toBe(false);
  });
});

describe('usePosCart – adding items', () => {
  it('should add an item to the cart', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCart([{ menuItem: mockMenuItem, qty: 2, note: '' }]);
    });

    expect(result.current.posCart).toHaveLength(1);
    expect(result.current.posCart[0].menuItem.id).toBe('item-1');
    expect(result.current.posCart[0].qty).toBe(2);
  });

  it('should calculate total correctly with one item', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCart([{ menuItem: mockMenuItem, qty: 3, note: '' }]);
    });

    // 35000 * 3 = 105000
    expect(result.current.posTotal).toBe(105000);
  });

  it('should calculate total correctly with multiple items', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCart([
        { menuItem: mockMenuItem, qty: 2, note: '' },
        { menuItem: mockMenuItem2, qty: 1, note: 'bien cuit' },
      ]);
    });

    // 35000 * 2 + 25000 * 1 = 95000
    expect(result.current.posTotal).toBe(95000);
  });

  it('should preserve item notes', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCart([{ menuItem: mockMenuItem, qty: 1, note: 'sans piment' }]);
    });

    expect(result.current.posCart[0].note).toBe('sans piment');
  });
});

describe('usePosCart – removing items', () => {
  it('should remove an item from the cart', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCart([
        { menuItem: mockMenuItem, qty: 2, note: '' },
        { menuItem: mockMenuItem2, qty: 1, note: '' },
      ]);
    });

    expect(result.current.posCart).toHaveLength(2);
    expect(result.current.posTotal).toBe(95000);

    act(() => {
      result.current.setPosCart(result.current.posCart.filter(item => item.menuItem.id !== 'item-1'));
    });

    expect(result.current.posCart).toHaveLength(1);
    expect(result.current.posCart[0].menuItem.id).toBe('item-2');
    expect(result.current.posTotal).toBe(25000);
  });

  it('should reset total to 0 when all items removed', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCart([{ menuItem: mockMenuItem, qty: 1, note: '' }]);
    });

    expect(result.current.posTotal).toBe(35000);

    act(() => {
      result.current.setPosCart([]);
    });

    expect(result.current.posTotal).toBe(0);
  });
});

describe('usePosCart – checkout form updates', () => {
  it('should update table number', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosTable(5);
    });

    expect(result.current.posTable).toBe(5);
  });

  it('should update payment method', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosPayment('mobile_money');
    });

    expect(result.current.posPayment).toBe('mobile_money');
  });

  it('should update order type', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosOrderType('takeaway');
    });

    expect(result.current.posOrderType).toBe('takeaway');
  });

  it('should update discount', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosDiscount(5000);
    });

    expect(result.current.posDiscount).toBe(5000);
  });

  it('should update customer name', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCustomerName('Jean Dupont');
    });

    expect(result.current.posCustomerName).toBe('Jean Dupont');
  });

  it('should update customer phone', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCustomerPhone('+224 628 00 00 00');
    });

    expect(result.current.posCustomerPhone).toBe('+224 628 00 00 00');
  });

  it('should update order note', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosNote('Livraison rapide SVP');
    });

    expect(result.current.posNote).toBe('Livraison rapide SVP');
  });

  it('should update category filter', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCategoryFilter('plats');
    });

    expect(result.current.posCategoryFilter).toBe('plats');
  });

  it('should update search query', () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosSearch('riz');
    });

    expect(result.current.posSearch).toBe('riz');
  });
});

describe('usePosCart – submitPosOrder', () => {
  it('should not submit when cart is empty', async () => {
    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    await act(async () => {
      await result.current.submitPosOrder();
    });

    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('should call apiFetch with correct data on submit', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'order-1', total: 70000 }),
    });

    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCart([{ menuItem: mockMenuItem, qty: 2, note: '' }]);
      result.current.setPosTable(3);
      result.current.setPosPayment('cash');
      result.current.setPosOrderType('dine_in');
    });

    await act(async () => {
      await result.current.submitPosOrder();
    });

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/orders', expect.objectContaining({
      method: 'POST',
    }));

    const body = JSON.parse((mockApiFetch.mock.calls[0] as any[])[1].body);
    expect(body.total).toBe(70000);
    expect(body.tableNumber).toBe(3);
    expect(body.paymentMethod).toBe('cash');
    expect(body.orderType).toBe('dine_in');
  });

  it('should clear cart after successful order', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'order-1', total: 35000 }),
    });

    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCart([{ menuItem: mockMenuItem, qty: 1, note: '' }]);
    });

    expect(result.current.posCart).toHaveLength(1);

    await act(async () => {
      await result.current.submitPosOrder();
    });

    expect(result.current.posCart).toHaveLength(0);
    expect(result.current.posTotal).toBe(0);
  });

  it('should set receipt after successful order', async () => {
    const orderData = { id: 'order-1', total: 35000 };
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(orderData),
    });

    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCart([{ menuItem: mockMenuItem, qty: 1, note: '' }]);
    });

    await act(async () => {
      await result.current.submitPosOrder();
    });

    expect(result.current.posReceipt).toEqual(orderData);
  });

  it('should reset table and discount after successful order', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'order-1', total: 30000 }),
    });

    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCart([{ menuItem: mockMenuItem, qty: 1, note: '' }]);
      result.current.setPosTable(7);
      result.current.setPosDiscount(5000);
      result.current.setPosCustomerName('Test');
    });

    await act(async () => {
      await result.current.submitPosOrder();
    });

    expect(result.current.posTable).toBe(1);
    expect(result.current.posDiscount).toBe(0);
    expect(result.current.posCustomerName).toBe('');
  });

  it('should call loadData after successful order', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'order-1', total: 35000 }),
    });

    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCart([{ menuItem: mockMenuItem, qty: 1, note: '' }]);
    });

    await act(async () => {
      await result.current.submitPosOrder();
    });

    expect(mockLoadData).toHaveBeenCalledTimes(1);
  });

  it('should not clear cart if apiFetch returns non-ok', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCart([{ menuItem: mockMenuItem, qty: 1, note: '' }]);
    });

    await act(async () => {
      await result.current.submitPosOrder();
    });

    expect(result.current.posCart).toHaveLength(1);
    expect(result.current.posReceipt).toBeNull();
  });

  it('should handle apiFetch throwing an error', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCart([{ menuItem: mockMenuItem, qty: 1, note: '' }]);
    });

    await act(async () => {
      await result.current.submitPosOrder();
    });

    // Cart should remain unchanged on error
    expect(result.current.posCart).toHaveLength(1);
    expect(result.current.posSubmitting).toBe(false);
  });

  it('should use "Walk-in Client" as default customer name', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'order-1', total: 35000 }),
    });

    const { result } = renderHook(() => usePosCart(mockLoadData, mockApiFetch));

    act(() => {
      result.current.setPosCart([{ menuItem: mockMenuItem, qty: 1, note: '' }]);
    });

    await act(async () => {
      await result.current.submitPosOrder();
    });

    const body = JSON.parse((mockApiFetch.mock.calls[0] as any[])[1].body);
    expect(body.customerName).toBe('Walk-in Client');
  });
});

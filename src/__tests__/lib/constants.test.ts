import { describe, it, expect } from 'vitest';
import { formatPrice, statusLabels, statusColors, vehicleLabels, MENU_CATS } from '@/lib/constants';

describe('formatPrice', () => {
  it('should format GNF price correctly', () => {
    expect(formatPrice(35000)).toContain('35');
    expect(formatPrice(35000)).toContain('GNF');
  });

  it('should handle zero', () => {
    expect(formatPrice(0)).toContain('0');
  });

  it('should handle large numbers', () => {
    const result = formatPrice(1000000);
    expect(result).toContain('GNF');
  });
});

describe('MENU_CATS', () => {
  it('should have 5 categories', () => {
    expect(MENU_CATS).toHaveLength(5);
  });

  it('should include required categories', () => {
    const ids = MENU_CATS.map(c => c.id);
    expect(ids).toContain('entrees');
    expect(ids).toContain('plats');
    expect(ids).toContain('desserts');
    expect(ids).toContain('boissons');
  });
});

describe('statusLabels', () => {
  it('should have labels for all key statuses', () => {
    expect(statusLabels.pending).toBeDefined();
    expect(statusLabels.preparing).toBeDefined();
    expect(statusLabels.delivered).toBeDefined();
    expect(statusLabels.cancelled).toBeDefined();
  });
});

describe('vehicleLabels', () => {
  it('should have labels for all vehicle types', () => {
    expect(vehicleLabels.moto).toBe('Moto');
    expect(vehicleLabels.velo).toBe('Vélo');
    expect(vehicleLabels.voiture).toBe('Voiture');
  });
});

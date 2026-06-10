import { describe, it, expect } from 'vitest';
import {
  parsePagination,
  paginate,
  prismaSkip,
  prismaTake,
  parseSorting,
  parseSearch,
  parseStatusFilter,
  parseDateRange,
  buildSearchWhere,
} from '@/lib/pagination';

describe('parsePagination', () => {
  it('should return defaults for empty params', () => {
    const sp = new URLSearchParams();
    const result = parsePagination(sp);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('should parse page and limit', () => {
    const sp = new URLSearchParams('page=3&limit=50');
    const result = parsePagination(sp);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('should clamp page to minimum 1', () => {
    const sp = new URLSearchParams('page=0');
    const result = parsePagination(sp);
    expect(result.page).toBe(1);
  });

  it('should clamp negative page', () => {
    const sp = new URLSearchParams('page=-5');
    const result = parsePagination(sp);
    expect(result.page).toBe(1);
  });

  it('should clamp limit to maximum 100', () => {
    const sp = new URLSearchParams('limit=200');
    const result = parsePagination(sp);
    expect(result.limit).toBe(100);
  });

  it('should clamp limit to minimum 1', () => {
    const sp = new URLSearchParams('limit=0');
    const result = parsePagination(sp);
    expect(result.limit).toBe(1);
  });

  it('should handle non-numeric values gracefully', () => {
    const sp = new URLSearchParams('page=abc&limit=xyz');
    const result = parsePagination(sp);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i, name: `Item ${i}` }));

  it('should return first page correctly', () => {
    const result = paginate(items, 1, 10);
    expect(result.data).toHaveLength(10);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.total).toBe(25);
    expect(result.pagination.totalPages).toBe(3);
    expect(result.pagination.hasNext).toBe(true);
    expect(result.pagination.hasPrev).toBe(false);
  });

  it('should return last page with remaining items', () => {
    const result = paginate(items, 3, 10);
    expect(result.data).toHaveLength(5);
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it('should handle empty array', () => {
    const result = paginate([], 1, 10);
    expect(result.data).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
  });
});

describe('prismaSkip / prismaTake', () => {
  it('should calculate skip correctly', () => {
    expect(prismaSkip(1, 20)).toBe(0);
    expect(prismaSkip(2, 20)).toBe(20);
    expect(prismaSkip(5, 10)).toBe(40);
  });

  it('should return take as-is', () => {
    expect(prismaTake(20)).toBe(20);
    expect(prismaTake(50)).toBe(50);
  });
});

describe('parseSorting', () => {
  it('should return defaults when no params provided', () => {
    const sp = new URLSearchParams();
    const result = parseSorting(sp, ['createdAt', 'name'] as const, 'createdAt');
    expect(result.sortBy).toBe('createdAt');
    expect(result.sortOrder).toBe('desc');
  });

  it('should parse valid sortBy and sortOrder', () => {
    const sp = new URLSearchParams('sortBy=name&sortOrder=asc');
    const result = parseSorting(sp, ['createdAt', 'name'] as const, 'createdAt');
    expect(result.sortBy).toBe('name');
    expect(result.sortOrder).toBe('asc');
  });

  it('should reject invalid sortBy and fall back to default', () => {
    const sp = new URLSearchParams('sortBy=hacked');
    const result = parseSorting(sp, ['createdAt', 'name'] as const, 'createdAt');
    expect(result.sortBy).toBe('createdAt');
  });

  it('should reject invalid sortOrder', () => {
    const sp = new URLSearchParams('sortOrder=invalid');
    const result = parseSorting(sp, ['createdAt'] as const, 'createdAt');
    expect(result.sortOrder).toBe('desc');
  });
});

describe('parseSearch', () => {
  it('should return null for empty search', () => {
    expect(parseSearch(new URLSearchParams())).toBeNull();
    expect(parseSearch(new URLSearchParams('search='))).toBeNull();
    expect(parseSearch(new URLSearchParams('search=  '))).toBeNull();
  });

  it('should return trimmed search string', () => {
    expect(parseSearch(new URLSearchParams('search=hello'))).toBe('hello');
    expect(parseSearch(new URLSearchParams('search=  hello  '))).toBe('hello');
  });
});

describe('parseStatusFilter', () => {
  it('should return null for invalid status', () => {
    const sp = new URLSearchParams('status=invalid');
    expect(parseStatusFilter(sp, ['active', 'inactive'] as const)).toBeNull();
  });

  it('should return valid status', () => {
    const sp = new URLSearchParams('status=active');
    expect(parseStatusFilter(sp, ['active', 'inactive'] as const)).toBe('active');
  });
});

describe('parseDateRange', () => {
  it('should parse valid dates', () => {
    const sp = new URLSearchParams('from=2025-01-01&to=2025-12-31');
    const result = parseDateRange(sp);
    expect(result.from).toBeInstanceOf(Date);
    expect(result.to).toBeInstanceOf(Date);
  });

  it('should return null for no dates', () => {
    const sp = new URLSearchParams();
    const result = parseDateRange(sp);
    expect(result.from).toBeNull();
    expect(result.to).toBeNull();
  });

  it('should return null for invalid dates', () => {
    const sp = new URLSearchParams('from=not-a-date');
    const result = parseDateRange(sp);
    expect(result.from).toBeNull();
  });
});

describe('buildSearchWhere', () => {
  it('should return empty object for null search', () => {
    expect(buildSearchWhere(null, ['name'])).toEqual({});
  });

  it('should build single-field search', () => {
    const result = buildSearchWhere('test', ['name']);
    expect(result).toEqual({ name: { contains: 'test' } });
  });

  it('should build multi-field OR search', () => {
    const result = buildSearchWhere('test', ['name', 'email']);
    expect(result).toEqual({
      OR: [
        { name: { contains: 'test' } },
        { email: { contains: 'test' } },
      ],
    });
  });
});

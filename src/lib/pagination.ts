export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function parsePagination(searchParams: URLSearchParams): { page: number; limit: number } {
  const rawPage = parseInt(searchParams.get('page') || '1');
  const rawLimit = parseInt(searchParams.get('limit') || '20');
  // Guard against NaN from non-numeric query params
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));
  return { page, limit };
}

export function paginate<T>(items: T[], page: number, limit: number): PaginatedResponse<T> {
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

// For Prisma queries
export function prismaSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function prismaTake(limit: number): number {
  return limit;
}

/**
 * Parse and validate sorting parameters from query string.
 * Supports `sortBy` (field name) and `sortOrder` (asc/desc).
 * Validates against a whitelist of allowed fields to prevent injection.
 */
export function parseSorting<T extends string>(
  searchParams: URLSearchParams,
  allowedFields: T[],
  defaultField: T,
  defaultOrder: 'asc' | 'desc' = 'desc'
): { sortBy: T; sortOrder: 'asc' | 'desc' } {
  const sortByParam = searchParams.get('sortBy') as T | null;
  const sortOrderParam = searchParams.get('sortOrder') as 'asc' | 'desc' | null;

  const sortBy = sortByParam && allowedFields.includes(sortByParam) ? sortByParam : defaultField;
  const sortOrder = sortOrderParam === 'asc' || sortOrderParam === 'desc' ? sortOrderParam : defaultOrder;

  return { sortBy, sortOrder };
}

/**
 * Parse search/query filter from query string.
 * Returns null if no search parameter is provided.
 */
export function parseSearch(searchParams: URLSearchParams, paramName = 'search'): string | null {
  const value = searchParams.get(paramName);
  return value && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Parse a status filter from query string.
 * Validates against a whitelist of allowed statuses.
 */
export function parseStatusFilter<T extends string>(
  searchParams: URLSearchParams,
  allowedStatuses: T[],
  paramName = 'status'
): T | null {
  const value = searchParams.get(paramName) as T | null;
  return value && allowedStatuses.includes(value) ? value : null;
}

/**
 * Parse a date range filter from query string.
 * Returns { from, to } where each can be a Date or null.
 */
export function parseDateRange(searchParams: URLSearchParams): { from: Date | null; to: Date | null } {
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');

  let from: Date | null = null;
  let to: Date | null = null;

  if (fromStr) {
    const parsed = new Date(fromStr);
    if (!isNaN(parsed.getTime())) from = parsed;
  }

  if (toStr) {
    const parsed = new Date(toStr);
    if (!isNaN(parsed.getTime())) to = parsed;
  }

  return { from, to };
}

/**
 * Build a Prisma-compatible `where` clause with search filtering.
 * Searches across specified string fields using case-insensitive contains.
 */
export function buildSearchWhere(
  search: string | null,
  fields: string[]
): Record<string, unknown> {
  if (!search) return {};

  // SQLite doesn't support case-insensitive mode, but Prisma contains is case-insensitive by default in SQLite
  if (fields.length === 1) {
    return { [fields[0]]: { contains: search } };
  }

  return {
    OR: fields.map((field) => ({
      [field]: { contains: search },
    })),
  };
}

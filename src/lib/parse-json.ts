/**
 * Safely parse a Prisma field that may be a JSON string (SQLite) or
 * an already-parsed JSON value (PostgreSQL with Json type).
 *
 * In the SQLite schema, `items`, `metadata`, `features`, etc. are
 * declared as `String` and stored as JSON.stringify'd strings.
 * In the PostgreSQL schema, the same fields are declared as `Json`
 * and Prisma returns them as already-parsed JS values.
 *
 * This helper handles both cases transparently:
 *   - If the value is a string, parse it with JSON.parse
 *   - If the value is already an object/array, return it as-is
 *   - If the value is null/undefined, return the fallback
 *
 * Usage:
 *   const items = parseJsonField(order.items, []) as OrderItem[]
 */
export function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  // Already parsed (PostgreSQL Json type returns object/array)
  return value as T;
}

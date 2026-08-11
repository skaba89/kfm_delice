export interface ProxyRequestContext {
  requestId: string;
  tenantSlug?: string | null;
  userId?: string;
  userType?: string;
  userRole?: string;
  restaurantId?: string;
}

const INTERNAL_CONTEXT_HEADERS = [
  'x-request-id',
  'x-user-id',
  'x-user-type',
  'x-user-role',
  'x-restaurant-id',
] as const;

/**
 * Build the headers forwarded from Next.js Proxy to route handlers.
 * Client-provided internal identity headers are always removed first so only
 * the proxy can assert authenticated request context.
 */
export function buildTrustedRequestHeaders(
  incoming: Headers,
  context: ProxyRequestContext
): Headers {
  const forwarded = new Headers(incoming);

  for (const name of INTERNAL_CONTEXT_HEADERS) forwarded.delete(name);

  forwarded.set('x-request-id', context.requestId);
  if (context.tenantSlug) forwarded.set('x-restaurant-slug', context.tenantSlug);
  if (context.userId) forwarded.set('x-user-id', context.userId);
  if (context.userType) forwarded.set('x-user-type', context.userType);
  if (context.userRole) forwarded.set('x-user-role', context.userRole);
  if (context.restaurantId) forwarded.set('x-restaurant-id', context.restaurantId);

  return forwarded;
}

"use client";

/**
 * Public API fetch helper — for pages WITHOUT authentication (menu, orders, reservations, etc.)
 *
 * Automatically adds the x-restaurant-slug header for multi-tenant routing
 * — but ONLY if a slug is known. There is NO hardcoded default: each
 * restaurant is identified by its own slug (derived from its name at
 * creation time via `generateSlug()`).
 *
 * Slug resolution priority:
 *   1. Explicit `slug` option passed to `publicApiFetch({ slug })`
 *   2. URL query param `?restaurant=<slug>` on the current page
 *   3. URL path segment `/r/<slug>/...` on the current page
 *   4. localStorage["restaurantpro_slug"] (set by /q/[token] scan OR by login)
 *   5. Empty string → header NOT sent (server returns 404 in production)
 *
 * For authenticated requests, use useAuth().apiFetch() instead.
 */

const RESTAURANT_SLUG_KEY = "restaurantpro_slug";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

/**
 * Compatibility adapter for the public order endpoint.
 *
 * The backend intentionally treats prices/totals/discounts/status fields as
 * server-authoritative. Older UI code and historical E2E scripts still send
 * legacy fields such as `total`, `deliveryFee` and item snapshots
 * `{ id, name, price, qty }`. Passing those fields directly now produces a
 * 400 FORBIDDEN_FIELDS response.
 *
 * This adapter converts only the client-allowed intent to the strict API
 * contract. It NEVER forwards client-controlled monetary or status fields.
 * It can be removed once every public caller has migrated to the strict shape.
 */
export function normalizePublicOrderBody(input: unknown): UnknownRecord {
  const raw = asRecord(input) ?? {};

  let rawItems: unknown = raw.items;
  if (typeof rawItems === "string") {
    try {
      rawItems = JSON.parse(rawItems);
    } catch {
      rawItems = [];
    }
  }

  const items = Array.isArray(rawItems)
    ? rawItems.flatMap((item) => {
        const row = asRecord(item);
        if (!row) return [];
        const menuItemId = typeof row.menuItemId === "string"
          ? row.menuItemId
          : typeof row.id === "string"
            ? row.id
            : "";
        const quantityRaw = row.quantity ?? row.qty;
        const quantity = typeof quantityRaw === "number"
          ? Math.trunc(quantityRaw)
          : Number.parseInt(String(quantityRaw ?? ""), 10);
        if (!menuItemId || !Number.isFinite(quantity) || quantity < 1) return [];
        return [{
          menuItemId,
          quantity,
          ...(typeof row.note === "string" && row.note.length > 0 ? { note: row.note } : {}),
        }];
      })
    : [];

  const tableNumber = typeof raw.tableNumber === "number"
    ? raw.tableNumber
    : Number.parseInt(String(raw.tableNumber ?? ""), 10);
  const originalNote = typeof raw.note === "string" ? raw.note.trim() : "";
  const note = Number.isFinite(tableNumber) && tableNumber > 0 && !raw.tableQrToken
    ? `Table ${tableNumber}${originalNote ? ` — ${originalNote}` : ""}`
    : originalNote;

  return {
    items,
    orderType: raw.orderType,
    customerName: raw.customerName,
    phone: raw.phone,
    deliveryAddress: raw.deliveryAddress,
    paymentMethod: raw.paymentMethod,
    ...(typeof raw.tableQrToken === "string" && raw.tableQrToken.length > 0
      ? { tableQrToken: raw.tableQrToken }
      : {}),
    ...(typeof raw.promoCode === "string" && raw.promoCode.length > 0
      ? { promoCode: raw.promoCode }
      : {}),
    ...(typeof raw.tip === "number" ? { tip: raw.tip } : {}),
    ...(note ? { note } : {}),
    ...(typeof raw.idempotencyKey === "string" && raw.idempotencyKey.length > 0
      ? { idempotencyKey: raw.idempotencyKey }
      : {}),
  };
}

/**
 * Resolve the current restaurant slug from the browser context.
 * Returns "" if no slug can be determined — the caller should then
 * either redirect to a restaurant picker or fail explicitly.
 */
export function getRestaurantSlug(): string {
  if (typeof window === "undefined") return "";

  // 1. localStorage (set by /q/[token] scan or by login)
  try {
    const stored = localStorage.getItem(RESTAURANT_SLUG_KEY);
    if (stored && stored.length > 0) return stored;
  } catch { /* localStorage not available */ }

  // 2. URL query param ?restaurant=<slug>
  try {
    const sp = new URLSearchParams(window.location.search);
    const qSlug = sp.get("restaurant") || sp.get("slug");
    if (qSlug && qSlug.length > 0) return qSlug;
  } catch { /* SSR / no window */ }

  // 3. URL path segment /r/<slug>/...
  try {
    const match = window.location.pathname.match(/^\/r\/([^/]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);
  } catch { /* SSR */ }

  // No slug found — do NOT fall back to a hardcoded default. Each
  // restaurant has its own URL based on its name.
  return "";
}

export interface PublicApiFetchOptions extends RequestInit {
  /** Explicit slug override (highest priority). Use when the caller
   *  knows the target tenant (e.g. /r/[slug] pages). */
  slug?: string;
}

export async function publicApiFetch(
  url: string,
  options: PublicApiFetchOptions = {}
): Promise<Response> {
  const { slug: explicitSlug, ...rest } = options;
  const slug = explicitSlug && explicitSlug.length > 0 ? explicitSlug : getRestaurantSlug();

  const headers = new Headers(rest.headers);
  // Only set the x-restaurant-slug header when we actually have a slug.
  // Setting it to "" would be ignored by the server, but omitting it
  // entirely makes the intent clearer in DevTools.
  if (slug && !headers.has("x-restaurant-slug")) {
    headers.set("x-restaurant-slug", slug);
  }

  let body = rest.body;
  // Backward-compatible normalization at the transport boundary. This keeps
  // the server strict while preventing older menu clients from reintroducing
  // client-authoritative prices/totals.
  if (url === "/api/orders" && (rest.method || "GET").toUpperCase() === "POST" && typeof body === "string") {
    try {
      body = JSON.stringify(normalizePublicOrderBody(JSON.parse(body)));
    } catch {
      // Let the API return its normal validation error for malformed JSON.
    }
  }

  if (body && !headers.has("Content-Type")) {
    // Don't set Content-Type for FormData — browser sets it automatically
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    if (!isFormData) {
      headers.set("Content-Type", "application/json");
    }
  }
  return fetch(url, { ...rest, body, headers });
}

/**
 * Convenience helper for JSON POST requests without auth.
 * Returns the parsed JSON body (or throws on non-2xx).
 */
export async function publicApiPost<T = unknown>(
  url: string,
  body: unknown,
  slug?: string
): Promise<T> {
  const res = await publicApiFetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    ...(slug ? { slug } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `Erreur ${res.status}`);
  }
  return data as T;
}

/**
 * Persist the current restaurant slug so subsequent publicApiFetch
 * calls (and authenticated apiFetch calls) target the right tenant.
 * Called by /q/[token] scan page and by the /r/[slug] layout.
 */
export function setRestaurantSlug(slug: string): void {
  if (typeof window === "undefined") return;
  if (!slug || slug.length === 0) return;
  try {
    localStorage.setItem(RESTAURANT_SLUG_KEY, slug);
  } catch { /* localStorage not available */ }
}

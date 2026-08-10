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

type JsonRecord = Record<string, unknown>;

/**
 * Temporary compatibility boundary for the public menu UI.
 *
 * The order API is intentionally server-authoritative: prices, totals,
 * discounts, taxes, delivery fees and statuses must never be trusted from
 * the browser. Older menu components still include some of those fields and
 * use the legacy item shape { id, qty, name, price }.
 *
 * This function converts only the safe identifiers/quantities to the strict
 * POST /api/orders contract and DROPS every client-computed monetary field.
 * It does not weaken the server validation and can be removed once every
 * public ordering surface emits the strict contract directly.
 */
export function normalizePublicOrderPayload(input: unknown): JsonRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const raw = input as JsonRecord;
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items = rawItems
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const item = entry as JsonRecord;
      const menuItemId =
        typeof item.menuItemId === "string" && item.menuItemId.length > 0
          ? item.menuItemId
          : typeof item.id === "string" && item.id.length > 0
            ? item.id
            : "";
      const quantityRaw = item.quantity ?? item.qty;
      const quantity = typeof quantityRaw === "number" ? quantityRaw : Number(quantityRaw);
      if (!menuItemId || !Number.isInteger(quantity) || quantity < 1) return null;

      return {
        menuItemId,
        quantity,
        ...(typeof item.note === "string" && item.note.length > 0 ? { note: item.note } : {}),
      };
    })
    .filter((item): item is { menuItemId: string; quantity: number; note?: string } => item !== null);

  const manualTable = Number(raw.tableNumber);
  const existingNote = typeof raw.note === "string" ? raw.note.trim() : "";
  const manualTableNote =
    !raw.tableQrToken && Number.isInteger(manualTable) && manualTable > 0
      ? `[Table ${manualTable}]${existingNote ? ` ${existingNote}` : ""}`
      : existingNote;

  const normalized: JsonRecord = {
    items,
    ...(typeof raw.orderType === "string" ? { orderType: raw.orderType } : {}),
    ...(typeof raw.customerName === "string" ? { customerName: raw.customerName } : {}),
    ...(typeof raw.phone === "string" ? { phone: raw.phone } : {}),
    ...(typeof raw.deliveryAddress === "string" ? { deliveryAddress: raw.deliveryAddress } : {}),
    ...(typeof raw.paymentMethod === "string" ? { paymentMethod: raw.paymentMethod } : {}),
    ...(typeof raw.tableQrToken === "string" && raw.tableQrToken.length > 0
      ? { tableQrToken: raw.tableQrToken }
      : {}),
    ...(typeof raw.promoCode === "string" && raw.promoCode.length > 0 ? { promoCode: raw.promoCode } : {}),
    ...(typeof raw.tip === "number" ? { tip: raw.tip } : {}),
    ...(manualTableNote ? { note: manualTableNote } : {}),
    ...(typeof raw.idempotencyKey === "string" && raw.idempotencyKey.length > 0
      ? { idempotencyKey: raw.idempotencyKey }
      : {}),
  };

  return normalized;
}

function normalizeRequestBody(url: string, method: string | undefined, body: BodyInit | null | undefined): BodyInit | null | undefined {
  if (!body || typeof body !== "string") return body;
  if ((method || "GET").toUpperCase() !== "POST") return body;

  let pathname = url;
  try {
    pathname = new URL(url, "http://localhost").pathname;
  } catch { /* keep raw URL */ }
  if (pathname !== "/api/orders") return body;

  try {
    return JSON.stringify(normalizePublicOrderPayload(JSON.parse(body)));
  } catch {
    // Keep malformed JSON unchanged so the API returns its normal validation error.
    return body;
  }
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

  const body = normalizeRequestBody(url, rest.method, rest.body);
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

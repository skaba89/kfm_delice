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
  if (rest.body && !headers.has("Content-Type")) {
    // Don't set Content-Type for FormData — browser sets it automatically
    const isFormData = typeof FormData !== "undefined" && rest.body instanceof FormData;
    if (!isFormData) {
      headers.set("Content-Type", "application/json");
    }
  }
  return fetch(url, { ...rest, headers });
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

"use client";

/**
 * Public API fetch helper — for pages WITHOUT authentication (menu, orders, reservations, etc.)
 *
 * Automatically adds the x-restaurant-slug header for multi-tenant routing.
 * Falls back to 'kfm-delice' if no slug is stored in localStorage.
 *
 * For authenticated requests, use useAuth().apiFetch() instead.
 */

const DEFAULT_SLUG = "kfm-delice";
const RESTAURANT_SLUG_KEY = "restaurantpro_slug";

export function getRestaurantSlug(): string {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(RESTAURANT_SLUG_KEY);
      if (stored) return stored;
    } catch { /* localStorage not available */ }
  }
  return DEFAULT_SLUG;
}

export async function publicApiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const slug = getRestaurantSlug();
  const headers = new Headers(options.headers);
  if (!headers.has("x-restaurant-slug")) {
    headers.set("x-restaurant-slug", slug);
  }
  if (options.body && !headers.has("Content-Type")) {
    // Don't set Content-Type for FormData — browser sets it automatically
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (!isFormData) {
      headers.set("Content-Type", "application/json");
    }
  }
  return fetch(url, { ...options, headers });
}

/**
 * Convenience helper for JSON POST requests without auth.
 * Returns the parsed JSON body (or throws on non-2xx).
 */
export async function publicApiPost<T = unknown>(
  url: string,
  body: unknown
): Promise<T> {
  const res = await publicApiFetch(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `Erreur ${res.status}`);
  }
  return data as T;
}

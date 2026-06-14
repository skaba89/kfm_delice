"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { RestaurantDB } from "./types";

// ────────────────────────────────────────────────────────────────
// Restaurant Context — provides the current restaurant config
// to all components in the tree. Loads from /api/restaurant?slug=xxx
// or falls back to the first restaurant.
// ────────────────────────────────────────────────────────────────

interface RestaurantContextValue {
  restaurant: RestaurantDB | null;
  slug: string | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const RestaurantContext = createContext<RestaurantContextValue>({
  restaurant: null,
  slug: null,
  loading: true,
  error: null,
  reload: () => {},
});

export function useRestaurant() {
  return useContext(RestaurantContext);
}

interface RestaurantProviderProps {
  slug: string | null; // null = default (first restaurant)
  children: ReactNode;
}

export function RestaurantProvider({ slug, children }: RestaurantProviderProps) {
  const [restaurant, setRestaurant] = useState<RestaurantDB | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRestaurant = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = slug
        ? `/api/restaurant?slug=${encodeURIComponent(slug)}`
        : "/api/restaurant";
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Restaurant introuvable");
      }
      const data = await res.json();
      setRestaurant(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchRestaurant();
  }, [fetchRestaurant]);

  return (
    <RestaurantContext.Provider
      value={{ restaurant, slug, loading, error, reload: fetchRestaurant }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}

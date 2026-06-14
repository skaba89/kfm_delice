"use client";

import { useEffect } from "react";
import { useRestaurant } from "@/lib/restaurant-context";

/**
 * DynamicTheme — applies the restaurant's primary and secondary colors
 * as CSS custom properties on the document root, enabling dynamic theming
 * for all components without modifying their code.
 */
export function DynamicTheme({ children }: { children: React.ReactNode }) {
  const { restaurant } = useRestaurant();

  useEffect(() => {
    if (!restaurant) return;

    const root = document.documentElement;
    // Set CSS custom properties from restaurant config
    root.style.setProperty("--restaurant-primary", restaurant.primaryColor || "#ea580c");
    root.style.setProperty("--restaurant-secondary", restaurant.secondaryColor || "#dc2626");
    root.style.setProperty("--restaurant-currency", restaurant.currency || "GNF");

    // Compute lighter/darker variants
    root.style.setProperty("--restaurant-primary-light", adjustColor(restaurant.primaryColor || "#ea580c", 30));
    root.style.setProperty("--restaurant-primary-dark", adjustColor(restaurant.primaryColor || "#ea580c", -20));

    // Cleanup on unmount
    return () => {
      root.style.removeProperty("--restaurant-primary");
      root.style.removeProperty("--restaurant-secondary");
      root.style.removeProperty("--restaurant-currency");
      root.style.removeProperty("--restaurant-primary-light");
      root.style.removeProperty("--restaurant-primary-dark");
    };
  }, [restaurant]);

  return <>{children}</>;
}

/**
 * Adjust a hex color brightness by a percentage.
 * Positive = lighter, negative = darker.
 */
function adjustColor(hex: string, percent: number): string {
  // Remove # if present
  const cleaned = hex.replace("#", "");
  const num = parseInt(cleaned, 16);

  let r = (num >> 16) + Math.round(((255 * percent) / 100));
  let g = ((num >> 8) & 0x00ff) + Math.round(((255 * percent) / 100));
  let b = (num & 0x0000ff) + Math.round(((255 * percent) / 100));

  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

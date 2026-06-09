"use client";

import { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";

/**
 * Client-side provider wrapper.
 * Placed in the root layout so that AuthProvider (and future providers)
 * are shared across all routes — auth state persists during navigation.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

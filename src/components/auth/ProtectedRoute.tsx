"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface ProtectedRouteProps {
  /** Which user type is required to access this route */
  userType: "admin" | "customer" | "driver";
  /** Where to redirect if not authenticated */
  redirectTo: string;
  children: ReactNode;
}

/**
 * Guards a route that requires authentication.
 * Shows nothing (or a spinner) while checking auth, then either
 * renders children or redirects to `redirectTo`.
 */
export function ProtectedRoute({ userType, redirectTo, children }: ProtectedRouteProps) {
  const { admin, customer, driver, hydrated } = useAuth();
  const router = useRouter();

  const isAuthenticated =
    userType === "admin" ? !!admin :
    userType === "customer" ? !!customer :
    !!driver;

  useEffect(() => {
    // Wait for localStorage hydration before deciding
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.push(redirectTo);
    }
  }, [hydrated, isAuthenticated, redirectTo, router]);

  // Don't flash content while hydrating or redirecting
  if (!hydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

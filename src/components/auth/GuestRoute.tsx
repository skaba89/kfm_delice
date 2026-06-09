"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface GuestRouteProps {
  /** Which user type, if already authenticated, should be redirected away */
  userType: "admin" | "customer" | "driver";
  /** Where to redirect if already authenticated */
  redirectTo: string;
  children: ReactNode;
}

/**
 * Guards a route that should only be accessible to guests (e.g. login pages).
 * If the user is already authenticated, redirects to `redirectTo`.
 */
export function GuestRoute({ userType, redirectTo, children }: GuestRouteProps) {
  const { admin, customer, driver, hydrated } = useAuth();
  const router = useRouter();

  const isAuthenticated =
    userType === "admin" ? !!admin :
    userType === "customer" ? !!customer :
    !!driver;

  useEffect(() => {
    if (!hydrated) return;
    if (isAuthenticated) {
      router.push(redirectTo);
    }
  }, [hydrated, isAuthenticated, redirectTo, router]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

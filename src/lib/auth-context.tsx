"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import type { AdminUser, CustomerUser, DriverUser } from "@/lib/types";

interface AuthState {
  token: string | null;
  admin: AdminUser | null;
  customer: CustomerUser | null;
  driver: DriverUser | null;
  userType: "admin" | "customer" | "driver" | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  hydrated: boolean;
  loginAdmin: (data: { token: string; id: string; email: string; name: string; role: string; restaurantId?: string; restaurantSlug?: string; mustChangePassword?: boolean }) => void;
  loginCustomer: (data: { token: string; id: string; email: string; name: string; phone: string; address: string; loyaltyPoints: number; totalOrders: number; totalSpent: number; status: string }) => void;
  loginDriver: (data: { token: string; id: string; email: string; name: string; phone: string; vehicle: string; status: string; rating: number; totalDeliveries: number; zone: string; currentOrderId: string; lat: number; lng: number }) => void;
  updateCustomer: (data: Partial<CustomerUser>) => void;
  updateUserData: (data: Record<string, unknown>) => void;
  logout: () => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

// Tenant-aware storage keys — include restaurant slug for multi-tenant support
const RESTAURANT_SLUG_KEY = "restaurantpro_slug";
const AUTH_TOKEN_KEY = "restaurantpro_token";
const AUTH_USER_TYPE_KEY = "restaurantpro_user_type";
const AUTH_ADMIN_KEY = "restaurantpro_admin";
const AUTH_CUSTOMER_KEY = "restaurantpro_customer";
const AUTH_DRIVER_KEY = "restaurantpro_driver";

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Always start with null auth state (SSR-safe, avoids hydration mismatch)
  const [hydrated, setHydrated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [driver, setDriver] = useState<DriverUser | null>(null);
  const [userType, setUserType] = useState<"admin" | "customer" | "driver" | null>(null);

  // Hydrate auth state from localStorage after mount (client-only)
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      const storedUserType = localStorage.getItem(AUTH_USER_TYPE_KEY) as "admin" | "customer" | "driver" | null;
      const storedAdmin = localStorage.getItem(AUTH_ADMIN_KEY);
      const storedCustomer = localStorage.getItem(AUTH_CUSTOMER_KEY);
      const storedDriver = localStorage.getItem(AUTH_DRIVER_KEY);

      if (storedToken && storedUserType) {
        // Set token and userType first
        setToken(storedToken);
        setUserType(storedUserType);

        // Then set user data based on type
        if (storedUserType === "admin" && storedAdmin) {
          try { setAdmin(JSON.parse(storedAdmin)); } catch { /* corrupted */ }
        } else if (storedUserType === "customer" && storedCustomer) {
          try { setCustomer(JSON.parse(storedCustomer)); } catch { /* corrupted */ }
        } else if (storedUserType === "driver" && storedDriver) {
          try { setDriver(JSON.parse(storedDriver)); } catch { /* corrupted */ }
        }
      }
    } catch { /* localStorage not available */ }
    setHydrated(true);
  }, []);

  const clearAuthStorage = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_TYPE_KEY);
    localStorage.removeItem(AUTH_ADMIN_KEY);
    localStorage.removeItem(AUTH_CUSTOMER_KEY);
    localStorage.removeItem(AUTH_DRIVER_KEY);
    localStorage.removeItem(RESTAURANT_SLUG_KEY);
  }, []);

  // Mission 5: logout now calls /api/logout to revoke refresh tokens server-side
  const logout = useCallback(() => {
    // Fire-and-forget — don't block the UI on the server call
    fetch('/api/logout', {
      method: 'POST',
      credentials: 'include', // send the refresh_token cookie
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => { /* network error — still clear local state */ });

    setToken(null);
    setAdmin(null);
    setCustomer(null);
    setDriver(null);
    setUserType(null);
    clearAuthStorage();
  }, [clearAuthStorage, token]);

  const loginAdmin = useCallback((data: { token: string; id: string; email: string; name: string; role: string; restaurantId?: string; restaurantSlug?: string; mustChangePassword?: boolean }) => {
    const adminUser: AdminUser = { id: data.id, email: data.email, name: data.name, role: data.role, restaurantId: data.restaurantId, restaurantSlug: data.restaurantSlug, mustChangePassword: data.mustChangePassword };
    setToken(data.token);
    setAdmin(adminUser);
    setUserType("admin");
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(AUTH_USER_TYPE_KEY, "admin");
    localStorage.setItem(AUTH_ADMIN_KEY, JSON.stringify(adminUser));
    if (data.restaurantSlug) localStorage.setItem(RESTAURANT_SLUG_KEY, data.restaurantSlug);
  }, []);

  const loginCustomer = useCallback((data: { token: string; id: string; email: string; name: string; phone: string; address: string; loyaltyPoints: number; totalOrders: number; totalSpent: number; status: string; restaurantId?: string; restaurantSlug?: string; mustChangePassword?: boolean }) => {
    const customerUser: CustomerUser = {
      id: data.id, email: data.email, name: data.name, phone: data.phone,
      address: data.address, loyaltyPoints: data.loyaltyPoints, totalOrders: data.totalOrders,
      totalSpent: data.totalSpent, status: data.status, restaurantId: data.restaurantId, restaurantSlug: data.restaurantSlug, mustChangePassword: data.mustChangePassword,
    };
    setToken(data.token);
    setCustomer(customerUser);
    setUserType("customer");
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(AUTH_USER_TYPE_KEY, "customer");
    localStorage.setItem(AUTH_CUSTOMER_KEY, JSON.stringify(customerUser));
    if (data.restaurantSlug) localStorage.setItem(RESTAURANT_SLUG_KEY, data.restaurantSlug);
  }, []);

  const loginDriver = useCallback((data: { token: string; id: string; email: string; name: string; phone: string; vehicle: string; status: string; rating: number; totalDeliveries: number; zone: string; currentOrderId: string; lat: number; lng: number; restaurantId?: string; restaurantSlug?: string; mustChangePassword?: boolean }) => {
    const driverUser: DriverUser = {
      id: data.id, email: data.email, name: data.name, phone: data.phone,
      vehicle: data.vehicle, status: data.status, rating: data.rating,
      totalDeliveries: data.totalDeliveries, zone: data.zone, currentOrderId: data.currentOrderId,
      lat: data.lat || 0, lng: data.lng || 0, restaurantId: data.restaurantId, restaurantSlug: data.restaurantSlug, mustChangePassword: data.mustChangePassword,
    };
    setToken(data.token);
    setDriver(driverUser);
    setUserType("driver");
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(AUTH_USER_TYPE_KEY, "driver");
    localStorage.setItem(AUTH_DRIVER_KEY, JSON.stringify(driverUser));
    if (data.restaurantSlug) localStorage.setItem(RESTAURANT_SLUG_KEY, data.restaurantSlug);
  }, []);

  const updateCustomer = useCallback((data: Partial<CustomerUser>) => {
    setCustomer(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      localStorage.setItem(AUTH_CUSTOMER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Update current user data (e.g. mustChangePassword after password change)
  const updateUserData = useCallback((data: Record<string, unknown>) => {
    if (userType === "admin" && admin) {
      const updated = { ...admin, ...data } as AdminUser;
      setAdmin(updated);
      localStorage.setItem(AUTH_ADMIN_KEY, JSON.stringify(updated));
    } else if (userType === "customer" && customer) {
      const updated = { ...customer, ...data } as CustomerUser;
      setCustomer(updated);
      localStorage.setItem(AUTH_CUSTOMER_KEY, JSON.stringify(updated));
    } else if (userType === "driver" && driver) {
      const updated = { ...driver, ...data } as DriverUser;
      setDriver(updated);
      localStorage.setItem(AUTH_DRIVER_KEY, JSON.stringify(updated));
    }
  }, [userType, admin, customer, driver]);

  // ── Mission 5: Auto-refresh logic ──
  // When a 401 is received, try to refresh the token ONCE, then replay
  // the original request. If refresh fails, logout.
  // A shared promise prevents multiple concurrent refresh calls.
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const doRefresh = useCallback(async (): Promise<string | null> => {
    // If a refresh is already in flight, reuse it
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }
    refreshPromiseRef.current = (async () => {
      try {
        const res = await fetch('/api/refresh', {
          method: 'POST',
          credentials: 'include', // send the refresh_token cookie
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.accessToken) {
          setToken(data.accessToken);
          return data.accessToken as string;
        }
        return null;
      } catch {
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();
    return refreshPromiseRef.current;
  }, []);

  const apiFetch = useCallback(async (url: string, options?: RequestInit): Promise<Response> => {
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string> || {}),
    };

    // Add Authorization header if token exists
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Add restaurant slug header for multi-tenant API routing
    try {
      const slug = localStorage.getItem(RESTAURANT_SLUG_KEY);
      if (slug && !headers["x-restaurant-slug"]) {
        headers["x-restaurant-slug"] = slug;
      }
    } catch { /* localStorage not available */ }

    // Add Content-Type for requests with body (but not for FormData)
    if (options?.body && !headers["Content-Type"]) {
      const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
      if (!isFormData) {
        headers["Content-Type"] = "application/json";
      }
    }

    let res = await fetch(url, {
      ...options,
      headers,
    });

    // ── Mission 5: Auto-refresh on 401 ──
    // If we got a 401 and we have a token, try to refresh ONCE and replay.
    if (res.status === 401 && token) {
      const newToken = await doRefresh();
      if (newToken) {
        // Replay the original request with the new token (only once)
        headers["Authorization"] = `Bearer ${newToken}`;
        res = await fetch(url, {
          ...options,
          headers,
        });
      } else {
        // Refresh failed — logout
        logout();
      }
    }

    return res;
  }, [token, logout, doRefresh]);

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{
      token, admin, customer, driver, userType, isAuthenticated, hydrated,
      loginAdmin, loginCustomer, loginDriver, updateCustomer, updateUserData, logout, apiFetch,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

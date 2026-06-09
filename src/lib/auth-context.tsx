"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
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
  loginAdmin: (data: { token: string; id: string; email: string; name: string; role: string }) => void;
  loginCustomer: (data: { token: string; id: string; email: string; name: string; phone: string; address: string; loyaltyPoints: number; totalOrders: number; totalSpent: number; status: string }) => void;
  loginDriver: (data: { token: string; id: string; email: string; name: string; phone: string; vehicle: string; status: string; rating: number; totalDeliveries: number; zone: string; currentOrderId: string; lat: number; lng: number }) => void;
  updateCustomer: (data: Partial<CustomerUser>) => void;
  logout: () => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AUTH_TOKEN_KEY = "kfm_delice_token";
const AUTH_USER_TYPE_KEY = "kfm_delice_user_type";
const AUTH_ADMIN_KEY = "kfm_delice_admin";
const AUTH_CUSTOMER_KEY = "kfm_delice_customer";
const AUTH_DRIVER_KEY = "kfm_delice_driver";

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
        if (storedUserType === "admin" && storedAdmin) {
          try { setAdmin(JSON.parse(storedAdmin)); } catch { /* corrupted */ }
        } else if (storedUserType === "customer" && storedCustomer) {
          try { setCustomer(JSON.parse(storedCustomer)); } catch { /* corrupted */ }
        } else if (storedUserType === "driver" && storedDriver) {
          try { setDriver(JSON.parse(storedDriver)); } catch { /* corrupted */ }
        }
        setToken(storedToken);
        setUserType(storedUserType);
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
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setAdmin(null);
    setCustomer(null);
    setDriver(null);
    setUserType(null);
    clearAuthStorage();
  }, [clearAuthStorage]);

  const loginAdmin = useCallback((data: { token: string; id: string; email: string; name: string; role: string }) => {
    const adminUser: AdminUser = { id: data.id, email: data.email, name: data.name, role: data.role };
    setToken(data.token);
    setAdmin(adminUser);
    setUserType("admin");
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(AUTH_USER_TYPE_KEY, "admin");
    localStorage.setItem(AUTH_ADMIN_KEY, JSON.stringify(adminUser));
  }, []);

  const loginCustomer = useCallback((data: { token: string; id: string; email: string; name: string; phone: string; address: string; loyaltyPoints: number; totalOrders: number; totalSpent: number; status: string }) => {
    const customerUser: CustomerUser = {
      id: data.id, email: data.email, name: data.name, phone: data.phone,
      address: data.address, loyaltyPoints: data.loyaltyPoints, totalOrders: data.totalOrders,
      totalSpent: data.totalSpent, status: data.status,
    };
    setToken(data.token);
    setCustomer(customerUser);
    setUserType("customer");
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(AUTH_USER_TYPE_KEY, "customer");
    localStorage.setItem(AUTH_CUSTOMER_KEY, JSON.stringify(customerUser));
  }, []);

  const loginDriver = useCallback((data: { token: string; id: string; email: string; name: string; phone: string; vehicle: string; status: string; rating: number; totalDeliveries: number; zone: string; currentOrderId: string; lat: number; lng: number }) => {
    const driverUser: DriverUser = {
      id: data.id, email: data.email, name: data.name, phone: data.phone,
      vehicle: data.vehicle, status: data.status, rating: data.rating,
      totalDeliveries: data.totalDeliveries, zone: data.zone, currentOrderId: data.currentOrderId,
      lat: data.lat || 0, lng: data.lng || 0,
    };
    setToken(data.token);
    setDriver(driverUser);
    setUserType("driver");
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(AUTH_USER_TYPE_KEY, "driver");
    localStorage.setItem(AUTH_DRIVER_KEY, JSON.stringify(driverUser));
  }, []);

  const updateCustomer = useCallback((data: Partial<CustomerUser>) => {
    setCustomer(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      localStorage.setItem(AUTH_CUSTOMER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const apiFetch = useCallback(async (url: string, options?: RequestInit): Promise<Response> => {
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string> || {}),
    };

    // Add Authorization header if token exists
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Add Content-Type for requests with body (but not for FormData)
    if (options?.body && !headers["Content-Type"]) {
      // Don't set Content-Type for FormData — browser sets it automatically with boundary
      const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
      if (!isFormData) {
        headers["Content-Type"] = "application/json";
      }
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    // Handle token expiration — only logout if we had a token and got 401
    // This means our token is truly invalid/expired, not just a missing auth header
    if (res.status === 401 && token) {
      // Only logout if it's not a public route that might not need auth
      // or if the response body indicates an expired/invalid token
      try {
        const clonedRes = res.clone();
        const body = await clonedRes.json();
        // Only logout for actual token issues, not for "auth required" on public endpoints
        if (body.error?.includes("expiré") || body.error?.includes("invalide") || body.error?.includes("Token")) {
          logout();
        }
      } catch {
        // If we can't parse the response, logout to be safe
        logout();
      }
    }

    return res;
  }, [token, logout]);

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{
      token, admin, customer, driver, userType, isAuthenticated, hydrated,
      loginAdmin, loginCustomer, loginDriver, updateCustomer, logout, apiFetch,
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

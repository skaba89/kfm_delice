import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import type { ReactNode } from "react";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

function createWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("starts with no authenticated user", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper });

    // Before hydration, hydrated is false
    expect(result.current.admin).toBeNull();
    expect(result.current.customer).toBeNull();
    expect(result.current.driver).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("loginAdmin sets admin state and persists to localStorage", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper });

    act(() => {
      result.current.loginAdmin({
        token: "test-token",
        id: "admin-1",
        email: "admin@kfm-delice.com",
        name: "Admin",
        role: "admin",
      });
    });

    expect(result.current.admin).toEqual({
      id: "admin-1",
      email: "admin@kfm-delice.com",
      name: "Admin",
      role: "admin",
    });
    expect(result.current.token).toBe("test-token");
    expect(result.current.userType).toBe("admin");
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith("restaurantpro_token", "test-token");
  });

  it("loginCustomer sets customer state", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper });

    act(() => {
      result.current.loginCustomer({
        token: "cust-token",
        id: "cust-1",
        email: "aminata@gmail.com",
        name: "Aminata",
        phone: "622000000",
        address: "Conakry",
        loyaltyPoints: 100,
        totalOrders: 5,
        totalSpent: 50000,
        status: "active",
      });
    });

    expect(result.current.customer).toEqual({
      id: "cust-1",
      email: "aminata@gmail.com",
      name: "Aminata",
      phone: "622000000",
      address: "Conakry",
      loyaltyPoints: 100,
      totalOrders: 5,
      totalSpent: 50000,
      status: "active",
    });
    expect(result.current.userType).toBe("customer");
  });

  it("loginDriver sets driver state", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper });

    act(() => {
      result.current.loginDriver({
        token: "drv-token",
        id: "drv-1",
        email: "moussa@kfm-delice.com",
        name: "Moussa",
        phone: "622111111",
        vehicle: "moto",
        status: "available",
        rating: 4.5,
        totalDeliveries: 42,
        zone: "Kaloum",
        currentOrderId: "",
        lat: 9.51,
        lng: -13.71,
      });
    });

    expect(result.current.driver).toEqual({
      id: "drv-1",
      email: "moussa@kfm-delice.com",
      name: "Moussa",
      phone: "622111111",
      vehicle: "moto",
      status: "available",
      rating: 4.5,
      totalDeliveries: 42,
      zone: "Kaloum",
      currentOrderId: "",
      lat: 9.51,
      lng: -13.71,
    });
    expect(result.current.userType).toBe("driver");
  });

  it("logout clears all auth state", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper });

    act(() => {
      result.current.loginAdmin({
        token: "test-token",
        id: "admin-1",
        email: "admin@kfm-delice.com",
        name: "Admin",
        role: "admin",
      });
    });

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.admin).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.userType).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorageMock.removeItem).toHaveBeenCalled();
  });

  it("apiFetch adds Authorization header when token exists", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper });

    act(() => {
      result.current.loginAdmin({
        token: "bearer-token",
        id: "admin-1",
        email: "admin@kfm-delice.com",
        name: "Admin",
        role: "admin",
      });
    });

    // Mock global fetch
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));

    await result.current.apiFetch("/api/test");

    expect(fetchSpy).toHaveBeenCalledWith("/api/test", expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer bearer-token",
      }),
    }));

    fetchSpy.mockRestore();
  });

  it("updateCustomer merges partial data into existing customer", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper });

    act(() => {
      result.current.loginCustomer({
        token: "cust-token",
        id: "cust-1",
        email: "aminata@gmail.com",
        name: "Aminata",
        phone: "622000000",
        address: "Conakry",
        loyaltyPoints: 100,
        totalOrders: 5,
        totalSpent: 50000,
        status: "active",
      });
    });

    act(() => {
      result.current.updateCustomer({ name: "Aminata Diallo", phone: "622999999" });
    });

    expect(result.current.customer?.name).toBe("Aminata Diallo");
    expect(result.current.customer?.phone).toBe("622999999");
    expect(result.current.customer?.email).toBe("aminata@gmail.com"); // unchanged
  });
});

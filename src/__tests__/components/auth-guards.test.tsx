import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GuestRoute } from "@/components/auth/GuestRoute";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import type { ReactNode } from "react";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Create a test wrapper that allows injecting auth state
function createWrapper(initialAuth?: {
  userType?: "admin" | "customer" | "driver";
  loginFn?: string;
}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
  };
}

describe("ProtectedRoute", () => {
  it("shows spinner while not hydrated", () => {
    render(
      <AuthProvider>
        <ProtectedRoute userType="admin" redirectTo="/admin/login">
          <div>Protected Content</div>
        </ProtectedRoute>
      </AuthProvider>
    );

    // Should show loading spinner, not the protected content
    expect(screen.queryByText("Protected Content")).toBeNull();
  });
});

describe("GuestRoute", () => {
  it("renders children when not authenticated (after hydration)", async () => {
    render(
      <AuthProvider>
        <GuestRoute userType="admin" redirectTo="/admin">
          <div>Guest Content</div>
        </GuestRoute>
      </AuthProvider>
    );

    // After hydration completes (no admin in localStorage), children should render
    // Wait a tick for the useEffect to run
    await vi.waitFor(() => {
      expect(screen.getByText("Guest Content")).toBeInTheDocument();
    });
  });
});

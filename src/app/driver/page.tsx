"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DriverDashboard } from "@/components/DriverDashboard";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

function DriverPageContent() {
  const { driver, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (!driver) return null;

  return <DriverDashboard driver={driver} onLogout={handleLogout} />;
}

export default function DriverPage() {
  return (
    <ProtectedRoute userType="driver" redirectTo="/driver/login">
      <DriverPageContent />
    </ProtectedRoute>
  );
}

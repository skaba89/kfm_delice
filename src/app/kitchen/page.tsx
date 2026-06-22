"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { KitchenDashboard } from "@/components/kitchen/KitchenDashboard";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

function KitchenPageContent() {
  const { admin, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (!admin) return null;

  return <KitchenDashboard onLogout={handleLogout} />;
}

export default function KitchenPage() {
  return (
    <ProtectedRoute userType="admin" redirectTo="/admin/login">
      <KitchenPageContent />
    </ProtectedRoute>
  );
}

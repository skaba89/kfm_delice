"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AdminDashboard } from "@/components/AdminDashboard";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

function AdminPageContent() {
  const { admin, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (!admin) return null;

  return <AdminDashboard admin={admin} onLogout={handleLogout} />;
}

export default function AdminPage() {
  return (
    <ProtectedRoute userType="admin" redirectTo="/admin/login">
      <AdminPageContent />
    </ProtectedRoute>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { CustomerAccount } from "@/components/CustomerAccount";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

function ClientPageContent() {
  const { customer, logout, updateCustomer } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (!customer) return null;

  return (
    <CustomerAccount
      customer={customer}
      onLogout={handleLogout}
      onUpdate={(c) => updateCustomer(c)}
      onTrackOrder={(order) => router.push(`/tracking?orderId=${order.id}`)}
    />
  );
}

export default function ClientPage() {
  return (
    <ProtectedRoute userType="customer" redirectTo="/client/login">
      <ClientPageContent />
    </ProtectedRoute>
  );
}

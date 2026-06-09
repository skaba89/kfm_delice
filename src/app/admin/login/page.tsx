"use client";

import { useRouter } from "next/navigation";
import { AdminLogin } from "@/components/AdminLogin";
import { GuestRoute } from "@/components/auth/GuestRoute";

export default function AdminLoginPage() {
  const router = useRouter();

  return (
    <GuestRoute userType="admin" redirectTo="/admin">
      <AdminLogin onLogin={() => router.push("/admin")} />
    </GuestRoute>
  );
}

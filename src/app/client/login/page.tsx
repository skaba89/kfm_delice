"use client";

import { useRouter } from "next/navigation";
import { CustomerLogin } from "@/components/CustomerLogin";
import { GuestRoute } from "@/components/auth/GuestRoute";

export default function ClientLoginPage() {
  const router = useRouter();

  return (
    <GuestRoute userType="customer" redirectTo="/client">
      <CustomerLogin
        onLogin={() => router.push("/client")}
        onRegister={() => router.push("/client/register")}
        onBack={() => router.push("/")}
      />
    </GuestRoute>
  );
}

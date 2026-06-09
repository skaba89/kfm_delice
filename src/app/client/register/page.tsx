"use client";

import { useRouter } from "next/navigation";
import { CustomerRegister } from "@/components/CustomerRegister";
import { GuestRoute } from "@/components/auth/GuestRoute";

export default function ClientRegisterPage() {
  const router = useRouter();

  return (
    <GuestRoute userType="customer" redirectTo="/client">
      <CustomerRegister
        onRegister={() => router.push("/client")}
        onLogin={() => router.push("/client/login")}
        onBack={() => router.push("/")}
      />
    </GuestRoute>
  );
}

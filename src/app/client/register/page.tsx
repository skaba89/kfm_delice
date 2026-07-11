"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CustomerRegister } from "@/components/CustomerRegister";
import { GuestRoute } from "@/components/auth/GuestRoute";

function ClientRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/client";

  return (
    <GuestRoute userType="customer" redirectTo="/client">
      <CustomerRegister
        onRegister={() => router.push(redirect)}
        onLogin={() => router.push(`/client/login?redirect=${encodeURIComponent(redirect)}`)}
        onBack={() => router.push("/")}
      />
    </GuestRoute>
  );
}

export default function ClientRegisterPage() {
  return (
    <Suspense fallback={null}>
      <ClientRegisterContent />
    </Suspense>
  );
}

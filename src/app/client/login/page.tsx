"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CustomerLogin } from "@/components/CustomerLogin";
import { GuestRoute } from "@/components/auth/GuestRoute";

function ClientLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/client";

  return (
    <GuestRoute userType="customer" redirectTo="/client">
      <CustomerLogin
        onLogin={() => router.push(redirect)}
        onRegister={() => router.push(`/client/register?redirect=${encodeURIComponent(redirect)}`)}
        onBack={() => router.push("/")}
      />
    </GuestRoute>
  );
}

export default function ClientLoginPage() {
  return (
    <Suspense fallback={null}>
      <ClientLoginContent />
    </Suspense>
  );
}

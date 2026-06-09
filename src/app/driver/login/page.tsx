"use client";

import { useRouter } from "next/navigation";
import { DriverLogin } from "@/components/DriverLogin";
import { GuestRoute } from "@/components/auth/GuestRoute";

export default function DriverLoginPage() {
  const router = useRouter();

  return (
    <GuestRoute userType="driver" redirectTo="/driver">
      <DriverLogin
        onLogin={() => router.push("/driver")}
        onBack={() => router.push("/")}
      />
    </GuestRoute>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { MenuSection } from "@/components/MenuSection";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";

export default function MenuPage() {
  const { customer, driver } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar
        onAdminClick={() => router.push("/admin/login")}
        onCustomerClick={() => { if (customer) router.push("/client"); else router.push("/client/login"); }}
        onDriverClick={() => { if (driver) router.push("/driver"); else router.push("/driver/login"); }}
        customer={customer}
      />
      <div className="pt-20">
        <MenuSection />
      </div>
      <PublicFooter />
    </div>
  );
}

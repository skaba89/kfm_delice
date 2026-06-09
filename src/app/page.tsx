"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PublicNavbar } from "@/components/PublicNavbar";
import { HeroSection } from "@/components/HeroSection";
import { MenuSection } from "@/components/MenuSection";
import { ReservationSection } from "@/components/ReservationSection";
import { AvisSection } from "@/components/AvisSection";
import { AboutSection } from "@/components/AboutSection";
import { PublicFooter } from "@/components/PublicFooter";

export default function Home() {
  const { customer, driver } = useAuth();
  const router = useRouter();

  // Seed DB only if not already seeded
  useEffect(() => {
    fetch("/api/seed", { method: "GET" })
      .then(res => res.json())
      .then(data => {
        if (data.needsSeed) {
          return fetch("/api/seed", { method: "POST" });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar
        onAdminClick={() => router.push("/admin/login")}
        onCustomerClick={() => { if (customer) router.push("/client"); else router.push("/client/login"); }}
        onDriverClick={() => { if (driver) router.push("/driver"); else router.push("/driver/login"); }}
        customer={customer}
      />
      <HeroSection />
      <MenuSection />
      <ReservationSection />
      <AvisSection />
      <AboutSection />
      <PublicFooter />
      <a href="https://wa.me/224622345678" target="_blank" rel="noopener noreferrer" className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg shadow-green-500/30 transition-colors" title="Commander via WhatsApp">
        <MessageCircle className="w-6 h-6" />
      </a>
    </div>
  );
}

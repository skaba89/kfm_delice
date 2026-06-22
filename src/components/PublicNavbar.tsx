"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, LayoutDashboard,
  Menu, X, UserCheck, Bike,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { CustomerUser } from "@/lib/types";

interface PublicNavbarProps {
  onAdminClick: () => void;
  onCustomerClick: () => void;
  onDriverClick: () => void;
  customer: CustomerUser | null;
}

export function PublicNavbar({ onAdminClick, onCustomerClick, onDriverClick, customer }: PublicNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { const h = () => setScrolled(window.scrollY > 20); window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h); }, []);
  const links = [
    { href: "#menu", label: "Menu" }, { href: "#reservation", label: "Réserver" },
    { href: "#avis", label: "Avis" }, { href: "#apropos", label: "À Propos" }, { href: "#contact", label: "Contact" },
  ];
  return (
    <motion.nav initial={{ y: -100 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all ${scrolled ? "bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-lg border-b border-orange-100 dark:border-orange-900/30" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <a href="#" className="flex items-center gap-2.5">
            <img src="/images/icon-192.png" alt="KFM Delice" className="w-10 h-10 rounded-xl shadow-lg shadow-orange-500/30 object-cover" />
            <div className="leading-tight">
              <span className={`text-xl font-extrabold tracking-tight transition-colors ${scrolled ? "text-gray-900 dark:text-gray-100" : "text-white"}`}>KFM <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">Delice</span></span>
              <p className={`text-[10px] font-medium tracking-widest uppercase ${scrolled ? "text-gray-400 dark:text-gray-500" : "text-white/60"}`}>Restaurant & Bar</p>
            </div>
          </a>
          <div className="hidden lg:flex items-center gap-5">
            {links.map(l => <a key={l.href} href={l.href} className={`text-sm font-medium transition-colors hover:text-orange-500 ${scrolled ? "text-gray-700 dark:text-gray-300" : "text-white/90"}`}>{l.label}</a>)}
            <a href="#reservation"><Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full px-6 shadow-lg shadow-orange-500/25">Réserver</Button></a>
            {customer ? (
              <button onClick={onCustomerClick} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${scrolled ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50" : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"}`}>
                <UserCheck className="w-4 h-4" /> {customer.name.split(" ")[0]}
              </button>
            ) : (
              <button onClick={onCustomerClick} className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${scrolled ? "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300" : "text-emerald-400 hover:text-emerald-300"}`}>
                <User className="w-4 h-4" /> Client
              </button>
            )}
            <button onClick={onDriverClick} className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${scrolled ? "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300" : "text-blue-400 hover:text-blue-300"}`}>
              <Bike className="w-4 h-4" /> Livreur
            </button>
            <ThemeToggle />
            <button onClick={onAdminClick} className={`p-2 rounded-lg transition-colors ${scrolled ? "text-gray-400 hover:text-orange-500 dark:text-gray-500 dark:hover:text-orange-400" : "text-white/50 hover:text-orange-400"}`} title="Admin"><LayoutDashboard className="w-5 h-5" /></button>
          </div>
          <div className="lg:hidden flex items-center gap-2">
            <ThemeToggle />
            <button className="p-2" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className={scrolled ? "text-gray-900 dark:text-gray-100" : "text-white"} /> : <Menu className={scrolled ? "text-gray-900 dark:text-gray-100" : "text-white"} />}
            </button>
          </div>
        </div>
        <AnimatePresence>{menuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="lg:hidden bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-4 mb-4">
            {links.map(l => <a key={l.href} href={l.href} className="block py-3 px-4 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:hover:text-orange-400 rounded-lg" onClick={() => setMenuOpen(false)}>{l.label}</a>)}
            <a href="#reservation" onClick={() => setMenuOpen(false)}><Button className="w-full mt-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full">Réserver</Button></a>
            {customer ? (
              <button onClick={() => { setMenuOpen(false); onCustomerClick(); }} className="w-full mt-2 py-3 px-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-lg text-sm flex items-center gap-2"><UserCheck className="w-4 h-4" /> Mon Compte ({customer.name})</button>
            ) : (
              <button onClick={() => { setMenuOpen(false); onCustomerClick(); }} className="w-full mt-2 py-3 px-4 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-sm flex items-center gap-2"><User className="w-4 h-4" /> Connexion Client</button>
            )}
            <button onClick={() => { setMenuOpen(false); onDriverClick(); }} className="w-full mt-2 py-3 px-4 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-sm flex items-center gap-2"><Bike className="w-4 h-4" /> Espace Livreur</button>
            <button onClick={() => { setMenuOpen(false); onAdminClick(); }} className="w-full mt-2 py-3 px-4 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-sm flex items-center gap-2"><LayoutDashboard className="w-4 h-4" /> Administration</button>
          </motion.div>
        )}</AnimatePresence>
      </div>
    </motion.nav>
  );
}

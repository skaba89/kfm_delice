"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, UtensilsCrossed } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900 p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <UtensilsCrossed className="w-12 h-12 text-orange-500" />
        </div>
        <h1 className="text-6xl font-extrabold text-orange-600 mb-2">404</h1>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Page introuvable
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/">
            <Button className="bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl">
              <Home className="w-4 h-4 mr-2" /> Accueil
            </Button>
          </Link>
          <Link href="/menu">
            <Button variant="outline" className="rounded-xl">
              <UtensilsCrossed className="w-4 h-4 mr-2" /> Voir le menu
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

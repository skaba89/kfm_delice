"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { QrCode, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * TablesTab — embedded in the admin dashboard.
 *
 * Redirects to the full-page /admin/tables interface (Mission 11.9)
 * which provides complete CRUD + QR code generation/rotation/printing.
 */
export function TablesTab() {
  const router = useRouter();

  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardContent className="p-6 text-center">
        <QrCode className="w-12 h-12 text-orange-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Tables & QR Codes
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-md mx-auto">
          Gérez les tables de votre restaurant : créez, modifiez, activez/désactivez,
          générez et imprimez les QR codes pour chaque table.
        </p>
        <Button
          onClick={() => router.push("/admin/tables")}
          className="bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl"
        >
          Ouvrir la gestion des tables
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

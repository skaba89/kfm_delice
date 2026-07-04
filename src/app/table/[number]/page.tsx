"use client";

import { use } from "react";
import { TableOrderingSection } from "@/components/TableOrderingSection";

export default function TableOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const tableNumber = parseInt(number, 10);

  if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 200) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <p className="text-6xl mb-4">🤔</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Numéro de table invalide</h1>
          <p className="text-gray-500">Scannez le QR code sur votre table pour commander.</p>
        </div>
      </div>
    );
  }

  return <TableOrderingSection tableNumber={tableNumber} />;
}

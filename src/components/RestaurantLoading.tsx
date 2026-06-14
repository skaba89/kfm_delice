"use client";

import { RefreshCw } from "lucide-react";

export function RestaurantLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <RefreshCw className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Chargement du restaurant...</p>
      </div>
    </div>
  );
}

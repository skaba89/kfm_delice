"use client";

import { RefreshCw } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Chargement…</p>
      </div>
    </div>
  );
}

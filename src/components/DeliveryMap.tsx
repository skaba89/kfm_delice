"use client";

/**
 * DeliveryMap — Public entry point for the real-time delivery map.
 *
 * Uses next/dynamic with ssr:false so that Leaflet (which requires `window`)
 * only ever loads in the browser. During the initial server render and the
 * first client paint, a lightweight placeholder is shown.
 */

import dynamic from "next/dynamic";
import type { DriverDB, OrderDB } from "@/lib/types";

const DeliveryMapInner = dynamic(
  () => import("@/components/DeliveryMapInner").then((m) => m.DeliveryMapInner),
  {
    ssr: false,
    loading: () => <MapPlaceholder height={320} />,
  }
);

export interface DeliveryMapProps {
  drivers: DriverDB[];
  orders: OrderDB[];
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  className?: string;
  /** If set, only show this driver (for customer tracking) */
  focusDriverId?: string;
  /** If set, draw a line from restaurant to this destination */
  destinationLat?: number;
  destinationLng?: number;
  /** Simple mode for customer tracking */
  simple?: boolean;
  onDriverClick?: (driver: DriverDB) => void;
}

function MapPlaceholder({ height = 320 }: { height?: number }) {
  return (
    <div
      className="w-full flex items-center justify-center bg-gradient-to-br from-emerald-50 to-sky-50 dark:from-gray-900 dark:to-gray-800 rounded-xl border border-emerald-100 dark:border-gray-700"
      style={{ height }}
    >
      <div className="flex flex-col items-center gap-2 text-emerald-600 dark:text-emerald-400">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium">Chargement de la carte…</p>
      </div>
    </div>
  );
}

export function DeliveryMap(props: DeliveryMapProps) {
  return <DeliveryMapInner {...props} />;
}

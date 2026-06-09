"use client";

import { Bike, ShoppingBag, UtensilsCrossed } from "lucide-react";

export function OrderTypeIcon({ type }: { type: string }) {
  if (type === "delivery") return <Bike className="w-3.5 h-3.5" />;
  if (type === "takeaway") return <ShoppingBag className="w-3.5 h-3.5" />;
  return <UtensilsCrossed className="w-3.5 h-3.5" />;
}

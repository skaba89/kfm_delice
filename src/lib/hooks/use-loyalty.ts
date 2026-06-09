"use client";

import { Shield, Medal, Award, Crown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface TierInfo {
  min: number;
  name: string;
  color: string;
  icon: LucideIcon;
  discount: string;
  next: number;
}

export const TIER_THRESHOLDS: TierInfo[] = [
  { min: 0, name: "Bronze", color: "from-orange-400 to-orange-700", icon: Shield, discount: "2%", next: 101 },
  { min: 101, name: "Silver", color: "from-gray-400 to-gray-600", icon: Medal, discount: "5%", next: 501 },
  { min: 501, name: "Gold", color: "from-yellow-400 to-yellow-600", icon: Award, discount: "10%", next: 1001 },
  { min: 1001, name: "Platinum", color: "from-gray-300 to-gray-500", icon: Crown, discount: "15%", next: Infinity },
];

export function getTier(points: number): TierInfo {
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= TIER_THRESHOLDS[i].min) return TIER_THRESHOLDS[i];
  }
  return TIER_THRESHOLDS[0];
}

export function getTierProgress(points: number): number {
  const tier = getTier(points);
  if (tier.next === Infinity) return 100;
  const prevMin = tier.min;
  return Math.round(((points - prevMin) / (tier.next - prevMin)) * 100);
}

export const ORDER_STEPS = ["pending", "confirmed", "preparing", "ready", "delivering", "delivered"];
export const ORDER_STEP_LABELS = ["Reçue", "Confirmée", "En préparation", "Prête", "En livraison", "Livrée"];

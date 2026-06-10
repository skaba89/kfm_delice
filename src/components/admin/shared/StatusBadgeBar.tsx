"use client";

import { Badge } from "@/components/ui/badge";

export interface StatusBadge {
  /** Count to display */
  count: number;
  /** Label text (e.g. "Actifs", "En attente") */
  label: string;
  /** Color variant */
  color: "green" | "red" | "amber" | "orange" | "blue" | "gray" | "purple" | "cyan";
}

const badgeColorMap: Record<string, string> = {
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
};

interface StatusBadgeBarProps {
  /** Array of status badges to display */
  badges: StatusBadge[];
}

/**
 * Consistent status badge header for admin tabs.
 * Eliminates the duplicated badge bar pattern found across 10+ tabs.
 *
 * @example
 * ```tsx
 * <StatusBadgeBar badges={[
 *   { count: activeCount, label: "Actifs", color: "green" },
 *   { count: inactiveCount, label: "Inactifs", color: "red" },
 * ]} />
 * ```
 */
export function StatusBadgeBar({ badges }: StatusBadgeBarProps) {
  return (
    <div className="flex items-center gap-2">
      {badges.map((badge, i) => (
        <Badge key={i} className={`${badgeColorMap[badge.color] || badgeColorMap.gray} text-xs`}>
          {badge.count} {badge.label}
        </Badge>
      ))}
    </div>
  );
}

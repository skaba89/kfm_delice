"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";

export interface SummaryCardItem {
  /** Label text (e.g. "Total facturé") */
  label: string;
  /** Value to display */
  value: ReactNode;
  /** Optional color class for the value (e.g. "text-green-600 dark:text-green-400") */
  valueColor?: string;
}

interface SummaryCardsProps {
  /** Array of summary card items */
  items: SummaryCardItem[];
  /** Grid columns: 2, 3, or 4 (default responsive) */
  columns?: 2 | 3 | 4 | 7;
}

const gridColsMap: Record<number, string> = {
  2: "grid grid-cols-2 gap-3",
  3: "grid grid-cols-3 gap-3",
  4: "grid grid-cols-2 lg:grid-cols-4 gap-3",
  7: "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2",
};

/**
 * Consistent summary/stat cards for admin tabs.
 * Eliminates the duplicated Card+CardContent pattern found in
 * Invoices, Customers, Payments, Expenses, Overview tabs.
 *
 * @example
 * ```tsx
 * <SummaryCards columns={4} items={[
 *   { label: "Total facturé", value: formatPrice(total) },
 *   { label: "Payé", value: formatPrice(paid), valueColor: "text-green-600 dark:text-green-400" },
 * ]} />
 * ```
 */
export function SummaryCards({ items, columns = 4 }: SummaryCardsProps) {
  return (
    <div className={gridColsMap[columns] || gridColsMap[4]}>
      {items.map((item, i) => (
        <Card key={i} className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
            <p className={`text-lg font-bold ${item.valueColor || "text-gray-900 dark:text-gray-100"}`}>
              {item.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

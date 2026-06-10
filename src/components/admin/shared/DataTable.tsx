"use client";

import { ReactNode } from "react";

/**
 * Column definition for the DataTable component.
 */
export interface DataTableColumn<T> {
  /** Column header label */
  header: string;
  /** Render the cell content for this row */
  cell: (item: T) => ReactNode;
  /** Optional CSS class for the header cell */
  headerClassName?: string;
  /** Optional CSS class for the data cell */
  cellClassName?: string;
}

interface DataTableProps<T> {
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Data rows */
  data: T[];
  /** Key extractor for each row (defaults to item.id) */
  keyExtractor?: (item: T) => string;
  /** Empty state content (icon + message) */
  emptyContent?: ReactNode;
}

/**
 * Reusable data table with consistent styling across admin tabs.
 * Eliminates the duplicated table shell pattern found in Reservations,
 * Staff, Expenses, and Payments tabs.
 *
 * Features:
 * - Consistent header styling (uppercase, gray-500, dark mode)
 * - Hover effects on rows
 * - Overflow-x-auto for responsive horizontal scrolling
 * - Dark mode support
 */
export function DataTable<T extends { id?: string }>({
  columns,
  data,
  keyExtractor,
  emptyContent,
}: DataTableProps<T>) {
  if (data.length === 0 && emptyContent) {
    return <>{emptyContent}</>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase ${col.headerClassName || ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {data.map((item) => {
              const key = keyExtractor ? keyExtractor(item) : (item as { id: string }).id;
              return (
                <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  {columns.map((col, i) => (
                    <td key={i} className={`px-4 py-3 ${col.cellClassName || ""}`}>
                      {col.cell(item)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

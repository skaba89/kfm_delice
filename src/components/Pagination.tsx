"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  label?: string;
}

export function Pagination({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange, label = "éléments" }: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-between px-2 py-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {startItem}-{endItem} sur {totalItems} {label}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} className="h-8 w-8 p-0">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
          .map((page, i, arr) => (
            <span key={page}>
              {i > 0 && arr[i - 1] !== page - 1 && <span className="px-1 text-gray-400">...</span>}
              <Button variant={page === currentPage ? "default" : "outline"} size="sm" onClick={() => onPageChange(page)} className="h-8 w-8 p-0">
                {page}
              </Button>
            </span>
          ))
        }
        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="h-8 w-8 p-0">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

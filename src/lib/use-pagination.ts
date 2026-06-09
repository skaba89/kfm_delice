import { useState, useMemo, useCallback } from "react";

export function usePagination<T>(items: T[], itemsPerPage = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const [prevItemsLen, setPrevItemsLen] = useState(items.length);

  // Detect items count change and reset page
  if (items.length !== prevItemsLen) {
    setPrevItemsLen(items.length);
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const effectivePage = Math.min(currentPage, Math.max(totalPages, 1));
  const paginatedItems = useMemo(() => {
    const start = (effectivePage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, effectivePage, itemsPerPage]);

  const onPageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  return { currentPage: effectivePage, setCurrentPage: onPageChange, totalPages, paginatedItems, totalItems: items.length, itemsPerPage };
}

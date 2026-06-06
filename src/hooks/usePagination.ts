"use client";

import { useState, useCallback } from "react";
import type { PaginationInfo } from "@/lib/types/pagination";

interface UsePaginationOptions {
  defaultPageSize?: number;
}

interface UsePaginationReturn {
  page: number;
  pageSize: number;
  pagination: PaginationInfo | null;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setPagination: (info: PaginationInfo) => void;
  resetPage: () => void;
}

export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { defaultPageSize = 20 } = options;

  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(defaultPageSize);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  const setPage = useCallback((p: number) => {
    if (p >= 1) setPageRaw(p);
  }, []);

  const setPageSize = useCallback((size: number) => {
    if (size >= 1) {
      setPageSizeRaw(size);
      setPageRaw(1);  // 改每页条数时重置页码
    }
  }, []);

  const resetPage = useCallback(() => {
    setPageRaw(1);
  }, []);

  return {
    page,
    pageSize,
    pagination,
    setPage,
    setPageSize,
    setPagination,
    resetPage,
  };
}

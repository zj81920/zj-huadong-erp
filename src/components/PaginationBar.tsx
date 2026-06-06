"use client";

import { useMemo } from "react";
import type { PaginationInfo } from "@/lib/types/pagination";

interface PaginationBarProps {
  pagination: PaginationInfo | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export default function PaginationBar({
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
}: PaginationBarProps) {
  if (!pagination || pagination.totalPages <= 0) return null;

  const { page, totalPages, total } = pagination;

  // 生成页码数组（带省略号）
  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 px-1 py-3 text-sm text-gray-500">
      {/* 总数 */}
      <span>
        共 <strong className="text-gray-900">{total}</strong> 条记录
      </span>

      {/* 页码 */}
      <div className="flex items-center gap-1">
        <button
          className="ios-btn text-xs px-3 py-1.5 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          &laquo; 上一页
        </button>

        {pageNumbers.map((num, idx) =>
          num === "..." ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={num}
              className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${
                num === page
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => onPageChange(num)}
            >
              {num}
            </button>
          )
        )}

        <button
          className="ios-btn text-xs px-3 py-1.5 disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          下一页 &raquo;
        </button>
      </div>

      {/* 每页条数 */}
      <div className="flex items-center gap-1.5">
        <span>每页</span>
        <select
          value={pagination.pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="ios-select text-xs py-1 px-2"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span>条</span>
      </div>
    </div>
  );
}

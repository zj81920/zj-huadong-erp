// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagination } from "@/hooks/usePagination";

describe("usePagination", () => {
  it("默认初始值：page=1, pageSize=20, pagination=null", () => {
    const { result } = renderHook(() => usePagination({}));
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(20);
    expect(result.current.pagination).toBeNull();
  });

  it("自定义 defaultPageSize", () => {
    const { result } = renderHook(() => usePagination({ defaultPageSize: 50 }));
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(50);
  });

  it("setPage 正常翻页", () => {
    const { result } = renderHook(() => usePagination({}));
    act(() => { result.current.setPage(3); });
    expect(result.current.page).toBe(3);
  });

  it("setPageSize 改变每页条数时自动重置 page=1", () => {
    const { result } = renderHook(() => usePagination({}));
    act(() => { result.current.setPage(5); });
    expect(result.current.page).toBe(5);
    act(() => { result.current.setPageSize(50); });
    expect(result.current.pageSize).toBe(50);
    expect(result.current.page).toBe(1);
  });

  it("setPagination 设置分页信息", () => {
    const { result } = renderHook(() => usePagination({}));
    act(() => {
      result.current.setPagination({
        page: 1,
        pageSize: 20,
        total: 100,
        totalPages: 5,
      });
    });
    expect(result.current.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 100,
      totalPages: 5,
    });
  });

  it("resetPage 重置到第 1 页", () => {
    const { result } = renderHook(() => usePagination({}));
    act(() => { result.current.setPage(5); });
    act(() => { result.current.resetPage(); });
    expect(result.current.page).toBe(1);
  });

  it("setPage 忽略 <= 0 的值", () => {
    const { result } = renderHook(() => usePagination({}));
    act(() => { result.current.setPage(0); });
    expect(result.current.page).toBe(1);
    act(() => { result.current.setPage(-1); });
    expect(result.current.page).toBe(1);
  });

  it("setPageSize 忽略 <= 0 的值", () => {
    const { result } = renderHook(() => usePagination({}));
    act(() => { result.current.setPageSize(0); });
    expect(result.current.pageSize).toBe(20);
    act(() => { result.current.setPageSize(-10); });
    expect(result.current.pageSize).toBe(20);
  });
});

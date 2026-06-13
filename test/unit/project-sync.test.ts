import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// 动态导入被测模块（需要在 mock 之后）
import { syncProjectToDS } from "@/lib/project-sync";

describe("syncProjectToDS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DS_API_BASE_URL = "http://localhost:3000";
    process.env.DS_INTERNAL_API_KEY = "test-key";
  });

  it("无 dsProjectCode 时应调用 POST 创建", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: "HDE-2024-001", id: "ds-id-1" }),
    });

    const result = await syncProjectToDS({
      id: "erp-id-1",
      projectCode: "HDE-2024-001",
      name: "测试项目",
      projectContent: "描述",
      status: "执行",
      dsProjectCode: null,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callUrl = mockFetch.mock.calls[0][0];
    expect(callUrl).toContain("/api/projects");

    const callOpts = mockFetch.mock.calls[0][1];
    expect(callOpts.method).toBe("POST");
    expect(callOpts.headers["x-internal-key"]).toBe("test-key");

    const body = JSON.parse(callOpts.body);
    expect(body.code).toBe("HDE-2024-001");
    expect(body.name).toBe("测试项目");
    expect(body.status).toBe("ACTIVE");
    expect(body.description).toBe("描述");

    expect(result).toEqual({ success: true, dsCode: "HDE-2024-001" });
  });

  it("有 dsProjectCode 时应调用 PATCH 更新", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: "HDE-2024-001" }),
    });

    const result = await syncProjectToDS({
      id: "erp-id-1",
      projectCode: "HDE-2024-001",
      name: "更新后项目",
      status: "暂停",
      dsProjectCode: "HDE-2024-001",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callOpts = mockFetch.mock.calls[0][1];
    expect(callOpts.method).toBe("PATCH");
    expect(result).toEqual({ success: true, dsCode: "HDE-2024-001" });
  });

  it("DS API 返回错误时不应抛出异常，返回 success: false", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await syncProjectToDS({
      id: "erp-id-1",
      projectCode: "HDE-2024-001",
      name: "测试",
      dsProjectCode: null,
    });

    expect(result.success).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { computeTaskStatus } from "../../src/lib/wbs-utils";

function d(s: string): Date {
  return new Date(s + "T00:00:00+08:00");
}

describe("computeTaskStatus with actualEndDate", () => {
  it("用例1: actualEndDate === planEnd → 按期完成（即使 today > planEnd）", () => {
    const r = computeTaskStatus(100, d("2026-06-01"), d("2026-06-10"), d("2026-06-10"), d("2026-06-11"));
    expect(r.status).toBe("onTimeComplete");
    expect(r.label).toBe("按期完成");
  });

  it("用例2: actualEndDate < planEnd → 提前完成", () => {
    const r = computeTaskStatus(100, d("2026-06-01"), d("2026-06-10"), d("2026-06-08"), d("2026-06-11"));
    expect(r.status).toBe("aheadComplete");
    expect(r.label).toBe("提前完成");
  });

  it("用例3: actualEndDate > planEnd → 超期完成", () => {
    const r = computeTaskStatus(100, d("2026-06-01"), d("2026-06-10"), d("2026-06-12"), d("2026-06-11"));
    expect(r.status).toBe("overdueComplete");
    expect(r.label).toBe("超期完成");
  });

  it("用例4: 无 actualEndDate，today === planEnd → 按期完成（向后兼容）", () => {
    const r = computeTaskStatus(100, d("2026-06-01"), d("2026-06-11"), null, d("2026-06-11"));
    expect(r.status).toBe("onTimeComplete");
    expect(r.label).toBe("按期完成");
  });

  it("用例5: 无 actualEndDate，today > planEnd → 超期完成（向后兼容）", () => {
    const r = computeTaskStatus(100, d("2026-06-01"), d("2026-06-10"), null, d("2026-06-11"));
    expect(r.status).toBe("overdueComplete");
    expect(r.label).toBe("超期完成");
  });

  it("用例6: progress=50%，无 actualEndDate → 不 panic", () => {
    const r = computeTaskStatus(50, d("2026-06-01"), d("2026-06-10"), null, d("2026-06-11"));
    expect(["delayed", "normal", "ahead"]).toContain(r.status);
  });
});

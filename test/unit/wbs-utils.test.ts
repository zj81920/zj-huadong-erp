import { describe, it, expect } from "vitest";
import { calcAlertStatus, summarizeProgress, buildWbsTree } from "@/lib/wbs-utils";

describe("calcAlertStatus", () => {
  it("实际 < 计划 返回 滞后", () => {
    expect(calcAlertStatus(80, 45)).toBe("滞后");
  });
  it("实际 >= 计划 返回 正常", () => {
    expect(calcAlertStatus(80, 80)).toBe("正常");
  });
  it("实际 > 计划 返回 正常", () => {
    expect(calcAlertStatus(50, 70)).toBe("正常");
  });
  it("两者均为0 返回 正常", () => {
    expect(calcAlertStatus(0, 0)).toBe("正常");
  });
});

describe("summarizeProgress", () => {
  it("空数组返回 0/0/正常", () => {
    expect(summarizeProgress([])).toEqual({ plannedPct: 0, actualPct: 0, alertStatus: "正常" });
  });
  it("单个子节点取自身值", () => {
    const r = summarizeProgress([{ plannedPct: 80, actualPct: 45 }]);
    expect(r.plannedPct).toBe(80);
    expect(r.actualPct).toBe(45);
    expect(r.alertStatus).toBe("滞后");
  });
  it("多个子节点取平均值", () => {
    const r = summarizeProgress([
      { plannedPct: 100, actualPct: 100 },
      { plannedPct: 80, actualPct: 40 },
    ]);
    expect(r.plannedPct).toBe(90);
    expect(r.actualPct).toBe(70);
    expect(r.alertStatus).toBe("滞后");
  });
  it("平均值向下取整", () => {
    const r = summarizeProgress([
      { plannedPct: 100, actualPct: 50 },
      { plannedPct: 80, actualPct: 33 },
      { plannedPct: 90, actualPct: 20 },
    ]);
    expect(r.plannedPct).toBe(90);
    expect(r.actualPct).toBe(34);
  });
});

describe("buildWbsTree", () => {
  const nodes = [
    { id: "1", parentId: null, level: 1, name: "方案设计", sortOrder: 0, plannedPct: 0, actualPct: 0 },
    { id: "2", parentId: "1", level: 2, name: "反应工段", sortOrder: 0, plannedPct: 0, actualPct: 0 },
    { id: "3", parentId: "2", level: 3, name: "工艺", sortOrder: 0, plannedPct: 0, actualPct: 0 },
    { id: "4", parentId: "3", level: 4, name: "P&ID绘制", sortOrder: 0, plannedPct: 0, actualPct: 0 },
    { id: "5", parentId: "1", level: 2, name: "精馏工段", sortOrder: 1, plannedPct: 0, actualPct: 0 },
  ];

  it("按 parentId 组装树形", () => {
    const tree = buildWbsTree(nodes);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("方案设计");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].children[0].children[0].name).toBe("P&ID绘制");
  });

  it("按 sortOrder 排序", () => {
    const tree = buildWbsTree(nodes);
    expect(tree[0].children[0].name).toBe("反应工段");
    expect(tree[0].children[1].name).toBe("精馏工段");
  });

  it("空数组返回空数组", () => {
    expect(buildWbsTree([])).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { summarizeProgress, buildWbsTree, judgeTaskStatus, calcPlanProgress, computeTaskStatus, computeParentStatus, aggregateProgress } from "@/lib/wbs-utils";

// ===== 固定"今天"便于测试 =====
const TODAY = new Date("2026-06-10");

describe("calcPlanProgress", () => {
  it("根据日期均匀计算计划进度", () => {
    // 5/1 ~ 8/15 = 106天，已过 5/1~6/10 = 40天，40/106 ≈ 38%
    const pct = calcPlanProgress(new Date("2026-05-01"), new Date("2026-08-15"), TODAY);
    expect(pct).toBe(38);
  });

  it("计划尚未开始返回 0", () => {
    const pct = calcPlanProgress(new Date("2026-07-01"), new Date("2026-09-15"), TODAY);
    expect(pct).toBe(0);
  });

  it("计划已结束返回 100", () => {
    const pct = calcPlanProgress(new Date("2026-04-01"), new Date("2026-05-01"), TODAY);
    expect(pct).toBe(100);
  });
});

describe("judgeTaskStatus", () => {
  const baseNode = {
    name: "test", level: 4 as const,
    planStart: "2026-05-01", planEnd: "2026-08-15",
  };

  it("场景1: 按期完成 — 100%，actualEnd ≤ planEnd", () => {
    const r = judgeTaskStatus({
      ...baseNode, planStart: "2026-04-01", planEnd: "2026-06-05",
      actualStart: "2026-04-01", actualEnd: "2026-06-03", pct: 100,
    }, TODAY);
    expect(r.status).toBe("done");
    expect(r.reason).toContain("按期完成");
  });

  it("场景2: 超期完成 — 100%，actualEnd > planEnd", () => {
    const r = judgeTaskStatus({
      ...baseNode, planStart: "2026-04-01", planEnd: "2026-05-31",
      actualStart: "2026-04-01", actualEnd: "2026-06-08", pct: 100,
    }, TODAY);
    expect(r.status).toBe("delayed");
    expect(r.reason).toContain("超期完成");
  });

  it("场景3: 未按时开始 — 无 actualStart，planStart 已过", () => {
    const r = judgeTaskStatus({
      ...baseNode, planStart: "2026-05-20", planEnd: "2026-06-30", pct: 0,
    }, TODAY);
    expect(r.status).toBe("delayed");
    expect(r.reason).toContain("未按时开始");
  });

  it("场景4: 等待开始 — 无 actualStart，planStart 未到", () => {
    const r = judgeTaskStatus({
      ...baseNode, planStart: "2026-07-01", planEnd: "2026-09-15", pct: 0,
    }, TODAY);
    expect(r.status).toBe("wait");
    expect(r.reason).toContain("等待开始");
  });

  it("场景5: 进行中-按期 — 实际 ≥ 计划-5%", () => {
    // planPct ≈ 38%, actual=35% ≥ 38-5=33% → ontrack
    const r = judgeTaskStatus({
      ...baseNode, planStart: "2026-05-01", planEnd: "2026-08-15",
      actualStart: "2026-05-02", pct: 35,
    }, TODAY);
    expect(r.status).toBe("ontrack");
    expect(r.reason).toContain("按期");
  });

  it("场景6: 进行中-延误 — 实际 < 计划-5%", () => {
    // planPct ≈ 42%, actual=8% < 42-5=37% → delayed
    const r = judgeTaskStatus({
      ...baseNode, planStart: "2026-05-15", planEnd: "2026-07-15",
      actualStart: "2026-05-20", pct: 8,
    }, TODAY);
    expect(r.status).toBe("delayed");
    expect(r.reason).toContain("进度滞后");
  });

  it("无计划时间返回 none", () => {
    const r = judgeTaskStatus({
      planStart: "", planEnd: "", pct: 0,
    }, TODAY);
    expect(r.status).toBe("none");
  });

  it("100% 但无 actualEnd 默认为按期", () => {
    const r = judgeTaskStatus({
      ...baseNode, planStart: "2026-04-01", planEnd: "2026-06-05",
      actualStart: "2026-04-01", pct: 100,
    }, TODAY);
    expect(r.status).toBe("done");
  });
});

describe("summarizeProgress", () => {
  it("空数组返回计算结果均为0", () => {
    expect(summarizeProgress([])).toEqual({ plannedPct: 0, actualPct: 0 });
  });
  it("多个子节点取平均值", () => {
    const r = summarizeProgress([
      { plannedPct: 100, actualPct: 100 },
      { plannedPct: 80, actualPct: 40 },
    ]);
    expect(r.plannedPct).toBe(90);
    expect(r.actualPct).toBe(70);
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

// ========== 新六态系统 TDD ==========

const T = new Date("2026-06-10");

describe("computeTaskStatus", () => {
  // P1: 提前完成 — progress=100 且 today < planEndDate
  it("P1 提前完成: progress=100, today < planEnd", () => {
    const r = computeTaskStatus(100, new Date("2026-05-01"), new Date("2026-08-15"), T);
    expect(r.status).toBe("aheadComplete");
    expect(r.emoji).toBe("🎉");
  });

  // P2: 按期完成 — progress=100 且 today 与 planEndDate 同一天
  it("P2 按期完成: progress=100, today = planEnd", () => {
    const r = computeTaskStatus(100, new Date("2026-04-01"), new Date("2026-06-10"), T);
    expect(r.status).toBe("onTimeComplete");
    expect(r.emoji).toBe("🏁");
  });

  // P3: 超期完成 — progress=100 且 today > planEndDate
  it("P3 超期完成: progress=100, today > planEnd", () => {
    const r = computeTaskStatus(100, new Date("2026-04-01"), new Date("2026-05-31"), T);
    expect(r.status).toBe("overdueComplete");
    expect(r.emoji).toBe("⚠️");
  });

  // P4: 提前 — progress>0 且 <100，且 (today < planStart 或 progress ≥ planPct)
  it("P4 提前: 尚未到计划开始但已开始做", () => {
    const r = computeTaskStatus(20, new Date("2026-07-01"), new Date("2026-09-15"), T);
    expect(r.status).toBe("ahead");
    expect(r.emoji).toBe("🚀");
  });

  it("P4 提前: 进度大于等于计划进度", () => {
    const r = computeTaskStatus(40, new Date("2026-05-01"), new Date("2026-08-15"), T);
    expect(r.status).toBe("ahead");
    expect(r.emoji).toBe("🚀");
  });

  // P5: 延误 — progress>0且<100, today≥planStart, progress<planPct
  it("P5 延误: 进度落后于计划", () => {
    const r = computeTaskStatus(8, new Date("2026-05-15"), new Date("2026-07-15"), T);
    expect(r.status).toBe("delayed");
    expect(r.emoji).toBe("⚠️");
  });

  it("P5 延误: progress=0 但已过计划开始日", () => {
    const r = computeTaskStatus(0, new Date("2026-05-20"), new Date("2026-06-30"), T);
    expect(r.status).toBe("delayed");
    expect(r.emoji).toBe("⚠️");
  });

  // P6: 正常 — progress=0 且 today ≤ planStart
  it("P6 正常: 等待开始", () => {
    const r = computeTaskStatus(0, new Date("2026-07-01"), new Date("2026-09-15"), T);
    expect(r.status).toBe("normal");
    expect(r.emoji).toBe("✅");
  });

  // 边界: planStart=planEnd, planPct=100
  it("边界: planStart=planEnd 时 planPct=100", () => {
    const r = computeTaskStatus(0, new Date("2026-06-01"), new Date("2026-06-01"), T);
    expect(r.status).toBe("delayed");
  });

  // 无计划日期
  it("无计划日期返回 none", () => {
    const r = computeTaskStatus(0, null as any, null as any, T);
    expect(r.status).toBe("none");
    expect(r.emoji).toBe("—");
  });
});

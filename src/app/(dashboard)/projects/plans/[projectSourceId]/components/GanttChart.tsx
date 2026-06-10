"use client";
import { useMemo } from "react";
import { buildWbsTree, judgeTaskStatus, judgeParentStatus } from "@/lib/wbs-utils";
import type { WbsTreeNode } from "@/lib/wbs-utils";

/* ---------- 类型 ---------- */

interface WbsNode {
  id: string;
  projectSourceId: string;
  parentId: string | null;
  level: number;
  name: string;
  planStartDate: string | null;
  planEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  progress: number;
  status: string;
  delayDays: number;
  sortOrder: number;
  plannedPct: number;
  actualPct: number;
  [key: string]: unknown;
}

interface Props {
  nodes: WbsNode[];
  disciplines: { id: string; name: string; code: string }[];
}

/* ---------- 辅助 ---------- */

interface FlatRow {
  id: string;
  name: string;
  level: number;
  depth: number;
  hasChildren: boolean;
  planStart: string;
  planEnd: string;
  actualStart: string;
  actualEnd: string;
  status: "ontrack" | "delayed" | "none";
}

/** 递归展平树为可视行 */
function flattenVisible(
  nodes: WbsTreeNode[],
  depth: number,
  expandedIds: Set<string>
): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const node of nodes) {
    const raw = node as unknown as WbsNode;
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);

    let planStart = "";
    let planEnd = "";
    let actualStart = "";
    let actualEnd = "";
    let status: "ontrack" | "delayed" | "none" = "none";

    if (node.level === 4) {
      planStart = raw.planStartDate || "";
      planEnd = raw.planEndDate || "";
      actualStart = raw.actualStartDate || "";
      actualEnd = raw.actualEndDate || "";
      const s = judgeTaskStatus({
        planStart: planStart || "",
        planEnd: planEnd || "",
        actualStart: actualStart || undefined,
        actualEnd: actualEnd || undefined,
        pct: raw.progress ?? raw.actualPct ?? 0,
      });
      status = s.status;
    } else {
      // 聚合
      const leaves = collectLeaves(node);
      const ps = leaves.map((l) => l.planStart).filter(Boolean);
      const pe = leaves.map((l) => l.planEnd).filter(Boolean);
      const as_ = leaves.map((l) => l.actualStart).filter(Boolean) as string[];
      const ae = leaves.map((l) => l.actualEnd).filter(Boolean) as string[];
      planStart = ps.length ? ps.reduce((a, b) => (a < b ? a : b)) : "";
      planEnd = pe.length ? pe.reduce((a, b) => (a > b ? a : b)) : "";
      actualStart = as_.length ? as_.reduce((a, b) => (a < b ? a : b)) : "";
      actualEnd = ae.length ? ae.reduce((a, b) => (a > b ? a : b)) : "";
      if (leaves.length > 0) {
        status = judgeParentStatus(leaves).status;
      }
    }

    rows.push({
      id: node.id, name: node.name, level: node.level, depth,
      hasChildren, planStart, planEnd, actualStart, actualEnd, status,
    });

    if (hasChildren && isExpanded) {
      rows.push(...flattenVisible(node.children, depth + 1, expandedIds));
    }
  }
  return rows;
}

function collectLeaves(
  node: WbsTreeNode
): { planStart: string; planEnd: string; actualStart?: string; actualEnd?: string; pct?: number }[] {
  if (node.level === 4) {
    const raw = node as unknown as WbsNode;
    return [{
      planStart: (raw.planStartDate as string) || "",
      planEnd: (raw.planEndDate as string) || "",
      actualStart: (raw.actualStartDate as string) || undefined,
      actualEnd: (raw.actualEndDate as string) || undefined,
      pct: raw.progress ?? raw.actualPct ?? 0,
    }];
  }
  const result: { planStart: string; planEnd: string; actualStart?: string; actualEnd?: string; pct?: number }[] = [];
  for (const child of node.children) {
    result.push(...collectLeaves(child));
  }
  return result;
}

/** 生成月份标签 */
function getMonths(start: Date, end: Date): { label: string; offset: number; width: number }[] {
  const months: { label: string; offset: number; width: number }[] = [];
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return [];

  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    const monthStart = new Date(Math.max(cur.getTime(), start.getTime()));
    const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const monthEnd = new Date(Math.min(nextMonth.getTime(), end.getTime()));
    const offset = (monthStart.getTime() - start.getTime()) / totalMs * 100;
    const width = (monthEnd.getTime() - monthStart.getTime()) / totalMs * 100;
    months.push({
      label: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`,
      offset, width,
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

/* ========== 主组件 ========== */

export default function GanttChart({ nodes }: Props) {
  const tree = useMemo(
    () => buildWbsTree(nodes as unknown as Parameters<typeof buildWbsTree>[0]),
    [nodes]
  );

  // 默认展开所有节点来生成行
  const allIds = useMemo(() => {
    const ids = new Set<string>();
    function walk(ns: WbsTreeNode[]) {
      for (const n of ns) { ids.add(n.id); walk(n.children); }
    }
    walk(tree);
    return ids;
  }, [tree]);

  const rows = useMemo(() => flattenVisible(tree, 0, allIds), [tree, allIds]);

  // 时间范围
  const { timeStart, timeEnd } = useMemo(() => {
    let minTs = Infinity;
    let maxTs = -Infinity;
    for (const n of nodes) {
      if (n.planStartDate) minTs = Math.min(minTs, new Date(n.planStartDate).getTime());
      if (n.planEndDate) maxTs = Math.max(maxTs, new Date(n.planEndDate).getTime());
      if (n.actualStartDate) minTs = Math.min(minTs, new Date(n.actualStartDate).getTime());
      if (n.actualEndDate) maxTs = Math.max(maxTs, new Date(n.actualEndDate).getTime());
    }
    if (minTs === Infinity) {
      const now = new Date();
      minTs = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      maxTs = new Date(now.getFullYear(), now.getMonth() + 3, 0).getTime();
    }
    // 加 padding
    const range = maxTs - minTs;
    return {
      timeStart: new Date(minTs - range * 0.05),
      timeEnd: new Date(maxTs + range * 0.05),
    };
  }, [nodes]);

  const totalMs = timeEnd.getTime() - timeStart.getTime();
  const months = useMemo(() => getMonths(timeStart, timeEnd), [timeStart, timeEnd]);

  // Today 位置
  const todayPct = totalMs > 0
    ? ((Date.now() - timeStart.getTime()) / totalMs) * 100
    : -1;

  function toPct(dateStr: string) {
    if (!dateStr) return { left: 0, width: 0 };
    const ts = new Date(dateStr).getTime();
    const left = ((ts - timeStart.getTime()) / totalMs) * 100;
    return { left, width: 1 };
  }

  function barPosition(start: string, end: string) {
    if (!start || !end) return null;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (isNaN(s) || isNaN(e) || e < s) return null;
    return {
      left: ((s - timeStart.getTime()) / totalMs) * 100,
      width: ((e - s) / totalMs) * 100,
    };
  }

  const ROW_HEIGHT = 42;

  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* 甘特标题 */}
      <div style={{
        padding: "10px 12px", borderBottom: "2px solid #E7E5E4",
        background: "#FAFAF9", fontSize: 14, fontWeight: 600, color: "#1C1917",
        flexShrink: 0,
      }}>
        甘特图
      </div>

      {/* 月份时间轴 */}
      <div style={{
        position: "relative", height: 28, background: "#FAFAF9",
        borderBottom: "1px solid #E7E5E4", flexShrink: 0,
      }}>
        {months.map((m, i) => (
          <div key={i} style={{
            position: "absolute", left: `${m.offset}%`, width: `${m.width}%`,
            top: 0, bottom: 0, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 11, color: "#78716C",
            borderRight: "1px solid #F5F5F4",
          }}>
            {m.label}
          </div>
        ))}
        {/* Today 线 */}
        {todayPct >= 0 && todayPct <= 100 && (
          <div style={{
            position: "absolute", left: `${todayPct}%`, top: 0, bottom: 0,
            width: 2, background: "#DC2626", zIndex: 5,
          }} />
        )}
      </div>

      {/* 行区域 */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {rows.map((row) => {
          const planBar = barPosition(row.planStart, row.planEnd);
          const actualBar = barPosition(row.actualStart, row.actualEnd);

          return (
            <div key={row.id} style={{
              position: "relative", height: ROW_HEIGHT,
              borderBottom: "1px solid #F5F5F4",
            }}>
              {/* 计划条（蓝色虚线边框+浅蓝填充） */}
              {planBar && (
                <div style={{
                  position: "absolute", top: 8, height: 12,
                  left: `${planBar.left}%`, width: `${Math.max(0.3, planBar.width)}%`,
                  background: "rgba(59,130,246,0.15)",
                  border: "1.5px dashed #3B82F6", borderRadius: 4,
                  zIndex: 2,
                }} />
              )}
              {/* 实际条 */}
              {actualBar && (
                <div style={{
                  position: "absolute", bottom: 8, height: 10,
                  left: `${actualBar.left}%`, width: `${Math.max(0.3, actualBar.width)}%`,
                  background: row.status === "delayed" ? "#DC2626" : "#22C55E",
                  borderRadius: 4, zIndex: 3,
                }} />
              )}
            </div>
          );
        })}

        {/* Today 线贯穿行区域 */}
        {todayPct >= 0 && todayPct <= 100 && (
          <div style={{
            position: "absolute", left: `${todayPct}%`, top: 28, bottom: 0,
            width: 2, background: "#DC2626", opacity: 0.5, zIndex: 4,
            pointerEvents: "none",
          }} />
        )}
      </div>
    </div>
  );
}

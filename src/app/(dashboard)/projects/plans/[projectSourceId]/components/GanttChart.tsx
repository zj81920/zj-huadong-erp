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

function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "-";
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

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

  const allIds = useMemo(() => {
    const ids = new Set<string>();
    function walk(ns: WbsTreeNode[]) {
      for (const n of ns) { ids.add(n.id); walk(n.children); }
    }
    walk(tree);
    return ids;
  }, [tree]);

  const rows = useMemo(() => flattenVisible(tree, 0, allIds), [tree, allIds]);

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
    const range = maxTs - minTs;
    return {
      timeStart: new Date(minTs - range * 0.05),
      timeEnd: new Date(maxTs + range * 0.05),
    };
  }, [nodes]);

  const totalMs = timeEnd.getTime() - timeStart.getTime();
  const months = useMemo(() => getMonths(timeStart, timeEnd), [timeStart, timeEnd]);

  const todayPct = totalMs > 0
    ? ((Date.now() - timeStart.getTime()) / totalMs) * 100
    : -1;

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

  const ROW_H = 50; // 两行合一
  const LABEL_W = 80; // 日期标签宽度(pct)

  return (
    <div style={{ position: "relative", minWidth: 600 }}>
      {/* 月份时间轴 */}
      <div style={{
        position: "relative", height: 26, background: "#FAFAF9",
        borderBottom: "1px solid #D6D3D1",
        marginLeft: LABEL_W * 0 + 0,
      }}>
        {months.map((m, i) => (
          <div key={i} style={{
            position: "absolute", left: `${m.offset}%`, width: `${m.width}%`,
            top: 0, bottom: 0, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 11, color: "#78716C",
            borderRight: "1px solid #E7E5E4",
          }}>
            {m.label}
          </div>
        ))}
        {todayPct >= 0 && todayPct <= 100 && (
          <div style={{
            position: "absolute", left: `${todayPct}%`, top: 0, bottom: 0,
            width: 1, background: "#B85C5C", zIndex: 5,
          }} />
        )}
      </div>

      {/* 行区域 */}
      <div>
        {rows.map((row) => {
          const planBar = barPosition(row.planStart, row.planEnd);
          const actualBar = barPosition(row.actualStart, row.actualEnd);

          const isLevel4 = row.level === 4;
          const barColor = row.status === "delayed" ? "#C47676" : "#7DA88E";

          return (
            <div key={row.id} style={{
              position: "relative", height: ROW_H,
              borderBottom: "1px solid #E7E5E4",
              background: row.depth === 0 ? "#FAFAF9" : "#fff",
            }}>
              {/* === P 行 (计划) === */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 24, display: "flex", alignItems: "center" }}>
                {/* 左侧日期标签 */}
                <span style={{
                  position: "absolute", left: 4, fontSize: 10, color: "#90A4C4",
                  fontWeight: 500, zIndex: 2,
                }}>
                  P {planBar ? fmtDate(row.planStart) : ""}
                </span>
                {/* 计划虚线横道 */}
                {planBar && (
                  <div style={{
                    position: "absolute", left: `${planBar.left}%`,
                    width: `${Math.max(0.2, planBar.width)}%`,
                    top: "50%", transform: "translateY(-50%)",
                    height: 10,
                    background: "rgba(144,164,196,0.2)",
                    border: "1.5px dashed #90A4C4",
                    borderRadius: 3,
                    zIndex: 1,
                  }} />
                )}
                {/* 右侧日期标签 */}
                <span style={{
                  position: "absolute", right: 4, fontSize: 10, color: "#90A4C4",
                  fontWeight: 500, zIndex: 2,
                }}>
                  {planBar ? fmtDate(row.planEnd) : ""}
                </span>
              </div>

              {/* === A 行 (实际) === */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 26, display: "flex", alignItems: "center" }}>
                {/* 左侧日期标签 */}
                {actualBar && (
                  <span style={{
                    position: "absolute", left: 4, fontSize: 9, color: "#78716C",
                    zIndex: 2,
                  }}>
                    A
                  </span>
                )}
                {actualBar && (
                  <span style={{
                    position: "absolute", left: 18, fontSize: 10, color: barColor,
                    fontWeight: 500, zIndex: 2,
                  }}>
                    {fmtDate(row.actualStart)}
                  </span>
                )}
                {/* 实际实心横道 */}
                {actualBar && (
                  <div style={{
                    position: "absolute", left: `${actualBar.left}%`,
                    width: `${Math.max(0.2, actualBar.width)}%`,
                    top: "50%", transform: "translateY(-50%)",
                    height: 10,
                    background: barColor,
                    borderRadius: 3,
                    opacity: 0.85,
                    zIndex: 1,
                  }} />
                )}
                {/* 右侧日期标签 */}
                {actualBar && (
                  <span style={{
                    position: "absolute", right: 4, fontSize: 10, color: barColor,
                    fontWeight: 500, zIndex: 2,
                  }}>
                    {row.actualEnd ? fmtDate(row.actualEnd) : row.actualStart ? "进行中" : ""}
                  </span>
                )}
                {!actualBar && (
                  <span style={{ position: "absolute", left: 4, fontSize: 10, color: "#A8A29E" }}>
                    未开始
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Today 线贯穿 */}
        {todayPct >= 0 && todayPct <= 100 && (
          <div style={{
            position: "absolute", left: `${todayPct}%`, top: 26, bottom: 0,
            width: 1, background: "#B85C5C", opacity: 0.4, zIndex: 4,
            pointerEvents: "none",
          }} />
        )}
      </div>

      {/* 图例 */}
      <div style={{
        display: "flex", gap: 16, padding: "8px 12px",
        borderTop: "1px solid #E7E5E4", fontSize: 11, color: "#78716C",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 12, height: 1, borderTop: "1.5px dashed #90A4C4" }} /> 计划
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 12, height: 8, background: "#7DA88E", borderRadius: 2 }} /> 按期
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 12, height: 8, background: "#C47676", borderRadius: 2 }} /> 延误
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 12, height: 0, borderLeft: "1px solid #B85C5C" }} /> 今天
        </span>
      </div>
    </div>
  );
}

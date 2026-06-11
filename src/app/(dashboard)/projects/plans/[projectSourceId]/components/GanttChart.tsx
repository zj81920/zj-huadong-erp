"use client";
import { useMemo } from "react";
import { buildWbsTree, computeTaskStatus, computeParentStatus } from "@/lib/wbs-utils";
import type { WbsTreeNode, TaskStatusResult } from "@/lib/wbs-utils";

/* ---------- 类型 ---------- */

interface WbsNode {
  id: string;
  projectSourceId: string;
  parentId: string | null;
  level: number;
  name: string;
  planStartDate: string | null;
  planEndDate: string | null;
  progress: number;
  sortOrder: number;
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
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${m}-${day}`;
}

interface GanttRow {
  id: string;
  name: string;
  level: number;
  depth: number;
  planStart: string;
  planEnd: string;
  status: string;
  progress: number;
  isGroupHeader?: boolean;
  groupPlanStart?: string;
  groupPlanEnd?: string;
}

function flattenGanttRows(nodes: WbsTreeNode[], depth: number): GanttRow[] {
  const rows: GanttRow[] = [];
  for (const node of nodes) {
    const raw = node as unknown as WbsNode;
    let planStart = "";
    let planEnd = "";
    let status = "none";
    let progress = 0;

    if (node.level === 4) {
      planStart = raw.planStartDate || "";
      planEnd = raw.planEndDate || "";
      progress = raw.progress ?? 0;
      const ps = planStart ? new Date(planStart) : null;
      const pe = planEnd ? new Date(planEnd) : null;
      const r = computeTaskStatus(progress, ps, pe);
      status = r.status;
    } else {
      function collectLeaves(n: WbsTreeNode): WbsNode[] {
        if (n.level === 4) return [n as unknown as WbsNode];
        const result: WbsNode[] = [];
        for (const child of n.children) result.push(...collectLeaves(child));
        return result;
      }
      const leaves = collectLeaves(node);
      if (leaves.length > 0) {
        const leafResults: TaskStatusResult[] = leaves.map(l => {
          const ps = l.planStartDate ? new Date(l.planStartDate) : null;
          const pe = l.planEndDate ? new Date(l.planEndDate) : null;
          return computeTaskStatus(l.progress ?? 0, ps, pe);
        });
        const parentR = computeParentStatus(leafResults);
        status = parentR.status;

        const validDates = leaves.filter(l => l.planStartDate);
        if (validDates.length > 0) {
          planStart = validDates.map(l => l.planStartDate!).reduce((a, b) => a < b ? a : b);
          const withEnd = leaves.filter(l => l.planEndDate);
          planEnd = withEnd.length > 0 
            ? withEnd.map(l => l.planEndDate!).reduce((a, b) => a > b ? a : b) 
            : "";
        }
        progress = leaves.length > 0
          ? Math.round(leaves.reduce((s, l) => s + (l.progress ?? 0), 0) / leaves.length)
          : 0;
      }
    }

    if (node.level === 1) {
      rows.push({
        id: `group-${node.id}`, name: node.name, level: node.level, depth,
        planStart: "", planEnd: "", status: "none", progress: 0,
        isGroupHeader: true,
        groupPlanStart: planStart, groupPlanEnd: planEnd,
      });
    }

    rows.push({
      id: node.id, name: node.name, level: node.level, depth,
      planStart, planEnd, status, progress,
    });

    if (node.children.length > 0) {
      rows.push(...flattenGanttRows(node.children, depth + 1));
    }
  }
  return rows;
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

  const rows = useMemo(() => flattenGanttRows(tree, 0), [tree]);

  const { timeStart, timeEnd } = useMemo(() => {
    let minTs = Infinity;
    let maxTs = -Infinity;
    for (const n of nodes) {
      if (n.planStartDate) minTs = Math.min(minTs, new Date(n.planStartDate).getTime());
      if (n.planEndDate) maxTs = Math.max(maxTs, new Date(n.planEndDate).getTime());
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

  function barPosition(start: string, end?: string) {
    if (!start) return null;
    const s = new Date(start).getTime();
    if (isNaN(s)) return null;
    // 如果没有结束日期，用今天作为结束（用于进行中任务的实际横道）
    const e = end ? new Date(end).getTime() : Date.now();
    if (isNaN(e) || e < s) return null;
    return {
      left: ((s - timeStart.getTime()) / totalMs) * 100,
      width: ((e - s) / totalMs) * 100,
    };
  }

  const ROW_H = 50;
  const LABEL_W = 140; // 左侧名称列宽度

  return (
    <div style={{ position: "relative", minWidth: 700, display: "flex" }}>
      {/* 左侧名称列 */}
      <div style={{ width: LABEL_W, flexShrink: 0, borderRight: "1px solid #DFE3E8", background: "#FAFBFC" }}>
        {/* 表头占位 */}
        <div style={{ height: 26, borderBottom: "1px solid #DFE3E8" }} />
        {/* 行名称 */}
        {rows.map((row) => {
          if (row.isGroupHeader) {
            return (
              <div key={row.id} style={{
                height: 24,
                padding: "4px 8px",
                fontSize: 12,
                fontWeight: 600,
                color: "#333",
                borderBottom: "1px solid #EBEEF2",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#fff",
              }}>
                <span>{row.name}</span>
                <span style={{ fontWeight: 400, color: "#8C95A3" }}>
                  计划：{fmtDate(row.groupPlanStart)} ~ {fmtDate(row.groupPlanEnd)}
                </span>
              </div>
            );
          }
          const indent = row.depth * 12;
          const levelPrefix = row.level === 1 ? "一、" : row.level === 2 ? "  " : row.level === 3 ? "    " : "      ";
          return (
            <div key={row.id} style={{
              height: ROW_H,
              padding: `0 8px 0 ${8 + indent}px`,
              borderBottom: "1px solid #E7E5E4",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              background: row.depth === 0 ? "#FAFAF9" : "#fff",
            }}>
              <span style={{
                fontSize: row.level === 1 ? 13 : 12,
                fontWeight: row.level === 1 ? 600 : 400,
                color: row.level === 1 ? "#333" : row.level === 2 ? "#4A6FA5" : row.level === 3 ? "#6B8E6B" : "#8B7355",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {levelPrefix}{row.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* 右侧时间轴区域 */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* 月份时间轴 */}
        <div style={{
          position: "relative", height: 26, background: "#FAFBFC",
          borderBottom: "1px solid #DFE3E8",
        }}>
          {months.map((m, i) => (
            <div key={i} style={{
              position: "absolute", left: `${m.offset}%`, width: `${m.width}%`,
              top: 0, bottom: 0, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 11, color: "#78716C",
              borderRight: "1px solid #EBEEF2",
            }}>
              {m.label}
            </div>
          ))}
        </div>

        {/* 行区域 */}
        <div style={{ position: "relative" }}>
          {rows.map((row) => {
            if (row.isGroupHeader) {
              return (
                <div key={row.id} style={{
                  height: 24,
                  borderBottom: "1px solid #EBEEF2",
                  background: "#fff",
                }} />
              );
            }

            const planBar = barPosition(row.planStart, row.planEnd);
            const isDelayed = row.status === "delayed" || row.status === "overdueComplete";
            const isAhead = row.status === "ahead" || row.status === "aheadComplete";
            const barColor = isDelayed ? "#C47676" : isAhead ? "#5A8A6A" : "#7DA88E";

            // progress bar: plan bar width * progress%
            const progressBar = planBar ? {
              left: planBar.left,
              width: planBar.width * (row.progress / 100),
            } : null;

            return (
              <div key={row.id} style={{
                position: "relative", height: ROW_H,
                borderBottom: "1px solid #E7E5E4",
                background: row.depth === 0 ? "#FAFAF9" : "#fff",
              }}>
                {/* 计划框 (虚线) */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                  {planBar && (
                    <>
                      <span style={{ position: "absolute", left: 4, fontSize: 10, color: "#90A4C4", zIndex: 2 }}>
                        {fmtDate(row.planStart)}
                      </span>
                      <div style={{
                        position: "absolute", left: `${planBar.left}%`,
                        width: `${Math.max(0.2, planBar.width)}%`,
                        top: "50%", transform: "translateY(-50%)",
                        height: 12,
                        background: "rgba(144,164,196,0.05)",
                        border: "1.5px dashed #90A4C4",
                        borderRadius: 0, zIndex: 1,
                      }} />
                      <span style={{ position: "absolute", right: 4, fontSize: 10, color: "#90A4C4", zIndex: 2 }}>
                        {fmtDate(row.planEnd)}
                      </span>
                    </>
                  )}
                </div>

                {/* 进度横道 (实心) */}
                {progressBar && row.level === 4 && (
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                    <div style={{
                      position: "absolute", left: `${progressBar.left}%`,
                      width: `${Math.max(0.2, progressBar.width)}%`,
                      top: "50%", transform: "translateY(-50%)",
                      height: 6,
                      background: barColor,
                      borderRadius: 0, zIndex: 3, opacity: 0.9,
                    }} />
                  </div>
                )}

                {!planBar && (
                  <span style={{ position: "absolute", left: 4, fontSize: 10, color: "#A8A29E", top: "50%", transform: "translateY(-50%)" }}>
                    无计划
                  </span>
                )}
              </div>
            );
          })}

          {/* Today 线贯穿 */}
          {todayPct >= 0 && todayPct <= 100 && (
            <div style={{
              position: "absolute", left: `${todayPct}%`, top: 0, bottom: 0,
              width: 1, background: "#E05050", zIndex: 4,
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
            <span style={{ width: 12, height: 6, background: "#7DA88E" }} /> 正常
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 12, height: 6, background: "#5A8A6A" }} /> 提前
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 12, height: 6, background: "#C47676" }} /> 延误
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 12, height: 0, borderLeft: "1px solid #E05050" }} /> 今天
          </span>
        </div>
      </div>
    </div>
  );
}

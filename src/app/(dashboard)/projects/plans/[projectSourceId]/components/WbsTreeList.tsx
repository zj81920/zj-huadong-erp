"use client";
import { useState, useCallback, useEffect } from "react";
import {
  buildWbsTree,
  judgeTaskStatus,
  judgeParentStatus,
  calcPlanProgress,
  summarizeProgress,
} from "@/lib/wbs-utils";
import type { WbsTreeNode } from "@/lib/wbs-utils";
import AIStatusBadge from "./AIStatusBadge";
import ProgressDialog from "./ProgressDialog";
import NodeEditDialog from "./NodeEditDialog";

/* ---------- 类型 ---------- */

interface WbsNode {
  id: string;
  projectSourceId: string;
  parentId: string | null;
  level: number;
  name: string;
  disciplineId: string | null;
  isMilestone: boolean;
  planStartDate: string | null;
  planEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  progress: number;
  status: string;
  delayDays: number;
  sortOrder: number;
  responsibleId: string | null;
  responsiblePerson?: { id: string; realName: string } | null;
  plannedPct: number;
  actualPct: number;
  children?: WbsNode[];
  [key: string]: unknown;
}

interface Props {
  nodes: WbsNode[];
  disciplines: { id: string; name: string; code: string }[];
  projectSourceId: string;
  onRefresh: () => void;
}

/* ---------- 辅助 ---------- */

const LEVEL_COLORS: Record<number, { bg: string; color: string; label: string }> = {
  1: { bg: "#1C1917", color: "#fff", label: "阶段" },
  2: { bg: "#3B82F6", color: "#fff", label: "子项" },
  3: { bg: "#8B5CF6", color: "#fff", label: "专业" },
  4: { bg: "#22C55E", color: "#fff", label: "任务" },
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "-";
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** 递归收集某节点下所有 level-4 叶子的 planStart / planEnd / actualStart / actualEnd */
function collectLeafDates(
  node: WbsTreeNode
): { planStart: string; planEnd: string; actualStart?: string; actualEnd?: string; pct?: number }[] {
  if (node.level === 4) {
    const raw = node as unknown as WbsNode;
    return [
      {
        planStart: (raw.planStartDate as string) || "",
        planEnd: (raw.planEndDate as string) || "",
        actualStart: (raw.actualStartDate as string) || undefined,
        actualEnd: (raw.actualEndDate as string) || undefined,
        pct: raw.progress ?? raw.actualPct ?? 0,
      },
    ];
  }
  const result: { planStart: string; planEnd: string; actualStart?: string; actualEnd?: string; pct?: number }[] = [];
  for (const child of node.children) {
    result.push(...collectLeafDates(child));
  }
  return result;
}

/** 取聚合时间范围 min~max */
function aggRange(dates: { planStart: string; planEnd: string; actualStart?: string; actualEnd?: string }[]) {
  const starts = dates.map((d) => d.planStart).filter(Boolean);
  const ends = dates.map((d) => d.planEnd).filter(Boolean);
  const aStarts = dates.map((d) => d.actualStart).filter(Boolean) as string[];
  const aEnds = dates.map((d) => d.actualEnd).filter(Boolean) as string[];
  return {
    planStart: starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : "",
    planEnd: ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : "",
    actualStart: aStarts.length ? aStarts.reduce((a, b) => (a < b ? a : b)) : "",
    actualEnd: aEnds.length ? aEnds.reduce((a, b) => (a > b ? a : b)) : "",
  };
}

/* ========== 主组件 ========== */

export default function WbsTreeList({ nodes, disciplines, projectSourceId, onRefresh }: Props) {
  const tree = buildWbsTree(nodes as unknown as Parameters<typeof buildWbsTree>[0]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    tree.forEach((n) => ids.add(n.id));
    return ids;
  });

  /* 弹窗状态 */
  const [createParent, setCreateParent] = useState<{ id: string; level: number; disciplineId?: string | null } | null>(null);
  const [editNode, setEditNode] = useState<{
    id: string; name: string; level: number; isMilestone: boolean;
    planStartDate?: string | null; planEndDate?: string | null;
  } | null>(null);
  const [progressNode, setProgressNode] = useState<WbsNode | null>(null);

  /* 任务日志 */
  const [logPanelNodeId, setLogPanelNodeId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, any[]>>({});
  const [newLogText, setNewLogText] = useState("");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogText, setEditLogText] = useState("");

  /* 操作菜单 */
  const [actionMenuNodeId, setActionMenuNodeId] = useState<string | null>(null);

  // 点击菜单外部关闭
  useEffect(() => {
    if (!actionMenuNodeId) return;
    const handler = (e: MouseEvent) => setActionMenuNodeId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [actionMenuNodeId]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  /* ---------- 日志操作 ---------- */

  async function loadLogs(nodeId: string) {
    const res = await fetch(`/api/wbs/tasks/${nodeId}/logs`);
    const data = await res.json();
    setLogs((prev) => ({ ...prev, [nodeId]: data.data || [] }));
  }

  async function addLog(nodeId: string) {
    if (!newLogText.trim()) return;
    await fetch(`/api/wbs/tasks/${nodeId}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newLogText, createdBy: "当前用户" }),
    });
    setNewLogText("");
    loadLogs(nodeId);
  }

  async function updateLog(nodeId: string, logId: string) {
    await fetch(`/api/wbs/tasks/${nodeId}/logs/${logId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editLogText }),
    });
    setEditingLogId(null);
    setEditLogText("");
    loadLogs(nodeId);
  }

  async function deleteLog(nodeId: string, logId: string) {
    if (!confirm("确定删除该日志？")) return;
    await fetch(`/api/wbs/tasks/${nodeId}/logs/${logId}`, { method: "DELETE" });
    loadLogs(nodeId);
  }

  /* ---------- 删除节点 ---------- */

  async function handleDelete(nodeId: string) {
    if (!confirm("确定删除该节点及其所有子节点？")) return;
    await fetch(`/api/projects/plans/${projectSourceId}/nodes/${nodeId}`, { method: "DELETE" });
    onRefresh();
  }

  /* ---------- 渲染行 ---------- */

  const menuItemStyle: React.CSSProperties = {
    display: "block", width: "100%", padding: "6px 14px",
    border: "none", background: "none", cursor: "pointer",
    fontSize: 13, textAlign: "left" as const, color: "#1C1917",
  };

  function renderRow(node: WbsTreeNode, depth: number) {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const raw = node as unknown as WbsNode;
    const level = node.level;
    const lvl = LEVEL_COLORS[level] || { bg: "#A8A29E", color: "#fff", label: `L${level}` };

    // 计算时间
    let planTime = "";
    let actualTime = "";
    let aiStatus;
    let progressPct = raw.progress ?? raw.actualPct ?? 0;
    let plannedPct = raw.plannedPct ?? 0;

    if (level === 4) {
      planTime = raw.planStartDate && raw.planEndDate
        ? `${fmtDate(raw.planStartDate)} ~ ${fmtDate(raw.planEndDate)}` : "-";
      actualTime = raw.actualStartDate && raw.actualEndDate
        ? `${fmtDate(raw.actualStartDate)} ~ ${fmtDate(raw.actualEndDate)}` : "-";
      aiStatus = judgeTaskStatus({
        planStart: (raw.planStartDate as string) || "",
        planEnd: (raw.planEndDate as string) || "",
        actualStart: (raw.actualStartDate as string) || undefined,
        actualEnd: (raw.actualEndDate as string) || undefined,
        pct: progressPct,
      });
    } else {
      // 聚合子节点
      const leafDates = collectLeafDates(node);
      const range = aggRange(leafDates);
      planTime = range.planStart && range.planEnd ? `${fmtDate(range.planStart)} ~ ${fmtDate(range.planEnd)}` : "-";
      actualTime = range.actualStart && range.actualEnd ? `${fmtDate(range.actualStart)} ~ ${fmtDate(range.actualEnd)}` : "-";
      if (leafDates.length > 0) {
        aiStatus = judgeParentStatus(leafDates);
      } else {
        aiStatus = { status: "none" as const, label: "-", reason: "无任务" };
      }
      // 聚合进度
      if (leafDates.length > 0) {
        const progData = leafDates.map((l) => {
          const ps = l.planStart ? calcPlanProgress(new Date(l.planStart), new Date(l.planEnd), new Date()) : 0;
          return { plannedPct: ps, actualPct: l.pct ?? 0 };
        });
        const agg = summarizeProgress(progData);
        plannedPct = agg.plannedPct;
        progressPct = agg.actualPct;
      }
    }

    const isLogOpen = logPanelNodeId === node.id;

    return (
      <div key={node.id}>
        {/* 主行 */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", borderBottom: "1px solid #F5F5F4",
            background: depth === 0 ? "#FAFAF9" : "#fff",
            paddingLeft: depth * 28 + 12,
            minHeight: 42,
          }}
        >
          {/* 展开/折叠 */}
          <button
            onClick={() => hasChildren && toggleExpand(node.id)}
            style={{
              width: 20, height: 20, display: "flex", alignItems: "center",
              justifyContent: "center", border: "none", background: "none",
              cursor: hasChildren ? "pointer" : "default", color: "#78716C",
              fontSize: 12, flexShrink: 0,
            }}
          >
            {hasChildren ? (isExpanded ? "▼" : "▶") : "·"}
          </button>

          {/* 层级徽章 */}
          <span style={{
            display: "inline-block", padding: "2px 8px", borderRadius: 4,
            fontSize: 11, fontWeight: 600, background: lvl.bg, color: lvl.color,
            flexShrink: 0,
          }}>
            {lvl.label}
          </span>

          {/* 名称 */}
          <span style={{ fontSize: 13, fontWeight: 500, color: "#1C1917", minWidth: 80, flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.name}
          </span>

          {/* 负责人 */}
          {raw.responsiblePerson && (
            <span style={{ fontSize: 12, color: "#78716C", flexShrink: 0 }}>
              {raw.responsiblePerson.realName}
            </span>
          )}

          {/* 计划时间 */}
          <span style={{ fontSize: 11, color: "#78716C", flexShrink: 0, minWidth: 150 }}>
            📅 {planTime}
          </span>

          {/* 实际时间 */}
          <span style={{ fontSize: 11, color: "#78716C", flexShrink: 0, minWidth: 150 }}>
            🏁 {actualTime}
          </span>

          {/* 进度条 */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, width: 90 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#F5F5F4", position: "relative", overflow: "hidden" }}>
              {/* 计划进度底 */}
              <div style={{ position: "absolute", inset: 0, background: "#BFDBFE", borderRadius: 3, width: `${Math.min(100, Math.max(0, plannedPct))}%` }} />
              {/* 实际进度 */}
              <div style={{
                position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: 3,
                background: aiStatus?.status === "delayed" ? "#DC2626" : "#22C55E",
                width: `${Math.min(100, Math.max(0, progressPct))}%`,
              }} />
            </div>
            <span style={{ fontSize: 11, color: "#78716C", width: 28, textAlign: "right" }}>
              {progressPct}%
            </span>
          </div>

          {/* AI 状态 */}
          <div style={{ flexShrink: 0, width: 20, textAlign: "center" }}>
            <AIStatusBadge status={aiStatus?.status ?? "none"} reason={aiStatus?.reason ?? ""} />
          </div>

          {/* 操作菜单 (⋮ 下拉) */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setActionMenuNodeId(actionMenuNodeId === node.id ? null : node.id)}
              style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16, padding: "2px 6px", color: "#78716C" }}
            >⋮</button>
            {actionMenuNodeId === node.id && (
              <div style={{
                position: "absolute", right: 0, top: "100%", zIndex: 50,
                background: "#fff", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", border: "1px solid #E7E5E4",
                minWidth: 120, padding: "4px 0",
              }}>
                {level < 4 && (
                  <button onClick={() => { setActionMenuNodeId(null); setCreateParent({ id: node.id, level: node.level, disciplineId: raw.disciplineId }); }}
                    style={menuItemStyle}>＋ 添加子节点</button>
                )}
                {level >= 2 && level <= 4 && (
                  <button onClick={() => { setActionMenuNodeId(null); setEditNode({
                    id: node.id, name: node.name, level: node.level, isMilestone: !!raw.isMilestone,
                    planStartDate: raw.planStartDate, planEndDate: raw.planEndDate,
                  }); }} style={menuItemStyle}>✏️ 编辑</button>
                )}
                {level === 4 && (
                  <button onClick={() => { setActionMenuNodeId(null); setProgressNode(raw); }}
                    style={menuItemStyle}>📊 填报进度</button>
                )}
                {level === 4 && (
                  <button onClick={() => { setActionMenuNodeId(null);
                    if (isLogOpen) { setLogPanelNodeId(null); } else { setLogPanelNodeId(node.id); loadLogs(node.id); }
                  }} style={menuItemStyle}>{isLogOpen ? "🔼 收起日志" : "🔽 展开日志"}</button>
                )}
                {level >= 2 && level <= 4 && (
                  <button onClick={() => { setActionMenuNodeId(null); handleDelete(node.id); }}
                    style={{ ...menuItemStyle, color: "#DC2626" }}>🗑 删除</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 任务日志面板 */}
        {level === 4 && isLogOpen && (
          <div style={{
            marginLeft: depth * 28 + 44, marginRight: 12,
            background: "#FAFAF9", borderRadius: 8, padding: 12,
            borderBottom: "1px solid #F5F5F4",
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#1C1917", marginBottom: 8 }}>
              任务日志
            </div>
            {/* 新增日志输入 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                value={newLogText}
                onChange={(e) => setNewLogText(e.target.value)}
                placeholder="输入日志内容..."
                style={{
                  flex: 1, padding: "6px 10px", border: "1px solid #D6D3D1",
                  borderRadius: 6, fontSize: 13,
                }}
                onKeyDown={(e) => { if (e.key === "Enter") addLog(node.id); }}
              />
              <button
                onClick={() => addLog(node.id)}
                style={{
                  padding: "6px 14px", border: "none", borderRadius: 6,
                  background: "#3B82F6", color: "#fff", fontSize: 13, cursor: "pointer",
                }}
              >添加</button>
            </div>
            {/* 日志列表 */}
            {(logs[node.id] || []).length === 0 && (
              <div style={{ fontSize: 12, color: "#A8A29E" }}>暂无日志</div>
            )}
            {(logs[node.id] || []).map((log: any) => (
              <div key={log.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 0", borderBottom: "1px solid #F5F5F4",
                fontSize: 13,
              }}>
                {editingLogId === log.id ? (
                  <>
                    <input
                      value={editLogText}
                      onChange={(e) => setEditLogText(e.target.value)}
                      style={{
                        flex: 1, padding: "4px 8px", border: "1px solid #D6D3D1", borderRadius: 4, fontSize: 13,
                      }}
                    />
                    <button onClick={() => updateLog(node.id, log.id)} style={{ border: "none", background: "none", color: "#3B82F6", cursor: "pointer", fontSize: 12 }}>保存</button>
                    <button onClick={() => { setEditingLogId(null); setEditLogText(""); }} style={{ border: "none", background: "none", color: "#78716C", cursor: "pointer", fontSize: 12 }}>取消</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, color: "#1C1917" }}>{log.content}</span>
                    <span style={{ fontSize: 11, color: "#A8A29E", flexShrink: 0 }}>{log.createdAt ? fmtDate(log.createdAt) : ""}</span>
                    <button
                      onClick={() => { setEditingLogId(log.id); setEditLogText(log.content); }}
                      style={{ border: "none", background: "none", color: "#78716C", cursor: "pointer", fontSize: 12 }}
                    >编辑</button>
                    <button
                      onClick={() => deleteLog(node.id, log.id)}
                      style={{ border: "none", background: "none", color: "#DC2626", cursor: "pointer", fontSize: 12 }}
                    >删除</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 子节点 */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* 表头 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
        borderBottom: "2px solid #E7E5E4", background: "#FAFAF9",
        fontSize: 12, fontWeight: 600, color: "#78716C",
      }}>
        <span style={{ width: 20 }} />
        <span style={{ width: 42 }}>层级</span>
        <span style={{ minWidth: 80 }}>名称</span>
        <span style={{ minWidth: 60 }}>负责人</span>
        <span style={{ minWidth: 150 }}>计划时间</span>
        <span style={{ minWidth: 150 }}>实际时间</span>
        <span style={{ width: 90 }}>进度</span>
        <span style={{ width: 20, textAlign: "center" }}>AI</span>
        <span style={{ width: 36 }}>操作</span>
      </div>

      {/* 树 */}
      {tree.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#A8A29E" }}>
          暂无 WBS 数据
        </div>
      ) : (
        tree.map((root) => renderRow(root, 0))
      )}

      {/* 创建弹窗 */}
      <NodeEditDialog
        open={!!createParent}
        mode="create"
        parentNode={createParent}
        disciplines={disciplines}
        projectSourceId={projectSourceId}
        onClose={() => setCreateParent(null)}
        onSaved={() => { setCreateParent(null); onRefresh(); }}
      />

      {/* 编辑弹窗 */}
      <NodeEditDialog
        open={!!editNode}
        mode="edit"
        parentNode={null}
        editNode={editNode}
        disciplines={disciplines}
        projectSourceId={projectSourceId}
        onClose={() => setEditNode(null)}
        onSaved={() => { setEditNode(null); onRefresh(); }}
      />

      {/* 进度弹窗 */}
      <ProgressDialog
        open={!!progressNode}
        node={progressNode ? {
          id: progressNode.id,
          name: progressNode.name,
          progress: progressNode.progress ?? progressNode.actualPct ?? 0,
          actualStartDate: progressNode.actualStartDate,
          actualEndDate: progressNode.actualEndDate,
          projectSourceId: progressNode.projectSourceId,
        } : null}
        onClose={() => setProgressNode(null)}
        onSaved={() => { setProgressNode(null); onRefresh(); }}
      />
    </div>
  );
}

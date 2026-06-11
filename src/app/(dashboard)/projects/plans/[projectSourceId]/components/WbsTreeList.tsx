"use client";
import { useState, useCallback, useMemo, useEffect } from "react";
import {
  buildWbsTree,
  computeTaskStatus,
  computeParentStatus,
  aggregateProgress,
} from "@/lib/wbs-utils";
import type { WbsTreeNode, TaskStatusResult } from "@/lib/wbs-utils";
import ProgressDialog from "./ProgressDialog";
import NodeEditDialog from "./NodeEditDialog";
import WbsAlertBar from "@/components/WbsAlertBar";

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
  progress: number;
  sortOrder: number;
  responsibleIds: string[];
  aiGenerated: boolean;
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

const LEVEL_COLORS: Record<number, { color: string; label: string }> = {
  1: { color: "#333", label: "阶段" },
  2: { color: "#4A6FA5", label: "子项" },
  3: { color: "#6B8E6B", label: "专业" },
  4: { color: "#8B7355", label: "任务" },
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "-";
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/* ========== 主组件 ========== */

export default function WbsTreeList({ nodes, disciplines, projectSourceId, onRefresh }: Props) {
  const tree = buildWbsTree(nodes as unknown as Parameters<typeof buildWbsTree>[0]);

  // 用户 ID → 姓名映射
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const ids = [...new Set(nodes.flatMap(n => n.responsibleIds || []))];
    if (ids.length === 0) return;
    // 如果已有缓存则跳过
    if (ids.every(id => userMap.has(id))) return;
    fetch("/api/users?pageSize=500")
      .then(r => r.json())
      .then(data => {
        const map = new Map(userMap);
        for (const u of (data.data || [])) {
          map.set(u.id, u.realName);
        }
        setUserMap(map);
      })
      .catch(() => {});
  }, [nodes]);

  // 预警统计
  const alertStats = useMemo(() => {
    const allL4 = nodes.filter(n => n.level === 4);
    let delayed = 0;
    let ahead = 0;
    const today = new Date();
    for (const n of allL4) {
      const ps = n.planStartDate ? new Date(n.planStartDate) : null;
      const pe = n.planEndDate ? new Date(n.planEndDate) : null;
      const r = computeTaskStatus(n.progress ?? 0, ps, pe, today);
      if (r.status === "delayed" || r.status === "overdueComplete") delayed++;
      if (r.status === "ahead" || r.status === "aheadComplete") ahead++;
    }
    const avg = allL4.length > 0
      ? Math.round(allL4.reduce((s, n) => s + (n.progress ?? 0), 0) / allL4.length)
      : 0;
    return { totalTasks: allL4.length, delayedTasks: delayed, aheadTasks: ahead, overallProgress: avg };
  }, [nodes]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    tree.forEach((n) => ids.add(n.id));
    return ids;
  });

  /* 弹窗状态 */
  const [createParent, setCreateParent] = useState<{ id: string; name: string; level: number; disciplineId?: string | null; rootL1Name?: string } | null>(null);
  const [editNode, setEditNode] = useState<{
    id: string; name: string; level: number; isMilestone: boolean;
    planStartDate?: string | null; planEndDate?: string | null;
    responsibleIds?: string[];
  } | null>(null);
  const [progressNode, setProgressNode] = useState<WbsNode | null>(null);

  /* 任务日志 */
  const [logPanelNodeId, setLogPanelNodeId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, any[]>>({});
  const [newLogText, setNewLogText] = useState("");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogText, setEditLogText] = useState("");

  /* 统一的按钮样式 */
  const defaultBtnStyle: React.CSSProperties = {
    border: "1px solid #D0D5DD",
    background: "#fff",
    color: "#6B7685",
    fontSize: 12,
    padding: "3px 10px",
    borderRadius: 0,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const deleteBtnStyle: React.CSSProperties = {
    ...defaultBtnStyle,
    color: "#C47676",
    borderColor: "#E8D0D0",
  };

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

  /* ---------- 递归渲染表格行 ---------- */

  function renderRows(node: WbsTreeNode, depth: number, rootL1Name: string): React.ReactNode[] {
    const rows: React.ReactNode[] = [];
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const raw = node as unknown as WbsNode;
    const level = node.level;
    const lvl = LEVEL_COLORS[level] || { color: "#A8A29E", label: `L${level}` };

    let aiStatus: TaskStatusResult;
    let progressPct = raw.progress ?? 0;

    if (level === 4) {
      const planStart = raw.planStartDate ? new Date(raw.planStartDate) : null;
      const planEnd = raw.planEndDate ? new Date(raw.planEndDate) : null;
      aiStatus = computeTaskStatus(progressPct, planStart, planEnd, new Date());
    } else {
      // L1/L2/L3: collect all L4 descendants
      const leafStatuses: TaskStatusResult[] = [];
      const leafProgress: number[] = [];
      function collectLeaves(n: WbsTreeNode) {
        if (n.level === 4) {
          const r = n as unknown as WbsNode;
          const ps = r.planStartDate ? new Date(r.planStartDate) : null;
          const pe = r.planEndDate ? new Date(r.planEndDate) : null;
          leafStatuses.push(computeTaskStatus(r.progress ?? 0, ps, pe, new Date()));
          leafProgress.push(r.progress ?? 0);
        }
        for (const child of n.children) collectLeaves(child);
      }
      collectLeaves(node);
      if (leafStatuses.length > 0) {
        aiStatus = computeParentStatus(leafStatuses);
        progressPct = aggregateProgress(leafProgress);
      } else {
        aiStatus = { status: "none", emoji: "—", label: "无任务", planPct: 0 };
      }
    }

    const isLogOpen = logPanelNodeId === node.id;

    const statusColor = 
      aiStatus.status === "delayed" || aiStatus.status === "overdueComplete" ? "#C47676" :
      aiStatus.status === "aheadComplete" || aiStatus.status === "ahead" ? "#5A8A6A" :
      "#7DA88E";

    const showResponsibleSelect = level === 4 || (level === 3 && rootL1Name?.includes("采购"));

    // 节点名称样式按 level
    const NAME_STYLES: Record<number, { fontWeight: number; fontSize: number; color: string }> = {
      1: { fontWeight: 700, fontSize: 14, color: "#333" },
      2: { fontWeight: 600, fontSize: 13, color: "#4A6FA5" },
      3: { fontWeight: 400, fontSize: 13, color: "#6B8E6B" },
      4: { fontWeight: 400, fontSize: 13, color: "#8B7355" },
    };
    const nameStyle = NAME_STYLES[level] || { fontWeight: 400, fontSize: 13, color: "#44403C" };

    /* ---- 主行 ---- */
    rows.push(
      <tr
        key={node.id}
        className="tree-row"
        style={{
          borderBottom: "1px solid #E7E5E4",
          transition: "background 0.15s",
        }}
      >
        {/* 节点名称 30% */}
        <td style={{ padding: "6px 12px", width: "30%", verticalAlign: "middle" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* 层级缩进 */}
            {Array.from({ length: depth }).map((_, i) => (
              <span key={i} style={{ display: "inline-block", width: 20, flexShrink: 0 }} />
            ))}
            {/* 展开/折叠箭头 */}
            <span
              onClick={() => hasChildren && toggleExpand(node.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 16,
                height: 16,
                cursor: hasChildren ? "pointer" : "default",
                color: "#A8A29E",
                fontSize: 10,
                flexShrink: 0,
                userSelect: "none",
              }}
            >
              {hasChildren ? (isExpanded ? "▼" : "▶") : ""}
            </span>
            {/* 层级标签 */}
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: lvl.color,
              flexShrink: 0,
              minWidth: 32,
            }}>
              {lvl.label}
            </span>
            {/* 节点名称 */}
            <span style={{
              flex: 1,
              fontSize: nameStyle.fontSize,
              fontWeight: nameStyle.fontWeight,
              color: nameStyle.color,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {node.name}
            </span>
          </div>
        </td>

        {/* 状态 */}
        <td style={{
          padding: "6px 8px", width: "12%", textAlign: "center", verticalAlign: "middle",
        }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: statusColor }}>
            {aiStatus.emoji} {aiStatus.label}
          </span>
        </td>

        {/* 进度 */}
        <td style={{ padding: "6px 8px", width: "20%", verticalAlign: "middle" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                height: 8, background: "#E0E4EA", borderRadius: 0, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  background: statusColor,
                  width: `${Math.min(100, Math.max(0, progressPct))}%`,
                  borderRadius: 0,
                  transition: "width 0.3s",
                }} />
              </div>
            </div>
            <span style={{ fontSize: 11, color: "#78716C", whiteSpace: "nowrap", minWidth: 30, textAlign: "right" }}>
              {progressPct}%
            </span>
          </div>
        </td>

        {/* 责任人 */}
        <td style={{ padding: "6px 8px", width: "13%", verticalAlign: "middle" }}>
          {showResponsibleSelect && (raw.responsibleIds || []).length > 0 ? (
            <span style={{ fontSize: 12, color: "#57534E" }}>
              {(raw.responsibleIds || []).map(id => userMap.get(id) || id).join(", ")}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>—</span>
          )}
        </td>

        {/* 操作 30% */}
        <td style={{ padding: "6px 8px", width: "30%", verticalAlign: "middle" }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {level < 4 && (
              <button
                onClick={() => setCreateParent({ id: node.id, name: node.name, level: node.level, disciplineId: raw.disciplineId, rootL1Name })}
                style={defaultBtnStyle}
              >+ 添加</button>
            )}
            {level >= 2 && level <= 4 && (
              <button
                onClick={() => setEditNode({
                  id: node.id, name: node.name, level: node.level, isMilestone: !!raw.isMilestone,
                  planStartDate: raw.planStartDate, planEndDate: raw.planEndDate,
                  responsibleIds: raw.responsibleIds || [],
                })}
                style={defaultBtnStyle}
              >编辑</button>
            )}
            {level === 4 && (
              <button
                onClick={() => setProgressNode(raw)}
                style={defaultBtnStyle}
              >进度</button>
            )}
            {level === 4 && (
              <button
                onClick={() => {
                  if (isLogOpen) { setLogPanelNodeId(null); } else { setLogPanelNodeId(node.id); loadLogs(node.id); }
                }}
                style={defaultBtnStyle}
              >{isLogOpen ? "收起" : "日志"}</button>
            )}
            {level >= 2 && level <= 4 && (
              <button
                onClick={() => handleDelete(node.id)}
                style={deleteBtnStyle}
              >删除</button>
            )}
          </div>
        </td>
      </tr>
    );

    /* ---- 日志面板行（colSpan=5） ---- */
    if (level === 4 && isLogOpen) {
      rows.push(
        <tr key={`${node.id}-log`}>
          <td colSpan={5} style={{ padding: 0, borderBottom: "1px solid #F5F5F4" }}>
            <div style={{
              padding: "12px 12px 12px 50px",
              background: "#FAFBFC",
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
                    borderRadius: 0, fontSize: 13,
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") addLog(node.id); }}
                />
                <button
                  onClick={() => addLog(node.id)}
                  style={{
                    padding: "6px 14px", border: "none", borderRadius: 0,
                    background: "#4A6FA5", color: "#fff", fontSize: 13, cursor: "pointer",
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
          </td>
        </tr>
      );
    }

    /* ---- 子节点 ---- */
    if (hasChildren && isExpanded) {
      const childL1Name = depth === 0 ? node.name : rootL1Name;
      for (const child of node.children) {
        rows.push(...renderRows(child, depth + 1, childL1Name));
      }
    }

    return rows;
  }

  return (
    <div>
      <style>{`
        .tree-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .tree-table thead th {
          background: #FAFBFC;
          color: #8C95A3;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 12px;
          text-align: left;
          border-bottom: 2px solid #DFE3E8;
        }
        .tree-table tbody tr.tree-row:hover {
          background: #F8F9FB;
        }
      `}</style>

      <WbsAlertBar
        totalTasks={alertStats.totalTasks}
        delayedTasks={alertStats.delayedTasks}
        aheadTasks={alertStats.aheadTasks}
        overallProgress={alertStats.overallProgress}
      />

      <table className="tree-table">
        <thead>
          <tr>
            <th style={{ width: "30%" }}>节点名称</th>
            <th style={{ width: "12%", textAlign: "center" }}>状态</th>
            <th style={{ width: "20%" }}>进度</th>
            <th style={{ width: "13%" }}>责任人</th>
            <th style={{ width: "25%" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {tree.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#A8A29E" }}>
                暂无 WBS 数据
              </td>
            </tr>
          ) : (
            tree.flatMap((root) => renderRows(root, 0, root.name))
          )}
        </tbody>
      </table>

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
          progress: progressNode.progress ?? 0,
          planStartDate: progressNode.planStartDate,
          planEndDate: progressNode.planEndDate,
          isMilestone: !!progressNode.isMilestone,
          projectSourceId: progressNode.projectSourceId,
        } : null}
        onClose={() => setProgressNode(null)}
        onSaved={() => { setProgressNode(null); onRefresh(); }}
      />
    </div>
  );
}

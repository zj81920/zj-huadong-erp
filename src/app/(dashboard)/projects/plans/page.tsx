"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import PaginationBar from "@/components/PaginationBar";
import { usePagination } from "@/hooks/usePagination";

interface ProjectSummary {
  id: string;
  projectSourceId: string;
  projectCode: string;
  sourceRefId: string | null;
  name: string;
  customerName: string;
  overallProgress: number;
  isDelayed: boolean;
  aiStatus: string;
  taskCount: number;
  nodeCount: number;
  delayedCount: number;
  aheadCount: number;
  riskLevel: "low" | "medium" | "high";
  designPhasesList: string[];
  startDate: string | null;
  plannedEndDate: string | null;
  useWbs: boolean;
  status: string;
  actualStartDate: string | null;
  actualEndDate: string | null;
}

interface SummaryData {
  totalProjects: number;
  normalProjects: number;
  aheadProjects: number;
  delayedProjects: number;
  projects: ProjectSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function WbsDashboardPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [search, setSearch] = useState("");
  const { page, pageSize, setPage, setPageSize, pagination, setPagination } = usePagination({ defaultPageSize: 20 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // WBS 开关切换
  const [toggleProject, setToggleProject] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  // 行内编辑暂存
  const [editValues, setEditValues] = useState<Record<string, Partial<ProjectSummary>>>({});

  const fetchData = useCallback((q: string, p: number) => {
    const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
    if (q) params.set("search", q);
    fetch(`/api/projects/plans/summary?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.data);
        setPagination({
          page: d.data.page,
          pageSize: d.data.pageSize,
          total: d.data.total,
          totalPages: d.data.totalPages,
        });
      })
      .catch(() => {});
  }, [pageSize, setPagination]);

  useEffect(() => { fetchData(search, page); }, [page]); // eslint-disable-line

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setPage(1); fetchData(value, 1); }, 300);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // WBS 开关确认
  async function confirmToggle() {
    if (!toggleProject || !summary) return;
    setToggling(true);
    const project = summary.projects.find(p => p.projectSourceId === toggleProject);
    if (!project) { setToggling(false); return; }
    const newValue = !project.useWbs;
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useWbs: newValue }),
      });
      setToggleProject(null);
      fetchData(search, page);
    } finally {
      setToggling(false);
    }
  }

  // 行内编辑保存
  async function saveField(projectId: string, projectSourceId: string, field: string, value: unknown) {
    await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    fetchData(search, page);
  }

  if (!summary) return <div style={{ padding: 24 }}>加载中...</div>;

  const riskEmoji: Record<string, string> = { low: "🟢", medium: "🟡", high: "🔴" };

  const inputStyle: React.CSSProperties = {
    padding: "4px 6px", border: "1px solid #D0D5DD", borderRadius: 4, fontSize: 12, textAlign: "center",
    background: "#fff", outline: "none",
  };

  return (
    <div style={{ background: "#F0F1F3", minHeight: "100vh", padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>项目 WBS 计划与进度</h2>

      {/* 4 张统计卡片 */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <StatCard label="项目总数" value={summary.totalProjects} color="#44403C" />
        <StatCard label="🚀 提前" value={summary.aheadProjects} color="#7DA88E" />
        <StatCard label="✅ 正常" value={summary.normalProjects} color="#57534E" />
        <StatCard label="⚠️ 延误" value={summary.delayedProjects} color="#C47676" />
      </div>

      {/* 搜索框 */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="搜索项目编号 / 项目名称 / 甲方名称…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{
            width: "100%", maxWidth: 360, padding: "8px 12px", fontSize: 13,
            border: "1px solid #D0D5DD", borderRadius: 0, outline: "none",
            color: "#44403C", background: "#fff",
          }}
          onFocus={(e) => { e.target.style.borderColor = "#4A6FA5"; }}
          onBlur={(e) => { e.target.style.borderColor = "#D0D5DD"; }}
        />
      </div>

      {/* 项目列表 */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DFE3E8" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #DFE3E8" }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>项目列表</span>
          <span style={{ fontSize: 13, color: "#8C95A3" }}>共 {summary.total} 个项目</span>
        </div>

        {/* 表头 */}
        <div style={{
          display: "flex", padding: "10px 16px", borderBottom: "1px solid #DFE3E8",
          fontSize: 12, fontWeight: 500, color: "#8C95A3", background: "#FAFBFC",
        }}>
          <span style={{ width: 100 }}>项目编号</span>
          <span style={{ width: 180 }}>项目名称</span>
          <span style={{ width: 100 }}>甲方</span>
          <span style={{ width: 180 }}>设计阶段</span>
          <span style={{ width: 160, textAlign: "center" }}>进度</span>
          <span style={{ width: 200, textAlign: "center" }}>实际时间</span>
          <span style={{ width: 80, textAlign: "center" }}>状态</span>
          <span style={{ width: 50, textAlign: "center" }}>风险</span>
          <span style={{ width: 60, textAlign: "center" }}>WBS</span>
        </div>

        {/* 行 */}
        {summary.projects?.map((p) => {
          const ev = editValues[p.projectSourceId] || {};
          return (
            <div
              key={p.projectSourceId}
              style={{
                display: "flex", alignItems: "center", padding: "10px 16px",
                borderBottom: "1px solid #F5F5F4",
                background: p.isDelayed ? "#FFF5F5" : "transparent",
              }}
            >
              {/* 项目编号 */}
              <span style={{ width: 100, fontSize: 13, color: "#57534E" }}>
                {p.projectCode || p.sourceRefId || "-"}
              </span>

              {/* 项目名称 — WBS ON 可点击跳转 */}
              {p.useWbs ? (
                <Link href={`/projects/plans/${p.projectSourceId}`} style={{
                  width: 180, fontWeight: 500, fontSize: 13, color: "#1C1917",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  textDecoration: "none",
                }}>
                  {p.name}
                </Link>
              ) : (
                <span style={{
                  width: 180, fontWeight: 500, fontSize: 13, color: "#1C1917",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {p.name}
                </span>
              )}

              {/* 甲方 */}
              <span style={{ width: 100, fontSize: 13, color: "#57534E" }}>
                {p.customerName || "-"}
              </span>

              {/* 设计阶段 */}
              <span style={{ width: 180, display: "flex", gap: 4, flexWrap: "wrap" }}>
                {(p.designPhasesList || []).map((phase) => (
                  <span key={phase} style={{
                    padding: "2px 8px", fontSize: 11, borderRadius: 4,
                    background: "#EBF0F7", color: "#4A6FA5", whiteSpace: "nowrap",
                  }}>
                    {phase}
                  </span>
                ))}
              </span>

              {/* 进度 */}
              <span style={{ width: 160, textAlign: "center", fontSize: 13 }}>
                {p.useWbs ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 100, height: 8, background: "#E8ECF1", borderRadius: 4,
                      display: "inline-block", overflow: "hidden",
                    }}>
                      <span style={{
                        display: "block", height: "100%",
                        width: `${p.overallProgress ?? 0}%`,
                        background: p.isDelayed ? "#C47676" : "#7DA88E",
                        borderRadius: 3,
                      }} />
                    </span>
                    <span style={{ fontSize: 12, color: "#555" }}>{p.overallProgress ?? 0}%</span>
                  </span>
                ) : (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="number" min={0} max={100}
                      value={ev.overallProgress ?? p.overallProgress ?? 0}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                        setEditValues(prev => ({ ...prev, [p.projectSourceId]: { ...prev[p.projectSourceId], overallProgress: v } }));
                      }}
                      onBlur={() => {
                        const v = ev.overallProgress ?? p.overallProgress ?? 0;
                        if (v !== p.overallProgress) saveField(p.id, p.projectSourceId, "overallProgress", v);
                      }}
                      style={{ ...inputStyle, width: 55 }}
                    />
                    <span style={{ fontSize: 12, color: "#555" }}>%</span>
                  </div>
                )}
              </span>

              {/* 实际时间 */}
              <span style={{ width: 200, textAlign: "center", fontSize: 12, color: "#57534E" }}>
                {p.useWbs ? (
                  <span>
                    {p.actualStartDate || p.actualEndDate
                      ? `${p.actualStartDate ? p.actualStartDate.slice(0, 10) : "—"} ~ ${p.actualEndDate ? p.actualEndDate.slice(0, 10) : "—"}`
                      : "-"}
                  </span>
                ) : (
                  <div style={{ display: "flex", gap: 2, alignItems: "center", justifyContent: "center" }}
                    onClick={(e) => e.stopPropagation()}>
                    <input
                      type="date"
                      value={ev.actualStartDate ?? (p.actualStartDate?.slice(0, 10) || "")}
                      onChange={(e) => {
                        setEditValues(prev => ({ ...prev, [p.projectSourceId]: { ...prev[p.projectSourceId], actualStartDate: e.target.value } }));
                      }}
                      onBlur={() => {
                        const v = ev.actualStartDate ?? (p.actualStartDate?.slice(0, 10) || "");
                        saveField(p.id, p.projectSourceId, "actualStartDate", v || null);
                      }}
                      style={{ ...inputStyle, width: 90, fontSize: 11 }}
                    />
                    <span style={{ color: "#8C95A3", fontSize: 11 }}>~</span>
                    <input
                      type="date"
                      value={ev.actualEndDate ?? (p.actualEndDate?.slice(0, 10) || "")}
                      onChange={(e) => {
                        setEditValues(prev => ({ ...prev, [p.projectSourceId]: { ...prev[p.projectSourceId], actualEndDate: e.target.value } }));
                      }}
                      onBlur={() => {
                        const v = ev.actualEndDate ?? (p.actualEndDate?.slice(0, 10) || "");
                        saveField(p.id, p.projectSourceId, "actualEndDate", v || null);
                      }}
                      style={{ ...inputStyle, width: 90, fontSize: 11 }}
                    />
                  </div>
                )}
              </span>

              {/* 状态 */}
              <span style={{ width: 80, textAlign: "center" }}>
                {p.useWbs ? (
                  (() => {
                    const isComplete = (p.overallProgress ?? 0) >= 100;
                    let statusText: string;
                    let badgeStyle: React.CSSProperties;
                    if (isComplete) {
                      statusText = "已完成";
                      badgeStyle = { color: "#5A7A9A", border: "1px solid #C0D0E0", background: "#F5F8FB" };
                    } else if (p.delayedCount > 0) {
                      statusText = "延误";
                      badgeStyle = { color: "#C47676", border: "1px solid #E8C8C8", background: "#FDF6F6" };
                    } else {
                      statusText = "正常";
                      badgeStyle = { color: "#5A8A6A", border: "1px solid #B8D4C0", background: "#F6FAF7" };
                    }
                    return (
                      <span style={{
                        ...badgeStyle, padding: "3px 8px", fontSize: 11, borderRadius: 4, display: "inline-block",
                      }}>
                        {statusText}
                      </span>
                    );
                  })()
                ) : (
                  <select
                    value={ev.status ?? p.status ?? "执行"}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      setEditValues(prev => ({ ...prev, [p.projectSourceId]: { ...prev[p.projectSourceId], status: e.target.value } }));
                      saveField(p.id, p.projectSourceId, "status", e.target.value);
                    }}
                    style={{ ...inputStyle, padding: "3px 4px" }}
                  >
                    <option value="执行">执行</option>
                    <option value="暂停">暂停</option>
                    <option value="关闭">关闭</option>
                  </select>
                )}
              </span>

              {/* 风险 */}
              <span style={{ width: 50, textAlign: "center" }}>
                {p.useWbs ? (
                  <span style={{ fontSize: 16 }}>{riskEmoji[p.riskLevel] || "🟢"}</span>
                ) : (
                  <select
                    value={ev.riskLevel ?? p.riskLevel ?? "low"}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      setEditValues(prev => ({ ...prev, [p.projectSourceId]: { ...prev[p.projectSourceId], riskLevel: e.target.value as "low" | "medium" | "high" } }));
                      saveField(p.id, p.projectSourceId, "riskLevel", e.target.value);
                    }}
                    style={{ ...inputStyle, padding: "3px 2px", fontSize: 11 }}
                  >
                    <option value="low">🟢低</option>
                    <option value="medium">🟡中</option>
                    <option value="high">🔴高</option>
                  </select>
                )}
              </span>

              {/* WBS 开关 */}
              <span style={{ width: 60, textAlign: "center" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setToggleProject(p.projectSourceId); }}
                  style={{
                    width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                    background: p.useWbs ? "#4A6FA5" : "#D0D5DD",
                    position: "relative", transition: "background 0.2s",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 2, width: 18, height: 18, borderRadius: "50%",
                    background: "#fff", transition: "left 0.2s",
                    left: p.useWbs ? 20 : 2,
                  }} />
                </button>
              </span>
            </div>
          );
        })}

        {(!summary.projects || summary.projects.length === 0) && (
          <div style={{ padding: 32, textAlign: "center", color: "#A8A29E" }}>
            {search ? "未找到匹配的项目" : "暂无项目数据"}
          </div>
        )}
      </div>

      {/* 分页 */}
      {summary.total > 0 && (
        <div style={{ padding: "12px 16px", borderTop: "1px solid #DFE3E8" }}>
          <PaginationBar
            pagination={pagination}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* WBS 切换确认弹窗 */}
      {toggleProject && (() => {
        const project = summary.projects.find(p => p.projectSourceId === toggleProject);
        const newValue = project ? !project.useWbs : true;
        return (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}>
            <div style={{ background: "#fff", padding: 24, minWidth: 380, maxWidth: 480 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>切换 WBS 模式</h3>
              <p style={{ fontSize: 14, color: "#57534E", marginBottom: 8 }}>
                {newValue
                  ? "开启 WBS 后，将通过 WBS 节点管理项目进度。之前手动填写的进度/时间/状态/风险数据将被清除。"
                  : "关闭 WBS 后，可在列表中直接编辑进度、实际时间、状态和风险。已有的 WBS 节点数据将被隐藏（重新开启后可恢复）。"}
              </p>
              <p style={{ fontSize: 13, color: "#8C95A3", marginBottom: 20 }}>
                项目：{project?.name || ""}
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  onClick={() => setToggleProject(null)}
                  disabled={toggling}
                  style={{
                    padding: "8px 20px", borderRadius: 0, border: "1px solid #D6D3D1",
                    background: "#fff", cursor: "pointer", fontSize: 14,
                  }}
                >
                  取消
                </button>
                <button
                  onClick={confirmToggle}
                  disabled={toggling}
                  style={{
                    padding: "8px 20px", borderRadius: 0, border: "none",
                    background: "#4A6FA5", color: "#fff", cursor: "pointer", fontWeight: 500, fontSize: 14,
                  }}
                >
                  {toggling ? "切换中..." : "确认"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, background: "#fff", borderRadius: 0, border: "1px solid #DFE3E8", padding: "16px 20px" }}>
      <div style={{ fontSize: 13, color: "#78716C", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

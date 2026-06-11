"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

interface ProjectSummary {
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

const PAGE_SIZE = 20;

export default function WbsDashboardPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback((q: string, p: number) => {
    const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
    if (q) params.set("search", q);
    fetch(`/api/projects/plans/summary?${params}`)
      .then((r) => r.json())
      .then((d) => setSummary(d.data))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchData(search, page); }, [page]); // eslint-disable-line

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setPage(1); fetchData(value, 1); }, 300);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (!summary) return <div style={{ padding: 24 }}>加载中...</div>;

  const riskEmoji: Record<string, string> = { low: "🟢", medium: "🟡", high: "🔴" };

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
          <span style={{ width: 200 }}>项目名称</span>
          <span style={{ flex: 1 }}>设计阶段</span>
          <span style={{ width: 100 }}>甲方</span>
          <span style={{ width: 110, textAlign: "center" }}>进度</span>
          <span style={{ width: 80, textAlign: "center" }}>状态</span>
          <span style={{ width: 40, textAlign: "center" }}>风险</span>
        </div>

        {/* 行 */}
        {summary.projects?.map((p) => (
          <Link
            key={p.projectSourceId}
            href={`/projects/plans/${p.projectSourceId}`}
            style={{
              display: "flex", alignItems: "center", padding: "10px 16px",
              borderBottom: "1px solid #F5F5F4", textDecoration: "none",
              background: p.isDelayed ? "#FFF5F5" : "transparent",
            }}
          >
            <span style={{ width: 100, fontSize: 13, color: "#57534E" }}>
              {p.projectCode || p.sourceRefId || "-"}
            </span>
            <span style={{
              width: 200, fontWeight: 500, fontSize: 13, color: "#1C1917",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {p.name}
            </span>
            <span style={{ flex: 1, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(p.designPhasesList || []).map((phase) => (
                <span key={phase} style={{
                  padding: "2px 8px", fontSize: 11, borderRadius: 4,
                  background: "#EBF0F7", color: "#4A6FA5", whiteSpace: "nowrap",
                }}>
                  {phase}
                </span>
              ))}
            </span>
            <span style={{ width: 100, fontSize: 13, color: "#57534E" }}>
              {p.customerName || "-"}
            </span>
            <span style={{ width: 110, textAlign: "center", fontSize: 13 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  width: 60, height: 6, background: "#E8ECF1", borderRadius: 3,
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
            </span>
            <span style={{ width: 80, textAlign: "center" }}>
              {(() => {
                const isComplete = (p.overallProgress ?? 0) >= 100;
                let statusText: string;
                let badgeStyle: React.CSSProperties;
                if (isComplete) {
                  statusText = "🏁 已完成";
                  badgeStyle = { color: "#5A7A9A", border: "1px solid #C0D0E0", background: "#F5F8FB" };
                } else if (p.delayedCount > 0) {
                  statusText = "⚠️ 延误";
                  badgeStyle = { color: "#C47676", border: "1px solid #E8C8C8", background: "#FDF6F6" };
                } else {
                  statusText = "✅ 正常";
                  badgeStyle = { color: "#5A8A6A", border: "1px solid #B8D4C0", background: "#F6FAF7" };
                }
                return (
                  <div>
                    <span style={{
                      ...badgeStyle, padding: "3px 10px", fontSize: 12, borderRadius: 4, display: "inline-block",
                    }}>
                      {statusText}
                    </span>
                    {p.delayedCount > 0 && (
                      <span style={{ display: "block", fontSize: 10, color: "#C47676", marginTop: 2 }}>
                        {p.delayedCount}项延误
                      </span>
                    )}
                  </div>
                );
              })()}
            </span>
            <span style={{ width: 40, textAlign: "center", fontSize: 16 }}>
              {riskEmoji[p.riskLevel] || "🟢"}
            </span>
          </Link>
        ))}

        {(!summary.projects || summary.projects.length === 0) && (
          <div style={{ padding: 32, textAlign: "center", color: "#A8A29E" }}>
            {search ? "未找到匹配的项目" : "暂无 WBS 计划数据"}
          </div>
        )}
      </div>

      {/* 分页 */}
      {summary.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 20 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={summary.page <= 1}
            style={paginationBtnStyle(summary.page <= 1)}
          >上一页</button>
          <span style={{ fontSize: 13, color: "#57534E" }}>
            第 {summary.page}/{summary.totalPages} 页
          </span>
          <button
            onClick={() => setPage((p) => Math.min(summary.totalPages, p + 1))}
            disabled={summary.page >= summary.totalPages}
            style={paginationBtnStyle(summary.page >= summary.totalPages)}
          >下一页</button>
        </div>
      )}
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

function paginationBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 16px", fontSize: 13, border: "1px solid #D0D5DD", borderRadius: 0,
    background: disabled ? "#fff" : "#4A6FA5", color: disabled ? "#555" : "#fff",
    borderColor: disabled ? "#D0D5DD" : "#4A6FA5",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

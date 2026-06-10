"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface ProjectSummary {
  projectSourceId: string;
  sourceRefId: string | null;
  name: string;
  customerName: string;
  overallProgress: number;
  isDelayed: boolean;
  aiStatus: string;
  taskCount: number;
  nodeCount: number;
}

interface SummaryData {
  totalProjects: number;
  ontrackProjects: number;
  delayedProjects: number;
  projects: ProjectSummary[];
}

export default function WbsDashboardPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);

  useEffect(() => {
    fetch("/api/projects/plans/summary")
      .then(r => r.json())
      .then(d => setSummary(d.data))
      .catch(() => {});
  }, []);

  if (!summary) return <div style={{ padding: 24 }}>加载中...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>项目 WBS 计划与进度</h2>
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <StatCard label="项目总数" value={summary.totalProjects} color="#44403C" />
        <StatCard label="按期项目" value={summary.ontrackProjects} color="#57534E" />
        <StatCard label="延误项目" value={summary.delayedProjects} color="#A8A29E" />
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E7E5E4" }}>
        <div style={{ display: "flex", padding: "10px 16px", borderBottom: "1px solid #E7E5E4", fontSize: 12, fontWeight: 600, color: "#78716C" }}>
          <span style={{ width: 120 }}>项目编号</span>
          <span style={{ flex: 1 }}>项目名称</span>
          <span style={{ width: 140 }}>甲方名称</span>
          <span style={{ width: 80, textAlign: "center" }}>完成进度</span>
          <span style={{ width: 80, textAlign: "center" }}>状态</span>
          <span style={{ width: 80 }} />
        </div>
        {summary.projects?.map((p) => (
          <div key={p.projectSourceId} style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #F5F5F4" }}>
            <span style={{ width: 120, fontSize: 13, color: "#57534E" }}>{p.sourceRefId || "-"}</span>
            <span style={{ flex: 1, fontWeight: 500 }}>{p.name}</span>
            <span style={{ width: 140, fontSize: 13, color: "#57534E" }}>{p.customerName || "-"}</span>
            <span style={{ width: 80, textAlign: "center", fontSize: 13 }}>{p.overallProgress ?? 0}%</span>
            <span style={{ width: 80, textAlign: "center", fontWeight: 500, fontSize: 13, color: p.isDelayed ? "#A8A29E" : "#57534E" }}>
              {p.isDelayed ? "延误" : "正常"}
            </span>
            <Link href={`/projects/plans/${p.projectSourceId}`} style={{ color: "#78716C", fontSize: 13, width: 80, textAlign: "center" }}>
              查看详情 →
            </Link>
          </div>
        ))}
        {(!summary.projects || summary.projects.length === 0) && (
          <div style={{ padding: 32, textAlign: "center", color: "#A8A29E" }}>暂无 WBS 计划数据</div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, background: "#fff", borderRadius: 12, border: "1px solid #E7E5E4", padding: "16px 20px" }}>
      <div style={{ fontSize: 13, color: "#78716C", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

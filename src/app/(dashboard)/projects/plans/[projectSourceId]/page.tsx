"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import WbsTreeList from "./components/WbsTreeList";
import GanttChart from "./components/GanttChart";

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
  [key: string]: unknown;
}

export default function WbsDetailPage() {
  const params = useParams<{ projectSourceId: string }>();
  const projectSourceId = params.projectSourceId;
  const [nodes, setNodes] = useState<WbsNode[]>([]);
  const [disciplines, setDisciplines] = useState<{ id: string; name: string; code: string }[]>([]);
  const [projectCode, setProjectCode] = useState("");
  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [ganttOpen, setGanttOpen] = useState(false);

  async function loadData() {
    try {
      const [nodeRes, discRes, projRes] = await Promise.all([
        fetch(`/api/projects/plans/${projectSourceId}`),
        fetch("/api/settings/disciplines"),
        fetch(`/api/projects?search=${encodeURIComponent(projectSourceId)}&pageSize=1`),
      ]);
      const nodeData = await nodeRes.json();
      const discData = await discRes.json();
      const projData = await projRes.json();
      setNodes(nodeData.data || []);
      setDisciplines(discData.data || []);
      if (projData.data && projData.data.length > 0) {
        const proj = projData.data[0];
        setProjectCode(proj.projectCode || "");
        setProjectName(proj.name || "");
        setCustomerName(proj.customer?.name || "");
      }
    } catch (e) {
      console.error("加载失败:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [projectSourceId]);

  if (loading) return <div style={{ padding: 24 }}>加载中...</div>;

  // 面包屑项目名称：优先从 API 获取的项目名，否则从第一个一级节点获取
  const breadcrumbName = projectName || nodes.find(n => n.level === 1)?.name || projectSourceId;

  return (
    <div style={{ background: "#F0F1F3", minHeight: "100vh" }}>
      {/* 面包屑导航 */}
      <div style={{ padding: "16px 16px 0", marginBottom: 16 }}>
        <Link
          href="/projects/plans"
          style={{ fontSize: 13, color: "#4A6FA5", cursor: "pointer", textDecoration: "none" }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = "underline"; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = "none"; }}
        >
          项目 WBS 仪表盘
        </Link>
        <span style={{ fontSize: 13, color: "#8C95A3" }}> › {breadcrumbName}</span>
      </div>

      {/* 卡片 */}
      <div style={{
        margin: "0 16px 16px",
        background: "#fff",
        border: "1px solid #DFE3E8",
        borderRadius: 0,
      }}>
        {/* 卡片头部 */}
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid #DFE3E8",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A" }}>WBS 任务分解</span>
          <span style={{ fontSize: 12, color: "#8C95A3" }}>
            项目编号：{projectCode || "-"} | 甲方：{customerName || "-"}
          </span>
        </div>

        {/* 全宽列表 */}
        <WbsTreeList
          nodes={nodes}
          disciplines={disciplines}
          projectSourceId={projectSourceId}
          onRefresh={loadData}
        />

        {/* 甘特图折叠面板 */}
        <div style={{ borderTop: "1px solid #DFE3E8" }}>
          <button
            onClick={() => setGanttOpen(!ganttOpen)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "10px 16px",
              border: "none", background: "#FAFAF9",
              fontSize: 13, fontWeight: 600, color: "#57534E",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 14, transition: "transform 0.2s", transform: ganttOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
              ▶
            </span>
            {ganttOpen ? "收起甘特图" : "展开甘特图"}
          </button>
          {ganttOpen && (
            <div style={{ height: 400, overflow: "auto", borderTop: "1px solid #DFE3E8" }}>
              <GanttChart nodes={nodes} disciplines={disciplines} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

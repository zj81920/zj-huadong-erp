"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  actualStartDate: string | null;
  actualEndDate: string | null;
  progress: number;
  plannedPct: number;
  actualPct: number;
  status: string;
  delayDays: number;
  sortOrder: number;
  responsibleId: string | null;
  responsiblePerson?: { id: string; realName: string } | null;
  [key: string]: unknown;
}

export default function WbsDetailPage() {
  const params = useParams<{ projectSourceId: string }>();
  const projectSourceId = params.projectSourceId;
  const [nodes, setNodes] = useState<WbsNode[]>([]);
  const [disciplines, setDisciplines] = useState<{ id: string; name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [ganttOpen, setGanttOpen] = useState(false);

  async function loadData() {
    try {
      const [nodeRes, discRes] = await Promise.all([
        fetch(`/api/projects/plans/${projectSourceId}`),
        fetch("/api/settings/disciplines"),
      ]);
      const nodeData = await nodeRes.json();
      const discData = await discRes.json();
      setNodes(nodeData.data || []);
      setDisciplines(discData.data || []);
    } catch (e) {
      console.error("加载失败:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [projectSourceId]);

  if (loading) return <div style={{ padding: 24 }}>加载中...</div>;

  return (
    <div style={{
      margin: 16,
      background: "#fff",
      border: "1px solid #E7E5E4",
      borderRadius: 8,
      overflow: "hidden",
    }}>
      {/* 全宽列表 */}
      <WbsTreeList
        nodes={nodes}
        disciplines={disciplines}
        projectSourceId={projectSourceId}
        onRefresh={loadData}
      />

      {/* 甘特图折叠面板 */}
      <div style={{ borderTop: "1px solid #E7E5E4" }}>
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
          <div style={{ height: 400, overflow: "auto", borderTop: "1px solid #E7E5E4" }}>
            <GanttChart nodes={nodes} disciplines={disciplines} />
          </div>
        )}
      </div>
    </div>
  );
}

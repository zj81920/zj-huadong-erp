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
      display: "flex",
      height: "calc(100vh - 60px)",
      border: "1px solid #E7E5E4",
      borderRadius: 14,
      overflow: "hidden",
      background: "#fff",
      margin: 16,
    }}>
      <div style={{ width: "58%", borderRight: "1px solid #E7E5E4", overflow: "auto" }}>
        <WbsTreeList
          nodes={nodes}
          disciplines={disciplines}
          projectSourceId={projectSourceId}
          onRefresh={loadData}
        />
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        <GanttChart nodes={nodes} disciplines={disciplines} />
      </div>
    </div>
  );
}

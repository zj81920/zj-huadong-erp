"use client";
import { useState, useEffect } from "react";

interface Props {
  open: boolean;
  node: {
    id: string;
    name: string;
    progress: number;
    planStartDate?: string | null;
    planEndDate?: string | null;
    isMilestone?: boolean;
    projectSourceId: string;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProgressDialog({ open, node, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [progress, setProgress] = useState(0);
  const [planStart, setPlanStart] = useState("");
  const [planEnd, setPlanEnd] = useState("");
  const [isMilestone, setIsMilestone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (node) {
      setName(node.name || "");
      setProgress(node.progress || 0);
      setPlanStart(node.planStartDate?.slice(0, 10) || "");
      setPlanEnd(node.planEndDate?.slice(0, 10) || "");
      setIsMilestone(!!node.isMilestone);
    }
  }, [node]);

  if (!open || !node) return null;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/plans/${node!.projectSourceId}/nodes/${node!.id}/progress`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progress }),
        }
      );
      if (res.ok) {
        onSaved();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", border: "1px solid #D6D3D1",
    borderRadius: 0, fontSize: 14, boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{ background: "#fff", borderRadius: 0, padding: 24, width: 440 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>
          任务详情 — {node.name}
        </h3>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>任务名称</label>
          <input type="text" value={name} readOnly style={{ ...inputStyle, background: "#F5F5F5" }} />
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>计划开始</label>
            <input type="date" value={planStart} readOnly style={{ ...inputStyle, background: "#F5F5F5" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>计划结束</label>
            <input type="date" value={planEnd} readOnly style={{ ...inputStyle, background: "#F5F5F5" }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={isMilestone} disabled />
            里程碑
          </label>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
            进度 (0-100)
          </label>
          <input
            type="number" min={0} max={100}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button onClick={onClose} style={{
            padding: "8px 20px", borderRadius: 0, border: "1px solid #D6D3D1",
            background: "#fff", cursor: "pointer",
          }}>取消</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "8px 20px", borderRadius: 0, border: "none",
            background: "#4A6FA5", color: "#fff", cursor: "pointer", fontWeight: 500,
          }}>{saving ? "保存中..." : "保存"}</button>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";

interface Props {
  open: boolean;
  node: {
    id: string;
    name: string;
    progress: number;
    actualStartDate?: string | null;
    actualEndDate?: string | null;
    projectSourceId: string;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProgressDialog({ open, node, onClose, onSaved }: Props) {
  const [progress, setProgress] = useState(0);
  const [actualStart, setActualStart] = useState("");
  const [actualEnd, setActualEnd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (node) {
      setProgress(node.progress || 0);
      setActualStart(node.actualStartDate?.slice(0, 10) || "");
      setActualEnd(node.actualEndDate?.slice(0, 10) || "");
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
          body: JSON.stringify({
            progress,
            actualStartDate: actualStart || undefined,
            actualEndDate: actualEnd || undefined,
          }),
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
    borderRadius: 8, fontSize: 14,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: 420 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>
          填报进度 — {node.name}
        </h3>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            完成百分比 (%)
          </label>
          <input
            type="number" min={0} max={100}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            实际开始时间
          </label>
          <input
            type="date" value={actualStart}
            onChange={(e) => setActualStart(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            实际结束时间
          </label>
          <input
            type="date" value={actualEnd}
            onChange={(e) => setActualEnd(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "1px solid #D6D3D1",
              background: "#fff", cursor: "pointer",
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave} disabled={saving}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: "#3B82F6", color: "#fff", cursor: "pointer", fontWeight: 500,
            }}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

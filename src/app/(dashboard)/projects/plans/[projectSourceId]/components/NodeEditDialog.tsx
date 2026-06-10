"use client";
import { useState, useEffect } from "react";

interface Discipline {
  id: string;
  name: string;
  code: string;
}

interface Props {
  open: boolean;
  mode: "create" | "edit";
  parentNode: { id: string; level: number; disciplineId?: string | null } | null;
  editNode?: {
    id: string;
    name: string;
    level: number;
    isMilestone: boolean;
    planStartDate?: string | null;
    planEndDate?: string | null;
  } | null;
  disciplines: Discipline[];
  onClose: () => void;
  onSaved: () => void;
  projectSourceId: string;
}

export default function NodeEditDialog({
  open, mode, parentNode, editNode, disciplines, onClose, onSaved, projectSourceId,
}: Props) {
  const level =
    mode === "create"
      ? parentNode ? parentNode.level + 1 : 2
      : editNode?.level ?? 2;
  const [name, setName] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [planStart, setPlanStart] = useState("");
  const [planEnd, setPlanEnd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editNode) {
      setName(editNode.name);
      setPlanStart(editNode.planStartDate?.slice(0, 10) || "");
      setPlanEnd(editNode.planEndDate?.slice(0, 10) || "");
    } else {
      setName("");
      setDisciplineId("");
      setPlanStart("");
      setPlanEnd("");
    }
  }, [editNode, open]);

  if (!open) return null;

  const isLevel3 = level === 3;
  const isLevel4 = level === 4;

  async function handleSave() {
    setSaving(true);
    try {
      if (mode === "create") {
        const body: Record<string, unknown> = {
          parentId: parentNode?.id || null,
          name,
          level,
        };
        if (isLevel3) body.disciplineId = disciplineId;
        if (isLevel4) {
          body.planStartDate = planStart || null;
          body.planEndDate = planEnd || null;
        }
        await fetch(`/api/projects/plans/${projectSourceId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else if (editNode) {
        const body: Record<string, unknown> = { name };
        if (isLevel4) {
          body.planStartDate = planStart || null;
          body.planEndDate = planEnd || null;
        }
        await fetch(`/api/projects/plans/${projectSourceId}/nodes/${editNode.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      onSaved();
      onClose();
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
          {mode === "edit"
            ? "编辑节点"
            : `新建${level === 2 ? "子项" : level === 3 ? "专业" : "任务"}`}
        </h3>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            名称
          </label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>
        {isLevel3 && mode === "create" && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              专业
            </label>
            <select value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)} style={inputStyle}>
              <option value="">请选择专业</option>
              {disciplines.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>
        )}
        {isLevel4 && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                计划开始
              </label>
              <input type="date" value={planStart} onChange={(e) => setPlanStart(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                计划结束
              </label>
              <input type="date" value={planEnd} onChange={(e) => setPlanEnd(e.target.value)} style={inputStyle} />
            </div>
          </>
        )}
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
            onClick={handleSave}
            disabled={saving || !name.trim()}
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

"use client";
import { useEffect, useState } from "react";

interface Discipline { id: string; name: string; code: string; }

export default function DisciplinesPage() {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/disciplines");
    const data = await res.json();
    setDisciplines(data.data || []);
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!name || !code) return;
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/disciplines/${editingId}` : "/api/disciplines";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, code }) });
    setName(""); setCode(""); setEditingId(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除？")) return;
    await fetch(`/api/disciplines/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>专业字典管理</h2>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "flex-end" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#78716C", marginBottom: 4 }}>专业名称</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="如：工艺"
            style={{ padding: "8px 12px", border: "1px solid #D6D3D1", borderRadius: 8, fontSize: 14, width: 160 }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#78716C", marginBottom: 4 }}>专业代码</label>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="如：PROC"
            style={{ padding: "8px 12px", border: "1px solid #D6D3D1", borderRadius: 8, fontSize: 14, width: 120 }} />
        </div>
        <button onClick={handleSave} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#3B82F6", color: "#fff", cursor: "pointer", fontWeight: 500, height: 40 }}>
          {editingId ? "更新" : "添加"}
        </button>
        {editingId && (
          <button onClick={() => { setEditingId(null); setName(""); setCode(""); }}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #D6D3D1", background: "#fff", cursor: "pointer", height: 40 }}>取消</button>
        )}
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E7E5E4", overflow: "hidden" }}>
        <div style={{ display: "flex", padding: "10px 16px", borderBottom: "1px solid #E7E5E4", fontSize: 12, fontWeight: 600, color: "#78716C" }}>
          <span style={{ flex: 1 }}>专业名称</span>
          <span style={{ width: 120, textAlign: "center" }}>专业代码</span>
          <span style={{ width: 120, textAlign: "center" }}>操作</span>
        </div>
        {disciplines.map((d) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid #F5F5F4", fontSize: 13 }}>
            <span style={{ flex: 1 }}>{d.name}</span>
            <span style={{ width: 120, textAlign: "center", fontFamily: "monospace", color: "#3B82F6" }}>{d.code}</span>
            <span style={{ width: 120, textAlign: "center", display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => { setEditingId(d.id); setName(d.name); setCode(d.code); }}
                style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #D6D3D1", background: "#fff", cursor: "pointer", fontSize: 12 }}>编辑</button>
              <button onClick={() => handleDelete(d.id)}
                style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", fontSize: 12 }}>删除</button>
            </span>
          </div>
        ))}
        {disciplines.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#A8A29E" }}>暂无专业数据</div>
        )}
      </div>
    </div>
  );
}

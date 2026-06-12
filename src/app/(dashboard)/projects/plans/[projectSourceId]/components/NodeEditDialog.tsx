"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { pinyinMatch } from "@/lib/pinyin-utils";

interface Discipline {
  id: string;
  name: string;
  code: string;
}

interface User {
  id: string;
  realName: string;
  username: string;
}

interface Props {
  open: boolean;
  mode: "create" | "edit";
  parentNode: { id: string; name: string; level: number; disciplineId?: string | null; rootL1Name?: string } | null;
  editNode?: {
    id: string;
    name: string;
    level: number;
    isMilestone: boolean;
    planStartDate?: string | null;
    planEndDate?: string | null;
    responsibleIds?: string[];
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
  const [responsibleIds, setResponsibleIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // 责任人下拉状态
  const [respOpen, setRespOpen] = useState(false);
  const [respSearch, setRespSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const respContainerRef = useRef<HTMLDivElement>(null);
  const respInputRef = useRef<HTMLInputElement>(null);

  // 判断是否是采购体系（根L1节点名称为采购）
  const isProcurement =
    mode === "create" && parentNode?.rootL1Name
      ? parentNode.rootL1Name.includes("采购")
      : false;

  useEffect(() => {
    if (editNode) {
      setName(editNode.name);
      setPlanStart(editNode.planStartDate?.slice(0, 10) || "");
      setPlanEnd(editNode.planEndDate?.slice(0, 10) || "");
      setResponsibleIds(editNode.responsibleIds || []);
    } else {
      setName("");
      setDisciplineId("");
      setPlanStart("");
      setPlanEnd("");
      setResponsibleIds([]);
    }
    setRespOpen(false);
    setRespSearch("");
  }, [editNode, open]);

  // L3 选择专业后，自动填充名称
  useEffect(() => {
    if (level === 3 && mode === "create" && disciplineId) {
      const d = disciplines.find((x) => x.id === disciplineId);
      if (d) setName(d.name);
    }
  }, [disciplineId, level, mode, disciplines]);

  // 点击外部关闭责任人下拉
  useEffect(() => {
    if (!respOpen) return;
    const handler = (e: MouseEvent) => {
      if (respContainerRef.current && !respContainerRef.current.contains(e.target as Node)) {
        setRespOpen(false);
        setRespSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [respOpen]);

  // 加载用户列表
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/users?pageSize=500");
      if (!res.ok) { setUsers([]); return; }
      const data = await res.json();
      setUsers(data.data || []);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const currentResponsible = responsibleIds.length > 0
    ? users.filter((u) => responsibleIds.includes(u.id))
    : [];

  if (!open) return null;

  const isLevel3 = level === 3;
  const isLevel4 = level === 4;
  const isProcurementTask = isProcurement;
  // 需要显示责任人字段：L4 / 采购L3 / 编辑模式下的L4或采购L3
  const showResponsible = isLevel4 || level === 3;

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
        if (isLevel4 || (level === 3 && isProcurementTask)) {
          body.planStartDate = planStart || null;
          body.planEndDate = planEnd || null;
        }
        if (showResponsible) {
          body.responsibleIds = responsibleIds;
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
        if (showResponsible) {
          body.responsibleIds = responsibleIds;
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
    borderRadius: 0, fontSize: 14,
  };

  const filteredUsers = respSearch.trim()
    ? users.filter((u) => pinyinMatch(respSearch, u.realName))
    : users;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{ background: "#fff", borderRadius: 0, padding: 24, width: 420 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>
          {mode === "edit"
            ? "编辑节点"
            : isProcurementTask
              ? "添加采购任务"
              : `添加${level === 2 ? "子项" : level === 3 ? "专业" : "任务"}`}
        </h3>
        {isProcurementTask && (
          <div style={{ marginBottom: 12, fontSize: 12, color: "#8C95A3", background: "#FAFBFC", padding: "8px 12px", border: "1px solid #EBEEF2" }}>
            采购任务无专业选择（采购体系为 3 级结构，无需关联专业字典）
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            名称
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLevel3}
            style={{ ...inputStyle, background: isLevel3 ? "#F8F9FB" : "#fff" }}
          />
          {isLevel3 && mode === "create" && (
            <div style={{ fontSize: 11, color: "#8C95A3", marginTop: 4 }}>
              名称由所选专业自动填充，创建后不可修改
            </div>
          )}
        </div>
        {isLevel3 && mode === "create" && !isProcurementTask && (
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
        {(isLevel4 || (level === 3 && isProcurementTask)) && (
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
        {/* 责任人字段 */}
        {showResponsible && (
          <div style={{ marginBottom: 16 }} ref={respContainerRef}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              责任人
            </label>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => {
                  if (!respOpen) { setRespSearch(""); loadUsers(); }
                  setRespOpen(!respOpen);
                }}
                style={{
                  width: "100%", padding: "8px 12px", border: "1px solid #D6D3D1",
                  borderRadius: 0, fontSize: 14, textAlign: "left",
                  background: "#fff", cursor: "pointer",
                  color: currentResponsible ? "#1C1917" : "#A8A29E",
                }}
              >
                {currentResponsible.length > 0
                  ? currentResponsible.length <= 2
                    ? currentResponsible.map((u) => u.realName).join("、")
                    : `已选 ${currentResponsible.length} 人`
                  : "请选择责任人"}
              </button>
              {respOpen && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 60,
                  marginTop: 4, background: "#fff", border: "1px solid #D6D3D1",
                  maxHeight: 220, overflowY: "auto",
                }}>
                  <div style={{ padding: 8, borderBottom: "1px solid #EBEEF2" }}>
                    <input
                      ref={respInputRef}
                      type="text"
                      value={respSearch}
                      onChange={(e) => setRespSearch(e.target.value)}
                      placeholder="搜索姓名（支持拼音首字母）..."
                      style={{ width: "100%", padding: "6px 8px", border: "1px solid #D6D3D1", fontSize: 13 }}
                    />
                  </div>
                  {usersLoading && (
                    <div style={{ padding: "8px 12px", fontSize: 13, color: "#A8A29E" }}>加载中...</div>
                  )}
                  {!usersLoading && filteredUsers.length === 0 && (
                    <div style={{ padding: "8px 12px", fontSize: 13, color: "#A8A29E" }}>无匹配用户</div>
                  )}
                  {!usersLoading && filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setResponsibleIds((prev) =>
                          prev.includes(u.id)
                            ? prev.filter((id) => id !== u.id)
                            : [...prev, u.id]
                        );
                      }}
                      style={{
                        display: "block", width: "100%", padding: "8px 12px",
                        border: "none", background: responsibleIds.includes(u.id) ? "#F5F5F4" : "transparent",
                        cursor: "pointer", fontSize: 13, textAlign: "left",
                        color: "#1C1917",
                      }}
                    >
                      {responsibleIds.includes(u.id) && <span style={{ marginRight: 8, color: "#4A6FA5" }}>✓</span>}
                      {u.realName}
                    </button>
                  ))}
                  {responsibleIds.length > 0 && (
                    <div style={{ borderTop: "1px solid #EBEEF2", padding: "8px 12px" }}>
                      <button
                        type="button"
                        onClick={() => { setResponsibleIds([]); setRespOpen(false); }}
                        style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "#DC2626" }}
                      >
                        清除责任人
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px", borderRadius: 0, border: "1px solid #D6D3D1",
              background: "#fff", cursor: "pointer",
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            style={{
              padding: "8px 20px", borderRadius: 0, border: "none",
              background: "#4A6FA5", color: "#fff", cursor: "pointer", fontWeight: 500,
            }}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

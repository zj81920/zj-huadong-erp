"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { pinyinMatch } from "@/lib/pinyin-utils";

interface User {
  id: string;
  realName: string;
  username: string;
}

interface Props {
  nodeId: string;
  projectSourceId: string;
  currentResponsible: { id: string; realName: string } | null;
  onChanged: () => void;
}

export default function ResponsibleSelect({
  nodeId,
  projectSourceId,
  currentResponsible,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 加载用户列表
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users?pageSize=500");
      if (!res.ok) {
        console.error("加载用户列表失败:", res.status, res.statusText);
        setUsers([]);
        return;
      }
      const data = await res.json();
      setUsers(data.data || []);
    } catch (err) {
      console.error("加载用户列表异常:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 打开面板时加载用户
  const handleOpen = () => {
    if (!open) {
      setSearch("");
      loadUsers();
    }
    setOpen(!open);
  };

  // 聚焦搜索框
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // 选择责任人
  const handleSelect = async (userId: string) => {
    setSaving(true);
    try {
      await fetch(
        `/api/projects/plans/${projectSourceId}/nodes/${nodeId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responsibleId: userId }),
        }
      );
      onChanged();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
      setOpen(false);
      setSearch("");
    }
  };

  // 清除责任人
  const handleClear = async () => {
    setSaving(true);
    try {
      await fetch(
        `/api/projects/plans/${projectSourceId}/nodes/${nodeId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responsibleId: null }),
        }
      );
      onChanged();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
      setOpen(false);
      setSearch("");
    }
  };

  // 过滤用户
  const filtered = search.trim()
    ? users.filter((u) => pinyinMatch(search, u.realName))
    : users;

  const label = currentResponsible?.realName || "—";

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      {/* 触发器 */}
      <button
        onClick={handleOpen}
        disabled={saving}
        style={{
          border: "1px solid transparent",
          background: open ? "#F5F5F4" : "transparent",
          color: currentResponsible ? "#1C1917" : "#A8A29E",
          fontSize: 12,
          padding: "2px 6px",
          borderRadius: 4,
          cursor: "pointer",
          minWidth: 60,
          textAlign: "left",
          transition: "all 0.15s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          if (!open) (e.currentTarget as HTMLButtonElement).style.borderColor = "#D6D3D1";
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
        }}
        title={saving ? "保存中..." : "点击更换负责人"}
      >
        {saving ? "..." : label}
      </button>

      {/* 下拉面板 */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 60,
            marginTop: 4,
            width: 220,
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
            border: "1px solid #E7E5E4",
            overflow: "hidden",
          }}
        >
          {/* 搜索框 */}
          <div style={{ padding: 8 }}>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索姓名（支持拼音首字母）..."
              style={{
                width: "100%",
                padding: "6px 10px",
                border: "1px solid #D6D3D1",
                borderRadius: 6,
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#78716C")}
              onBlur={(e) => (e.target.style.borderColor = "#D6D3D1")}
            />
          </div>

          {/* 用户列表 */}
          <div
            style={{
              maxHeight: 200,
              overflowY: "auto",
              borderTop: "1px solid #F5F5F4",
            }}
          >
            {loading && (
              <div style={{ padding: "10px 12px", fontSize: 13, color: "#A8A29E" }}>
                加载中...
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div style={{ padding: "10px 12px", fontSize: 13, color: "#A8A29E" }}>
                无匹配用户
              </div>
            )}

            {!loading &&
              filtered.map((user) => {
                const isSelected = currentResponsible?.id === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => handleSelect(user.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "8px 12px",
                      border: "none",
                      background: isSelected ? "#F5F5F4" : "transparent",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#1C1917",
                      textAlign: "left",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLButtonElement).style.background = "#FAFAF9";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    }}
                  >
                    {user.realName}
                  </button>
                );
              })}
          </div>

          {/* 底部清除按钮 */}
          {currentResponsible && (
            <div style={{ borderTop: "1px solid #F5F5F4" }}>
              <button
                onClick={handleClear}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "#DC2626",
                  textAlign: "left",
                }}
              >
                清除负责人
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

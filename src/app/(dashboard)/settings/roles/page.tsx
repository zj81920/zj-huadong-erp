"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Shield,
  Plus,
  Trash2,
  Users,
  Search,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  departmentName: string | null;
  modulePermissions: string;
  level: number;
  updatedAt: string;
  userCount: number;
}

const MODULE_OPTIONS = [
  { key: "business", label: "商务管理" },
  { key: "projects", label: "项目管理" },
  { key: "procurement", label: "项目采购" },
  { key: "contracts", label: "合同管理" },
  { key: "finance", label: "财务管理" },
  { key: "hr", label: "人事行政" },
  { key: "settings", label: "系统设置" },
];

const DEFAULT_ROLES: { name: string; level: number }[] = [
  { name: "部门负责人", level: 1 },
  { name: "项目经理", level: 2 },
  { name: "项目管理部", level: 3 },
  { name: "行政", level: 4 },
  { name: "采购部", level: 5 },
  { name: "设计负责人/生产经理", level: 6 },
  { name: "财务", level: 7 },
  { name: "出纳", level: 8 },
  { name: "副总经理", level: 9 },
  { name: "总经理", level: 10 },
  { name: "董事长", level: 11 },
];

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/roles");
      if (res.ok) {
        const json = await res.json();
        setRoles(json.data);
      }
    } catch {
      console.error("获取角色列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleInitDefaults = async () => {
    setSaving(true);
    try {
      for (const role of DEFAULT_ROLES) {
        await fetch("/api/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(role),
        });
      }
      setToast({ type: "success", text: "默认角色初始化成功" });
      fetchRoles();
    } catch {
      setToast({ type: "error", text: "初始化默认角色失败" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/roles/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        setToast({ type: "success", text: "角色删除成功" });
        fetchRoles();
      } else {
        const json = await res.json();
        setDeleteError(json.error || "删除失败");
      }
    } catch {
      setDeleteError("网络错误，请重试");
    } finally {
      setDeleting(false);
    }
  };

  const filteredRoles = roles.filter((role) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      role.name.toLowerCase().includes(q) ||
      (role.description && role.description.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#1C1917]" />
            </div>
            <div>
              <h1>角色设置</h1>
              <p>管理审批流程中的角色，角色用于流程节点配置</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {roles.length === 0 && (
              <button
                className="ios-btn ios-btn-secondary gap-1.5"
                onClick={handleInitDefaults}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                初始化默认角色
              </button>
            )}
            <Link href="/settings/roles/new" className="ios-btn ios-btn-primary">
              <Plus className="w-4 h-4" />
              新增角色
            </Link>
          </div>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索角色名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="ml-auto text-[13px] text-[#78716C]">
            共 <span className="font-semibold text-[#1C1917]">{roles.length}</span> 个角色
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : roles.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <Shield className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>暂无角色，点击「初始化默认角色」快速创建</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRoles.map((role) => {
                const modules = (() => {
                  try {
                    return typeof role.modulePermissions === "string"
                      ? JSON.parse(role.modulePermissions || "{}")
                      : role.modulePermissions || {};
                  } catch { return {}; }
                })() as Record<string, unknown>;
                const moduleKeys = Object.keys(modules);
                const isAdmin = role.code === "admin";

                return (
                  <div
                    key={role.id}
                    className={`rounded-2xl border border-[#F5F5F4] p-5 transition-all duration-150 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${isAdmin ? "bg-[#FAFAF9]" : "bg-white"}`}
                  >
                    {/* 头部：等级圆圈 + 名称 + 编辑 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[14px] font-semibold text-[#1C1917]">{role.level}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] font-semibold text-[#1C1917]">{role.name}</span>
                            {isAdmin && (
                              <span className="text-[11px] bg-[#E7E5E4] rounded-md px-1.5 py-0.5 text-[#78716C] font-medium">
                                系统内定
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-[#78716C] mt-0.5">
                            {role.departmentName || "无部门"} · 等级 {role.level}
                          </p>
                        </div>
                      </div>
                      {!isAdmin && (
                        <Link
                          href={`/settings/roles/${role.id}`}
                          className="text-[12px] bg-[#F5F5F4] rounded-lg px-3 py-1.5 hover:bg-[#E7E5E4] transition-colors duration-150"
                        >
                          编辑
                        </Link>
                      )}
                    </div>

                    {/* 权限模块标签 */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {moduleKeys.slice(0, 3).map((key) => {
                        const modOption = MODULE_OPTIONS.find((m) => m.key === key);
                        return (
                          <span
                            key={key}
                            className="text-[11px] bg-[#F5F5F4] rounded-md px-2 py-1 text-[#78716C] font-medium"
                          >
                            {modOption?.label || key}
                          </span>
                        );
                      })}
                      {moduleKeys.length > 3 && (
                        <span className="text-[11px] bg-[#F5F5F4] rounded-md px-2 py-1 text-[#78716C] font-medium">
                          +{moduleKeys.length - 3} 模块
                        </span>
                      )}
                      {moduleKeys.length === 0 && (
                        <span className="text-[12px] text-[#78716C]">暂无权限模块</span>
                      )}
                    </div>

                    {/* 底部：用户数 + 修改时间 */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#F5F5F4]">
                      <span className="text-[12px] text-[#78716C] flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {role.userCount} 位用户
                      </span>
                      <span className="text-[12px] text-[#78716C]">
                        {formatDate(role.updatedAt)}
                      </span>
                    </div>

                    {/* 非admin、非finance角色显示删除按钮 */}
                    {!isAdmin && role.code !== "finance" && (
                      <div className="mt-3 pt-2 border-t border-[#F5F5F4]/60">
                        <button
                          className="text-[12px] text-[#78716C] hover:text-[#1C1917] transition-colors duration-150 flex items-center gap-1"
                          onClick={() => {
                            setDeleteConfirm(role);
                            setDeleteError("");
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredRoles.length === 0 && search && (
              <div className="empty-state">
                <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
                  <Search className="w-8 h-8 text-[#78716C]" />
                </div>
                <p>没有匹配「{search}」的角色</p>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => {
          setDeleteConfirm(null);
          setDeleteError("");
        }}
        title="确认删除"
        maxWidth="420px"
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#78716C]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#78716C]" />
          </div>
          <p className="text-[15px] text-[#1C1917] mb-1">
            确定要删除角色 <span className="font-semibold">{deleteConfirm?.name}</span> 吗？
          </p>
          {deleteConfirm && deleteConfirm.userCount > 0 && (
            <p className="text-[13px] text-[#78716C] mb-2">
              该角色下有 {deleteConfirm.userCount} 位关联用户，删除后将解除关联
            </p>
          )}
          <p className="text-[13px] text-[#78716C] mb-2">此操作不可撤销</p>

          {deleteError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium flex items-center gap-2 justify-center mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {deleteError}
            </div>
          )}

          <div className="flex justify-center gap-3">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => {
                setDeleteConfirm(null);
                setDeleteError("");
              }}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-[14px] font-semibold backdrop-blur-xl transition-all duration-300 ${
            toast.type === "success"
              ? "bg-[#78716C]/90 text-white"
              : "bg-[#78716C]/90 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast.text}
        </div>
      )}
    </>
  );
}

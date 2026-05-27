"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Users,
  Search,
  Loader2,
  AlertCircle,
  Check,
  Link2,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isProjectRole: boolean;
  sort: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userCount: number;
}

interface RoleFormData {
  code: string;
  name: string;
  description: string;
  isProjectRole: boolean;
  sort: number;
}

const DEFAULT_ROLES: Omit<RoleFormData, "description">[] = [
  { code: "initiator", name: "经办人", isProjectRole: false, sort: 1 },
  { code: "dept_head", name: "部门负责人", isProjectRole: false, sort: 2 },
  { code: "project_manager", name: "项目经理", isProjectRole: true, sort: 3 },
  { code: "pmo", name: "项目管理部", isProjectRole: false, sort: 4 },
  { code: "admin", name: "行政", isProjectRole: false, sort: 5 },
  { code: "procurement", name: "采购部", isProjectRole: false, sort: 6 },
  { code: "production", name: "设计负责人/生产经理", isProjectRole: true, sort: 7 },
  { code: "finance", name: "财务", isProjectRole: false, sort: 8 },
  { code: "cashier", name: "出纳", isProjectRole: false, sort: 9 },
  { code: "vice_gm", name: "副总经理", isProjectRole: false, sort: 10 },
  { code: "gm", name: "总经理", isProjectRole: false, sort: 11 },
  { code: "chairman", name: "董事长", isProjectRole: false, sort: 12 },
];

const emptyForm: RoleFormData = {
  code: "",
  name: "",
  description: "",
  isProjectRole: false,
  sort: 0,
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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

  const handleOpenCreate = () => {
    setEditingRole(null);
    setForm({ ...emptyForm, sort: roles.length + 1 });
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (role: Role) => {
    setEditingRole(role);
    setForm({
      code: role.code,
      name: role.name,
      description: role.description || "",
      isProjectRole: role.isProjectRole,
      sort: role.sort,
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.code.trim()) {
      setFormError("角色编码不能为空");
      return;
    }
    if (!form.name.trim()) {
      setFormError("角色名称不能为空");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        isProjectRole: form.isProjectRole,
        sort: form.sort,
      };

      const url = editingRole
        ? `/api/roles/${editingRole.id}`
        : "/api/roles";
      const method = editingRole ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        setToast({ type: "success", text: editingRole ? "角色更新成功" : "角色创建成功" });
        fetchRoles();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误，请重试");
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
      role.code.toLowerCase().includes(q) ||
      role.name.toLowerCase().includes(q) ||
      (role.description && role.description.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#007AFF]" />
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
            <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4" />
              新增角色
            </button>
          </div>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索角色编码、名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="ml-auto text-[13px] text-[#86868B]">
            共 <span className="font-semibold text-[#1D1D1F]">{roles.length}</span> 个角色
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : roles.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
              <Shield className="w-8 h-8 text-[#86868B]" />
            </div>
            <p>暂无角色，点击「初始化默认角色」快速创建</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>排序</th>
                  <th>角色编码</th>
                  <th>角色名称</th>
                  <th>描述</th>
                  <th>属性</th>
                  <th>用户数</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((role) => (
                  <tr key={role.id}>
                    <td className="text-center">
                      <span className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-[#F5F5F7] text-[13px] font-semibold text-[#86868B]">
                        {role.sort}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-[13px] font-semibold text-[#007AFF]">
                        {role.code}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                          <Shield className="w-4 h-4 text-[#007AFF]" />
                        </div>
                        <span className="font-semibold">{role.name}</span>
                      </div>
                    </td>
                    <td className="text-[#86868B] max-w-[200px] truncate">
                      {role.description || "-"}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {role.isProjectRole && (
                          <span className="ios-badge ios-badge-blue gap-1">
                            <Link2 className="w-3 h-3" />
                            项目关联
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="ios-badge ios-badge-gray gap-1">
                        <Users className="w-3 h-3" />
                        {role.userCount}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenEdit(role)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                          onClick={() => {
                            setDeleteConfirm(role);
                            setDeleteError("");
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredRoles.length === 0 && search && (
              <div className="empty-state">
                <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
                  <Search className="w-8 h-8 text-[#86868B]" />
                </div>
                <p>没有匹配「{search}」的角色</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingRole ? "编辑角色" : "新增角色"}
        maxWidth="520px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {formError}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
              角色编码 <span className="text-[#FF3B30]">*</span>
            </label>
            <input
              type="text"
              className="ios-input font-mono"
              placeholder="如：dept_head"
              value={form.code}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, code: e.target.value }));
                if (formError) setFormError("");
              }}
              disabled={!!editingRole}
            />
            {editingRole && (
              <p className="text-[12px] text-[#86868B] mt-1">角色编码创建后不可修改</p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
              角色名称 <span className="text-[#FF3B30]">*</span>
            </label>
            <input
              type="text"
              className="ios-input"
              placeholder="如：部门负责人"
              value={form.name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                if (formError) setFormError("");
              }}
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
              描述
            </label>
            <textarea
              className="ios-textarea"
              placeholder="角色描述（选填）"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-[#F5F5F7]">
            <div>
              <p className="text-[14px] font-semibold text-[#1D1D1F]">项目关联角色</p>
              <p className="text-[12px] text-[#86868B] mt-0.5">开启后该角色将关联项目维度</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.isProjectRole}
              onClick={() => setForm((prev) => ({ ...prev, isProjectRole: !prev.isProjectRole }))}
              className={`relative inline-flex h-[30px] w-[51px] flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out ${
                form.isProjectRole ? "bg-[#007AFF]" : "bg-[#E5E5EA]"
              }`}
            >
              <span
                className={`inline-block h-[26px] w-[26px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                  form.isProjectRole ? "translate-x-[23px]" : "translate-x-[1px]"
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
              排序
            </label>
            <input
              type="number"
              className="ios-input w-[120px]"
              placeholder="0"
              value={form.sort}
              onChange={(e) => setForm((prev) => ({ ...prev, sort: parseInt(e.target.value) || 0 }))}
              min={0}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowModal(false)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "保存中..." : editingRole ? "保存修改" : "创建角色"}
            </button>
          </div>
        </div>
      </Modal>

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
          <div className="w-14 h-14 rounded-full bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#FF3B30]" />
          </div>
          <p className="text-[15px] text-[#1D1D1F] mb-1">
            确定要删除角色 <span className="font-semibold">{deleteConfirm?.name}</span> 吗？
          </p>
          {deleteConfirm && deleteConfirm.userCount > 0 && (
            <p className="text-[13px] text-[#FF9500] mb-2">
              该角色下有 {deleteConfirm.userCount} 位关联用户，删除后将解除关联
            </p>
          )}
          <p className="text-[13px] text-[#86868B] mb-2">此操作不可撤销</p>

          {deleteError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium flex items-center gap-2 justify-center mb-4">
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
              ? "bg-[#34C759]/90 text-white"
              : "bg-[#FF3B30]/90 text-white"
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

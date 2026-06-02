"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Department {
  id: string;
  name: string;
  sort: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  roleCount: number;
}

interface DeptFormData {
  name: string;
  sort: number;
}

const emptyForm: DeptFormData = {
  name: "",
  sort: 0,
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [form, setForm] = useState<DeptFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/departments");
      if (res.ok) {
        const json = await res.json();
        setDepartments(json.data);
      }
    } catch {
      console.error("获取部门列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleOpenCreate = () => {
    setEditingDept(null);
    setForm({ ...emptyForm, sort: departments.length + 1 });
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setForm({
      name: dept.name,
      sort: dept.sort,
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError("部门名称不能为空");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        name: form.name.trim(),
        sort: form.sort,
      };

      const url = editingDept
        ? `/api/departments/${editingDept.id}`
        : "/api/departments";
      const method = editingDept ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        setToast({ type: "success", text: editingDept ? "部门更新成功" : "部门创建成功" });
        fetchDepartments();
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
      const res = await fetch(`/api/departments/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        setToast({ type: "success", text: "部门删除成功" });
        fetchDepartments();
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

  const filteredDepts = departments.filter((dept) => {
    if (!search) return true;
    return dept.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#007AFF]" />
            </div>
            <div>
              <h1>部门设置</h1>
              <p>管理部门信息，用于角色关联和人员组织</p>
            </div>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增部门
          </button>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索部门名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="ml-auto text-[13px] text-[#86868B]">
            共 <span className="font-semibold text-[#1D1D1F]">{departments.length}</span> 个部门
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : departments.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
              <Building2 className="w-8 h-8 text-[#86868B]" />
            </div>
            <p>暂无部门，点击「新增部门」创建</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>排序</th>
                  <th>部门名称</th>
                  <th>关联角色数</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {filteredDepts.map((dept) => (
                  <tr key={dept.id}>
                    <td className="text-center">
                      <span className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-[#F5F5F7] text-[13px] font-semibold text-[#86868B]">
                        {dept.sort}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-[#007AFF]" />
                        </div>
                        <span className="font-semibold">{dept.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-[13px] text-[#86868B]">
                        {dept.roleCount} 个角色
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenEdit(dept)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                          onClick={() => {
                            setDeleteConfirm(dept);
                            setDeleteError("");
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          删除
                        </button>
                      </div>
                    </td>
                    <td className="text-[#86868B] text-[12px] whitespace-nowrap">
                      {dept.lastModifiedBy && (
                        <span>{dept.lastModifiedBy}</span>
                      )}
                      <span className="block text-[11px]">{formatDate(dept.updatedAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredDepts.length === 0 && search && (
              <div className="empty-state">
                <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
                  <Search className="w-8 h-8 text-[#86868B]" />
                </div>
                <p>没有匹配「{search}」的部门</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingDept ? "编辑部门" : "新增部门"}
        maxWidth="480px"
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
              部门名称 <span className="text-[#FF3B30]">*</span>
            </label>
            <input
              type="text"
              className="ios-input"
              placeholder="如：项目管理部"
              value={form.name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                if (formError) setFormError("");
              }}
            />
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
              {saving ? "保存中..." : editingDept ? "保存修改" : "创建部门"}
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
            确定要删除部门 <span className="font-semibold">{deleteConfirm?.name}</span> 吗？
          </p>
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

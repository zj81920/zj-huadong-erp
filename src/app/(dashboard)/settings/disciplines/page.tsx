"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertCircle,
  Check,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Discipline {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DisciplineFormData {
  code: string;
  name: string;
  sortOrder: number;
}

const emptyForm: DisciplineFormData = {
  code: "",
  name: "",
  sortOrder: 0,
};

export default function DisciplinesPage() {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Discipline | null>(null);
  const [form, setForm] = useState<DisciplineFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<Discipline | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchDisciplines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/disciplines");
      if (res.ok) {
        const json = await res.json();
        setDisciplines(json.data);
      }
    } catch {
      console.error("获取专业字典失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisciplines();
  }, [fetchDisciplines]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm({ ...emptyForm, sortOrder: disciplines.length + 1 });
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (item: Discipline) => {
    setEditingItem(item);
    setForm({
      code: item.code,
      name: item.name,
      sortOrder: item.sortOrder,
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.code.trim()) {
      setFormError("专业编码不能为空");
      return;
    }
    if (!form.name.trim()) {
      setFormError("专业名称不能为空");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        sortOrder: form.sortOrder,
      };

      const url = editingItem
        ? `/api/settings/disciplines/${editingItem.id}`
        : "/api/settings/disciplines";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        setToast({ type: "success", text: editingItem ? "专业更新成功" : "专业创建成功" });
        fetchDisciplines();
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
      const res = await fetch(`/api/settings/disciplines/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        setToast({ type: "success", text: "专业删除成功" });
        fetchDisciplines();
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

  const filteredItems = disciplines.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#1C1917]" />
            </div>
            <div>
              <h1>专业字典</h1>
              <p>管理专业分类信息，用于项目设计任务等业务</p>
            </div>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增专业
          </button>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索编码或名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="ml-auto text-[13px] text-[#78716C]">
            共 <span className="font-semibold text-[#1C1917]">{disciplines.length}</span> 个专业
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : disciplines.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>暂无专业，点击「新增专业」创建</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>排序</th>
                  <th>专业编码</th>
                  <th>专业名称</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="text-center">
                      <span className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-[#FAFAF9] text-[13px] font-semibold text-[#78716C]">
                        {item.sortOrder}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-[13px] text-[#78716C]">{item.code}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-4 h-4 text-[#1C1917]" />
                        </div>
                        <span className="font-semibold">{item.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                          onClick={() => {
                            setDeleteConfirm(item);
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

            {filteredItems.length === 0 && search && (
              <div className="empty-state">
                <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
                  <Search className="w-8 h-8 text-[#78716C]" />
                </div>
                <p>没有匹配「{search}」的专业</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? "编辑专业" : "新增专业"}
        maxWidth="480px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {formError}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              专业编码 <span className="text-[#78716C]">*</span>
            </label>
            <input
              type="text"
              className="ios-input"
              placeholder="如：ARCH"
              value={form.code}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, code: e.target.value }));
                if (formError) setFormError("");
              }}
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              专业名称 <span className="text-[#78716C]">*</span>
            </label>
            <input
              type="text"
              className="ios-input"
              placeholder="如：建筑"
              value={form.name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                if (formError) setFormError("");
              }}
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              排序
            </label>
            <input
              type="number"
              className="ios-input w-[120px]"
              placeholder="0"
              value={form.sortOrder}
              onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
              min={0}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
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
              {saving ? "保存中..." : editingItem ? "保存修改" : "创建专业"}
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
          <div className="w-14 h-14 rounded-full bg-[#78716C]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#78716C]" />
          </div>
          <p className="text-[15px] text-[#1C1917] mb-1">
            确定要删除专业 <span className="font-semibold">{deleteConfirm?.name}</span>（{deleteConfirm?.code}）吗？
          </p>
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

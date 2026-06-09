"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Users,
  Loader2,
} from "lucide-react";
import Modal from "@/components/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { getUserModulePerms, canEditFrontend, canDeleteFrontend } from "@/lib/types/permissions";

// 股东数据类型
interface Shareholder {
  id: string;
  name: string;
  idNumber: string | null;
  shareRatio: number | null;
  contactPhone: string | null;
  createdAt: string;
}

// 表单数据类型
interface ShareholderFormData {
  name: string;
  idNumber: string;
  shareRatio: string;
  contactPhone: string;
}

const emptyForm: ShareholderFormData = {
  name: "",
  idNumber: "",
  shareRatio: "",
  contactPhone: "",
};

export default function ShareholdersPage() {
  const { user } = useAuth();
  const isAdminUser =
    user?.username === "admin" ||
    user?.roles?.some((r: any) => r.code === "admin") ||
    false;
  const rolePerms = getUserModulePerms(user, "shareholder");

  // 列表数据
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // 搜索
  const [search, setSearch] = useState("");

  // 新增/编辑弹窗
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Shareholder | null>(null);
  const [form, setForm] = useState<ShareholderFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // 删除确认弹窗
  const [deleteConfirm, setDeleteConfirm] = useState<Shareholder | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 获取股东列表
  const fetchShareholders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("pageSize", "100");

      const res = await fetch(`/api/shareholders?${params}`);
      const json = await res.json();

      if (res.ok) {
        setShareholders(json.data || []);
        setTotal(json.pagination?.total ?? (json.data || []).length);
      }
    } catch (err) {
      console.error("获取股东列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchShareholders();
  }, [fetchShareholders]);

  // 打开新增弹窗
  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  // 打开编辑弹窗
  const handleOpenEdit = (item: Shareholder) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      idNumber: item.idNumber || "",
      shareRatio: item.shareRatio !== null ? String(item.shareRatio) : "",
      contactPhone: item.contactPhone || "",
    });
    setFormError("");
    setShowModal(true);
  };

  // 提交表单（新增/编辑）
  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError("股东名称不能为空");
      return;
    }

    // 持股比例范围校验
    if (form.shareRatio) {
      const ratio = parseFloat(form.shareRatio);
      if (isNaN(ratio) || ratio < 0 || ratio > 100) {
        setFormError("持股比例必须在 0-100 之间");
        return;
      }
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        name: form.name.trim(),
        idNumber: form.idNumber.trim() || null,
        shareRatio: form.shareRatio ? parseFloat(form.shareRatio) : null,
        contactPhone: form.contactPhone.trim() || null,
      };

      const url = editingItem
        ? `/api/shareholders/${editingItem.id}`
        : "/api/shareholders";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchShareholders();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  // 删除
  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/shareholders/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        fetchShareholders();
      } else {
        const json = await res.json();
        alert(json.error || "删除失败");
        setDeleteConfirm(null);
      }
    } catch {
      alert("网络错误，请重试");
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  // 更新表单字段
  const updateForm = (field: keyof ShareholderFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <>
      {/* 页面头部 */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>股东管理</h1>
            <p>管理公司股东信息及持股比例</p>
          </div>
          {canEditFrontend(false, rolePerms, "", user?.id ?? "", null, isAdminUser) && (
            <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4" />
              新增股东
            </button>
          )}
        </div>
      </div>

      {/* 列表区域 */}
      <div className="bento-card-static">
        {/* 搜索栏 */}
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索股东名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="ml-auto text-[13px] text-[#78716C]">
            共 <span className="font-semibold text-[#1C1917]">{total}</span> 条记录
          </div>
        </div>

        {/* 加载中 */}
        {loading ? (
          <div className="empty-state">
            <Loader2 className="w-10 h-10 text-[#78716C] animate-spin" />
            <p>加载中...</p>
          </div>
        ) : shareholders.length === 0 ? (
          /* 空状态 */
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <Users className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>{search ? "没有匹配的股东记录" : "暂无股东，点击右上角新增"}</p>
          </div>
        ) : (
          /* 表格 */
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>股东名称</th>
                  <th>身份证号</th>
                  <th>持股比例</th>
                  <th>联系电话</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {shareholders.map((item) => (
                  <tr key={item.id}>
                    {/* 股东名称（加粗） */}
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <Users className="w-4 h-4 text-[#1C1917]" />
                        </div>
                        <span className="font-semibold">{item.name}</span>
                      </div>
                    </td>

                    {/* 身份证号 */}
                    <td className="text-[#78716C]">
                      {item.idNumber || "-"}
                    </td>

                    {/* 持股比例（带进度条） */}
                    <td>
                      {item.shareRatio !== null ? (
                        <div className="flex items-center gap-2.5">
                          <span className="font-medium text-[#1C1917] min-w-[52px]">
                            {item.shareRatio.toFixed(2)}%
                          </span>
                          <div className="w-20 h-2 rounded-full bg-[#F5F5F4] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#1C1917] transition-all"
                              style={{ width: `${Math.min(item.shareRatio, 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#78716C]">-</span>
                      )}
                    </td>

                    {/* 联系电话 */}
                    <td className="text-[#78716C]">
                      {item.contactPhone || "-"}
                    </td>

                    {/* 操作 */}
                    <td>
                      <div className="flex items-center gap-1">
                        {canEditFrontend(false, rolePerms, "", user?.id ?? "", null, isAdminUser) && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            编辑
                          </button>
                        )}
                        {canDeleteFrontend(false, rolePerms, "", user?.id ?? "", null, isAdminUser) && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                            onClick={() => setDeleteConfirm(item)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 新增/编辑弹窗 */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? "编辑股东" : "新增股东"}
        maxWidth="520px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* 股东名称 */}
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                股东名称 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入股东名称"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
              />
            </div>

            {/* 身份证号 */}
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                身份证号
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入身份证号"
                value={form.idNumber}
                onChange={(e) => updateForm("idNumber", e.target.value)}
              />
            </div>

            {/* 持股比例 */}
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                持股比例 (%)
              </label>
              <input
                type="number"
                className="ios-input"
                placeholder="如 30.00"
                min="0"
                max="100"
                step="0.01"
                value={form.shareRatio}
                onChange={(e) => updateForm("shareRatio", e.target.value)}
              />
            </div>

            {/* 联系电话 */}
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                联系电话
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入联系电话"
                value={form.contactPhone}
                onChange={(e) => updateForm("contactPhone", e.target.value)}
              />
            </div>
          </div>

          {/* 底部按钮 */}
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
              {saving ? "保存中..." : editingItem ? "保存修改" : "创建股东"}
            </button>
          </div>
        </div>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="确认删除"
        maxWidth="400px"
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#78716C]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#78716C]" />
          </div>
          <p className="text-[15px] text-[#1C1917] mb-1">
            确定要删除股东 <span className="font-semibold">{deleteConfirm?.name}</span> 吗？
          </p>
          <p className="text-[13px] text-[#78716C] mb-6">此操作不可撤销</p>
          <div className="flex justify-center gap-3">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setDeleteConfirm(null)}
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
    </>
  );
}

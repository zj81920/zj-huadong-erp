"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Stamp,
  Eye,
  MapPin,
  FileText,
  User,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Seal {
  id: string;
  name: string;
  sealType: string;
  custodian: string | null;
  location: string | null;
  status: string;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
}

interface SealFormData {
  name: string;
  sealType: string;
  custodian: string;
  location: string;
  status: string;
  remark: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const emptyForm: SealFormData = {
  name: "",
  sealType: "",
  custodian: "",
  location: "",
  status: "在库",
  remark: "",
};

const sealTypeOptions = [
  { value: "公章", label: "公章" },
  { value: "财务章", label: "财务章" },
  { value: "合同章", label: "合同章" },
  { value: "法人章", label: "法人章" },
  { value: "项目章", label: "项目章" },
  { value: "其他", label: "其他" },
];

const statusOptions = [
  { value: "在库", label: "在库" },
  { value: "使用中", label: "使用中" },
  { value: "外借", label: "外借" },
  { value: "报废", label: "报废" },
];

const sealTypeColorMap: Record<string, string> = {
  公章: "ios-badge-red",
  财务章: "ios-badge-blue",
  合同章: "ios-badge-orange",
  法人章: "ios-badge-purple",
  项目章: "ios-badge-green",
  其他: "ios-badge-gray",
};

const statusColorMap: Record<string, string> = {
  在库: "ios-badge-green",
  使用中: "ios-badge-blue",
  外借: "ios-badge-orange",
  报废: "ios-badge-gray",
};

export default function SealsPage() {
  const [seals, setSeals] = useState<Seal[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterSealType, setFilterSealType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Seal | null>(null);
  const [form, setForm] = useState<SealFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [detailItem, setDetailItem] = useState<Seal | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Seal | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [users, setUsers] = useState<{id: string; username: string; realName: string}[]>([]);

  const fetchSeals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterSealType) params.set("sealType", filterSealType);
      if (filterStatus) params.set("status", filterStatus);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/seals?${params}`);
      const json = await res.json();

      if (res.ok) {
        setSeals(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取印章列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterSealType, filterStatus, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchSeals();
    fetch("/api/settings/users").then(res => res.json()).then(json => setUsers(json.data || []));
  }, [fetchSeals]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (item: Seal) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      sealType: item.sealType,
      custodian: item.custodian || "",
      location: item.location || "",
      status: item.status,
      remark: item.remark || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError("印章名称不能为空");
      return;
    }
    if (!form.sealType) {
      setFormError("印章类型不能为空");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        name: form.name.trim(),
        sealType: form.sealType,
        custodian: form.custodian.trim() || null,
        location: form.location.trim() || null,
        status: form.status || "在库",
        remark: form.remark.trim() || null,
      };

      const url = editingItem
        ? `/api/seals/${editingItem.id}`
        : "/api/seals";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchSeals();
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
    try {
      const res = await fetch(`/api/seals/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        fetchSeals();
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

  const updateForm = (field: keyof SealFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>印章管理</h1>
            <p>管理公司印章信息及使用状态</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增印章
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
              placeholder="搜索印章名称、保管人..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
          </div>

          <select
            className="ios-select w-[140px]"
            value={filterSealType}
            onChange={(e) => {
              setFilterSealType(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部类型</option>
            {sealTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            className="ios-select w-[140px]"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部状态</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div className="ml-auto text-[13px] text-[#78716C]">
            共 <span className="font-semibold text-[#1C1917]">{pagination.total}</span> 条记录
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : seals.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <Stamp className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>{search || filterSealType || filterStatus ? "没有匹配的印章记录" : "暂无印章，点击右上角新增"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>印章名称</th>
                  <th>类型</th>
                  <th>保管人</th>
                  <th>存放位置</th>
                  <th>状态</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {seals.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <Stamp className="w-4 h-4 text-[#1C1917]" />
                        </div>
                        <span className="font-semibold">{item.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`ios-badge ${sealTypeColorMap[item.sealType] || "ios-badge-gray"}`}>
                        {item.sealType}
                      </span>
                    </td>
                    <td>
                      {item.custodian ? (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#78716C]" />
                          <span>{users.find(u => u.id === item.custodian)?.realName || item.custodian}</span>
                        </div>
                      ) : (
                        <span className="text-[#78716C]">-</span>
                      )}
                    </td>
                    <td>
                      {item.location ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#78716C]" />
                          <span>{item.location}</span>
                        </div>
                      ) : (
                        <span className="text-[#78716C]">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`ios-badge ${statusColorMap[item.status] || "ios-badge-gray"}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => setDetailItem(item)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          详情
                        </button>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                          onClick={() => setDeleteConfirm(item)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          删除
                        </button>
                      </div>
                    </td>
                    <td className="text-[#78716C] text-[12px] whitespace-nowrap">
                      {item.lastModifiedBy && (
                        <span>{item.lastModifiedBy}</span>
                      )}
                      <span className="block text-[11px]">{formatDate(item.updatedAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-[#F5F5F4]">
                <button
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  上一页
                </button>
                <span className="text-[13px] text-[#78716C] px-3">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? "编辑印章" : "新增印章"}
        maxWidth="600px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                印章名称 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入印章名称"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                印章类型 <span className="text-[#78716C]">*</span>
              </label>
              <select
                className="ios-select"
                value={form.sealType}
                onChange={(e) => updateForm("sealType", e.target.value)}
              >
                <option value="">请选择</option>
                {sealTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">状态</label>
              <select
                className="ios-select"
                value={form.status}
                onChange={(e) => updateForm("status", e.target.value)}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">保管人</label>
              <select
                className="ios-select"
                value={form.custodian}
                onChange={(e) => updateForm("custodian", e.target.value)}
              >
                <option value="">请选择保管人</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.realName}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">存放位置</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="存放位置"
                  value={form.location}
                  onChange={(e) => updateForm("location", e.target.value)}
                />
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">备注</label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-3 w-4 h-4 text-[#78716C]" />
                <textarea
                  className="ios-input pl-10 min-h-[80px] resize-none"
                  placeholder="备注信息"
                  value={form.remark}
                  onChange={(e) => updateForm("remark", e.target.value)}
                />
              </div>
            </div>
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
              {saving ? "保存中..." : editingItem ? "保存修改" : "创建印章"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
        title="印章详情"
        maxWidth="500px"
      >
        {detailItem && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">印章名称</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{detailItem.name}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">类型</p>
                <p>
                  <span className={`ios-badge ${sealTypeColorMap[detailItem.sealType] || "ios-badge-gray"}`}>
                    {detailItem.sealType}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">保管人</p>
                <p className="text-[14px] text-[#1C1917]">{users.find(u => u.id === detailItem.custodian)?.realName || detailItem.custodian || "-"}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">存放位置</p>
                <p className="text-[14px] text-[#1C1917]">{detailItem.location || "-"}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">状态</p>
                <p>
                  <span className={`ios-badge ${statusColorMap[detailItem.status] || "ios-badge-gray"}`}>
                    {detailItem.status}
                  </span>
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[12px] text-[#78716C] mb-0.5">备注</p>
                <p className="text-[14px] text-[#1C1917]">{detailItem.remark || "-"}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">创建时间</p>
                <p className="text-[14px] text-[#1C1917]">{formatDate(detailItem.createdAt)}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">更新时间</p>
                <p className="text-[14px] text-[#1C1917]">{formatDate(detailItem.updatedAt)}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

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
            确定要删除印章 <span className="font-semibold">{deleteConfirm?.name}</span> 吗？
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

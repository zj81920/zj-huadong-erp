"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Building2,
  Phone,
  Mail,
  MapPin,
  Users,
  Upload,
  FileCheck,
  X,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Supplier {
  id: string;
  name: string;
  supplierType: string | null;
  status: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bankName: string | null;
  bankAccount: string | null;
  remark: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SupplierFormData {
  name: string;
  supplierType: string;
  status: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  bankName: string;
  bankAccount: string;
  remark: string;
  attachmentUrl: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const emptyForm: SupplierFormData = {
  name: "",
  supplierType: "",
  status: "当前有效",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  bankName: "",
  bankAccount: "",
  remark: "",
  attachmentUrl: "",
};

const supplierTypeColorMap: Record<string, string> = {
  企业: "ios-badge-blue",
  政府: "ios-badge-orange",
  银行: "ios-badge-green",
  税务: "ios-badge-purple",
  政务机构: "ios-badge-orange",
  个人: "ios-badge-gray",
};

const statusColorMap: Record<string, string> = {
  当前有效: "ios-badge-green",
  已失效: "ios-badge-gray",
};

const supplierTypeOptions = ["企业", "政府", "银行", "税务", "政务机构", "个人"];

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFileName, setUploadFileName] = useState("");

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterType) params.set("supplierType", filterType);
      if (filterStatus) params.set("status", filterStatus);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/suppliers?${params}`);
      const json = await res.json();

      if (res.ok) {
        setSuppliers(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取供应商列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterStatus, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setForm(emptyForm);
    setFormError("");
    setUploadFileName("");
    setShowModal(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      supplierType: supplier.supplierType || "",
      status: supplier.status || "当前有效",
      contactPerson: supplier.contactPerson || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      bankName: supplier.bankName || "",
      bankAccount: supplier.bankAccount || "",
      remark: supplier.remark || "",
      attachmentUrl: supplier.attachmentUrl || "",
    });
    setUploadFileName(supplier.attachmentUrl ? supplier.attachmentUrl.split("/").pop() || "" : "");
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError("供应商名称不能为空");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const url = editingSupplier
        ? `/api/suppliers/${editingSupplier.id}`
        : "/api/suppliers";
      const method = editingSupplier ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchSuppliers();
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
      const res = await fetch(`/api/suppliers/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        fetchSuppliers();
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

  const updateForm = (field: keyof SupplierFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setFormError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (res.ok) {
        setForm((prev) => ({ ...prev, attachmentUrl: json.url }));
        setUploadFileName(file.name);
      } else {
        setFormError(json.error || "上传失败");
      }
    } catch {
      setFormError("上传失败，请重试");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
            <h1>供应商管理</h1>
            <p>管理供应商信息，维护供应商档案</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增供应商
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
              placeholder="搜索供应商名称、联系人、电话..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
          </div>

          <select
            className="ios-select w-[140px]"
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部性质</option>
            {supplierTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
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
            <option value="当前有效">当前有效</option>
            <option value="已失效">已失效</option>
          </select>

          <div className="ml-auto text-[13px] text-[#86868B]">
            共 <span className="font-semibold text-[#1D1D1F]">{pagination.total}</span> 条记录
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
              <Users className="w-8 h-8 text-[#86868B]" />
            </div>
            <p>{search || filterType || filterStatus ? "没有匹配的供应商记录" : "暂无供应商，点击右上角新增"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>供应商名称</th>
                  <th>供应商性质</th>
                  <th>状态</th>
                  <th>联系人</th>
                  <th>电话</th>
                  <th>开户行</th>
                  <th>银行账号</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-[#007AFF]" />
                        </div>
                        <span className="font-semibold">{supplier.name}</span>
                      </div>
                    </td>
                    <td>
                      {supplier.supplierType ? (
                        <span className={`ios-badge ${supplierTypeColorMap[supplier.supplierType] || "ios-badge-gray"}`}>
                          {supplier.supplierType}
                        </span>
                      ) : (
                        <span className="text-[#86868B]">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`ios-badge ${statusColorMap[supplier.status || "当前有效"]}`}>
                        {supplier.status || "当前有效"}
                      </span>
                    </td>
                    <td>{supplier.contactPerson || "-"}</td>
                    <td>
                      {supplier.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-[#86868B]" />
                          {supplier.phone}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{supplier.bankName || "-"}</td>
                    <td>{supplier.bankAccount || "-"}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenEdit(supplier)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                          onClick={() => setDeleteConfirm(supplier)}
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

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-[#F0F0F0]">
                <button
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  上一页
                </button>
                <span className="text-[13px] text-[#86868B] px-3">
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
        title={editingSupplier ? "编辑供应商" : "新增供应商"}
        maxWidth="600px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                供应商名称 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入供应商名称"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">供应商性质</label>
              <select
                className="ios-select"
                value={form.supplierType}
                onChange={(e) => updateForm("supplierType", e.target.value)}
              >
                <option value="">请选择</option>
                {supplierTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">供应商状态</label>
              <select
                className="ios-select"
                value={form.status}
                onChange={(e) => updateForm("status", e.target.value)}
              >
                <option value="当前有效">当前有效</option>
                <option value="已失效">已失效</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">联系人</label>
              <div className="relative">
                <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="联系人姓名"
                  value={form.contactPerson}
                  onChange={(e) => updateForm("contactPerson", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">电话</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="联系电话"
                  value={form.phone}
                  onChange={(e) => updateForm("phone", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input
                  type="email"
                  className="ios-input pl-10"
                  placeholder="邮箱地址"
                  value={form.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">开户行信息</label>
              <input
                type="text"
                className="ios-input"
                placeholder="开户行名称"
                value={form.bankName}
                onChange={(e) => updateForm("bankName", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">开户行账号</label>
              <input
                type="text"
                className="ios-input"
                placeholder="银行账号"
                value={form.bankAccount}
                onChange={(e) => updateForm("bankAccount", e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">地址</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-[#86868B]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="供应商地址"
                  value={form.address}
                  onChange={(e) => updateForm("address", e.target.value)}
                />
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">备注</label>
              <textarea
                className="ios-input min-h-[80px] resize-none"
                placeholder="备注信息"
                value={form.remark}
                onChange={(e) => updateForm("remark", e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">供应商资料</label>
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.rar"
                  onChange={handleFileUpload}
                />
                {form.attachmentUrl ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0]">
                    <FileCheck className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
                    <span className="flex-1 text-[13px] text-[#1D1D1F] truncate">
                      {uploadFileName || "已上传文件"}
                    </span>
                    <button
                      type="button"
                      className="text-[#86868B] hover:text-[#FF3B30]"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, attachmentUrl: "" }));
                        setUploadFileName("");
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="ios-btn ios-btn-secondary w-full"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? "上传中..." : form.attachmentUrl ? "重新上传" : "选择文件上传"}
                </button>
                <p className="text-[12px] text-[#86868B]">
                  支持 PDF、Word、Excel、图片、压缩包，最大 10MB
                </p>
              </div>
            </div>
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
              {saving ? "保存中..." : editingSupplier ? "保存修改" : "创建供应商"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="确认删除"
        maxWidth="400px"
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#FF3B30]" />
          </div>
          <p className="text-[15px] text-[#1D1D1F] mb-1">
            确定要删除供应商 <span className="font-semibold">{deleteConfirm?.name}</span> 吗？
          </p>
          <p className="text-[13px] text-[#86868B] mb-6">此操作不可撤销</p>
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

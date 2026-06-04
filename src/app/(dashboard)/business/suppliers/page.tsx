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
  Send,
  Eye,
} from "lucide-react";
import Modal from "@/components/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { ApprovalTimeline } from "@/components/ApprovalComponents";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { BatchDeleteBar } from "@/components/BatchDeleteBar";
import { getUserModulePerms } from "@/lib/types/permissions";
import { canDeleteFrontend, canEditFrontend } from "@/lib/types/permissions";

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
  approvalStatus: string;
  approvalInstanceId?: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  createdById: string | null;
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

const approvalStatusConfig: Record<string, { color: string; label: string }> = {
  草稿: { color: "ios-badge-gray", label: "草稿" },
  审批中: { color: "ios-badge-orange", label: "审批中" },
  已批准: { color: "ios-badge-green", label: "已批准" },
  已驳回: { color: "ios-badge-red", label: "已驳回" },
};

const supplierTypeOptions = ["企业", "政府", "银行", "税务", "政务机构", "个人"];

export default function SuppliersPage() {
  const { user } = useAuth();
  const isAdminUser = user?.username === "admin" || user?.roles?.some((r: any) => r.code === "admin") || false;
  const rolePerms = getUserModulePerms(user, "supplier");
  const hasFlow = user?.moduleFlowStatus?.["supplier"] ?? false;

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
  const [filterApproval, setFilterApproval] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [approvalInstance, setApprovalInstance] = useState<any>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const {
    toggleSelect,
    selectAll,
    clearSelection,
    isAllSelected,
    selectedCount,
    isSelected,
  } = useBatchSelection(suppliers.map((s) => s.id));

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
      if (filterApproval) params.set("approvalStatus", filterApproval);
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
  }, [search, filterType, filterStatus, filterApproval, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const fetchApprovalInstance = useCallback(async (instanceId: string) => {
    setApprovalLoading(true);
    try {
      const res = await fetch(`/api/approval-instances/${instanceId}`);
      if (res.ok) {
        const json = await res.json();
        setApprovalInstance(json.data);
      } else {
        setApprovalInstance(null);
      }
    } catch {
      setApprovalInstance(null);
    } finally {
      setApprovalLoading(false);
    }
  }, []);

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
    if (!canDeleteFrontend(hasFlow, rolePerms, deleteConfirm.approvalStatus, user?.id ?? "", deleteConfirm.createdById ?? null, isAdminUser)) {
      alert("无权删除该记录");
      setDeleteConfirm(null);
      return;
    }

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

  const handleSubmitApproval = async (supplierId: string) => {
    setSubmittingId(supplierId);
    try {
      const res = await fetch("/api/approval-instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: "supplier",
          businessId: supplierId,
          flowLevel: "common",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        const instanceId = json.data.instanceId;
        const supplier = suppliers.find((s) => s.id === supplierId);
        if (supplier) {
          setDetailSupplier({ ...supplier, approvalStatus: "审批中" });
          setApprovalLoading(true);
          try {
            const instRes = await fetch(`/api/approval-instances/${instanceId}`);
            const instJson = await instRes.json();
            if (instJson.data) setApprovalInstance(instJson.data);
          } catch {
          } finally {
            setApprovalLoading(false);
          }
        }
        fetchSuppliers();
      } else {
        alert(json.error || "提交审批失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setSubmittingId(null);
    }
  };

  const handleStatusChange = (newStatus: string, _instanceId: string | null) => {
    fetchSuppliers();
    if (detailSupplier && detailSupplier.id) {
      setDetailSupplier((prev) => prev ? { ...prev, approvalStatus: newStatus } : null);
      if (_instanceId) {
        setApprovalLoading(true);
        fetch(`/api/approval-instances/${_instanceId}`)
          .then((r) => r.json())
          .then((json) => { if (json.data) setApprovalInstance(json.data); })
          .catch(() => {})
          .finally(() => setApprovalLoading(false));
      }
    }
  };

  const openDetail = async (supplier: Supplier) => {
    setDetailSupplier(supplier);
    setApprovalInstance(null);
    setApprovalLoading(true);
    try {
      const detailRes = await fetch(`/api/suppliers/${supplier.id}`);
      if (detailRes.ok) {
        const json = await detailRes.json();
        setDetailSupplier(json.data);
        if (json.data.approvalInstanceId) {
          fetchApprovalInstance(json.data.approvalInstanceId);
        } else {
          setApprovalLoading(false);
        }
      } else {
        setApprovalLoading(false);
      }
    } catch {
      setApprovalLoading(false);
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
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
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

          <select
            className="ios-select w-[130px]"
            value={filterApproval}
            onChange={(e) => {
              setFilterApproval(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部审批</option>
            <option value="草稿">草稿</option>
            <option value="审批中">审批中</option>
            <option value="已批准">已批准</option>
            <option value="已驳回">已驳回</option>
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
        ) : suppliers.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <Users className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>{search || filterType || filterStatus || filterApproval ? "没有匹配的供应商记录" : "暂无供应商，点击右上角新增"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  {rolePerms.delete && (
                    <th className="w-10">
                      <input
                        type="checkbox"
                        className="ios-checkbox"
                        checked={isAllSelected}
                        onChange={() => isAllSelected ? clearSelection() : selectAll()}
                      />
                    </th>
                  )}
                  <th>供应商名称</th>
                  <th>供应商性质</th>
                  <th>状态</th>
                  <th>审批状态</th>
                  <th>联系人</th>
                  <th>电话</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className={isSelected(supplier.id) ? "bg-[#1C1917]/5" : ""}>
                    {rolePerms.delete && (
                      <td className="w-10">
                        <input
                          type="checkbox"
                          className="ios-checkbox"
                          checked={isSelected(supplier.id)}
                          onChange={() => toggleSelect(supplier.id)}
                        />
                      </td>
                    )}
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-[#1C1917]" />
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
                        <span className="text-[#78716C]">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`ios-badge ${statusColorMap[supplier.status || "当前有效"]}`}>
                        {supplier.status || "当前有效"}
                      </span>
                    </td>
                    <td>
                      <span className={`ios-badge ${approvalStatusConfig[supplier.approvalStatus]?.color || "ios-badge-gray"}`}>
                        {approvalStatusConfig[supplier.approvalStatus]?.label || supplier.approvalStatus}
                      </span>
                    </td>
                    <td>{supplier.contactPerson || "-"}</td>
                    <td>
                      {supplier.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-[#78716C]" />
                          {supplier.phone}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {supplier.approvalStatus === "草稿" || supplier.approvalStatus === "已驳回" ? (
                          <>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => handleOpenEdit(supplier)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              编辑
                            </button>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                              onClick={() => setDeleteConfirm(supplier)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              删除
                            </button>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                              disabled={submittingId === supplier.id}
                              onClick={() => handleSubmitApproval(supplier.id)}
                            >
                              <Send className="w-3.5 h-3.5" />
                              {submittingId === supplier.id ? "提交中..." : "提交审批"}
                            </button>
                          </>
                        ) : supplier.approvalStatus === "审批中" ? (
                          <>
                            {canDeleteFrontend(hasFlow, rolePerms, supplier.approvalStatus, user?.id ?? "", supplier.createdById ?? null, isAdminUser) && (
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                                onClick={() => setDeleteConfirm(supplier)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                删除
                              </button>
                            )}
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => openDetail(supplier)}
                              title="查看详情"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : supplier.approvalStatus === "已批准" ? (
                          <>
                            {canDeleteFrontend(hasFlow, rolePerms, supplier.approvalStatus, user?.id ?? "", supplier.createdById ?? null, isAdminUser) && (
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                                onClick={() => setDeleteConfirm(supplier)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                删除
                              </button>
                            )}
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => openDetail(supplier)}
                              title="查看详情"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                    <td className="text-[#78716C] text-[12px] whitespace-nowrap">
                      {supplier.lastModifiedBy && (
                        <span>{supplier.lastModifiedBy}</span>
                      )}
                      <span className="block text-[11px]">{formatDate(supplier.updatedAt)}</span>
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

        {rolePerms.delete && (
          <BatchDeleteBar
            businessType="supplier"
            selectedIds={suppliers.filter((s) => isSelected(s.id)).map((s) => s.id)}
            onDeleteSuccess={fetchSuppliers}
            onClear={clearSelection}
          />
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
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                供应商名称 <span className="text-[#78716C]">*</span>
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
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">供应商性质</label>
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
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">供应商状态</label>
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
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">联系人</label>
              <div className="relative">
                <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
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
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">电话</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
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
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
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
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">开户行信息</label>
              <input
                type="text"
                className="ios-input"
                placeholder="开户行名称"
                value={form.bankName}
                onChange={(e) => updateForm("bankName", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">开户行账号</label>
              <input
                type="text"
                className="ios-input"
                placeholder="银行账号"
                value={form.bankAccount}
                onChange={(e) => updateForm("bankAccount", e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">地址</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-[#78716C]" />
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
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">备注</label>
              <textarea
                className="ios-input min-h-[80px] resize-none"
                placeholder="备注信息"
                value={form.remark}
                onChange={(e) => updateForm("remark", e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">供应商资料</label>
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
                    <span className="flex-1 text-[13px] text-[#1C1917] truncate">
                      {uploadFileName || "已上传文件"}
                    </span>
                    <button
                      type="button"
                      className="text-[#78716C] hover:text-[#78716C]"
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
                <p className="text-[12px] text-[#78716C]">
                  支持 PDF、Word、Excel、图片、压缩包，最大 10MB
                </p>
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
          <div className="w-14 h-14 rounded-full bg-[#78716C]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#78716C]" />
          </div>
          <p className="text-[15px] text-[#1C1917] mb-1">
            确定要删除供应商 <span className="font-semibold">{deleteConfirm?.name}</span> 吗？
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

      <Modal
        isOpen={!!detailSupplier}
        onClose={() => { setDetailSupplier(null); setApprovalInstance(null); }}
        title="供应商审批详情"
        maxWidth="700px"
      >
        {detailSupplier && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">供应商名称</p>
                <p className="text-[14px] font-semibold">{detailSupplier.name}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">供应商性质</p>
                <p className="text-[14px] font-semibold">{detailSupplier.supplierType || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">审批状态</p>
                <span className={`ios-badge ${approvalStatusConfig[detailSupplier.approvalStatus]?.color || "ios-badge-gray"}`}>
                  {approvalStatusConfig[detailSupplier.approvalStatus]?.label || detailSupplier.approvalStatus}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">供应商状态</p>
                <span className={`ios-badge ${statusColorMap[detailSupplier.status || "当前有效"]}`}>
                  {detailSupplier.status || "当前有效"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">联系人</p>
                <p className="text-[14px] font-semibold">{detailSupplier.contactPerson || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">电话</p>
                <p className="text-[14px] font-semibold">{detailSupplier.phone || "-"}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F5F5F4]">
              <h4 className="text-[13px] font-bold text-[#1C1917] mb-3">审批流程</h4>
              <ApprovalTimeline instance={approvalInstance} loading={approvalLoading} />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

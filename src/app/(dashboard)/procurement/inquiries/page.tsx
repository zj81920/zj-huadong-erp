"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  HelpCircle,
  Send,
  Calendar,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import Modal from "@/components/Modal";

interface PurchaseRequestItem {
  id: string;
  materialName: string;
  spec: string | null;
  material: string | null;
  brand: string | null;
  standardNo: string | null;
  unit: string | null;
  quantity: number | string | null;
  remark: string | null;
  sortOrder: number;
}

interface PurchaseRequest {
  id: string;
  projectSourceId: string;
  requestNo: string;
  status: string;
  items: PurchaseRequestItem[];
}

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
}

interface SupplierName {
  id: string;
  name: string;
}

interface Inquiry {
  id: string;
  purchaseRequestId: string;
  projectSourceId: string;
  supplierIds: string[];
  inquiryDate: string;
  closingDate: string | null;
  quoteSummary: Record<string, { price: number; deliveryDays: number; remark: string }>;
  recommendedSupplierId: string | null;
  isSingleSource: boolean;
  singleSourceReason: string | null;
  createdAt: string;
  updatedAt: string;
  hasContract: boolean;
  purchaseRequest: PurchaseRequest;
  supplierNames: SupplierName[];
  recommendedSupplierName: string | null;
}

interface InquiryDetail extends Inquiry {
  supplierDetails: { id: string; name: string; contactPerson: string | null; phone: string | null }[];
  purchaseContract: { id: string; contractNo: string } | null;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface FormData {
  purchaseRequestId: string;
  projectSourceId: string;
  supplierIds: string[];
  closingDate: string;
  quoteSummary: Record<string, { price: number; deliveryDays: number; remark: string }>;
  recommendedSupplierId: string;
  isSingleSource: boolean;
  singleSourceReason: string;
}

const emptyForm: FormData = {
  purchaseRequestId: "",
  projectSourceId: "",
  supplierIds: [],
  closingDate: "",
  quoteSummary: {},
  recommendedSupplierId: "",
  isSingleSource: false,
  singleSourceReason: "",
};

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, pageSize: 20, total: 0, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterProjectSourceId, setFilterProjectSourceId] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState<Inquiry | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [detailInquiry, setDetailInquiry] = useState<InquiryDetail | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Inquiry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPurchaseRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/purchase-requests?status=已批准&pageSize=200");
      const json = await res.json();
      if (res.ok) setPurchaseRequests(json.data || []);
    } catch {}
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch("/api/suppliers?pageSize=200");
      const json = await res.json();
      if (res.ok) setSuppliers(json.data || []);
    } catch {}
  }, []);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterProjectSourceId) params.set("projectSourceId", filterProjectSourceId);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/inquiries?${params}`);
      const json = await res.json();
      if (res.ok) {
        setInquiries(json.data);
        setPagination(json.pagination);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [search, filterProjectSourceId, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchPurchaseRequests();
    fetchSuppliers();
  }, [fetchPurchaseRequests, fetchSuppliers]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const handleOpenCreate = () => {
    setEditingInquiry(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (inquiry: Inquiry) => {
    setEditingInquiry(inquiry);
    const qs = inquiry.quoteSummary || {};
    const parsedQuoteSummary: Record<string, { price: number; deliveryDays: number; remark: string }> = {};
    inquiry.supplierIds.forEach((sid) => {
      parsedQuoteSummary[sid] = qs[sid] || { price: 0, deliveryDays: 0, remark: "" };
    });
    setForm({
      purchaseRequestId: inquiry.purchaseRequestId,
      projectSourceId: inquiry.projectSourceId,
      supplierIds: [...inquiry.supplierIds],
      closingDate: inquiry.closingDate ? inquiry.closingDate.split("T")[0] : "",
      quoteSummary: parsedQuoteSummary,
      recommendedSupplierId: inquiry.recommendedSupplierId || "",
      isSingleSource: inquiry.isSingleSource,
      singleSourceReason: inquiry.singleSourceReason || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.purchaseRequestId) {
      setFormError("请选择采购需求");
      return;
    }
    if (form.supplierIds.length === 0) {
      setFormError("请至少选择一个供应商");
      return;
    }
    if (form.isSingleSource && !form.singleSourceReason.trim()) {
      setFormError("单一来源采购需填写原因");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const url = editingInquiry
        ? `/api/inquiries/${editingInquiry.id}`
        : "/api/inquiries";
      const method = editingInquiry ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        supplierIds: form.supplierIds,
        closingDate: form.closingDate || null,
        quoteSummary: form.quoteSummary,
        recommendedSupplierId: form.recommendedSupplierId || null,
        isSingleSource: form.isSingleSource,
        singleSourceReason: form.isSingleSource ? form.singleSourceReason.trim() : null,
      };

      if (!editingInquiry) {
        body.purchaseRequestId = form.purchaseRequestId;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchInquiries();
        if (editingInquiry) {
          fetchPurchaseRequests();
        } else {
          fetchPurchaseRequests();
        }
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleViewDetail = async (inquiry: Inquiry) => {
    try {
      const res = await fetch(`/api/inquiries/${inquiry.id}`);
      const json = await res.json();
      if (res.ok) {
        setDetailInquiry(json.data);
      }
    } catch {
      setDetailInquiry(inquiry as unknown as InquiryDetail);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/inquiries/${deleteConfirm.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchInquiries();
        fetchPurchaseRequests();
      } else {
        const json = await res.json();
        alert(json.error || "删除失败");
        setDeleteConfirm(null);
      }
    } catch {
      alert("网络错误");
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleSelectPurchaseRequest = (prId: string) => {
    const pr = purchaseRequests.find((p) => p.id === prId);
    if (pr) {
      setForm((prev) => ({
        ...prev,
        purchaseRequestId: prId,
        projectSourceId: pr.projectSourceId,
      }));
    }
    if (formError) setFormError("");
  };

  const handleToggleSupplier = (supplierId: string) => {
    setForm((prev) => {
      const isSelected = prev.supplierIds.includes(supplierId);
      const newIds = isSelected
        ? prev.supplierIds.filter((id) => id !== supplierId)
        : [...prev.supplierIds, supplierId];

      const newQuoteSummary = { ...prev.quoteSummary };
      if (!isSelected) {
        newQuoteSummary[supplierId] = newQuoteSummary[supplierId] || { price: 0, deliveryDays: 0, remark: "" };
      } else {
        delete newQuoteSummary[supplierId];
      }

      const newRecommendedId = isSelected && prev.recommendedSupplierId === supplierId
        ? ""
        : prev.recommendedSupplierId;

      return {
        ...prev,
        supplierIds: newIds,
        quoteSummary: newQuoteSummary,
        recommendedSupplierId: newRecommendedId,
      };
    });
    if (formError) setFormError("");
  };

  const updateQuoteField = (supplierId: string, field: "price" | "deliveryDays" | "remark", value: string | number) => {
    setForm((prev) => ({
      ...prev,
      quoteSummary: {
        ...prev.quoteSummary,
        [supplierId]: {
          ...prev.quoteSummary[supplierId],
          [field]: value,
        },
      },
    }));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const stats = {
    total: pagination.total,
    singleSource: inquiries.filter((i) => i.isSingleSource).length,
    withRecommendation: inquiries.filter((i) => i.recommendedSupplierId).length,
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>询价管理</h1>
            <p>管理采购询价流程，对比供应商报价</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增询价
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-[#007AFF]" />
          </div>
          <div>
            <p className="text-[13px] text-[#86868B]">询价总数</p>
            <p className="text-[24px] font-bold text-[#1D1D1F] leading-tight">{stats.total}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#FF9500]/10 flex items-center justify-center">
            <Send className="w-5 h-5 text-[#FF9500]" />
          </div>
          <div>
            <p className="text-[13px] text-[#86868B]">单一来源</p>
            <p className="text-[24px] font-bold text-[#FF9500] leading-tight">{stats.singleSource}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#34C759]/10 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-[#34C759]" />
          </div>
          <div>
            <p className="text-[13px] text-[#86868B]">已推荐供应商</p>
            <p className="text-[24px] font-bold text-[#34C759] leading-tight">{stats.withRecommendation}</p>
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
              placeholder="搜索项目源ID、计划单号..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
          </div>

          <input
            type="text"
            className="ios-select w-[180px]"
            placeholder="筛选项目源ID"
            value={filterProjectSourceId}
            onChange={(e) => {
              setFilterProjectSourceId(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          />

          <div className="ml-auto text-[13px] text-[#86868B]">
            共 <span className="font-semibold text-[#1D1D1F]">{pagination.total}</span> 条询价
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
              <HelpCircle className="w-8 h-8 text-[#86868B]" />
            </div>
            <p>{search || filterProjectSourceId ? "没有匹配的询价记录" : "暂无询价记录，点击右上角新增"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>项目源ID</th>
                  <th>采购需求(计划单号)</th>
                  <th>物资明细</th>
                  <th>询价日期</th>
                  <th>截止日期</th>
                  <th>供应商数量</th>
                  <th>推荐供应商</th>
                  <th>单一来源</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inquiry) => (
                  <tr key={inquiry.id}>
                    <td>
                      <span className="font-mono text-[13px] font-semibold text-[#007AFF]">
                        {inquiry.projectSourceId}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-[13px] font-semibold">
                        {inquiry.purchaseRequest.requestNo}
                      </span>
                    </td>
                    <td>
                      {inquiry.purchaseRequest.items && inquiry.purchaseRequest.items.length > 0 ? (
                        <div className="max-w-[200px]">
                          <p className="text-[13px] font-semibold truncate">
                            {inquiry.purchaseRequest.items[0].materialName}
                          </p>
                          {inquiry.purchaseRequest.items.length > 1 && (
                            <p className="text-[11px] text-[#86868B]">
                              +{inquiry.purchaseRequest.items.length - 1} 项物资
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#86868B]">-</span>
                      )}
                    </td>
                    <td className="text-[#86868B]">{formatDate(inquiry.inquiryDate)}</td>
                    <td className="text-[#86868B]">{formatDate(inquiry.closingDate)}</td>
                    <td>
                      <span className="ios-badge ios-badge-blue">{inquiry.supplierIds.length}</span>
                    </td>
                    <td>
                      {inquiry.recommendedSupplierName ? (
                        <span className="font-semibold text-[#34C759]">{inquiry.recommendedSupplierName}</span>
                      ) : (
                        <span className="text-[#86868B]">-</span>
                      )}
                    </td>
                    <td>
                      {inquiry.isSingleSource ? (
                        <span className="ios-badge ios-badge-orange">是</span>
                      ) : (
                        <span className="ios-badge ios-badge-gray">否</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleViewDetail(inquiry)}>
                          <Eye className="w-3.5 h-3.5" />
                          详情
                        </button>
                        <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleOpenEdit(inquiry)}>
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                          onClick={() => setDeleteConfirm(inquiry)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
        title={editingInquiry ? "编辑询价" : "新增询价"}
        maxWidth="720px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className={editingInquiry ? "col-span-2" : ""}>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                采购需求 <span className="text-[#FF3B30]">*</span>
              </label>
              {editingInquiry ? (
                <input
                  type="text"
                  className="ios-input bg-[#F5F5F7]"
                  value={`${editingInquiry.purchaseRequest.requestNo} (${editingInquiry.projectSourceId})`}
                  readOnly
                />
              ) : (
                <select
                  className="ios-select"
                  value={form.purchaseRequestId}
                  onChange={(e) => handleSelectPurchaseRequest(e.target.value)}
                >
                  <option value="">请选择已批准的采购需求</option>
                  {purchaseRequests.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      [{pr.requestNo}] {pr.items?.[0]?.materialName || "无物资"}
                      {pr.items && pr.items.length > 1 ? ` +${pr.items.length - 1}项` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">项目源ID</label>
              <input
                type="text"
                className="ios-input bg-[#F5F5F7]"
                value={form.projectSourceId || "选择采购需求后自动填充"}
                readOnly
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                截止日期
              </label>
              <input
                type="date"
                className="ios-input"
                value={form.closingDate}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, closingDate: e.target.value }));
                  if (formError) setFormError("");
                }}
              />
            </div>
          </div>

          {!editingInquiry && form.purchaseRequestId && (() => {
            const selectedPr = purchaseRequests.find((p) => p.id === form.purchaseRequestId);
            return selectedPr && selectedPr.items && selectedPr.items.length > 0 ? (
              <div>
                <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-2">物资明细</label>
                <div className="max-h-[180px] overflow-y-auto border border-[#E5E5EA] rounded-xl">
                  <table className="ios-table text-[12px]">
                    <thead>
                      <tr>
                        <th>物资名称</th>
                        <th>规格</th>
                        <th>数量</th>
                        <th>单位</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPr.items.map((item) => (
                        <tr key={item.id}>
                          <td className="font-semibold">{item.materialName}</td>
                          <td className="text-[#86868B]">{item.spec || "-"}</td>
                          <td>{item.quantity ?? "-"}</td>
                          <td>{item.unit || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null;
          })()}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-semibold text-[#1D1D1F]">
                选择供应商 <span className="text-[#FF3B30]">*</span>
              </label>
              <span className="text-[12px] text-[#86868B]">
                已选 {form.supplierIds.length} 家
              </span>
            </div>
            {suppliers.length === 0 ? (
              <div className="p-3 rounded-xl bg-[#F5F5F7] text-[13px] text-[#86868B]">
                暂无供应商数据，请先在系统中添加供应商
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto p-2 border border-[#E5E5EA] rounded-xl">
                {suppliers.map((supplier) => {
                  const selected = form.supplierIds.includes(supplier.id);
                  return (
                    <button
                      key={supplier.id}
                      type="button"
                      className={`p-2 rounded-lg text-[12px] text-left transition-all duration-150 ${
                        selected
                          ? "bg-[#007AFF]/10 border-2 border-[#007AFF] text-[#007AFF]"
                          : "bg-[#F5F5F7] border-2 border-transparent text-[#1D1D1F] hover:bg-[#E5E5EA]"
                      }`}
                      onClick={() => handleToggleSupplier(supplier.id)}
                    >
                      <p className="font-semibold truncate">{supplier.name}</p>
                      {supplier.contactPerson && (
                        <p className="text-[11px] opacity-70 truncate">{supplier.contactPerson}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {form.supplierIds.length > 0 && (
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-2">报价汇总</label>
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {form.supplierIds.map((sid) => {
                  const supplier = suppliers.find((s) => s.id === sid);
                  const quote = form.quoteSummary[sid] || { price: 0, deliveryDays: 0, remark: "" };
                  return (
                    <div key={sid} className="p-3 rounded-xl border border-[#E5E5EA] bg-[#FAFAFA]">
                      <p className="text-[13px] font-semibold text-[#1D1D1F] mb-2">
                        {supplier?.name || "未知供应商"}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] text-[#86868B] mb-1">报价(元)</label>
                          <input
                            type="number"
                            className="ios-input text-[13px] py-1.5"
                            placeholder="0"
                            value={quote.price || ""}
                            onChange={(e) => updateQuoteField(sid, "price", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#86868B] mb-1">交货天数</label>
                          <input
                            type="number"
                            className="ios-input text-[13px] py-1.5"
                            placeholder="0"
                            value={quote.deliveryDays || ""}
                            onChange={(e) => updateQuoteField(sid, "deliveryDays", parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#86868B] mb-1">备注</label>
                          <input
                            type="text"
                            className="ios-input text-[13px] py-1.5"
                            placeholder="备注"
                            value={quote.remark}
                            onChange={(e) => updateQuoteField(sid, "remark", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">推荐供应商</label>
              <select
                className="ios-select"
                value={form.recommendedSupplierId}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, recommendedSupplierId: e.target.value }));
                  if (formError) setFormError("");
                }}
              >
                <option value="">请选择推荐供应商</option>
                {form.supplierIds.map((sid) => {
                  const supplier = suppliers.find((s) => s.id === sid);
                  return (
                    <option key={sid} value={sid}>
                      {supplier?.name || "未知供应商"}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">单一来源采购</label>
              <div className="flex items-center gap-3 h-[38px]">
                <button
                  type="button"
                  className={`relative w-[44px] h-[26px] rounded-full transition-colors duration-200 ${
                    form.isSingleSource ? "bg-[#007AFF]" : "bg-[#E5E5EA]"
                  }`}
                  onClick={() => {
                    setForm((prev) => ({ ...prev, isSingleSource: !prev.isSingleSource }));
                    if (formError) setFormError("");
                  }}
                >
                  <span
                    className={`absolute top-[3px] w-[20px] h-[20px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
                      form.isSingleSource ? "translate-x-[21px]" : "translate-x-[3px]"
                    }`}
                  />
                </button>
                <span className="text-[13px] text-[#86868B]">
                  {form.isSingleSource ? "是" : "否"}
                </span>
              </div>
            </div>
          </div>

          {form.isSingleSource && (
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                单一来源原因 <span className="text-[#FF3B30]">*</span>
              </label>
              <textarea
                className="ios-input min-h-[80px] resize-y"
                placeholder="请说明单一来源采购的原因"
                value={form.singleSourceReason}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, singleSourceReason: e.target.value }));
                  if (formError) setFormError("");
                }}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "保存中..." : editingInquiry ? "保存修改" : "创建询价"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailInquiry}
        onClose={() => setDetailInquiry(null)}
        title="询价详情"
        maxWidth="680px"
      >
        {detailInquiry && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F0F0F0]">
              <div className="w-12 h-12 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-[#007AFF]" />
              </div>
              <div>
                <p className="text-[17px] font-bold text-[#1D1D1F]">{detailInquiry.purchaseRequest.requestNo}</p>
                <p className="text-[13px] text-[#007AFF] font-mono font-semibold">{detailInquiry.projectSourceId}</p>
              </div>
              {detailInquiry.isSingleSource && (
                <span className="ios-badge ios-badge-orange ml-auto">单一来源</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">物资数量</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">
                  {detailInquiry.purchaseRequest.items?.length || 0} 项
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  询价日期
                </p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{formatDate(detailInquiry.inquiryDate)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  截止日期
                </p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{formatDate(detailInquiry.closingDate)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">推荐供应商</p>
                <p className="text-[14px] font-semibold text-[#34C759]">
                  {detailInquiry.recommendedSupplierName || "-"}
                </p>
              </div>
            </div>

            {detailInquiry.purchaseRequest.items && detailInquiry.purchaseRequest.items.length > 0 && (
              <div>
                <p className="text-[13px] font-semibold text-[#1D1D1F] mb-2">
                  采购需求物资明细
                </p>
                <div className="max-h-[200px] overflow-y-auto border border-[#E5E5EA] rounded-xl">
                  <table className="ios-table text-[12px]">
                    <thead>
                      <tr>
                        <th>物资名称</th>
                        <th>规格</th>
                        <th>材质</th>
                        <th>品牌</th>
                        <th>数量</th>
                        <th>单位</th>
                        <th>备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailInquiry.purchaseRequest.items.map((item: PurchaseRequestItem) => (
                        <tr key={item.id}>
                          <td className="font-semibold">{item.materialName}</td>
                          <td className="text-[#86868B]">{item.spec || "-"}</td>
                          <td className="text-[#86868B]">{item.material || "-"}</td>
                          <td className="text-[#86868B]">{item.brand || "-"}</td>
                          <td>{item.quantity ?? "-"}</td>
                          <td>{item.unit || "-"}</td>
                          <td className="text-[#86868B]">{item.remark || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {detailInquiry.isSingleSource && detailInquiry.singleSourceReason && (
              <div className="p-3 rounded-xl bg-[#FF9500]/8 border border-[#FF9500]/20">
                <p className="text-[12px] text-[#FF9500] font-semibold mb-1">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  单一来源原因
                </p>
                <p className="text-[13px] text-[#1D1D1F]">{detailInquiry.singleSourceReason}</p>
              </div>
            )}

            <div className="pt-3 border-t border-[#F0F0F0]">
              <p className="text-[13px] font-semibold text-[#1D1D1F] mb-3">
                报价汇总（{detailInquiry.supplierDetails?.length || 0} 家供应商）
              </p>
              {detailInquiry.supplierDetails && detailInquiry.supplierDetails.length > 0 ? (
                <div className="space-y-2">
                  {detailInquiry.supplierDetails.map((sd) => {
                    const quote = (detailInquiry.quoteSummary as Record<string, { price: number; deliveryDays: number; remark: string }>)?.[sd.id];
                    const isRecommended = detailInquiry.recommendedSupplierId === sd.id;
                    return (
                      <div
                        key={sd.id}
                        className={`p-3 rounded-xl border ${
                          isRecommended
                            ? "border-[#34C759]/40 bg-[#34C759]/5"
                            : "border-[#E5E5EA] bg-[#FAFAFA]"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-[13px] font-semibold text-[#1D1D1F]">{sd.name}</p>
                          {isRecommended && (
                            <span className="ios-badge ios-badge-green text-[10px]">推荐</span>
                          )}
                          {sd.contactPerson && (
                            <span className="text-[11px] text-[#86868B]">
                              {sd.contactPerson} {sd.phone || ""}
                            </span>
                          )}
                        </div>
                        {quote ? (
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <p className="text-[11px] text-[#86868B]">报价</p>
                              <p className="text-[14px] font-bold text-[#1D1D1F]">
                                ¥{quote.price?.toLocaleString() || "0"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] text-[#86868B]">交货天数</p>
                              <p className="text-[14px] font-bold text-[#1D1D1F]">{quote.deliveryDays || 0} 天</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-[#86868B]">备注</p>
                              <p className="text-[13px] text-[#1D1D1F]">{quote.remark || "-"}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[12px] text-[#86868B]">暂未报价</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[13px] text-[#86868B]">暂无供应商信息</p>
              )}
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
          <div className="w-14 h-14 rounded-full bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#FF3B30]" />
          </div>
          <p className="text-[15px] text-[#1D1D1F] mb-1">
            确定要删除此询价记录吗？
          </p>
          {deleteConfirm && (
            <p className="text-[13px] text-[#86868B] mb-1">
              项目源: {deleteConfirm.projectSourceId} | 计划单号: {deleteConfirm.purchaseRequest.requestNo}
            </p>
          )}
          {deleteConfirm?.hasContract ? (
            <p className="text-[13px] text-[#FF3B30] mb-4">该询价已生成采购合同，无法删除</p>
          ) : (
            <p className="text-[13px] text-[#86868B] mb-6">删除后采购需求将恢复为"已批准"状态</p>
          )}
          <div className="flex justify-center gap-3">
            <button className="ios-btn ios-btn-secondary" onClick={() => setDeleteConfirm(null)}>取消</button>
            {deleteConfirm && !deleteConfirm.hasContract && (
              <button className="ios-btn ios-btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "删除中..." : "确认删除"}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
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
  Link2,
  Copy,
  Globe,
  Check,
  Paperclip,
  File,
  Upload,
  X,
  ChevronDown,
  ChevronRight,
  Package,
} from "lucide-react";
import Modal from "@/components/Modal";
import { ApprovalTimeline } from "@/components/ApprovalComponents";
import { useAuth } from "@/contexts/AuthContext";
import { useFlowConfigured } from "@/hooks/useFlowConfigured";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { BatchDeleteBar } from "@/components/BatchDeleteBar";
import { getUserModulePerms } from "@/lib/types/permissions";
import { canDeleteFrontend, canEditFrontend } from "@/lib/types/permissions";

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
  unitPrice?: number | null;
  totalPrice?: number | null;
}

interface PurchaseRequest {
  id: string;
  projectSourceId: string;
  requestNo: string;
  status: string;
  items: PurchaseRequestItem[];
  project?: { projectSourceId: string; name: string; projectCode?: string };
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
  projectName: string;
  projectCode: string;
  supplierIds: string[];
  inquiryDate: string;
  closingDate: string | null;
  quoteSummary: Record<string, { price: number; deliveryDays: number; remark: string }>;
  recommendedSupplierId: string | null;
  isSingleSource: boolean;
  singleSourceReason: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  hasContract: boolean;
  purchaseRequest: PurchaseRequest;
  supplierNames: SupplierName[];
  recommendedSupplierName: string | null;
  inquiryMode: string;
  onlineStatus: string;
  onlineToken: string | null;
  onlineDeadline: string | null;
  currentRound: number;
  confirmedSupplierId: string | null;
  confirmedRound: number | null;
  inquiryStatus: string;
  approvalInstanceId: string | null;
  createdById: string | null;
  attachments?: { name: string; url: string }[];
}

interface InquiryDetail extends Inquiry {
  supplierDetails: { id: string; name: string; contactPerson: string | null; phone: string | null }[];
  expenseContract: { id: string; contractNo: string } | null;
  supplierQuotes: { id: string; supplierId: string; supplier: { name: string }; quoteMode: string; totalPrice: number | null; deliveryDays: number | null; remark: string | null; quotedAt: string | null; isValid: boolean; round: number; items: { id: string; purchaseRequestItemId: string; unitPrice: number | null; quantity: number | null; totalPrice: number | null; deliveryDays: number | null; remark: string | null; purchaseRequestItem: { id: string; materialName: string; spec: string | null; unit: string | null; quantity: number | null } }[] }[];
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
  inquiryMode: string;
  onlineDeadline: string;
  attachments: { name: string; url: string }[];
  confirmedSupplierId: string;
  confirmedRound: number | null;
}

const emptyForm: FormData = {
  purchaseRequestId: "",
  projectSourceId: "",
  supplierIds: [],
  closingDate: "",
  quoteSummary: {},
  inquiryMode: "offline",
  onlineDeadline: "",
  attachments: [],
  confirmedSupplierId: "",
  confirmedRound: null,
};

export default function InquiriesPage() {
  const { user } = useAuth();
  const isAdminUser = user?.username === "admin" || user?.roles?.some((r: any) => r.code === "admin") || false;
  const rolePerms = getUserModulePerms(user, "inquiries");
  const hasFlow = user?.moduleFlowStatus?.["inquiries"] ?? false;
  const { configured: flowConfigured } = useFlowConfigured("quotation");
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
  const [approvalInstance, setApprovalInstance] = useState<any>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Inquiry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [itemPrices, setItemPrices] = useState<Record<string, string>>({});
  const [uploadingFile, setUploadingFile] = useState(false);
  const [viewingRound, setViewingRound] = useState(1);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleRowExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const [quoteItems, setQuoteItems] = useState<Record<string, { unitPrice: string; quantity: string; totalPrice: string }>>({});
  const [projects, setProjects] = useState<{ id: string; name: string; projectCode?: string }[]>([]);

  const {
    toggleSelect, selectAll, clearSelection, isAllSelected, selectedCount, isSelected,
  } = useBatchSelection(inquiries.map((i) => i.id));

  const fetchPurchaseRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/purchase-requests?status=已批准&pageSize=200");
      const json = await res.json();
      if (res.ok) setPurchaseRequests(json.data || []);
    } catch {}
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch("/api/suppliers?status=当前有效&pageSize=200");
      const json = await res.json();
      if (res.ok) setSuppliers(json.data || []);
    } catch {}
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects?pageSize=200");
      const json = await res.json();
      if (res.ok) setProjects(json.data || []);
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

  const fetchApprovalInstance = useCallback(async (instanceId: string) => {
    setApprovalLoading(true);
    try {
      const res = await fetch(`/api/approval-instances/${instanceId}`);
      const json = await res.json();
      if (res.ok) {
        setApprovalInstance(json.data);
      }
    } catch {
    } finally {
      setApprovalLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchaseRequests();
    fetchSuppliers();
    fetchProjects();
  }, [fetchPurchaseRequests, fetchSuppliers, fetchProjects]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const handleOpenCreate = () => {
    setEditingInquiry(null);
    setForm(emptyForm);
    setItemPrices({});
    setQuoteItems({});
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = async (inquiry: Inquiry) => {
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
      inquiryMode: inquiry.inquiryMode || "offline",
      onlineDeadline: inquiry.onlineDeadline ? new Date(inquiry.onlineDeadline).toISOString().slice(0, 16) : "",
      attachments: inquiry.attachments && Array.isArray(inquiry.attachments) ? [...inquiry.attachments] : [],
      confirmedSupplierId: inquiry.confirmedSupplierId || "",
      confirmedRound: inquiry.confirmedRound || null,
    });
    setItemPrices({});
    setQuoteItems({});
    setFormError("");
    setShowModal(true);

    try {
      const detailRes = await fetch(`/api/inquiries/${inquiry.id}`);
      const detailJson = await detailRes.json();
      if (detailRes.ok && detailJson.data?.supplierQuotes) {
        const initialQuoteItems: Record<string, { unitPrice: string; quantity: string; totalPrice: string }> = {};
        for (const sq of detailJson.data.supplierQuotes) {
          if (sq.items) {
            for (const qi of sq.items) {
              const key = `${sq.supplierId}_${qi.purchaseRequestItemId}`;
              initialQuoteItems[key] = {
                unitPrice: qi.unitPrice != null ? String(qi.unitPrice) : "",
                quantity: qi.quantity != null ? String(qi.quantity) : "",
                totalPrice: qi.totalPrice != null ? String(qi.totalPrice) : "",
              };
            }
          }
        }
        setQuoteItems(initialQuoteItems);
      }
    } catch {}
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

    setSaving(true);
    setFormError("");

    try {
      const url = editingInquiry
        ? `/api/inquiries/${editingInquiry.id}`
        : "/api/inquiries";
      const method = editingInquiry ? "PUT" : "POST";

      const selectedPrItems = editingInquiry
        ? (editingInquiry.purchaseRequest?.items || [])
        : (purchaseRequests.find((p) => p.id === form.purchaseRequestId)?.items || []);

      const body: Record<string, unknown> = {
        supplierIds: form.supplierIds,
        closingDate: form.closingDate || null,
        quoteSummary: form.quoteSummary,
        inquiryMode: form.inquiryMode,
        onlineDeadline: form.onlineDeadline || null,
        attachments: form.attachments,
        confirmedSupplierId: form.confirmedSupplierId || null,
        confirmedRound: form.confirmedRound || null,
      };

      if (form.inquiryMode === "offline" && form.supplierIds.length > 0 && selectedPrItems.length > 0) {
        body.supplierQuotes = form.supplierIds.map((sid) => {
          const items = selectedPrItems.map((item) => {
            const key = `${sid}_${item.id}`;
            const qi = quoteItems[key];
            return {
              purchaseRequestItemId: item.id,
              unitPrice: qi?.unitPrice ? parseFloat(qi.unitPrice) : null,
              quantity: qi?.quantity ? parseFloat(qi.quantity) : null,
              totalPrice: qi?.totalPrice ? parseFloat(qi.totalPrice) : null,
            };
          }).filter((i) => i.unitPrice || i.quantity);
          return {
            supplierId: sid,
            round: 1,
            quoteMode: "offline",
            totalPrice: items.reduce((sum, i) => sum + (i.totalPrice || 0), 0),
            deliveryDays: form.quoteSummary[sid]?.deliveryDays || null,
            remark: form.quoteSummary[sid]?.remark || null,
            items,
          };
        }).filter((sq) => sq.items.length > 0);
      }

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
        fetchPurchaseRequests();
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
    setApprovalInstance(null);
    try {
      const res = await fetch(`/api/inquiries/${inquiry.id}`);
      const json = await res.json();
      if (res.ok) {
        setDetailInquiry(json.data);
        setViewingRound(json.data.currentRound || 1);
        if (json.data.approvalInstanceId) {
          fetchApprovalInstance(json.data.approvalInstanceId);
        }
      }
    } catch {
      setDetailInquiry(inquiry as unknown as InquiryDetail);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    if (!canDeleteFrontend(hasFlow, rolePerms, deleteConfirm.inquiryStatus, user?.id ?? "", deleteConfirm.createdById ?? null, isAdminUser)) {
      alert("无权删除该记录");
      setDeleteConfirm(null);
      return;
    }
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

  const handleSelectPurchaseRequest = async (prId: string) => {
    const pr = purchaseRequests.find((p) => p.id === prId);
    if (pr) {
      let prAttachments: { name: string; url: string }[] = [];
      try {
        const detailRes = await fetch(`/api/purchase-requests/${prId}`);
        const detailJson = await detailRes.json();
        if (detailRes.ok && detailJson.data.attachments && Array.isArray(detailJson.data.attachments)) {
          prAttachments = detailJson.data.attachments;
        }
      } catch {}
      setForm((prev) => ({
        ...prev,
        purchaseRequestId: prId,
        projectSourceId: pr.projectSourceId,
        attachments: prAttachments.length > 0 ? prAttachments : prev.attachments,
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

      return {
        ...prev,
        supplierIds: newIds,
        quoteSummary: newQuoteSummary,
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploadingFile(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const json = await res.json();
        if (res.ok) {
          setForm((prev) => ({
            ...prev,
            attachments: [...prev.attachments, { name: json.filename || file.name, url: json.url }],
          }));
        } else {
          alert(json.error || "上传失败");
        }
      }
    } catch {
      alert("上传失败");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const stats = {
    total: pagination.total,
    onlinePending: inquiries.filter((i) => i.inquiryMode === "online" && !i.confirmedSupplierId).length,
    confirmed: inquiries.filter((i) => i.confirmedSupplierId).length,
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>采购单</h1>
            <p>管理采购流程，对比供应商报价</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate} disabled={!flowConfigured} title={!flowConfigured ? "请先在流程设置中配置采购单审批流程" : undefined}>
            <Plus className="w-4 h-4" />
            新增采购单
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-[#1C1917]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">采购单总数</p>
            <p className="text-[24px] font-bold text-[#1C1917] leading-tight">{stats.total}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#78716C]/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-[#78716C]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">线上询价中</p>
            <p className="text-[24px] font-bold text-[#78716C] leading-tight">{stats.onlinePending}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#78716C]/10 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-[#78716C]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">已确认供应商</p>
            <p className="text-[24px] font-bold text-[#78716C] leading-tight">{stats.confirmed}</p>
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
              placeholder="搜索项目名称、计划单号..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
          </div>

          <select
            className="ios-select w-[180px]"
            value={filterProjectSourceId}
            onChange={(e) => {
              setFilterProjectSourceId(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部项目</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.projectCode ? `${project.projectCode} - ${project.name}` : project.name}
              </option>
            ))}
          </select>

          <div className="ml-auto text-[13px] text-[#78716C]">
            共 <span className="font-semibold text-[#1C1917]">{pagination.total}</span> 条采购单
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <HelpCircle className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>{search || filterProjectSourceId ? "没有匹配的采购单记录" : "暂无采购单记录，点击右上角新增"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  {rolePerms.delete && <th className="w-10"><input type="checkbox" className="ios-checkbox" checked={isAllSelected} onChange={() => isAllSelected ? clearSelection() : selectAll()} /></th>}
                  <th>项目名称</th>
                  <th>采购需求</th>
                  <th>询价日期</th>
                  <th>要求交货日期</th>
                  <th>供应商数量</th>
                  <th>询价方式</th>
                  <th>状态</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inquiry) => {
                  const isExpanded = expandedRows.has(inquiry.id);
                  return (
                    <Fragment key={inquiry.id}>
                      <tr className={`${isExpanded ? "bg-[#FAFAF9]/60" : ""} ${isSelected(inquiry.id) ? "bg-[#1C1917]/5" : ""}`}>
                        {rolePerms.delete && (
                          <td className="w-10">
                            <input type="checkbox" className="ios-checkbox" checked={isSelected(inquiry.id)} onChange={() => toggleSelect(inquiry.id)} />
                          </td>
                        )}
                        <td>
                          <span className="font-mono text-[13px] font-semibold text-[#1C1917]">
                            {inquiry.projectCode ? `${inquiry.projectCode} - ${inquiry.projectName}` : (inquiry.projectName || inquiry.projectSourceId)}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <button
                              className="w-6 h-6 rounded-md hover:bg-[#E7E5E4] flex items-center justify-center transition-colors"
                              onClick={() => toggleRowExpand(inquiry.id)}
                              title={isExpanded ? "收起明细" : "展开明细"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-[#1C1917]" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-[#78716C]" />
                              )}
                            </button>
                            <span className="font-mono text-[13px] font-semibold">
                              {inquiry.purchaseRequest?.requestNo}
                            </span>
                          </div>
                        </td>
                        <td className="text-[#78716C]">{formatDate(inquiry.inquiryDate)}</td>
                        <td className="text-[#78716C]">{formatDate(inquiry.closingDate)}</td>
                        <td>
                          <span className="ios-badge ios-badge-blue">{inquiry.supplierIds.length}</span>
                        </td>
                        <td>
                          {inquiry.inquiryMode === "online" ? (
                            <span className="ios-badge ios-badge-blue">线上</span>
                          ) : (
                            <span className="ios-badge ios-badge-gray">线下</span>
                          )}
                        </td>
                        <td>
                          <select
                            className="text-[12px] py-1 px-2 rounded-lg border border-[#D1D5DB] bg-white focus:outline-none focus:ring-1 focus:ring-[#1C1917]"
                            value={inquiry.inquiryStatus || "草稿"}
                            onChange={async (e) => {
                              const newStatus = e.target.value;
                              if (newStatus === "审批中" && inquiry.inquiryMode === "online" && !inquiry.confirmedSupplierId) {
                                alert("线上询价需先确认供应商报价才能提交审批");
                                return;
                              }
                              const res = await fetch(`/api/inquiries/${inquiry.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: newStatus }),
                              });
                              if (res.ok) fetchInquiries();
                              else {
                                const json = await res.json();
                                alert(json.error || "操作失败");
                              }
                            }}
                          >
                            <option value="草稿">草稿</option>
                            <option value="审批中">提交审批</option>
                          </select>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleViewDetail(inquiry)}>
                              <Eye className="w-3.5 h-3.5" />
                              详情
                            </button>
                            {(canEditFrontend(hasFlow, rolePerms, inquiry.inquiryStatus, user?.id ?? "", inquiry.createdById ?? null, isAdminUser) && !inquiry.hasContract) && (
                              <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleOpenEdit(inquiry)}>
                                <Pencil className="w-3.5 h-3.5" />
                                编辑
                              </button>
                            )}
                            {canDeleteFrontend(hasFlow, rolePerms, inquiry.inquiryStatus, user?.id ?? "", inquiry.createdById ?? null, isAdminUser) && (
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                                onClick={() => setDeleteConfirm(inquiry)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {inquiry.inquiryMode === "online" && inquiry.onlineToken && (
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                                onClick={() => {
                                  const url = `${window.location.origin}/inquiry/quote?token=${inquiry.onlineToken}`;
                                  navigator.clipboard.writeText(url);
                                  alert("报价链接已复制到剪贴板");
                                }}
                                title="复制供应商报价链接"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                链接
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="text-[#78716C] text-[12px] whitespace-nowrap">
                          {inquiry.lastModifiedBy && (
                            <span>{inquiry.lastModifiedBy}</span>
                          )}
                          <span className="block text-[11px]">{formatDate(inquiry.updatedAt)}</span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="p-0">
                            <div className="px-10 py-4 bg-[#FFFFFF] border-t border-b border-[#E7E5E4]">
                              <div className="flex items-center gap-2 mb-3">
                                <Package className="w-4 h-4 text-[#1C1917]" />
                                <span className="text-[13px] font-semibold text-[#1C1917]">
                                  物资明细（{inquiry.purchaseRequest?.items?.length || 0} 项）
                                </span>
                              </div>
                              {inquiry.purchaseRequest?.items && inquiry.purchaseRequest.items.length > 0 ? (
                                <div className="overflow-x-auto border border-[#E7E5E4] rounded-xl bg-white">
                                  <table className="w-full text-[13px]">
                                    <thead className="bg-[#FAFAF9]">
                                      <tr>
                                        <th className="py-2 px-3 text-center font-semibold text-[#78716C] w-[44px]">序号</th>
                                        <th className="py-2 px-3 text-left font-semibold text-[#1C1917]">物资名称</th>
                                        <th className="py-2 px-3 text-left font-semibold text-[#1C1917]">规格型号</th>
                                        <th className="py-2 px-3 text-left font-semibold text-[#1C1917]">材质</th>
                                        <th className="py-2 px-3 text-left font-semibold text-[#1C1917]">品牌</th>
                                        <th className="py-2 px-3 text-left font-semibold text-[#1C1917]">标准号</th>
                                        <th className="py-2 px-3 text-left font-semibold text-[#1C1917]">单位</th>
                                        <th className="py-2 px-3 text-left font-semibold text-[#1C1917]">数量</th>
                                        {inquiry.confirmedSupplierId && <th className="py-2 px-3 text-left font-semibold text-[#1C1917]">单价(元)</th>}
                                        {inquiry.confirmedSupplierId && <th className="py-2 px-3 text-left font-semibold text-[#1C1917]">明细总价(元)</th>}
                                        <th className="py-2 px-3 text-left font-semibold text-[#1C1917]">备注</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {inquiry.purchaseRequest.items.map((item, index) => (
                                        <tr key={item.id} className="border-t border-[#F5F5F4]">
                                          <td className="py-2 px-3 text-center text-[#78716C]">{index + 1}</td>
                                          <td className="py-2 px-3 font-semibold">{item.materialName}</td>
                                          <td className="py-2 px-3">{item.spec || "-"}</td>
                                          <td className="py-2 px-3">{item.material || "-"}</td>
                                          <td className="py-2 px-3">{item.brand || "-"}</td>
                                          <td className="py-2 px-3">{item.standardNo || "-"}</td>
                                          <td className="py-2 px-3">{item.unit || "-"}</td>
                                          <td className="py-2 px-3 font-mono">{item.quantity ?? "-"}</td>
                                          {inquiry.confirmedSupplierId && (
                                            <td className="py-2 px-3 font-mono text-[#1C1917]">
                                              {item.unitPrice != null ? `¥${Number(item.unitPrice).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}` : "-"}
                                            </td>
                                          )}
                                          {inquiry.confirmedSupplierId && (
                                            <td className="py-2 px-3 font-mono font-semibold text-[#1C1917]">
                                              {item.totalPrice != null ? `¥${Number(item.totalPrice).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}` : "-"}
                                            </td>
                                          )}
                                          <td className="py-2 px-3 text-[#78716C] max-w-[120px] truncate" title={item.remark || undefined}>{item.remark || "-"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-[13px] text-[#78716C] text-center py-4">暂无物资明细</p>
                              )}
                              {inquiry.inquiryStatus === "已批准" && inquiry.recommendedSupplierName && (
                                <div className="mt-3 p-3 rounded-xl bg-[#78716C]/5 border border-[#78716C]/20">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-[#78716C]" />
                                    <span className="text-[13px] font-semibold text-[#78716C]">
                                      已确认供应商：{inquiry.recommendedSupplierName}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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

      {rolePerms.delete && (
        <BatchDeleteBar
          businessType="inquiry"
          selectedIds={inquiries.filter((d) => isSelected(d.id)).map((d) => d.id)}
          onDeleteSuccess={fetchInquiries}
          onClear={clearSelection}
        />
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingInquiry ? "编辑采购单" : "新增采购单"}
        maxWidth="720px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className={editingInquiry ? "col-span-2" : ""}>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                采购需求 <span className="text-[#78716C]">*</span>
              </label>
              {editingInquiry ? (
                <input
                  type="text"
                  className="ios-input bg-[#FAFAF9]"
                  value={`${editingInquiry.purchaseRequest?.requestNo} (${editingInquiry.projectCode ? `${editingInquiry.projectCode} - ${editingInquiry.projectName}` : (editingInquiry.projectName || editingInquiry.projectSourceId)})`}
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
                      {pr.requestNo}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">项目名称</label>
              <input
                type="text"
                className="ios-input bg-[#FAFAF9]"
                value={(() => {
                  const pr = purchaseRequests.find(p => p.id === form.purchaseRequestId);
                  return pr ? (pr.project ? `${pr.project.projectSourceId} - ${pr.project.name}` : pr.projectSourceId) : (form.projectSourceId || "选择采购需求后自动填充");
                })()}
                readOnly
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                要求交货日期
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
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                询价方式
              </label>
              <select
                className="ios-select"
                value={form.inquiryMode}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, inquiryMode: e.target.value }));
                  if (formError) setFormError("");
                }}
              >
                <option value="offline">线下询价</option>
                <option value="online">线上询价</option>
              </select>
            </div>
          </div>

          {form.inquiryMode === "online" && (
            <div className="p-3 rounded-xl bg-[#1C1917]/5 border border-[#1C1917]/20">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-[#1C1917]" />
                <span className="text-[13px] font-semibold text-[#1C1917]">线上询价模式</span>
              </div>
              <p className="text-[12px] text-[#78716C] mb-2">
                创建后将生成报价链接，供应商可通过链接在线提交报价
              </p>
              <div>
                <label className="block text-[12px] text-[#1C1917] mb-1">线上报价截止时间</label>
                <input
                  type="datetime-local"
                  className="ios-input text-[13px]"
                  value={form.onlineDeadline}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, onlineDeadline: e.target.value }));
                  }}
                />
              </div>
            </div>
          )}

          {form.purchaseRequestId && (() => {
            const selectedPrItems = editingInquiry
              ? (editingInquiry.purchaseRequest?.items || [])
              : (purchaseRequests.find((p) => p.id === form.purchaseRequestId)?.items || []);
            const isOnline = form.inquiryMode === "online";
            return selectedPrItems && selectedPrItems.length > 0 ? (
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-2">物资明细</label>
                <div className="max-h-[240px] overflow-y-auto border border-[#E7E5E4] rounded-xl">
                  <table className="ios-table text-[12px]">
                    <thead>
                      <tr>
                        <th>物资名称</th>
                        <th>规格型号</th>
                        <th>材质</th>
                        <th>品牌</th>
                        <th>标准号</th>
                        <th>单位</th>
                        <th>数量</th>
                        {!isOnline && <th>单价(元)</th>}
                        {!isOnline && <th>总价(元)</th>}
                        <th>备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPrItems.map((item) => (
                        <tr key={item.id}>
                          <td className="font-semibold">{item.materialName}</td>
                          <td className="text-[#78716C]">{item.spec || "-"}</td>
                          <td className="text-[#78716C]">{item.material || "-"}</td>
                          <td className="text-[#78716C]">{item.brand || "-"}</td>
                          <td className="text-[#78716C]">{item.standardNo || "-"}</td>
                          <td>{item.unit || "-"}</td>
                          <td className="font-mono">{item.quantity ?? "-"}</td>
                          {!isOnline && (
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                className="ios-input text-[12px] py-1 w-[80px]"
                                placeholder="0"
                                value={itemPrices[item.id] || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setItemPrices((prev) => ({ ...prev, [item.id]: val }));
                                }}
                              />
                            </td>
                          )}
                          {!isOnline && (
                            <td className="font-semibold text-[#1C1917]">
                              {itemPrices[item.id] && item.quantity
                                ? `¥${(parseFloat(itemPrices[item.id]) * parseFloat(String(item.quantity))).toFixed(2)}`
                                : "-"}
                            </td>
                          )}
                          <td className="text-[#78716C] max-w-[120px] truncate" title={item.remark || undefined}>{item.remark || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {isOnline && (
                  <p className="text-[11px] text-[#78716C] mt-1.5">线上询价模式下物资明细不可修改，供应商将在报价页面查看完整物资信息</p>
                )}
              </div>
            ) : null;
          })()}

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              选择供应商 <span className="text-[#78716C]">*</span>
            </label>
            <select
              className="ios-select"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleToggleSupplier(e.target.value);
                }
              }}
            >
              <option value="">-- 点击选择供应商 --</option>
              {suppliers
                .filter((s) => !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
                .map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}{supplier.contactPerson ? ` (${supplier.contactPerson})` : ""}
                  </option>
                ))}
            </select>
            {form.supplierIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.supplierIds.map((sid) => {
                  const supplier = suppliers.find((s) => s.id === sid);
                  return (
                    <span key={sid} className="inline-flex items-center gap-1 px-2 py-1 bg-[#1C1917]/10 text-[#1C1917] rounded-lg text-[12px] font-medium">
                      {supplier?.name || "未知"}
                      <button
                        type="button"
                        className="w-4 h-4 rounded-full hover:bg-[#1C1917]/20 flex items-center justify-center"
                        onClick={() => handleToggleSupplier(sid)}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {form.inquiryMode === "offline" && form.supplierIds.length > 0 && (() => {
            const selectedPrItems = editingInquiry
              ? (editingInquiry.purchaseRequest?.items || [])
              : (purchaseRequests.find((p) => p.id === form.purchaseRequestId)?.items || []);
            if (selectedPrItems.length === 0) return null;
            return (
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-2">报价汇总（线下逐项录入）</label>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {form.supplierIds.map((sid) => {
                    const supplier = suppliers.find((s) => s.id === sid);
                    const quote = form.quoteSummary[sid] || { price: 0, deliveryDays: 0, remark: "" };
                    const supplierTotal = selectedPrItems.reduce((sum, item) => {
                      const key = `${sid}_${item.id}`;
                      const qi = quoteItems[key];
                      return sum + (qi?.totalPrice ? parseFloat(qi.totalPrice) : 0);
                    }, 0);
                    return (
                      <div key={sid} className="p-3 rounded-xl border border-[#E7E5E4] bg-[#FFFFFF]">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[13px] font-semibold text-[#1C1917]">
                            {supplier?.name || "未知供应商"}
                          </p>
                          <p className="text-[14px] font-bold text-[#1C1917]">
                            总报价: ¥{supplierTotal.toFixed(2)}
                          </p>
                        </div>
                        <div className="overflow-x-auto border border-[#E7E5E4] rounded-lg bg-white">
                          <table className="w-full text-[12px]">
                            <thead className="bg-[#FAFAF9]">
                              <tr>
                                <th className="py-1.5 px-2 text-left font-semibold min-w-[100px]">物资名称</th>
                                <th className="py-1.5 px-2 text-left font-semibold">规格</th>
                                <th className="py-1.5 px-2 text-left font-semibold w-[80px]">需求数量</th>
                                <th className="py-1.5 px-2 text-left font-semibold w-[90px]">单价(元)</th>
                                <th className="py-1.5 px-2 text-left font-semibold w-[90px]">数量</th>
                                <th className="py-1.5 px-2 text-left font-semibold w-[90px]">小计(元)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedPrItems.map((item) => {
                                const key = `${sid}_${item.id}`;
                                const qi = quoteItems[key] || { unitPrice: "", quantity: "", totalPrice: "" };
                                return (
                                  <tr key={item.id} className="border-t border-[#F5F5F4]">
                                    <td className="py-1.5 px-2 font-semibold">{item.materialName}</td>
                                    <td className="py-1.5 px-2 text-[#78716C]">{item.spec || "-"}</td>
                                    <td className="py-1.5 px-2">{item.quantity ?? "-"}</td>
                                    <td className="py-1.5 px-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        className="ios-input text-[12px] py-1 w-full"
                                        placeholder="0"
                                        value={qi.unitPrice}
                                        onChange={(e) => {
                                          const up = e.target.value;
                                          const qty = qi.quantity;
                                          const total = up && qty ? (parseFloat(up) * parseFloat(qty)).toFixed(2) : "";
                                          setQuoteItems((prev) => ({
                                            ...prev,
                                            [key]: { unitPrice: up, quantity: qty, totalPrice: total },
                                          }));
                                        }}
                                      />
                                    </td>
                                    <td className="py-1.5 px-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        className="ios-input text-[12px] py-1 w-full"
                                        placeholder="0"
                                        value={qi.quantity}
                                        onChange={(e) => {
                                          const qty = e.target.value;
                                          const up = qi.unitPrice;
                                          const total = up && qty ? (parseFloat(up) * parseFloat(qty)).toFixed(2) : "";
                                          setQuoteItems((prev) => ({
                                            ...prev,
                                            [key]: { unitPrice: up, quantity: qty, totalPrice: total },
                                          }));
                                        }}
                                      />
                                    </td>
                                    <td className="py-1.5 px-2 font-semibold text-[#1C1917]">
                                      {qi.totalPrice ? `¥${qi.totalPrice}` : "-"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="block text-[11px] text-[#78716C] mb-1">交货天数</label>
                            <input
                              type="number"
                              className="ios-input text-[13px] py-1.5"
                              placeholder="0"
                              value={quote.deliveryDays || ""}
                              onChange={(e) => updateQuoteField(sid, "deliveryDays", parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-[#78716C] mb-1">备注</label>
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
            );
          })()}

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-semibold text-[#1C1917]">
                <Paperclip className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                附件
              </label>
              <button
                className="ios-btn ios-btn-secondary ios-btn-sm"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.rar";
                  input.onchange = (e) => handleFileUpload(e as any);
                  input.click();
                }}
                disabled={uploadingFile}
              >
                <Upload className="w-3.5 h-3.5" />
                {uploadingFile ? "上传中..." : "上传附件"}
              </button>
            </div>
            {form.attachments.length > 0 ? (
              <div className="space-y-1.5">
                {form.attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[#FAFAF9]">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <File className="w-3.5 h-3.5 text-[#78716C] flex-shrink-0" />
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#1C1917] truncate hover:underline">{att.name}</a>
                    </div>
                    <button className="w-6 h-6 rounded-full hover:bg-[#E7E5E4] flex items-center justify-center flex-shrink-0" onClick={() => handleRemoveAttachment(idx)}>
                      <X className="w-3 h-3 text-[#78716C]" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-[#78716C] text-center py-3">暂无附件</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "保存中..." : editingInquiry ? "保存修改" : "创建采购单"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailInquiry}
        onClose={() => { setDetailInquiry(null); setApprovalInstance(null); }}
        title="采购单详情"
        maxWidth="680px"
      >
        {detailInquiry && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F5F5F4]">
              <div className="w-12 h-12 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-[#1C1917]" />
              </div>
              <div>
                <p className="text-[17px] font-bold text-[#1C1917]">{detailInquiry.purchaseRequest?.requestNo}</p>
                <p className="text-[13px] text-[#1C1917] font-mono font-semibold">{detailInquiry.projectCode ? `${detailInquiry.projectCode} - ${detailInquiry.projectName}` : (detailInquiry.projectName || detailInquiry.projectSourceId)}</p>
              </div>
              {detailInquiry.inquiryMode === "online" && (
                <span className="ios-badge ios-badge-blue ml-auto mr-2">线上询价</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">物资数量</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">
                  {detailInquiry.purchaseRequest?.items?.length || 0} 项
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  询价日期
                </p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailInquiry.inquiryDate)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  要求交货日期
                </p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailInquiry.closingDate)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">项目名称</p>
                <p className="text-[14px] font-semibold text-[#1C1917] font-mono">
                  {detailInquiry.projectCode ? `${detailInquiry.projectCode} - ${detailInquiry.projectName}` : (detailInquiry.projectName || detailInquiry.projectSourceId) || "-"}
                </p>
              </div>
              {detailInquiry.onlineDeadline && (
                <div className="p-3 rounded-xl bg-[#FAFAF9]">
                  <p className="text-[12px] text-[#78716C] mb-1">
                    <Globe className="w-3 h-3 inline mr-1" />
                    线上截止时间
                  </p>
                  <p className="text-[14px] font-semibold text-[#1C1917]">
                    {new Date(detailInquiry.onlineDeadline).toLocaleString("zh-CN")}
                  </p>
                </div>
              )}
            </div>

            {detailInquiry.purchaseRequest?.items && detailInquiry.purchaseRequest?.items?.length > 0 && (
              <div>
                <p className="text-[13px] font-semibold text-[#1C1917] mb-2">
                  采购需求物资明细
                </p>
                <div className="max-h-[260px] overflow-y-auto border border-[#E7E5E4] rounded-xl">
                  <table className="ios-table text-[12px]">
                    <thead>
                      <tr>
                        <th>物资名称</th>
                        <th>规格型号</th>
                        <th>材质</th>
                        <th>品牌</th>
                        <th>标准号</th>
                        <th>数量</th>
                        <th>单位</th>
                        {detailInquiry.confirmedSupplierId && <th>单价(元)</th>}
                        {detailInquiry.confirmedSupplierId && <th>明细总价(元)</th>}
                        <th>备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailInquiry.purchaseRequest?.items?.map((item: PurchaseRequestItem) => (
                        <tr key={item.id}>
                          <td className="font-semibold">{item.materialName}</td>
                          <td className="text-[#78716C]">{item.spec || "-"}</td>
                          <td className="text-[#78716C]">{item.material || "-"}</td>
                          <td className="text-[#78716C]">{item.brand || "-"}</td>
                          <td className="text-[#78716C]">{item.standardNo || "-"}</td>
                          <td>{item.quantity ?? "-"}</td>
                          <td>{item.unit || "-"}</td>
                          {detailInquiry.confirmedSupplierId && (
                            <td className="font-mono">
                              {item.unitPrice != null ? `¥${Number(item.unitPrice).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}` : "-"}
                            </td>
                          )}
                          {detailInquiry.confirmedSupplierId && (
                            <td className="font-mono font-semibold text-[#1C1917]">
                              {item.totalPrice != null ? `¥${Number(item.totalPrice).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}` : "-"}
                            </td>
                          )}
                          <td className="text-[#78716C] max-w-[120px] truncate" title={item.remark || undefined}>{item.remark || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {detailInquiry.attachments && detailInquiry.attachments.length > 0 && (
              <div>
                <p className="text-[13px] font-semibold text-[#1C1917] mb-2">
                  <Paperclip className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                  采购附件
                </p>
                <div className="space-y-1.5">
                  {detailInquiry.attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-[#FAFAF9]">
                      <File className="w-3.5 h-3.5 text-[#78716C] flex-shrink-0" />
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#1C1917] truncate hover:underline">{att.name}</a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailInquiry.confirmedSupplierId && detailInquiry.supplierQuotes && detailInquiry.supplierQuotes.some((sq: any) => sq.attachments && Array.isArray(sq.attachments) && sq.attachments.length > 0) && (
              <div>
                <p className="text-[13px] font-semibold text-[#1C1917] mb-2">
                  <Paperclip className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                  供应商报价附件
                </p>
                <div className="space-y-1.5">
                  {detailInquiry.supplierQuotes
                    .filter((sq: any) => sq.supplierId === detailInquiry.confirmedSupplierId)
                    .flatMap((sq: any) => (sq.attachments || []).map((att: { name: string; url: string }, idx: number) => (
                      <div key={`sq-att-${idx}`} className="flex items-center gap-2 p-2 rounded-lg bg-[#FAFAF9]">
                        <File className="w-3.5 h-3.5 text-[#78716C] flex-shrink-0" />
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#1C1917] truncate hover:underline">{att.name}</a>
                      </div>
                    )))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#F5F5F4]">
              <p className="text-[13px] font-semibold text-[#1C1917] mb-3">
                报价汇总（{detailInquiry.supplierDetails?.length || 0} 家供应商）
              </p>
              {detailInquiry.supplierDetails && detailInquiry.supplierDetails.length > 0 ? (
                <div className="space-y-2">
                  {detailInquiry.supplierDetails.map((sd) => {
                    const quote = (detailInquiry.quoteSummary as Record<string, { price: number; deliveryDays: number; remark: string }>)?.[sd.id];
                    return (
                      <div
                        key={sd.id}
                        className="p-3 rounded-xl border border-[#E7E5E4] bg-[#FFFFFF]"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-[13px] font-semibold text-[#1C1917]">{sd.name}</p>
                          {sd.contactPerson && (
                            <span className="text-[11px] text-[#78716C]">
                              {sd.contactPerson} {sd.phone || ""}
                            </span>
                          )}
                        </div>
                        {quote ? (
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <p className="text-[11px] text-[#78716C]">报价</p>
                              <p className="text-[14px] font-bold text-[#1C1917]">
                                ¥{quote.price?.toLocaleString() || "0"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] text-[#78716C]">交货天数</p>
                              <p className="text-[14px] font-bold text-[#1C1917]">{quote.deliveryDays || 0} 天</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-[#78716C]">备注</p>
                              <p className="text-[13px] text-[#1C1917]">{quote.remark || "-"}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[12px] text-[#78716C]">暂未报价</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[13px] text-[#78716C]">暂无供应商信息</p>
              )}
              {detailInquiry.supplierQuotes && detailInquiry.supplierQuotes.length > 0 && (
                <div className="pt-3 border-t border-[#F5F5F4]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-semibold text-[#1C1917]">
                      比价窗口
                    </p>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: detailInquiry.currentRound || 1 }, (_, i) => i + 1).map((r) => (
                        <button
                          key={r}
                          className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors ${
                            viewingRound === r
                              ? "bg-[#1C1917] text-white"
                              : "bg-[#FAFAF9] text-[#78716C] hover:bg-[#E7E5E4]"
                          }`}
                          onClick={() => setViewingRound(r)}
                        >
                          第{r}轮
                        </button>
                      ))}
                      {!detailInquiry.confirmedSupplierId && (
                        <button
                          className="ios-btn ios-btn-secondary ios-btn-sm ml-2"
                          onClick={async () => {
                            const newRound = (detailInquiry.currentRound || 1) + 1;
                            const res = await fetch(`/api/inquiries/${detailInquiry.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ currentRound: newRound }),
                              currentRound: newRound,
                            } as any);
                            if (res.ok) {
                              const detailRes = await fetch(`/api/inquiries/${detailInquiry.id}`);
                              if (detailRes.ok) {
                                const detailJson = await detailRes.json();
                                setDetailInquiry(detailJson.data);
                                setViewingRound(newRound);
                              }
                            }
                          }}
                        >
                          开启新一轮
                        </button>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const roundQuotes = detailInquiry.supplierQuotes.filter((sq: any) => sq.round === viewingRound);
                    const uniqueSupplierIds = [...new Set(roundQuotes.map((sq: any) => sq.supplierId))];
                    if (uniqueSupplierIds.length === 0) {
                      return <p className="text-[12px] text-[#78716C] text-center py-4">本轮暂无报价</p>;
                    }
                    const allPrices = uniqueSupplierIds.map((sid: string) => {
                      const sq = roundQuotes.find((q: any) => q.supplierId === sid);
                      return sq?.totalPrice ? Number(sq.totalPrice) : Infinity;
                    });
                    const minPrice = Math.min(...allPrices.filter((p) => p !== Infinity));

                    const hasItems = roundQuotes.some((sq: any) => sq.items && sq.items.length > 0);

                    const allItemIds = hasItems
                      ? (detailInquiry.purchaseRequest?.items || []).map((item: PurchaseRequestItem) => item.id)
                      : [];

                    return (
                      <div className="overflow-x-auto border border-[#E7E5E4] rounded-xl">
                        <table className="w-full text-[12px]">
                          <thead className="bg-[#FAFAF9]">
                            <tr>
                              <th className="py-2 px-3 text-left font-semibold text-[#1C1917] min-w-[80px]">项目</th>
                              {uniqueSupplierIds.map((sid: string) => {
                                const sq = roundQuotes.find((q: any) => q.supplierId === sid);
                                return (
                                  <th key={sid} className="py-2 px-3 text-left font-semibold min-w-[120px]">
                                    {sq?.supplier?.name || "未知"}
                                  </th>
                                );
                              })}
                              {!detailInquiry.confirmedSupplierId && (
                                <th className="py-2 px-3 text-center font-semibold w-[80px]">操作</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {hasItems && allItemIds.map((itemId: string) => {
                              const prItem = (detailInquiry.purchaseRequest?.items || []).find((i: PurchaseRequestItem) => i.id === itemId);
                              const itemName = prItem?.materialName || itemId;
                              const itemSpec = prItem?.spec || "";

                              const cellItemPrices = uniqueSupplierIds.map((sid: string) => {
                                const sq = roundQuotes.find((q: any) => q.supplierId === sid);
                                const qi = sq?.items?.find((i: any) => i.purchaseRequestItemId === itemId);
                                return qi?.unitPrice ? Number(qi.unitPrice) : Infinity;
                              });
                              const minItemPrice = Math.min(...cellItemPrices.filter((p) => p !== Infinity));

                              return (
                                <tr key={itemId} className="border-t border-[#F5F5F4]">
                                  <td className="py-2.5 px-3">
                                    <p className="font-semibold text-[#1C1917]">{itemName}</p>
                                    {itemSpec && <p className="text-[10px] text-[#78716C]">{itemSpec}</p>}
                                  </td>
                                  {uniqueSupplierIds.map((sid: string) => {
                                    const sq = roundQuotes.find((q: any) => q.supplierId === sid);
                                    const qi = sq?.items?.find((i: any) => i.purchaseRequestItemId === itemId);
                                    const unitPrice = qi?.unitPrice ? Number(qi.unitPrice) : 0;
                                    const quantity = qi?.quantity ? Number(qi.quantity) : 0;
                                    const totalPrice = qi?.totalPrice ? Number(qi.totalPrice) : 0;
                                    const isMin = unitPrice > 0 && unitPrice === minItemPrice;
                                    return (
                                      <td key={sid} className="py-2.5 px-3">
                                        {unitPrice > 0 ? (
                                          <div>
                                            <p className={`font-bold ${isMin ? "text-[#78716C]" : "text-[#1C1917]"}`}>
                                              ¥{unitPrice.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}/单价
                                              {isMin && <span className="ml-1 text-[10px] font-normal">最低</span>}
                                            </p>
                                            {quantity > 0 && (
                                              <p className="text-[11px] text-[#78716C]">
                                                数量: {quantity}
                                              </p>
                                            )}
                                            <p className="text-[11px] text-[#78716C]">
                                              小计: ¥{totalPrice.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                                            </p>
                                          </div>
                                        ) : (
                                          <span className="text-[#78716C]">-</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  {!detailInquiry.confirmedSupplierId && <td className="py-2.5 px-3 text-center">-</td>}
                                </tr>
                              );
                            })}
                            <tr className="border-t border-[#F5F5F4]">
                              <td className="py-2.5 px-3 font-semibold text-[#1C1917]">总报价</td>
                              {uniqueSupplierIds.map((sid: string) => {
                                const sq = roundQuotes.find((q: any) => q.supplierId === sid);
                                const totalPrice = sq?.totalPrice ? Number(sq.totalPrice) : 0;
                                const isMin = totalPrice > 0 && totalPrice === minPrice;
                                const isConfirmed = detailInquiry.confirmedSupplierId === sid;
                                return (
                                  <td key={sid} className={`py-2.5 px-3 font-bold ${isConfirmed ? "text-[#1C1917]" : isMin ? "text-[#78716C]" : "text-[#1C1917]"}`}>
                                    {totalPrice > 0 ? `¥${totalPrice.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}` : "-"}
                                    {isMin && !isConfirmed && <span className="ml-1 text-[10px] font-normal">最低</span>}
                                    {isConfirmed && <span className="ml-1 text-[10px] font-normal">已确认</span>}
                                  </td>
                                );
                              })}
                              {!detailInquiry.confirmedSupplierId && <td className="py-2.5 px-3 text-center">-</td>}
                            </tr>
                            <tr className="border-t border-[#F5F5F4]">
                              <td className="py-2.5 px-3 text-[#78716C]">交货天数</td>
                              {uniqueSupplierIds.map((sid: string) => {
                                const sq = roundQuotes.find((q: any) => q.supplierId === sid);
                                return <td key={sid} className="py-2.5 px-3">{sq?.deliveryDays ? `${sq.deliveryDays}天` : "-"}</td>;
                              })}
                              {!detailInquiry.confirmedSupplierId && <td className="py-2.5 px-3 text-center">-</td>}
                            </tr>
                            <tr className="border-t border-[#F5F5F4]">
                              <td className="py-2.5 px-3 text-[#78716C]">报价时间</td>
                              {uniqueSupplierIds.map((sid: string) => {
                                const sq = roundQuotes.find((q: any) => q.supplierId === sid);
                                return <td key={sid} className="py-2.5 px-3 text-[#78716C]">{sq?.quotedAt ? new Date(sq.quotedAt).toLocaleString("zh-CN") : "-"}</td>;
                              })}
                              {!detailInquiry.confirmedSupplierId && <td className="py-2.5 px-3 text-center">-</td>}
                            </tr>
                            <tr className="border-t border-[#F5F5F4]">
                              <td className="py-2.5 px-3 text-[#78716C]">备注</td>
                              {uniqueSupplierIds.map((sid: string) => {
                                const sq = roundQuotes.find((q: any) => q.supplierId === sid);
                                return <td key={sid} className="py-2.5 px-3">{sq?.remark || "-"}</td>;
                              })}
                              {!detailInquiry.confirmedSupplierId && <td className="py-2.5 px-3 text-center">-</td>}
                            </tr>
                            {!detailInquiry.confirmedSupplierId && (
                              <tr className="border-t border-[#F5F5F4] bg-[#FFFFFF]">
                                <td className="py-2.5 px-3 font-semibold">操作</td>
                                {uniqueSupplierIds.map((sid: string) => {
                                  const sq = roundQuotes.find((q: any) => q.supplierId === sid);
                                  return (
                                    <td key={sid} className="py-2.5 px-3">
                                      {sq?.totalPrice ? (
                                        <button
                                          className="ios-btn ios-btn-primary ios-btn-sm text-[11px] py-1 px-2"
                                          onClick={async () => {
                                            if (!confirm("确认选择该供应商的报价？确认后将自动填充物资明细价格。")) return;
                                            const res = await fetch(`/api/inquiries/${detailInquiry.id}`, {
                                              method: "PUT",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({
                                                confirmedSupplierId: sid,
                                                confirmedRound: viewingRound,
                                              }),
                                            });
                                            if (res.ok) {
                                              const updated = await res.json();
                                              setDetailInquiry(updated.data);
                                              fetchInquiries();
                                            }
                                          }}
                                        >
                                          确认此供应商
                                        </button>
                                      ) : (
                                        <span className="text-[#78716C] text-[11px]">未报价</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="py-2.5 px-3 text-center">-</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {detailInquiry.confirmedSupplierId && !detailInquiry.expenseContract && detailInquiry.inquiryStatus === "已批准" && (
              <button
                className="ios-btn ios-btn-primary mt-4 w-full"
                onClick={() => {
                  window.location.href = `/contracts/expense?fromInquiry=${detailInquiry.id}`;
                }}
              >
                生成采购合同
              </button>
            )}

            {detailInquiry.inquiryMode === "online" && detailInquiry.onlineToken && (
              <div className="p-3 rounded-xl bg-[#1C1917]/5 border border-[#1C1917]/20 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-[#1C1917]">供应商报价链接</p>
                  <p className="text-[12px] text-[#78716C] truncate max-w-[400px]">
                    {`${window.location.origin}/inquiry/quote?token=${detailInquiry.onlineToken}`}
                  </p>
                </div>
                <button
                  className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                  onClick={() => {
                    const url = `${window.location.origin}/inquiry/quote?token=${detailInquiry.onlineToken}`;
                    navigator.clipboard.writeText(url);
                    alert("链接已复制");
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                  复制
                </button>
              </div>
            )}

            <ApprovalTimeline instance={approvalInstance} loading={approvalLoading} />
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
            确定要删除此采购单吗？
          </p>
          {deleteConfirm && (
            <p className="text-[13px] text-[#78716C] mb-1">
              项目名称: {deleteConfirm.projectCode ? `${deleteConfirm.projectCode} - ${deleteConfirm.projectName}` : (deleteConfirm.projectName || deleteConfirm.projectSourceId)} | 计划单号: {deleteConfirm.purchaseRequest?.requestNo}
            </p>
          )}
          {deleteConfirm?.hasContract && !canDeleteFrontend(hasFlow, rolePerms, deleteConfirm.inquiryStatus, user?.id ?? "", deleteConfirm.createdById ?? null, isAdminUser) ? (
            <p className="text-[13px] text-[#78716C] mb-4">该采购单已生成采购合同，无法删除</p>
          ) : (
            <p className="text-[13px] text-[#78716C] mb-6">删除后采购需求将恢复为"已批准"状态</p>
          )}
          <div className="flex justify-center gap-3">
            <button className="ios-btn ios-btn-secondary" onClick={() => setDeleteConfirm(null)}>取消</button>
            {deleteConfirm && (!deleteConfirm.hasContract || canDeleteFrontend(hasFlow, rolePerms, deleteConfirm.inquiryStatus, user?.id ?? "", deleteConfirm.createdById ?? null, isAdminUser)) && (
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

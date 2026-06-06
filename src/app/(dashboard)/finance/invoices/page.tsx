"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  Search,
  Plus,
  Eye,
  Trash2,
  X,
  ChevronDown,
  Upload,
  ChevronUp,
  Pencil,
  Send,
  ArrowDownToLine,
  ArrowUpFromLine,
  Ban,
} from "lucide-react";
import Modal from "@/components/Modal";
import ProjectPicker from "@/components/ProjectPicker";
import { useAuth } from "@/contexts/AuthContext";
import { usePagination } from "@/hooks/usePagination";
import PaginationBar from "@/components/PaginationBar";
import { getRowStatusClass } from "@/lib/status-colors";

interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceCode: string | null;
  invoiceType: string;
  invoiceCategory: string;
  invoiceDate: string;
  amount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  sellerName: string | null;
  sellerTaxNo: string | null;
  buyerName: string | null;
  buyerTaxNo: string | null;
  projectSourceId: string | null;
  sourceType: string;
  sourceId: string | null;
  status: string;
  remark: string | null;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
  project: { projectSourceId: string; name: string; projectCode: string } | null;
}

interface InvoiceFormData {
  invoiceNo: string;
  invoiceCode: string;
  invoiceType: string;
  invoiceCategory: string;
  invoiceDate: string;
  amount: string;
  taxRate: string;
  taxAmount: string;
  totalAmount: string;
  sellerName: string;
  sellerTaxNo: string;
  buyerName: string;
  buyerTaxNo: string;
  projectSourceId: string;
  sourceType: string;
  remark: string;
  attachments: string[];
}

interface ProjectLeadItem {
  projectSourceId: string;
  projectName: string;
  customerId: string;
  customer: { id: string; name: string };
  currentStatus: string;
  project: { id: string; projectCode: string; name: string; status: string } | null;
}

const emptyForm: InvoiceFormData = {
  invoiceNo: "",
  invoiceCode: "",
  invoiceType: "增值税专用发票",
  invoiceCategory: "收票",
  invoiceDate: "",
  amount: "",
  taxRate: "6",
  taxAmount: "",
  totalAmount: "",
  sellerName: "",
  sellerTaxNo: "",
  buyerName: "",
  buyerTaxNo: "",
  projectSourceId: "",
  sourceType: "manual",
  remark: "",
  attachments: [],
};

const invoiceTypeOptions = [
  { value: "增值税专用发票", label: "增值税专用发票" },
  { value: "增值税普通发票", label: "增值税普通发票" },
  { value: "增值税电子发票", label: "增值税电子发票" },
  { value: "收据", label: "收据" },
];

const taxRateOptions = [
  { value: "3", label: "3%" },
  { value: "6", label: "6%" },
  { value: "9", label: "9%" },
  { value: "13", label: "13%" },
];

const sourceTypeOptions = [
  { value: "income_contract", label: "收入合同开票" },
  { value: "expense_contract", label: "支出合同收票" },
  { value: "inter_org_contract", label: "内部结算开票" },
  { value: "delivery_receipt", label: "到货验收收票" },
  { value: "non_contract_expense", label: "非合同支出收票" },
  { value: "expense_report", label: "员工报销" },
  { value: "manual", label: "手工录入" },
];

const sourceTypeMap: Record<string, string> = {
  income_contract: "收入合同",
  expense_contract: "支出合同",
  inter_org_contract: "内部结算",
  delivery_receipt: "到货验收",
  non_contract_expense: "非合同支出",
  expense_report: "员工报销",
  manual: "手工录入",
};

const statusConfig: Record<string, { color: string; label: string }> = {
  已登记: { color: "ios-badge-blue", label: "已登记" },
  待补票: { color: "ios-badge-yellow", label: "待补票" },
  已作废: { color: "ios-badge-red", label: "已作废" },
};

const categoryFilters = [
  { value: "", label: "全部" },
  { value: "开票", label: "开票" },
  { value: "收票", label: "收票" },
];

const statusFilters = [
  { value: "", label: "全部" },
  { value: "已登记", label: "已登记" },
  { value: "待补票", label: "待补票" },
  { value: "已作废", label: "已作废" },
];

const formatAmount = (amount: number) =>
  Number(amount).toLocaleString("zh-CN", { minimumFractionDigits: 2 });

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().split("T")[0];
};

export default function FinanceInvoicesPage() {
  const { user } = useAuth();
  const isAdminUser = user?.username === "admin";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const { page, pageSize, setPage, setPageSize, pagination, setPagination } = usePagination({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Invoice | null>(null);
  const [form, setForm] = useState<InvoiceFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [detailItem, setDetailItem] = useState<Invoice | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [projectLeads, setProjectLeads] = useState<ProjectLeadItem[]>([]);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterCategory) params.set("invoiceCategory", filterCategory);
      if (filterStatus) params.set("status", filterStatus);
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());

      const res = await fetch(`/api/invoices?${params}`);
      const json = await res.json();
      if (res.ok) {
        setInvoices(json.data || []);
        if (json.pagination) setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取发票列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterCategory, filterStatus, page, pageSize]);

  const fetchProjectLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/project-leads?pageSize=200");
      const json = await res.json();
      if (res.ok) {
        setProjectLeads((json.data || []).filter((l: { currentStatus: string }) => l.currentStatus !== "放弃"));
      }
    } catch (err) {
      console.error("获取项目线索列表失败:", err);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    fetchProjectLeads();
  }, [fetchProjectLeads]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setFormError("");
    setShowFormModal(true);
  };

  const handleOpenEdit = (item: Invoice) => {
    setEditingItem(item);
    setForm({
      invoiceNo: item.invoiceNo,
      invoiceCode: item.invoiceCode || "",
      invoiceType: item.invoiceType,
      invoiceCategory: item.invoiceCategory,
      invoiceDate: formatDate(item.invoiceDate),
      amount: String(item.amount),
      taxRate: String(item.taxRate * 100),
      taxAmount: String(item.taxAmount),
      totalAmount: String(item.totalAmount),
      sellerName: item.sellerName || "",
      sellerTaxNo: item.sellerTaxNo || "",
      buyerName: item.buyerName || "",
      buyerTaxNo: item.buyerTaxNo || "",
      projectSourceId: item.projectSourceId || "",
      sourceType: item.sourceType,
      remark: item.remark || "",
      attachments: item.attachments || [],
    });
    setFormError("");
    setShowFormModal(true);
  };

  const updateForm = (field: keyof InvoiceFormData, value: string | string[]) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "amount" || field === "taxRate") {
        const amt = Number(next.amount) || 0;
        const rate = Number(next.taxRate) || 0;
        const tax = amt * (rate / 100);
        next.taxAmount = String(Math.round(tax * 100) / 100);
        next.totalAmount = String(Math.round((amt + tax) * 100) / 100);
      }

      return next;
    });
    if (formError) setFormError("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        setForm((prev) => ({
          ...prev,
          attachments: [...prev.attachments, json.url],
        }));
      } else {
        alert(json.error || "上传失败");
      }
    } catch {
      alert("上传失败，请重试");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    if (!form.invoiceNo.trim()) {
      setFormError("发票号码不能为空");
      return;
    }
    if (!form.invoiceDate) {
      setFormError("请选择开票日期");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        invoiceNo: form.invoiceNo.trim(),
        invoiceCode: form.invoiceCode.trim() || null,
        invoiceType: form.invoiceType,
        invoiceCategory: form.invoiceCategory,
        invoiceDate: form.invoiceDate,
        amount: Number(form.amount) || 0,
        taxRate: (Number(form.taxRate) || 0) / 100,
        taxAmount: Number(form.taxAmount) || 0,
        totalAmount: Number(form.totalAmount) || 0,
        sellerName: form.sellerName.trim() || null,
        sellerTaxNo: form.sellerTaxNo.trim() || null,
        buyerName: form.buyerName.trim() || null,
        buyerTaxNo: form.buyerTaxNo.trim() || null,
        projectSourceId: form.projectSourceId || null,
        sourceType: form.sourceType,
        remark: form.remark.trim() || null,
        attachments: form.attachments,
        status: editingItem ? undefined : "已登记",
      };

      const url = editingItem
        ? `/api/invoices/${editingItem.id}`
        : "/api/invoices";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        setShowFormModal(false);
        fetchInvoices();
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
      const res = await fetch(`/api/invoices/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        setExpandedId(null);
        fetchInvoices();
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

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getInvoiceTypeBadge = (type: string) => {
    if (type.includes("专用")) return "ios-badge-blue";
    if (type.includes("普通")) return "ios-badge-green";
    if (type.includes("电子")) return "ios-badge-purple";
    return "ios-badge-gray";
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>发票管理</h1>
            <p>管理发票的开具与收取，支持发票扫描件归档</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增发票
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
              placeholder="搜索发票号码、销方、购方..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[#78716C]">方向</span>
            {categoryFilters.map((f) => (
              <button
                key={f.value}
                className={`ios-btn ios-btn-sm ${
                  filterCategory === f.value
                    ? "ios-btn-primary"
                    : "ios-btn-secondary"
                }`}
                onClick={() => {
                  setFilterCategory(f.value);
                  setPage(1);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[#78716C]">状态</span>
            {statusFilters.map((f) => (
              <button
                key={f.value}
                className={`ios-btn ios-btn-sm ${
                  filterStatus === f.value
                    ? "ios-btn-primary"
                    : "ios-btn-secondary"
                }`}
                onClick={() => {
                  setFilterStatus(f.value);
                  setPage(1);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="ml-auto text-[13px] text-[#78716C]">
            共 <span className="font-semibold text-[#1C1917]">{pagination?.total ?? 0}</span> 条记录
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 px-4 pt-4">
          <div className="bg-white rounded-xl p-3 border border-[#E7E5E4]">
            <p className="text-[12px] text-[#78716C] mb-1">开票总额</p>
            <p className="text-[18px] font-bold font-mono text-[#78716C]">
              ¥{invoices.filter(i => i.invoiceCategory === "开票").reduce((s, i) => s + (parseFloat(String(i.totalAmount)) || 0), 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-[#78716C] mt-1">
              {invoices.filter(i => i.invoiceCategory === "开票").length} 张
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#E7E5E4]">
            <p className="text-[12px] text-[#78716C] mb-1">收票总额</p>
            <p className="text-[18px] font-bold font-mono text-[#1C1917]">
              ¥{invoices.filter(i => i.invoiceCategory === "收票").reduce((s, i) => s + (parseFloat(String(i.totalAmount)) || 0), 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-[#78716C] mt-1">
              {invoices.filter(i => i.invoiceCategory === "收票").length} 张
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#E7E5E4]">
            <p className="text-[12px] text-[#78716C] mb-1">销项税额</p>
            <p className="text-[18px] font-bold font-mono text-[#78716C]">
              ¥{invoices.filter(i => i.invoiceCategory === "开票").reduce((s, i) => s + (parseFloat(String(i.taxAmount)) || 0), 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#E7E5E4]">
            <p className="text-[12px] text-[#78716C] mb-1">进项税额</p>
            <p className="text-[18px] font-bold font-mono text-[#5856D6]">
              ¥{invoices.filter(i => i.invoiceCategory === "收票").reduce((s, i) => s + (parseFloat(String(i.taxAmount)) || 0), 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <FileText className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>
              {search || filterCategory || filterStatus
                ? "没有匹配的发票记录"
                : "暂无发票记录，点击右上角新增"}
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {invoices.map((inv) => {
              const isExpanded = expandedId === inv.id;
              return (
                <div
                  key={inv.id}
                  className={`bg-white rounded-2xl shadow-sm border border-[#E7E5E4] overflow-hidden transition-all duration-200 ${getRowStatusClass(inv.status)}`}
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-[#FFFFFF] transition-colors duration-150"
                    onClick={() => toggleExpand(inv.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-[#1C1917]" />
                        </div>
                        <span className="font-semibold text-[15px] text-[#1C1917] font-mono">
                          {inv.invoiceNo}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`ios-badge ${getInvoiceTypeBadge(inv.invoiceType)}`}>
                          {inv.invoiceType}
                        </span>
                        <span className={`ios-badge ${statusConfig[inv.status]?.color || "ios-badge-gray"}`}>
                          {statusConfig[inv.status]?.label || inv.status}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[#78716C]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#78716C]" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[13px] mb-1.5">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          inv.invoiceCategory === "收票"
                            ? "text-[#1C1917]"
                            : "text-[#78716C]"
                        }`}
                      >
                        {inv.invoiceCategory === "收票" ? (
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpFromLine className="w-3.5 h-3.5" />
                        )}
                        {inv.invoiceCategory}
                      </span>
                      <span className="text-[#E7E5E4]">|</span>
                      <span className="font-mono font-semibold text-[#1C1917]">
                        ¥{formatAmount(inv.totalAmount)}
                      </span>
                      <span className="text-[#E7E5E4]">|</span>
                      <span className="text-[#78716C]">{formatDate(inv.invoiceDate)}</span>
                    </div>

                    <div className="flex items-center gap-3 text-[13px] text-[#78716C] mb-1">
                      {inv.project && (
                        <>
                          <span>{inv.project.name}</span>
                          <span className="text-[#E7E5E4]">|</span>
                        </>
                      )}
                      <span>{sourceTypeMap[inv.sourceType] || inv.sourceType}</span>
                    </div>

                    <div className="text-[13px] text-[#78716C]">
                      {inv.sellerName && (
                        <>
                          <span>{inv.sellerName}</span>
                          <span className="mx-1.5 text-[#A8A29E]">→</span>
                        </>
                      )}
                      {inv.buyerName && <span>{inv.buyerName}</span>}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-[#F5F5F4]">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3 py-4">
                        <div>
                          <span className="text-[12px] text-[#78716C]">发票代码</span>
                          <p className="text-[13px] text-[#1C1917] font-mono mt-0.5">
                            {inv.invoiceCode || "-"}
                          </p>
                        </div>
                        <div>
                          <span className="text-[12px] text-[#78716C]">不含税金额</span>
                          <p className="text-[13px] text-[#1C1917] font-mono mt-0.5">
                            ¥{formatAmount(inv.amount)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[12px] text-[#78716C]">税率</span>
                          <p className="text-[13px] text-[#1C1917] mt-0.5">
                            {(inv.taxRate * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div>
                          <span className="text-[12px] text-[#78716C]">税额</span>
                          <p className="text-[13px] text-[#1C1917] font-mono mt-0.5">
                            ¥{formatAmount(inv.taxAmount)}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#FAFAF9] p-3 space-y-2 mb-3">
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <span className="text-[12px] text-[#78716C]">销方名称</span>
                            <p className="text-[13px] text-[#1C1917] mt-0.5">
                              {inv.sellerName || "-"}
                            </p>
                          </div>
                          <div className="flex-1">
                            <span className="text-[12px] text-[#78716C]">销方税号</span>
                            <p className="text-[13px] text-[#1C1917] font-mono mt-0.5">
                              {inv.sellerTaxNo || "-"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <span className="text-[12px] text-[#78716C]">购方名称</span>
                            <p className="text-[13px] text-[#1C1917] mt-0.5">
                              {inv.buyerName || "-"}
                            </p>
                          </div>
                          <div className="flex-1">
                            <span className="text-[12px] text-[#78716C]">购方税号</span>
                            <p className="text-[13px] text-[#1C1917] font-mono mt-0.5">
                              {inv.buyerTaxNo || "-"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {inv.remark && (
                        <div className="mb-3">
                          <span className="text-[12px] text-[#78716C]">备注</span>
                          <p className="text-[13px] text-[#1C1917] mt-0.5">{inv.remark}</p>
                        </div>
                      )}

                      {inv.attachments && inv.attachments.length > 0 && (
                        <div className="mb-3">
                          <span className="text-[12px] text-[#78716C] block mb-2">
                            发票扫描件
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {inv.attachments.map((url, idx) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-16 h-16 rounded-lg border border-[#E7E5E4] overflow-hidden hover:shadow-md transition-shadow"
                              >
                                <img
                                  src={url}
                                  alt={`扫描件 ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-3 border-t border-[#F5F5F4]">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailItem(inv);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          查看
                        </button>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(inv);
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        {inv.status === "已登记" && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#F97316]!"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm(`确定要作废发票 ${inv.invoiceNo} 吗？此操作将扣减关联金额。`)) return;
                              const res = await fetch(`/api/invoices/${inv.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "已作废" }),
                              });
                              if (res.ok) {
                                fetchInvoices();
                              } else {
                                const json = await res.json();
                                alert(json.error || "操作失败");
                              }
                            }}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            作废
                          </button>
                        )}
                        {isAdminUser && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(inv);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <PaginationBar pagination={pagination} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </div>
        )}
      </div>

      {/* 新增/编辑 Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingItem ? "编辑发票" : "新增发票"}
        maxWidth="640px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                发票号码 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入发票号码"
                value={form.invoiceNo}
                onChange={(e) => updateForm("invoiceNo", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                发票代码
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入发票代码"
                value={form.invoiceCode}
                onChange={(e) => updateForm("invoiceCode", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                发票类型
              </label>
              <select
                className="ios-select"
                value={form.invoiceType}
                onChange={(e) => updateForm("invoiceType", e.target.value)}
              >
                {invoiceTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                发票方向
              </label>
              <select
                className="ios-select"
                value={form.invoiceCategory}
                onChange={(e) => updateForm("invoiceCategory", e.target.value)}
              >
                <option value="开票">开票</option>
                <option value="收票">收票</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                开票日期 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="date"
                className="ios-input"
                value={form.invoiceDate}
                onChange={(e) => updateForm("invoiceDate", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                不含税金额
              </label>
              <input
                type="number"
                className="ios-input"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => updateForm("amount", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                税率
              </label>
              <select
                className="ios-select"
                value={form.taxRate}
                onChange={(e) => updateForm("taxRate", e.target.value)}
              >
                {taxRateOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                税额
              </label>
              <input
                type="number"
                className="ios-input"
                placeholder="自动计算"
                value={form.taxAmount}
                onChange={(e) => updateForm("taxAmount", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                价税合计
              </label>
              <input
                type="number"
                className="ios-input font-semibold"
                placeholder="自动计算"
                value={form.totalAmount}
                onChange={(e) => updateForm("totalAmount", e.target.value)}
              />
            </div>

            <div className="col-span-2 h-px bg-[#F5F5F4]" />

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                销方名称
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入销方名称"
                value={form.sellerName}
                onChange={(e) => updateForm("sellerName", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                销方税号
              </label>
              <input
                type="text"
                className="ios-input font-mono"
                placeholder="请输入销方税号"
                value={form.sellerTaxNo}
                onChange={(e) => updateForm("sellerTaxNo", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                购方名称
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入购方名称"
                value={form.buyerName}
                onChange={(e) => updateForm("buyerName", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                购方税号
              </label>
              <input
                type="text"
                className="ios-input font-mono"
                placeholder="请输入购方税号"
                value={form.buyerTaxNo}
                onChange={(e) => updateForm("buyerTaxNo", e.target.value)}
              />
            </div>

            <div className="col-span-2 h-px bg-[#F5F5F4]" />

            <div>
              <ProjectPicker
                projectLeads={projectLeads}
                value={form.projectSourceId}
                onChange={(id) => updateForm("projectSourceId", id)}
                label="关联项目"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                来源类型
              </label>
              <select
                className="ios-select"
                value={form.sourceType}
                onChange={(e) => updateForm("sourceType", e.target.value)}
              >
                {sourceTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                备注
              </label>
              <textarea
                className="ios-textarea"
                placeholder="备注信息（选填）"
                value={form.remark}
                onChange={(e) => updateForm("remark", e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                发票扫描件
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {form.attachments.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative w-20 h-20 rounded-lg border border-[#E7E5E4] overflow-hidden group"
                  >
                    <img
                      src={url}
                      alt={`扫描件 ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveAttachment(idx)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 rounded-lg border-2 border-dashed border-[#E7E5E4] flex flex-col items-center justify-center cursor-pointer hover:border-[#1C1917] hover:bg-[#1C1917]/5 transition-colors">
                  <Upload className="w-5 h-5 text-[#78716C] mb-1" />
                  <span className="text-[10px] text-[#78716C]">
                    {uploading ? "上传中..." : "上传"}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowFormModal(false)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "保存中..." : editingItem ? "保存修改" : "创建发票"}
            </button>
          </div>
        </div>
      </Modal>

      {/* 详情 Modal */}
      <Modal
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
        title="发票详情"
        maxWidth="640px"
      >
        {detailItem && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[17px] text-[#1C1917] font-mono">
                  {detailItem.invoiceNo}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`ios-badge ${getInvoiceTypeBadge(detailItem.invoiceType)}`}
                >
                  {detailItem.invoiceType}
                </span>
                <span
                  className={`ios-badge ${statusConfig[detailItem.status]?.color || "ios-badge-gray"}`}
                >
                  {statusConfig[detailItem.status]?.label || detailItem.status}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-[#FAFAF9] p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[12px] text-[#78716C]">发票代码</span>
                  <p className="text-[13px] text-[#1C1917] font-mono mt-0.5">
                    {detailItem.invoiceCode || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#78716C]">发票方向</span>
                  <p
                    className={`text-[13px] font-medium mt-0.5 ${
                      detailItem.invoiceCategory === "收票"
                        ? "text-[#1C1917]"
                        : "text-[#78716C]"
                    }`}
                  >
                    {detailItem.invoiceCategory}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#78716C]">开票日期</span>
                  <p className="text-[13px] text-[#1C1917] mt-0.5">
                    {formatDate(detailItem.invoiceDate)}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#78716C]">来源类型</span>
                  <p className="text-[13px] text-[#1C1917] mt-0.5">
                    {sourceTypeMap[detailItem.sourceType] || detailItem.sourceType}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-[#FAFAF9] p-3 text-center">
                <span className="text-[11px] text-[#78716C] block">不含税金额</span>
                <p className="text-[15px] font-semibold text-[#1C1917] font-mono mt-1">
                  ¥{formatAmount(detailItem.amount)}
                </p>
              </div>
              <div className="rounded-xl bg-[#FAFAF9] p-3 text-center">
                <span className="text-[11px] text-[#78716C] block">
                  税额 ({(detailItem.taxRate * 100).toFixed(0)}%)
                </span>
                <p className="text-[15px] font-semibold text-[#78716C] font-mono mt-1">
                  ¥{formatAmount(detailItem.taxAmount)}
                </p>
              </div>
              <div className="rounded-xl bg-[#FAFAF9] p-3 text-center">
                <span className="text-[11px] text-[#78716C] block">价税合计</span>
                <p className="text-[15px] font-semibold text-[#1C1917] font-mono mt-1">
                  ¥{formatAmount(detailItem.totalAmount)}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[#E7E5E4] p-4 space-y-3">
              <div>
                <span className="text-[12px] text-[#78716C]">销方信息</span>
                <p className="text-[13px] text-[#1C1917] mt-0.5">
                  {detailItem.sellerName || "-"}
                </p>
                <p className="text-[12px] text-[#78716C] font-mono mt-0.5">
                  {detailItem.sellerTaxNo || "-"}
                </p>
              </div>
              <div className="h-px bg-[#F5F5F4]" />
              <div>
                <span className="text-[12px] text-[#78716C]">购方信息</span>
                <p className="text-[13px] text-[#1C1917] mt-0.5">
                  {detailItem.buyerName || "-"}
                </p>
                <p className="text-[12px] text-[#78716C] font-mono mt-0.5">
                  {detailItem.buyerTaxNo || "-"}
                </p>
              </div>
            </div>

            {detailItem.project && (
              <div>
                <span className="text-[12px] text-[#78716C]">关联项目</span>
                <p className="text-[13px] text-[#1C1917] mt-0.5">
                  {detailItem.project.name} ({detailItem.project.projectCode})
                </p>
              </div>
            )}

            {detailItem.remark && (
              <div>
                <span className="text-[12px] text-[#78716C]">备注</span>
                <p className="text-[13px] text-[#1C1917] mt-0.5">
                  {detailItem.remark}
                </p>
              </div>
            )}

            {detailItem.attachments && detailItem.attachments.length > 0 && (
              <div>
                <span className="text-[12px] text-[#78716C] block mb-2">
                  发票扫描件
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {detailItem.attachments.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-xl border border-[#E7E5E4] overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      <img
                        src={url}
                        alt={`扫描件 ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[11px] text-[#A8A29E] pt-2 border-t border-[#F5F5F4]">
              创建时间: {new Date(detailItem.createdAt).toLocaleString("zh-CN")} ·
              更新时间: {new Date(detailItem.updatedAt).toLocaleString("zh-CN")}
            </div>
          </div>
        )}
      </Modal>

      {/* 删除确认 Modal */}
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
            确定要删除发票{" "}
            <span className="font-mono font-semibold">{deleteConfirm?.invoiceNo}</span>{" "}
            吗？
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

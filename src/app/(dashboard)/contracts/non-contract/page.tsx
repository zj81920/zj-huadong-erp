"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  ArrowUpCircle,
  ArrowDownCircle,
  ChevronRight,
  X,
  FileText,
} from "lucide-react";
import Modal from "@/components/Modal";
import AdminStatusOverride from "@/components/AdminStatusOverride";
import ProjectPicker from "@/components/ProjectPicker";
import { ApprovalTimeline } from "@/components/ApprovalComponents";
import { useAuth } from "@/contexts/AuthContext";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { BatchDeleteBar } from "@/components/BatchDeleteBar";

interface Project {
  id: string;
  projectSourceId: string;
  name: string;
  projectCode: string;
}

interface ProjectLeadItem {
  id: string;
  projectSourceId: string;
  projectName: string;
  customerId: string;
  customer: { id: string; name: string };
  currentStatus: string;
  project: { id: string; projectCode: string; name: string; status: string } | null;
}

interface NonContractRecord {
  id: string;
  projectSourceId: string | null;
  amount: number;
  transactionDate: string;
  counterparty: string;
  description: string | null;
  invoicedAmount: number;
  status: "草稿" | "审批中" | "已批准" | "已驳回";
  approvalInstanceId: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  project: Project | null;
}

interface NonContractFormData {
  counterparty: string;
  amount: string;
  transactionDate: string;
  projectSourceId: string;
  description: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type TabType = "income" | "expense";

const emptyForm: NonContractFormData = {
  counterparty: "",
  amount: "",
  transactionDate: "",
  projectSourceId: "",
  description: "",
};

const statusConfig: Record<string, { color: string; label: string }> = {
  草稿: { color: "ios-badge-gray", label: "草稿" },
  审批中: { color: "ios-badge-orange", label: "审批中" },
  已批准: { color: "ios-badge-green", label: "已批准" },
  已驳回: { color: "ios-badge-red", label: "已驳回" },
};

const statusFlow: Record<string, string[]> = {
  草稿: ["审批中"],
  审批中: [],
  已批准: [],
  已驳回: [],
};

const statusActionsMap: Record<string, string> = {
  草稿: "提交审批",
  审批中: "确认通过",
};

export default function NonContractPage() {
  const { user } = useAuth();
  const isAdminUser = user?.username === "admin";
  const [activeTab, setActiveTab] = useState<TabType>("income");
  const [records, setRecords] = useState<NonContractRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProject, setFilterProject] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<NonContractRecord | null>(null);
  const [form, setForm] = useState<NonContractFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLeads, setProjectLeads] = useState<ProjectLeadItem[]>([]);

  const [detailRecord, setDetailRecord] = useState<NonContractRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<NonContractRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [expenseInvoices, setExpenseInvoices] = useState<any[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNo: "",
    invoiceCode: "",
    invoiceType: "增值税专用发票",
    invoiceDate: new Date().toISOString().split("T")[0],
    amount: "",
    taxRate: "6",
    taxAmount: "",
    totalAmount: "",
    sellerName: "",
    sellerTaxNo: "",
    remark: "",
  });
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceReceiptId, setInvoiceReceiptId] = useState<string | null>(null);

  const [approvalInstance, setApprovalInstance] = useState<any>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);

  const { toggleSelect, selectAll, clearSelection, isAllSelected, selectedCount, isSelected } = useBatchSelection(records.map((d) => d.id));

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

  const apiUrl = activeTab === "income" ? "/api/non-contract-incomes" : "/api/non-contract-expenses";

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects?pageSize=200");
      const json = await res.json();
      if (res.ok) {
        setProjects(
          json.data.map((p: { id: string; projectSourceId: string; name: string; projectCode: string }) => ({
            id: p.id,
            projectSourceId: p.projectSourceId,
            name: p.name,
            projectCode: p.projectCode,
          }))
        );
      }
    } catch (err) {
      console.error("获取项目列表失败:", err);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      if (filterProject) params.set("projectSourceId", filterProject);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`${apiUrl}?${params}`);
      const json = await res.json();
      if (res.ok) {
        setRecords(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取数据失败:", err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, search, filterStatus, filterProject, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchProjects();
    const fetchProjectLeads = async () => {
      try {
        const res = await fetch("/api/project-leads?pageSize=200");
        if (res.ok) {
          const json = await res.json();
          setProjectLeads(
            (json.data || []).filter(
              (l: { currentStatus: string }) => l.currentStatus !== "放弃"
            )
          );
        }
      } catch {
        setProjectLeads([]);
      }
    };
    fetchProjectLeads();
  }, [fetchProjects]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    const amt = parseFloat(invoiceForm.amount) || 0;
    const rate = parseFloat(invoiceForm.taxRate) / 100 || 0;
    const tax = amt * rate;
    setInvoiceForm(prev => ({ ...prev, taxAmount: tax.toFixed(2), totalAmount: (amt + tax).toFixed(2) }));
  }, [invoiceForm.amount, invoiceForm.taxRate]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearch("");
    setFilterStatus("");
    setFilterProject("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (record: NonContractRecord) => {
    setEditingRecord(record);
    setForm({
      counterparty: record.counterparty,
      amount: String(record.amount),
      transactionDate: record.transactionDate ? record.transactionDate.split("T")[0] : "",
      projectSourceId: record.projectSourceId || "",
      description: record.description || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.counterparty) {
      setFormError("请填写交易对方");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setFormError("请填写有效金额");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const url = editingRecord ? `${apiUrl}/${editingRecord.id}` : apiUrl;
      const method = editingRecord ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        counterparty: form.counterparty,
        amount: Number(form.amount),
        transactionDate: form.transactionDate || null,
        description: form.description || null,
        projectSourceId: form.projectSourceId || null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchRecords();
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
    if (deleteConfirm.status !== "草稿" && deleteConfirm.status !== "已驳回" && !isAdminUser) {
      alert("该记录已进入审批流程，仅管理员可删除");
      setDeleteConfirm(null);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`${apiUrl}/${deleteConfirm.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchRecords();
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

  const handleStatusChange = async (record: NonContractRecord, newStatus: string) => {
    try {
      const res = await fetch(`${apiUrl}/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchRecords();
      } else {
        const json = await res.json();
        alert(json.error || "状态变更失败");
      }
    } catch {
      alert("网络错误");
    }
  };

  const handleSubmitApproval = async (record: NonContractRecord) => {
    try {
      const res = await fetch("/api/approval-instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: activeTab === "income" ? "non_contract_income" : "non_contract_expense",
          businessId: record.id,
          flowLevel: "common",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        fetchRecords();
      } else {
        alert(json.error || "提交审批失败");
      }
    } catch {
      alert("网络错误");
    }
  };

  const fetchExpenseInvoices = async (expenseId: string) => {
    try {
      const res = await fetch(`/api/invoices?sourceType=non_contract_expense&sourceId=${expenseId}`);
      if (res.ok) {
        const json = await res.json();
        setExpenseInvoices(json.data || []);
      }
    } catch {}
  };

  const handleInvoiceSubmit = async () => {
    if (!invoiceForm.invoiceNo.trim()) {
      setInvoiceError("请输入发票号码");
      return;
    }
    if (!invoiceForm.amount || parseFloat(invoiceForm.amount) <= 0) {
      setInvoiceError("不含税金额必须大于0");
      return;
    }
    if (!invoiceReceiptId) return;

    setInvoiceSubmitting(true);
    setInvoiceError("");
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNo: invoiceForm.invoiceNo,
          invoiceCode: invoiceForm.invoiceCode || null,
          invoiceType: invoiceForm.invoiceType,
          invoiceDate: invoiceForm.invoiceDate || null,
          amount: parseFloat(invoiceForm.amount) || 0,
          taxRate: parseFloat(invoiceForm.taxRate) / 100,
          taxAmount: parseFloat(invoiceForm.taxAmount) || 0,
          totalAmount: parseFloat(invoiceForm.totalAmount) || 0,
          sellerName: invoiceForm.sellerName || null,
          sellerTaxNo: invoiceForm.sellerTaxNo || null,
          remark: invoiceForm.remark || null,
          invoiceCategory: "收票",
          sourceType: "non_contract_expense",
          sourceId: invoiceReceiptId,
          status: "已登记",
        }),
      });
      if (res.ok) {
        setShowInvoiceModal(false);
        setInvoiceForm({
          invoiceNo: "",
          invoiceCode: "",
          invoiceType: "增值税专用发票",
          invoiceDate: new Date().toISOString().split("T")[0],
          amount: "",
          taxRate: "6",
          taxAmount: "",
          totalAmount: "",
          sellerName: "",
          sellerTaxNo: "",
          remark: "",
        });
        fetchExpenseInvoices(invoiceReceiptId);
        fetchRecords();
      } else {
        const json = await res.json();
        setInvoiceError(json.error || "登记失败");
      }
    } catch {
      setInvoiceError("登记失败");
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  const updateForm = (field: keyof NonContractFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatAmount = (amount: number, type: TabType) => {
    const formatted = `¥${Number(amount).toLocaleString("zh-CN")}`;
    return type === "income" ? (
      <span className="text-[#34C759] font-semibold">{formatted}</span>
    ) : (
      <span className="text-[#FF3B30] font-semibold">{formatted}</span>
    );
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig["草稿"];
    return <span className={`ios-badge ${config.color}`}>{config.label}</span>;
  };

  const tabLabel = activeTab === "income" ? "非合同收入" : "非合同支出";
  const isIncome = activeTab === "income";

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>非合同收支</h1>
            <p>管理非合同收入与支出，支持按项目或公司级记录</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增{isIncome ? "收入" : "支出"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <button
          className={`ios-btn ${isIncome ? "ios-btn-primary" : "ios-btn-secondary"}`}
          onClick={() => handleTabChange("income")}
        >
          <ArrowUpCircle className="w-4 h-4" />
          非合同收入
        </button>
        <button
          className={`ios-btn ${!isIncome ? "ios-btn-primary" : "ios-btn-secondary"}`}
          onClick={() => handleTabChange("expense")}
        >
          <ArrowDownCircle className="w-4 h-4" />
          非合同支出
        </button>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索交易对方、描述..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
          </div>

          <select
            className="ios-select w-[140px]"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部状态</option>
            <option value="草稿">草稿</option>
            <option value="审批中">审批中</option>
            <option value="已批准">已批准</option>
            <option value="已驳回">已驳回</option>
          </select>

          <select
            className="ios-select w-[180px]"
            value={filterProject}
            onChange={(e) => {
              setFilterProject(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部项目</option>
            {projectLeads.map((l) => (
              <option key={l.projectSourceId} value={l.projectSourceId}>
                {l.projectSourceId} - {l.projectName}
              </option>
            ))}
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
        ) : records.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
              {isIncome ? (
                <ArrowUpCircle className="w-8 h-8 text-[#86868B]" />
              ) : (
                <ArrowDownCircle className="w-8 h-8 text-[#86868B]" />
              )}
            </div>
            <p>{search || filterStatus || filterProject ? `没有匹配的${tabLabel}记录` : `暂无${tabLabel}记录，点击右上角新增`}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  {isAdminUser && <th className="w-10"><input type="checkbox" className="ios-checkbox" checked={isAllSelected} onChange={() => isAllSelected ? clearSelection() : selectAll()} /></th>}
                  <th>交易对方</th>
                  <th>金额</th>
                  <th>交易日期</th>
                  <th>项目源</th>
                  <th>描述</th>
                  <th>状态</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const nextStatuses = statusFlow[record.status] || [];
                  return (
                    <tr key={record.id} className={isSelected(record.id) ? "bg-[#007AFF]/5" : ""}>
                      {isAdminUser && <td className="w-10"><input type="checkbox" className="ios-checkbox" checked={isSelected(record.id)} onChange={() => toggleSelect(record.id)} /></td>}
                      <td className="font-semibold">{record.counterparty}</td>
                      <td>{formatAmount(record.amount, activeTab)}</td>
                      <td className="text-[#86868B]">{formatDate(record.transactionDate)}</td>
                      <td>
                        {record.projectSourceId ? (
                          <div>
                            <span className="font-mono text-[13px] font-semibold text-[#007AFF]">
                              {record.projectSourceId}
                            </span>
                            {record.project && (
                              <p className="text-[11px] text-[#86868B] mt-0.5">{record.project.name}</p>
                            )}
                          </div>
                        ) : (
                          <span className="ios-badge ios-badge-blue">公司级</span>
                        )}
                      </td>
                      <td className="text-[#86868B] max-w-[200px] truncate">
                        {record.description || "-"}
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(record.status)}
                          {!isIncome && record.invoicedAmount > 0 && (
                            <span className="ios-badge ios-badge-blue text-[11px]">
                              已收票 ¥{Number(record.invoicedAmount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={() => {
                              setDetailRecord(record);
                              setApprovalInstance(null);
                              if (record.approvalInstanceId) {
                                fetchApprovalInstance(record.approvalInstanceId);
                              }
                              if (!isIncome) {
                                fetchExpenseInvoices(record.id);
                              }
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={() => handleOpenEdit(record)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!isIncome && (
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF]!"
                              title="登记发票"
                              onClick={() => {
                                setInvoiceReceiptId(record.id);
                                setInvoiceError("");
                                setInvoiceForm({
                                  invoiceNo: "",
                                  invoiceCode: "",
                                  invoiceType: "增值税专用发票",
                                  invoiceDate: new Date().toISOString().split("T")[0],
                                  amount: String(record.amount),
                                  taxRate: "6",
                                  taxAmount: "",
                                  totalAmount: "",
                                  sellerName: record.counterparty || "",
                                  sellerTaxNo: "",
                                  remark: "",
                                });
                                fetchExpenseInvoices(record.id);
                                setShowInvoiceModal(true);
                              }}
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(record.status === "草稿" || record.status === "已驳回" || isAdminUser) && (
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                              onClick={() => setDeleteConfirm(record)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {nextStatuses.length > 0 && (
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF]!"
                              onClick={() => {
                                if (nextStatuses[0] === "审批中") {
                                  handleSubmitApproval(record);
                                } else {
                                  handleStatusChange(record, nextStatuses[0]);
                                }
                              }}
                              title={statusActionsMap[record.status]}
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="text-[#86868B] text-[12px] whitespace-nowrap">
                        {record.lastModifiedBy && (
                          <span>{record.lastModifiedBy}</span>
                        )}
                        <span className="block text-[11px]">{formatDate(record.updatedAt)}</span>
                      </td>
                    </tr>
                  );
                })}
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

        {isAdminUser && <BatchDeleteBar businessType={activeTab === "income" ? "non_contract_income" : "non_contract_expense"} selectedIds={records.filter(d => isSelected(d.id)).map(d => d.id)} onDeleteSuccess={fetchRecords} onClear={clearSelection} />}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingRecord ? `编辑${tabLabel}` : `新增${tabLabel}`}
        maxWidth="600px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                交易对方 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入交易对方名称"
                value={form.counterparty}
                onChange={(e) => updateForm("counterparty", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                金额（元） <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="number"
                className="ios-input"
                placeholder="请输入金额"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => updateForm("amount", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                交易日期
              </label>
              <input
                type="date"
                className="ios-input"
                value={form.transactionDate}
                onChange={(e) => updateForm("transactionDate", e.target.value)}
              />
            </div>

            <div>
              <ProjectPicker
                projectLeads={projectLeads}
                value={form.projectSourceId}
                onChange={(id) => setForm((prev) => ({ ...prev, projectSourceId: id }))}
                label="关联项目"
                placeholder="不关联（公司级）"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                描述
              </label>
              <textarea
                className="ios-textarea"
                placeholder="请输入描述信息"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>
              取消
            </button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "保存中..." : editingRecord ? "保存修改" : `创建${tabLabel}记录`}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailRecord}
        onClose={() => { setDetailRecord(null); setExpenseInvoices([]); }}
        title={`${tabLabel}详情`}
        maxWidth="600px"
      >
        {detailRecord && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F0F0F0]">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  isIncome ? "bg-[#34C759]/10" : "bg-[#FF3B30]/10"
                }`}
              >
                {isIncome ? (
                  <ArrowUpCircle className="w-6 h-6 text-[#34C759]" />
                ) : (
                  <ArrowDownCircle className="w-6 h-6 text-[#FF3B30]" />
                )}
              </div>
              <div>
                <p className="text-[17px] font-bold text-[#1D1D1F]">{detailRecord.counterparty}</p>
                <p className="text-[13px] text-[#86868B]">
                  {isIncome ? "收入" : "支出"} · {formatDate(detailRecord.transactionDate)}
                </p>
              </div>
              <span className="ml-auto">
                <AdminStatusOverride
                  businessType={isIncome ? "non_contract_income" : "non_contract_expense"}
                  businessId={detailRecord.id}
                  currentStatus={detailRecord.status}
                  onStatusChanged={(newStatus) => {
                    setDetailRecord(prev => prev ? { ...prev, status: newStatus as NonContractRecord["status"] } : prev);
                    setRecords(prev => prev.map(r => r.id === detailRecord.id ? { ...r, status: newStatus as NonContractRecord["status"] } : r));
                  }}
                  size="md"
                />
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">金额</p>
                <p className={`text-[14px] font-semibold ${isIncome ? "text-[#34C759]" : "text-[#FF3B30]"}`}>
                  ¥{Number(detailRecord.amount).toLocaleString("zh-CN")}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">交易日期</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">
                  {formatDate(detailRecord.transactionDate)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">项目源</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">
                  {detailRecord.projectSourceId ? (
                    <span>
                      <span className="font-mono text-[#007AFF]">{detailRecord.projectSourceId}</span>
                      {detailRecord.project && (
                        <span className="text-[#86868B] text-[12px] ml-1.5">{detailRecord.project.name}</span>
                      )}
                    </span>
                  ) : (
                    <span className="ios-badge ios-badge-blue">公司级</span>
                  )}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">创建时间</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{formatDate(detailRecord.createdAt)}</p>
              </div>
              {detailRecord.description && (
                <div className="p-3 rounded-xl bg-[#F5F5F7] col-span-2">
                  <p className="text-[12px] text-[#86868B] mb-1">描述</p>
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">{detailRecord.description}</p>
                </div>
              )}
            </div>

            {!isIncome && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#86868B]" />
                    <p className="text-[13px] font-semibold text-[#1D1D1F]">
                      发票登记 ({expenseInvoices.length})
                    </p>
                  </div>
                  <button
                    className="ios-btn ios-btn-primary ios-btn-sm"
                    onClick={() => {
                      setInvoiceError("");
                      setInvoiceForm({
                        invoiceNo: "",
                        invoiceCode: "",
                        invoiceType: "增值税专用发票",
                        invoiceDate: new Date().toISOString().split("T")[0],
                        amount: String(detailRecord.amount),
                        taxRate: "6",
                        taxAmount: "",
                        totalAmount: "",
                        sellerName: detailRecord.counterparty || "",
                        sellerTaxNo: "",
                        remark: "",
                      });
                      setInvoiceReceiptId(detailRecord.id);
                      setShowInvoiceModal(true);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    登记发票
                  </button>
                </div>

                {expenseInvoices.length > 0 ? (
                  <>
                    <table className="ios-table text-[12px]">
                      <thead>
                        <tr>
                          <th>发票号码</th>
                          <th>发票类型</th>
                          <th>价税合计</th>
                          <th>开票日期</th>
                          <th>状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseInvoices.map((inv) => (
                          <tr key={inv.id}>
                            <td className="font-medium font-mono">{inv.invoiceNo}</td>
                            <td>
                              <span className="ios-badge ios-badge-blue text-[11px]">{inv.invoiceType}</span>
                            </td>
                            <td className="font-mono font-semibold text-[#007AFF]">
                              ¥{parseFloat(inv.totalAmount || inv.amount || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-[#86868B]">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("zh-CN") : "-"}</td>
                            <td>
                              <span className="ios-badge ios-badge-gray">{inv.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3 p-3 rounded-xl bg-[#F5F5F7]">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[#86868B]">已收票金额 / 支出金额</span>
                        <span className="text-[13px] font-semibold text-[#1D1D1F]">
                          ¥{expenseInvoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.totalAmount || inv.amount || 0)), 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                          {" / "}
                          ¥{Number(detailRecord.amount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#E5E5EA] overflow-hidden mt-2">
                        <div
                          className="h-full rounded-full bg-[#007AFF] transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (expenseInvoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.totalAmount || inv.amount || 0)), 0) / Math.max(0.01, detailRecord.amount)) * 100).toFixed(1)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-[#86868B] text-[13px] rounded-xl bg-[#F5F5F7]">
                    暂无发票记录
                  </div>
                )}
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
          <div className="w-14 h-14 rounded-full bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#FF3B30]" />
          </div>
          <p className="text-[15px] text-[#1D1D1F] mb-1">确定要删除该{tabLabel}记录吗？</p>
          <p className="text-[13px] text-[#86868B] mb-6">此操作不可撤销</p>
          <div className="flex justify-center gap-3">
            <button className="ios-btn ios-btn-secondary" onClick={() => setDeleteConfirm(null)}>
              取消
            </button>
            <button className="ios-btn ios-btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title="登记发票"
        maxWidth="640px"
      >
        <div className="space-y-4">
          {invoiceError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">
              {invoiceError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                发票号码 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入发票号码"
                value={invoiceForm.invoiceNo}
                onChange={(e) => {
                  setInvoiceForm(prev => ({ ...prev, invoiceNo: e.target.value }));
                  if (invoiceError) setInvoiceError("");
                }}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">发票代码</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入发票代码"
                value={invoiceForm.invoiceCode}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoiceCode: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">发票类型</label>
              <select
                className="ios-select"
                value={invoiceForm.invoiceType}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoiceType: e.target.value }))}
              >
                <option value="增值税专用发票">增值税专用发票</option>
                <option value="增值税普通发票">增值税普通发票</option>
                <option value="增值税电子发票">增值税电子发票</option>
                <option value="收据">收据</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">开票日期</label>
              <input
                type="date"
                className="ios-input"
                value={invoiceForm.invoiceDate}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                不含税金额 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="ios-input"
                placeholder="请输入不含税金额"
                value={invoiceForm.amount}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">税率</label>
              <select
                className="ios-select"
                value={invoiceForm.taxRate}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, taxRate: e.target.value }))}
              >
                <option value="3">3%</option>
                <option value="6">6%</option>
                <option value="9">9%</option>
                <option value="13">13%</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">税额（自动计算）</label>
              <input
                type="text"
                className="ios-input bg-[#F5F5F7]"
                value={invoiceForm.taxAmount ? `¥${invoiceForm.taxAmount}` : ""}
                readOnly
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">价税合计（自动计算）</label>
              <input
                type="text"
                className="ios-input bg-[#F5F5F7] font-semibold text-[#007AFF]"
                value={invoiceForm.totalAmount ? `¥${invoiceForm.totalAmount}` : ""}
                readOnly
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">销方名称</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入销方名称"
                value={invoiceForm.sellerName}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, sellerName: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">销方税号</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入纳税人识别号"
                value={invoiceForm.sellerTaxNo}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, sellerTaxNo: e.target.value }))}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">备注</label>
              <textarea
                className="ios-input min-h-[60px] resize-none"
                placeholder="备注信息"
                value={invoiceForm.remark}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, remark: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowInvoiceModal(false)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleInvoiceSubmit}
              disabled={invoiceSubmitting}
            >
              {invoiceSubmitting ? "提交中..." : "确认登记"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

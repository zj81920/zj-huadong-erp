"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Calculator,
  DollarSign,
  TrendingUp,
  FileText,
  MapPin,
  Calendar,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Customer {
  id: string;
  name: string;
  industryType: string | null;
}

interface Quotation {
  id: string;
  projectSourceId: string | null;
  customerId: string;
  estimatedCost: Record<string, unknown>;
  totalAmount: number;
  profitMargin: number | null;
  approvalStatus: string;
  version: number;
  adjustmentReason: string | null;
  createdAt: string;
  customer: Customer;
  projectLead: { id: string; projectSourceId: string; projectName: string } | null;
}

interface QuotationFormData {
  projectSourceId: string;
  customerId: string;
  laborCost: string;
  travelCost: string;
  otherCost: string;
  totalAmount: string;
  profitMargin: string;
  adjustmentReason: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const emptyForm: QuotationFormData = {
  projectSourceId: "",
  customerId: "",
  laborCost: "0",
  travelCost: "0",
  otherCost: "0",
  totalAmount: "",
  profitMargin: "",
  adjustmentReason: "",
};

const approvalStatusConfig: Record<string, { color: string; label: string }> = {
  "草稿": { color: "ios-badge-gray", label: "草稿" },
  "审批中": { color: "ios-badge-orange", label: "审批中" },
  "已审批": { color: "ios-badge-green", label: "已审批" },
  "已驳回": { color: "ios-badge-red", label: "已驳回" },
};

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, pageSize: 20, total: 0, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [form, setForm] = useState<QuotationFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projectLeads, setProjectLeads] = useState<{ projectSourceId: string; projectName: string; customerId: string; customerName?: string }[]>([]);

  const [detailQuotation, setDetailQuotation] = useState<Quotation | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Quotation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadForm, setLeadForm] = useState({
    customerId: "",
    projectName: "",
    location: "",
    estimatedInvestment: "",
    bidReleaseTime: "",
    infoSource: "",
    currentStatus: "潜在",
  });
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [leadCustomers, setLeadCustomers] = useState<Customer[]>([]);

  const [showLeadCustomerModal, setShowLeadCustomerModal] = useState(false);
  const [leadCustomerForm, setLeadCustomerForm] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    industryType: "",
    customerGrade: "C",
  });
  const [leadCustomerSaving, setLeadCustomerSaving] = useState(false);
  const [leadCustomerError, setLeadCustomerError] = useState("");

  const fetchOptions = useCallback(async () => {
    try {
      const [custRes, leadRes] = await Promise.all([
        fetch("/api/customers?pageSize=200"),
        fetch("/api/project-leads?pageSize=200"),
      ]);
      const custJson = await custRes.json();
      const leadJson = await leadRes.json();
      if (custRes.ok) setCustomers(custJson.data);
      if (leadRes.ok) setProjectLeads(leadJson.data.map((l: { projectSourceId: string; projectName: string; customerId: string; customer?: { name: string } }) => ({ projectSourceId: l.projectSourceId, projectName: l.projectName, customerId: l.customerId, customerName: l.customer?.name || "" })));
    } catch (err) {
      console.error("获取选项数据失败:", err);
    }
  }, []);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStatus) params.set("approvalStatus", filterStatus);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/quotations?${params}`);
      const json = await res.json();
      if (res.ok) {
        setQuotations(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取报价单列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const handleOpenCreate = () => {
    setEditingQuotation(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (quotation: Quotation) => {
    setEditingQuotation(quotation);
    const ec = (quotation.estimatedCost || {}) as Record<string, string>;
    setForm({
      projectSourceId: quotation.projectSourceId || "",
      customerId: quotation.customerId,
      laborCost: ec.labor || "0",
      travelCost: ec.travel || "0",
      otherCost: ec.other || "0",
      totalAmount: String(quotation.totalAmount),
      profitMargin: quotation.profitMargin ? String(quotation.profitMargin) : "",
      adjustmentReason: quotation.adjustmentReason || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.customerId) {
      setFormError("请选择客户");
      return;
    }
    if (!form.projectSourceId) {
      setFormError("请选择关联项目线索");
      return;
    }
    if (!form.totalAmount || parseFloat(form.totalAmount) <= 0) {
      setFormError("报价总金额必须大于0");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const estimatedCost = {
        labor: form.laborCost || "0",
        travel: form.travelCost || "0",
        other: form.otherCost || "0",
      };

      const payload = {
        projectSourceId: form.projectSourceId,
        customerId: form.customerId,
        estimatedCost,
        totalAmount: form.totalAmount,
        profitMargin: form.profitMargin || null,
        adjustmentReason: form.adjustmentReason || null,
      };

      const url = editingQuotation
        ? `/api/quotations/${editingQuotation.id}`
        : "/api/quotations";
      const method = editingQuotation ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchQuotations();
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
      const res = await fetch(`/api/quotations/${deleteConfirm.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchQuotations();
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

  const updateForm = (field: keyof QuotationFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const fetchLeadCustomers = async () => {
    try {
      const res = await fetch("/api/customers?pageSize=200");
      const json = await res.json();
      if (res.ok) setLeadCustomers(json.data);
    } catch (err) {
      console.error("获取客户列表失败:", err);
    }
  };

  const fetchLeadOptions = async () => {
    try {
      const res = await fetch("/api/project-leads?pageSize=200");
      const json = await res.json();
      if (res.ok) setProjectLeads(json.data.map((l: { projectSourceId: string; projectName: string; customerId: string; customer?: { name: string } }) => ({ projectSourceId: l.projectSourceId, projectName: l.projectName, customerId: l.customerId, customerName: l.customer?.name || "" })));
    } catch (err) {
      console.error("获取项目线索失败:", err);
    }
  };

  const handleOpenLeadModal = () => {
    setLeadForm({
      customerId: "",
      projectName: "",
      location: "",
      estimatedInvestment: "",
      bidReleaseTime: "",
      infoSource: "",
      currentStatus: "潜在",
    });
    setLeadError("");
    fetchLeadCustomers();
    setShowLeadModal(true);
  };

  const handleCreateLead = async () => {
    if (!leadForm.customerId) {
      setLeadError("请选择客户");
      return;
    }
    if (!leadForm.projectName.trim()) {
      setLeadError("请输入项目名称");
      return;
    }

    setLeadSaving(true);
    setLeadError("");

    try {
      const res = await fetch("/api/project-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadForm),
      });
      const json = await res.json();
      if (res.ok) {
        await fetchLeadOptions();
        fetchOptions();
        setForm((prev) => ({ ...prev, customerId: leadForm.customerId, projectSourceId: json.data.projectSourceId }));
        setShowLeadModal(false);
        setLeadForm({
          customerId: "",
          projectName: "",
          location: "",
          estimatedInvestment: "",
          bidReleaseTime: "",
          infoSource: "",
          currentStatus: "潜在",
        });
      } else {
        setLeadError(json.error || "创建项目线索失败");
      }
    } catch {
      setLeadError("网络错误，请重试");
    } finally {
      setLeadSaving(false);
    }
  };

  const handleOpenLeadCustomerModal = () => {
    setLeadCustomerForm({
      name: "",
      contactPerson: "",
      phone: "",
      industryType: "",
      customerGrade: "C",
    });
    setLeadCustomerError("");
    setShowLeadCustomerModal(true);
  };

  const handleCreateLeadCustomer = async () => {
    if (!leadCustomerForm.name.trim()) {
      setLeadCustomerError("请输入客户名称");
      return;
    }

    setLeadCustomerSaving(true);
    setLeadCustomerError("");

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadCustomerForm),
      });
      const json = await res.json();
      if (res.ok) {
        await fetchLeadCustomers();
        fetchOptions();
        setLeadForm((prev) => ({ ...prev, customerId: json.data.id }));
        setShowLeadCustomerModal(false);
        setLeadCustomerForm({
          name: "",
          contactPerson: "",
          phone: "",
          industryType: "",
          customerGrade: "C",
        });
      } else {
        setLeadCustomerError(json.error || "创建客户失败");
      }
    } catch {
      setLeadCustomerError("网络错误，请重试");
    } finally {
      setLeadCustomerSaving(false);
    }
  };

  const formatMoney = (amount: number | null) => {
    if (!amount) return "-";
    return `¥${Number(amount).toLocaleString("zh-CN")}`;
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
            <h1>商务报价</h1>
            <p>管理报价单，估算成本与利润率</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新建报价
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
              placeholder="搜索客户、项目名称..."
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
            <option value="已审批">已审批</option>
            <option value="已驳回">已驳回</option>
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
        ) : quotations.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
              <Calculator className="w-8 h-8 text-[#86868B]" />
            </div>
            <p>{search || filterStatus ? "没有匹配的报价单" : "暂无报价单，点击右上角新建"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>客户</th>
                  <th>关联项目</th>
                  <th>报价金额</th>
                  <th>利润率</th>
                  <th>版本</th>
                  <th>审批状态</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((quotation) => {
                  const asc = approvalStatusConfig[quotation.approvalStatus] || approvalStatusConfig["草稿"];
                  return (
                    <tr key={quotation.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[11px] font-bold text-[#007AFF]">{quotation.customer.name[0]}</span>
                          </div>
                          <span className="font-semibold">{quotation.customer.name}</span>
                        </div>
                      </td>
                      <td>
                        {quotation.projectLead ? (
                          <span className="font-mono text-[12px] text-[#007AFF]">{quotation.projectLead.projectSourceId}</span>
                        ) : (
                          <span className="text-[#86868B]">-</span>
                        )}
                      </td>
                      <td className="font-semibold">{formatMoney(quotation.totalAmount)}</td>
                      <td>
                        {quotation.profitMargin ? (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5 text-[#34C759]" />
                            <span className="text-[#34C759] font-semibold">{quotation.profitMargin}%</span>
                          </span>
                        ) : "-"}
                      </td>
                      <td>
                        <span className="ios-badge ios-badge-gray">v{quotation.version}</span>
                      </td>
                      <td>
                        <span className={`ios-badge ${asc.color}`}>{asc.label}</span>
                      </td>
                      <td className="text-[#86868B]">{formatDate(quotation.createdAt)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => setDetailQuotation(quotation)}>
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={() => handleOpenEdit(quotation)}
                            disabled={quotation.approvalStatus === "已审批" || quotation.approvalStatus === "审批中"}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                            onClick={() => setDeleteConfirm(quotation)}
                            disabled={quotation.approvalStatus === "已审批" || quotation.approvalStatus === "审批中"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
                <span className="text-[13px] text-[#86868B] px-3">{pagination.page} / {pagination.totalPages}</span>
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
        title={editingQuotation ? "编辑报价单" : "新建报价单"}
        maxWidth="640px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">{formError}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                客户 <span className="text-[#FF3B30]">*</span>
              </label>
              <select className="ios-select" value={form.customerId} onChange={(e) => {
                updateForm("customerId", e.target.value);
                if (form.projectSourceId) updateForm("projectSourceId", "");
              }}>
                <option value="">请选择客户</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                关联项目线索 <span className="text-[#FF3B30]">*</span>
              </label>
              <div className="flex items-center gap-2">
                <select className="ios-select flex-1" value={form.projectSourceId} onChange={(e) => updateForm("projectSourceId", e.target.value)}>
                  <option value="">请选择项目线索</option>
                  {projectLeads
                    .filter((l) => !form.customerId || l.customerId === form.customerId)
                    .map((l) => (
                      <option key={l.projectSourceId} value={l.projectSourceId}>
                        {l.projectSourceId} - {l.projectName}
                      </option>
                    ))}
                </select>
                {!editingQuotation && (
                  <button
                    type="button"
                    className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF] whitespace-nowrap"
                    onClick={handleOpenLeadModal}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新增线索
                  </button>
                )}
              </div>
            </div>

            <div className="col-span-2 pt-2 pb-1">
              <p className="text-[13px] font-semibold text-[#1D1D1F]">成本估算</p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">人工成本（元）</label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input type="number" className="ios-input pl-10" placeholder="0" value={form.laborCost} onChange={(e) => updateForm("laborCost", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">差旅成本（元）</label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input type="number" className="ios-input pl-10" placeholder="0" value={form.travelCost} onChange={(e) => updateForm("travelCost", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">其他成本（元）</label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input type="number" className="ios-input pl-10" placeholder="0" value={form.otherCost} onChange={(e) => updateForm("otherCost", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                报价总金额（元） <span className="text-[#FF3B30]">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input type="number" className="ios-input pl-10" placeholder="报价总金额" value={form.totalAmount} onChange={(e) => updateForm("totalAmount", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">利润率（%）</label>
              <div className="relative">
                <TrendingUp className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input type="number" step="0.1" className="ios-input pl-10" placeholder="如 15.5" value={form.profitMargin} onChange={(e) => updateForm("profitMargin", e.target.value)} />
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">调整原因</label>
              <textarea className="ios-textarea" placeholder="如有调整，请说明原因" value={form.adjustmentReason} onChange={(e) => updateForm("adjustmentReason", e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "保存中..." : editingQuotation ? "保存修改" : "创建报价单"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailQuotation}
        onClose={() => setDetailQuotation(null)}
        title="报价单详情"
        maxWidth="680px"
      >
        {detailQuotation && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F0F0F0]">
              <div className="w-12 h-12 rounded-2xl bg-[#AF52DE]/10 flex items-center justify-center">
                <Calculator className="w-6 h-6 text-[#AF52DE]" />
              </div>
              <div>
                <p className="text-[17px] font-bold text-[#1D1D1F]">{detailQuotation.customer.name} - 报价单</p>
                <p className="text-[13px] text-[#86868B]">版本 v{detailQuotation.version}</p>
              </div>
              <span className={`ios-badge ml-auto ${approvalStatusConfig[detailQuotation.approvalStatus]?.color || "ios-badge-gray"}`}>
                {detailQuotation.approvalStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">关联项目</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">
                  {detailQuotation.projectLead ? detailQuotation.projectLead.projectName : "（无关联）"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">报价总金额</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{formatMoney(detailQuotation.totalAmount)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">利润率</p>
                <p className="text-[14px] font-semibold text-[#34C759]">
                  {detailQuotation.profitMargin ? `${detailQuotation.profitMargin}%` : "-"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">创建时间</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{formatDate(detailQuotation.createdAt)}</p>
              </div>
            </div>

            {detailQuotation.adjustmentReason && (
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">调整原因</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{detailQuotation.adjustmentReason}</p>
              </div>
            )}
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
          <p className="text-[15px] text-[#1D1D1F] mb-1">确定要删除该报价单吗？</p>
          <p className="text-[13px] text-[#86868B] mb-6">此操作不可撤销</p>
          <div className="flex justify-center gap-3">
            <button className="ios-btn ios-btn-secondary" onClick={() => setDeleteConfirm(null)}>取消</button>
            <button className="ios-btn ios-btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showLeadModal}
        onClose={() => setShowLeadModal(false)}
        title="新增项目线索"
        maxWidth="640px"
      >
        <div className="space-y-4">
          {leadError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">{leadError}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                客户 <span className="text-[#FF3B30]">*</span>
              </label>
              <div className="flex items-center gap-2">
                <select
                  className="ios-select flex-1"
                  value={leadForm.customerId}
                  onChange={(e) => { setLeadForm((prev) => ({ ...prev, customerId: e.target.value })); if (leadError) setLeadError(""); }}
                >
                  <option value="">请选择客户</option>
                  {leadCustomers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF] whitespace-nowrap"
                  onClick={handleOpenLeadCustomerModal}
                >
                  <Plus className="w-3.5 h-3.5" />
                  新增客户
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                项目名称 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入项目名称"
                value={leadForm.projectName}
                onChange={(e) => { setLeadForm((prev) => ({ ...prev, projectName: e.target.value })); if (leadError) setLeadError(""); }}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">项目地点</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="请输入项目地点"
                  value={leadForm.location}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, location: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">预计投资额（万元）</label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input
                  type="number"
                  className="ios-input pl-10"
                  placeholder="请输入预计投资额"
                  value={leadForm.estimatedInvestment}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, estimatedInvestment: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">投标截止时间</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input
                  type="date"
                  className="ios-input pl-10"
                  value={leadForm.bidReleaseTime}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, bidReleaseTime: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">信息来源</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入信息来源"
                value={leadForm.infoSource}
                onChange={(e) => setLeadForm((prev) => ({ ...prev, infoSource: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowLeadModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleCreateLead} disabled={leadSaving}>
              {leadSaving ? "保存中..." : "确认添加"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showLeadCustomerModal}
        onClose={() => setShowLeadCustomerModal(false)}
        title="新增客户"
        maxWidth="480px"
      >
        <div className="space-y-4">
          {leadCustomerError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">{leadCustomerError}</div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
              客户名称 <span className="text-[#FF3B30]">*</span>
            </label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入客户名称"
              value={leadCustomerForm.name}
              onChange={(e) => { setLeadCustomerForm((prev) => ({ ...prev, name: e.target.value })); if (leadCustomerError) setLeadCustomerError(""); }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">联系人</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入联系人"
                value={leadCustomerForm.contactPerson}
                onChange={(e) => setLeadCustomerForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">电话</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入电话"
                value={leadCustomerForm.phone}
                onChange={(e) => setLeadCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">行业类型</label>
              <select
                className="ios-select"
                value={leadCustomerForm.industryType}
                onChange={(e) => setLeadCustomerForm((prev) => ({ ...prev, industryType: e.target.value }))}
              >
                <option value="">请选择</option>
                <option value="石化">石化</option>
                <option value="医药">医药</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">客户等级</label>
              <select
                className="ios-select"
                value={leadCustomerForm.customerGrade}
                onChange={(e) => setLeadCustomerForm((prev) => ({ ...prev, customerGrade: e.target.value }))}
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowLeadCustomerModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleCreateLeadCustomer} disabled={leadCustomerSaving}>
              {leadCustomerSaving ? "保存中..." : "确认添加"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

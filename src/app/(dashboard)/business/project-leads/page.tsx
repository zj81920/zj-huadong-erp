"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Briefcase,
  MapPin,
  Calendar,
  DollarSign,
  ChevronRight,
  Info,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Customer {
  id: string;
  name: string;
  industryType: string | null;
}

interface ProjectLead {
  id: string;
  projectSourceId: string;
  customerId: string;
  projectName: string;
  location: string | null;
  estimatedInvestment: number | null;
  bidReleaseTime: string | null;
  infoSource: string | null;
  currentStatus: string;
  followUpRecords: unknown[];
  competitorInfo: unknown[];
  createdAt: string;
  updatedAt: string;
  customer: Customer;
  biddings?: unknown[];
  quotations?: unknown[];
}

interface LeadFormData {
  customerId: string;
  projectName: string;
  location: string;
  estimatedInvestment: string;
  bidReleaseTime: string;
  infoSource: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const emptyForm: LeadFormData = {
  customerId: "",
  projectName: "",
  location: "",
  estimatedInvestment: "",
  bidReleaseTime: "",
  infoSource: "",
};

const statusConfig: Record<string, { color: string; label: string }> = {
  "跟踪中": { color: "ios-badge-gray", label: "跟踪中" },
  "投标中": { color: "ios-badge-orange", label: "投标中" },
  "已中标": { color: "ios-badge-green", label: "已中标" },
  "报价中": { color: "ios-badge-blue", label: "报价中" },
  "落地": { color: "ios-badge-green", label: "落地" },
  "放弃": { color: "ios-badge-red", label: "放弃" },
  "已立项": { color: "ios-badge-purple", label: "已立项" },
};

const statusFlow: Record<string, string[]> = {
  "跟踪中": ["投标中", "报价中", "放弃"],
  "投标中": ["已中标", "放弃"],
  "已中标": [],
  "报价中": ["落地", "放弃"],
  "落地": [],
  "放弃": ["跟踪中"],
  "已立项": [],
};

export default function ProjectLeadsPage() {
  const [leads, setLeads] = useState<ProjectLead[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, pageSize: 20, total: 0, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<ProjectLead | null>(null);
  const [form, setForm] = useState<LeadFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);

  const [detailLead, setDetailLead] = useState<ProjectLead | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProjectLead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [statusChanging, setStatusChanging] = useState<string | null>(null);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    industryType: "",
    customerGrade: "C",
  });
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerError, setCustomerError] = useState("");

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/customers?pageSize=200");
      const json = await res.json();
      if (res.ok) setCustomers(json.data);
    } catch (err) {
      console.error("获取客户列表失败:", err);
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/project-leads?${params}`);
      const json = await res.json();
      if (res.ok) {
        setLeads(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取项目线索列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleOpenCreate = () => {
    setEditingLead(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (lead: ProjectLead) => {
    setEditingLead(lead);
    setForm({
      customerId: lead.customerId,
      projectName: lead.projectName,
      location: lead.location || "",
      estimatedInvestment: lead.estimatedInvestment ? String(lead.estimatedInvestment) : "",
      bidReleaseTime: lead.bidReleaseTime ? lead.bidReleaseTime.split("T")[0] : "",
      infoSource: lead.infoSource || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.customerId) {
      setFormError("请选择客户");
      return;
    }
    if (!form.projectName.trim()) {
      setFormError("项目名称不能为空");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const url = editingLead
        ? `/api/project-leads/${editingLead.id}`
        : "/api/project-leads";
      const method = editingLead ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchLeads();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (!customerForm.name.trim()) {
      setCustomerError("客户名称不能为空");
      return;
    }

    setCustomerSaving(true);
    setCustomerError("");

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerForm),
      });

      const json = await res.json();

      if (res.ok) {
        await fetchCustomers();
        setForm((prev) => ({ ...prev, customerId: json.data.id }));
        setShowCustomerModal(false);
        setCustomerForm({
          name: "",
          contactPerson: "",
          phone: "",
          industryType: "",
          customerGrade: "C",
        });
      } else {
        setCustomerError(json.error || "创建客户失败");
      }
    } catch {
      setCustomerError("网络错误，请重试");
    } finally {
      setCustomerSaving(false);
    }
  };

  const handleStatusChange = async (lead: ProjectLead, newStatus: string) => {
    setStatusChanging(lead.id);
    try {
      const res = await fetch(`/api/project-leads/${lead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStatus: newStatus }),
      });

      if (res.ok) {
        fetchLeads();
        if (detailLead?.id === lead.id) {
          setDetailLead({ ...detailLead, currentStatus: newStatus });
        }
      } else {
        const json = await res.json();
        alert(json.error || "状态更新失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setStatusChanging(null);
    }
  };

  const handleViewDetail = async (lead: ProjectLead) => {
    try {
      const res = await fetch(`/api/project-leads/${lead.id}`);
      const json = await res.json();
      if (res.ok) {
        setDetailLead(json.data);
      }
    } catch {
      setDetailLead(lead);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/project-leads/${deleteConfirm.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchLeads();
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

  const updateForm = (field: keyof LeadFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatMoney = (amount: number | null) => {
    if (!amount) return "-";
    return `¥${Number(amount).toLocaleString("zh-CN")}`;
  };

  const stats = {
    total: pagination.total,
    bidding: leads.filter((l) => l.currentStatus === "投标中").length,
    won: leads.filter((l) => l.currentStatus === "已中标").length,
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>市场开发</h1>
            <p>管理项目线索，跟踪从潜在到中标的全过程</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            登记线索
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-[#007AFF]" />
          </div>
          <div>
            <p className="text-[13px] text-[#86868B]">线索总数</p>
            <p className="text-[24px] font-bold text-[#1D1D1F] leading-tight">{stats.total}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#FF9500]/10 flex items-center justify-center">
            <Info className="w-5 h-5 text-[#FF9500]" />
          </div>
          <div>
            <p className="text-[13px] text-[#86868B]">投标中</p>
            <p className="text-[24px] font-bold text-[#FF9500] leading-tight">{stats.bidding}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#34C759]/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-[#34C759]" />
          </div>
          <div>
            <p className="text-[13px] text-[#86868B]">已中标</p>
            <p className="text-[24px] font-bold text-[#34C759] leading-tight">{stats.won}</p>
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
              placeholder="搜索项目ID、名称、地点..."
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
            <option value="跟踪中">跟踪中</option>
            <option value="投标中">投标中</option>
            <option value="已中标">已中标</option>
            <option value="报价中">报价中</option>
            <option value="落地">落地</option>
            <option value="放弃">放弃</option>
            <option value="已立项">已立项</option>
          </select>

          <div className="ml-auto text-[13px] text-[#86868B]">
            共 <span className="font-semibold text-[#1D1D1F]">{pagination.total}</span> 条线索
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
              <Briefcase className="w-8 h-8 text-[#86868B]" />
            </div>
            <p>{search || filterStatus ? "没有匹配的项目线索" : "暂无线索，点击右上角登记"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>项目源ID</th>
                  <th>项目名称</th>
                  <th>客户</th>
                  <th>预计投资</th>
                  <th>投标截止</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const sc = statusConfig[lead.currentStatus] || statusConfig["跟踪中"];
                  const nextStatuses = statusFlow[lead.currentStatus] || [];
                  return (
                    <tr key={lead.id}>
                      <td>
                        <span className="font-mono text-[13px] font-semibold text-[#007AFF]">
                          {lead.projectSourceId}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold">{lead.projectName}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span>{lead.customer.name}</span>
                          {lead.customer.industryType && (
                            <span className={`ios-badge text-[10px] ${lead.customer.industryType === "石化" ? "ios-badge-orange" : "ios-badge-green"}`}>
                              {lead.customer.industryType}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-[#86868B]">{formatMoney(lead.estimatedInvestment)}</td>
                      <td className="text-[#86868B]">{formatDate(lead.bidReleaseTime)}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className={`ios-badge ${sc.color}`}>{sc.label}</span>
                          {nextStatuses.length > 0 && (
                            <select
                              className="text-[11px] border-none bg-transparent text-[#007AFF] cursor-pointer font-semibold p-0 outline-none"
                              value=""
                              disabled={statusChanging === lead.id}
                              onChange={(e) => {
                                if (e.target.value) handleStatusChange(lead, e.target.value);
                              }}
                            >
                              <option value="">变更→</option>
                              {nextStatuses.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="text-[#86868B]">{formatDate(lead.createdAt)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleViewDetail(lead)}>
                            <Eye className="w-3.5 h-3.5" />
                            详情
                          </button>
                          <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleOpenEdit(lead)}>
                            <Pencil className="w-3.5 h-3.5" />
                            编辑
                          </button>
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                            onClick={() => setDeleteConfirm(lead)}
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
        title={editingLead ? "编辑项目线索" : "登记项目线索"}
        maxWidth="640px"
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
                客户 <span className="text-[#FF3B30]">*</span>
              </label>
              <select
                className="ios-select"
                value={form.customerId}
                onChange={(e) => updateForm("customerId", e.target.value)}
              >
                <option value="">请选择客户</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.industryType ? ` (${c.industryType})` : ""}</option>
                ))}
              </select>
              <button
                type="button"
                className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF] mt-1"
                onClick={() => {
                  setCustomerError("");
                  setShowCustomerModal(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                新增客户
              </button>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                项目名称 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入项目名称"
                value={form.projectName}
                onChange={(e) => updateForm("projectName", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">项目地点</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="项目所在地点"
                  value={form.location}
                  onChange={(e) => updateForm("location", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">预计投资额（元）</label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
                <input
                  type="number"
                  className="ios-input pl-10"
                  placeholder="预计投资金额"
                  value={form.estimatedInvestment}
                  onChange={(e) => updateForm("estimatedInvestment", e.target.value)}
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
                  value={form.bidReleaseTime}
                  onChange={(e) => updateForm("bidReleaseTime", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">信息来源</label>
              <input
                type="text"
                className="ios-input"
                placeholder="如：招标网站、客户推荐"
                value={form.infoSource}
                onChange={(e) => updateForm("infoSource", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "保存中..." : editingLead ? "保存修改" : "创建线索"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailLead}
        onClose={() => setDetailLead(null)}
        title="项目线索详情"
        maxWidth="680px"
      >
        {detailLead && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F0F0F0]">
              <div className="w-12 h-12 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-[#007AFF]" />
              </div>
              <div>
                <p className="text-[17px] font-bold text-[#1D1D1F]">{detailLead.projectName}</p>
                <p className="text-[13px] text-[#007AFF] font-mono font-semibold">{detailLead.projectSourceId}</p>
              </div>
              <span className={`ios-badge ml-auto ${statusConfig[detailLead.currentStatus]?.color || "ios-badge-gray"}`}>
                {detailLead.currentStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">客户</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{detailLead.customer.name}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">项目地点</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{detailLead.location || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">预计投资额</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{formatMoney(detailLead.estimatedInvestment)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">投标截止时间</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{formatDate(detailLead.bidReleaseTime)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">信息来源</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{detailLead.infoSource || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">创建时间</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{formatDate(detailLead.createdAt)}</p>
              </div>
            </div>

            {(statusFlow[detailLead.currentStatus] || []).length > 0 && (
              <div className="pt-3 border-t border-[#F0F0F0]">
                <p className="text-[13px] font-semibold text-[#1D1D1F] mb-2">状态变更</p>
                <div className="flex gap-2">
                  {statusFlow[detailLead.currentStatus].map((nextStatus) => (
                    <button
                      key={nextStatus}
                      className="ios-btn ios-btn-primary ios-btn-sm"
                      disabled={statusChanging === detailLead.id}
                      onClick={() => handleStatusChange(detailLead, nextStatus)}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                      转为{nextStatus}
                    </button>
                  ))}
                </div>
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
          <p className="text-[15px] text-[#1D1D1F] mb-1">
            确定要删除线索 <span className="font-semibold">{deleteConfirm?.projectSourceId}</span> 吗？
          </p>
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
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        title="新增客户"
        maxWidth="480px"
      >
        <div className="space-y-4">
          {customerError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">
              {customerError}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
              客户名称 <span className="text-[#FF3B30]">*</span>
            </label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入客户名称"
              value={customerForm.name}
              onChange={(e) => {
                setCustomerForm((prev) => ({ ...prev, name: e.target.value }));
                if (customerError) setCustomerError("");
              }}
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">联系人</label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入联系人"
              value={customerForm.contactPerson}
              onChange={(e) => setCustomerForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">电话</label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入电话"
              value={customerForm.phone}
              onChange={(e) => setCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">行业类型</label>
            <select
              className="ios-select"
              value={customerForm.industryType}
              onChange={(e) => setCustomerForm((prev) => ({ ...prev, industryType: e.target.value }))}
            >
              <option value="">请选择行业类型</option>
              <option value="石化">石化</option>
              <option value="医药">医药</option>
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">客户等级</label>
            <select
              className="ios-select"
              value={customerForm.customerGrade}
              onChange={(e) => setCustomerForm((prev) => ({ ...prev, customerGrade: e.target.value }))}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowCustomerModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleCreateCustomer} disabled={customerSaving}>
              {customerSaving ? "保存中..." : "确认"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

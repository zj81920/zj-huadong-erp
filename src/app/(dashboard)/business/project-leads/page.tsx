"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Briefcase,
  MapPin,
  Phone,
  Mail,
  User,
  Users,
  ChevronRight,
  Info,
} from "lucide-react";
import Modal from "@/components/Modal";
import { BatchDeleteBar } from "@/components/BatchDeleteBar";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { useAuth } from "@/contexts/AuthContext";

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
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  projectNature: string[];
  implementationEntity: string;
  currentStatus: string;
  leadMode: string;
  followUpRecords: unknown[];
  competitorInfo: unknown[];
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  customer: Customer;
  biddings?: unknown[];
  quotations?: unknown[];
}

interface LeadFormData {
  customerId: string;
  projectName: string;
  location: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  projectNature: string[];
  implementationEntity: string;
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
  contactPerson: "",
  contactPhone: "",
  contactEmail: "",
  projectNature: [],
  implementationEntity: "",
};

const projectNatureOptions = [
  "方案设计",
  "初步设计",
  "详细设计",
  "EPC",
  "框架协议",
  "咨询",
];

const statusConfig: Record<string, { color: string; label: string }> = {
  "跟踪中": { color: "ios-badge-gray", label: "跟踪中" },
  "投标中": { color: "ios-badge-orange", label: "投标中" },
  "已中标": { color: "ios-badge-green", label: "已中标" },
  "报价中": { color: "ios-badge-blue", label: "报价中" },
  "落地": { color: "ios-badge-green", label: "落地" },
  "放弃": { color: "ios-badge-red", label: "放弃" },
  "已立项": { color: "ios-badge-purple", label: "已立项" },
};

export default function ProjectLeadsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdminUser = user?.username === "admin";
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
  const [bankAccounts, setBankAccounts] = useState<{ id: string; accountName: string }[]>([]);

  const [deleteConfirm, setDeleteConfirm] = useState<ProjectLead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    toggleSelect,
    selectAll,
    clearSelection,
    isAllSelected,
    isSelected,
  } = useBatchSelection(leads.map((l) => l.id));

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    address: "",
    contactPerson: "",
    phone: "",
    email: "",
    maintainer: "",
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

  const fetchBankAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/bank-accounts?isActive=true&pageSize=200");
      const json = await res.json();
      if (res.ok) {
        const companyAccounts = (json.data || []).filter(
          (a: { accountType: string }) => a.accountType === "公司账户"
        );
        setBankAccounts(companyAccounts.map((a: { id: string; accountName: string }) => ({ id: a.id, accountName: a.accountName })));
      }
    } catch (err) {
      console.error("获取银行账户列表失败:", err);
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
    fetchBankAccounts();
  }, [fetchCustomers, fetchBankAccounts]);

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
      contactPerson: lead.contactPerson || "",
      contactPhone: lead.contactPhone || "",
      contactEmail: lead.contactEmail || "",
      projectNature: lead.projectNature || [],
      implementationEntity: lead.implementationEntity || "",
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
    if (!form.projectNature || form.projectNature.length === 0) {
      setFormError("请选择项目性质");
      return;
    }
    if (!form.implementationEntity.trim()) {
      setFormError("请选择实施主体");
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
          address: "",
          contactPerson: "",
          phone: "",
          email: "",
          maintainer: "",
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

  const handleModeChange = async (lead: ProjectLead, mode: string) => {
    try {
      const res = await fetch(`/api/project-leads/${lead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadMode: mode }),
      });
      if (res.ok) fetchLeads();
      else {
        const j = await res.json();
        alert(j.error || "模式切换失败");
      }
    } catch {
      alert("网络错误");
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

  const stats = {
    total: pagination.total,
    bidding: leads.filter((l) => l.currentStatus === "投标中").length,
    quotation: leads.filter((l) => l.currentStatus === "报价中").length,
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
          <div className="w-11 h-11 rounded-2xl bg-[#111827]/10 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-[#111827]" />
          </div>
          <div>
            <p className="text-[13px] text-[#6B7280]">线索总数</p>
            <p className="text-[24px] font-bold text-[#111827] leading-tight">{stats.total}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#6B7280]/10 flex items-center justify-center">
            <Info className="w-5 h-5 text-[#6B7280]" />
          </div>
          <div>
            <p className="text-[13px] text-[#6B7280]">投标中</p>
            <p className="text-[24px] font-bold text-[#6B7280] leading-tight">{stats.bidding}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#6B7280]/10 flex items-center justify-center">
            <Phone className="w-5 h-5 text-[#6B7280]" />
          </div>
          <div>
            <p className="text-[13px] text-[#6B7280]">报价中</p>
            <p className="text-[24px] font-bold text-[#6B7280] leading-tight">{stats.quotation}</p>
          </div>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
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

          <div className="ml-auto text-[13px] text-[#6B7280]">
            共 <span className="font-semibold text-[#111827]">{pagination.total}</span> 条线索
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#111827] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F9FAFB] flex items-center justify-center">
              <Briefcase className="w-8 h-8 text-[#6B7280]" />
            </div>
            <p>{search || filterStatus ? "没有匹配的项目线索" : "暂无线索，点击右上角登记"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table" style={{ minWidth: 1100 }}>
              <colgroup>
                <col style={{ minWidth: 110 }} />
                <col style={{ minWidth: 180 }} />
                <col style={{ minWidth: 120 }} />
                <col style={{ minWidth: 140 }} />
                <col style={{ minWidth: 100 }} />
                <col style={{ minWidth: 80 }} />
                <col style={{ minWidth: 100 }} />
                <col style={{ minWidth: 100 }} />
                <col style={{ minWidth: 170 }} />
              </colgroup>
              <thead>
                <tr>
                  {isAdminUser && (
                    <th className="w-10">
                      <input
                        type="checkbox"
                        className="ios-checkbox"
                        checked={isAllSelected}
                        onChange={() => isAllSelected ? clearSelection() : selectAll()}
                      />
                    </th>
                  )}
                  <th>项目源ID</th>
                  <th>项目名称</th>
                  <th>客户</th>
                  <th>项目性质</th>
                  <th>实施主体</th>
                  <th>状态</th>
                  <th>模式</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const sc = statusConfig[lead.currentStatus] || statusConfig["跟踪中"];
                  const isEstablished = lead.currentStatus === "已立项";
                  return (
                    <tr key={lead.id} className={isSelected(lead.id) ? "bg-[#111827]/5" : ""}>
                      {isAdminUser && (
                        <td className="w-10">
                          <input
                            type="checkbox"
                            className="ios-checkbox"
                            checked={isSelected(lead.id)}
                            onChange={() => toggleSelect(lead.id)}
                          />
                        </td>
                      )}
                      <td className="whitespace-nowrap">
                        <span className="font-mono text-[13px] font-semibold text-[#111827]">
                          {lead.projectSourceId}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="font-semibold">{lead.projectName}</span>
                      </td>
                      <td className="whitespace-nowrap">{lead.customer.name}</td>
                      <td>
                        <div className="flex flex-wrap gap-1 whitespace-nowrap">
                          {(lead.projectNature || []).map((n: string) => (
                            <span key={n} className="ios-badge text-[11px] ios-badge-blue">{n}</span>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-[13px]">{lead.implementationEntity || "-"}</td>
                      <td className="whitespace-nowrap">
                        <span className={`ios-badge ${sc.color}`}>{sc.label}</span>
                      </td>
                      <td className="whitespace-nowrap">
                        <select
                          className="ios-select text-[12px] py-1 px-2 w-auto min-w-[90px]"
                          value={lead.leadMode === "商务报价" ? "商务报价" : "投标"}
                          disabled={isEstablished}
                          onChange={(e) => handleModeChange(lead, e.target.value)}
                        >
                          <option value="投标">投标</option>
                          <option value="商务报价">商务报价</option>
                        </select>
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => router.push(`/business/project-leads/${lead.id}`)}>
                            <Eye className="w-3.5 h-3.5" />
                            详情
                          </button>
                          {!isEstablished && (
                            <>
                              <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleOpenEdit(lead)}>
                                <Pencil className="w-3.5 h-3.5" />
                                编辑
                              </button>
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#6B7280]!"
                                onClick={() => setDeleteConfirm(lead)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="text-[#6B7280] text-[12px] whitespace-nowrap">
                        {lead.lastModifiedBy && (
                          <span>{lead.lastModifiedBy}</span>
                        )}
                        <span className="block text-[11px]">{formatDate(lead.updatedAt)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-[#F3F4F6]">
                <button
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  上一页
                </button>
                <span className="text-[13px] text-[#6B7280] px-3">
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

        {isAdminUser && (
          <BatchDeleteBar
            businessType="project_lead"
            selectedIds={leads.filter((l) => isSelected(l.id)).map((l) => l.id)}
            onDeleteSuccess={fetchLeads}
            onClear={clearSelection}
          />
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
            <div className="p-3 rounded-xl bg-[#6B7280]/8 text-[#6B7280] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                客户 <span className="text-[#6B7280]">*</span>
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
                className="ios-btn ios-btn-ghost ios-btn-sm text-[#111827] mt-1"
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
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                项目名称 <span className="text-[#6B7280]">*</span>
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
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">项目地点</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
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
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">项目联系人</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="请输入项目联系人"
                  value={form.contactPerson}
                  onChange={(e) => updateForm("contactPerson", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">联系电话</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="请输入联系电话"
                  value={form.contactPhone}
                  onChange={(e) => updateForm("contactPhone", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">联系邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="email"
                  className="ios-input pl-10"
                  placeholder="请输入联系邮箱"
                  value={form.contactEmail}
                  onChange={(e) => updateForm("contactEmail", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                项目性质 <span className="text-[#6B7280]">*</span>
              </label>
              <div className="flex flex-wrap gap-2 p-2.5 border border-[#E5E7EB] rounded-xl bg-white min-h-[42px]">
                {projectNatureOptions.map((opt) => {
                  const selected = form.projectNature.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all ${
                        selected
                          ? "bg-[#111827] text-white"
                          : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#E8E8ED]"
                      }`}
                      onClick={() => {
                        const updated = selected
                          ? form.projectNature.filter((v) => v !== opt)
                          : [...form.projectNature, opt];
                        setForm((prev) => ({ ...prev, projectNature: updated }));
                        if (formError) setFormError("");
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                实施主体 <span className="text-[#6B7280]">*</span>
              </label>
              <select
                className="ios-select"
                value={form.implementationEntity}
                onChange={(e) => updateForm("implementationEntity", e.target.value)}
              >
                <option value="">请选择实施主体</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.accountName}>{a.accountName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F3F4F6] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "保存中..." : editingLead ? "保存修改" : "创建线索"}
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
          <div className="w-14 h-14 rounded-full bg-[#6B7280]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#6B7280]" />
          </div>
          <p className="text-[15px] text-[#111827] mb-1">
            确定要删除线索 <span className="font-semibold">{deleteConfirm?.projectSourceId}</span> 吗？
          </p>
          <p className="text-[13px] text-[#6B7280] mb-6">此操作不可撤销</p>
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
        maxWidth="600px"
      >
        <div className="space-y-4">
          {customerError && (
            <div className="p-3 rounded-xl bg-[#6B7280]/8 text-[#6B7280] text-[13px] font-medium">
              {customerError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">
                客户名称 <span className="text-[#6B7280]">*</span>
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
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">行业类型</label>
              <select
                className="ios-select"
                value={customerForm.industryType}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, industryType: e.target.value }))}
              >
                <option value="">请选择</option>
                <option value="石化">石化</option>
                <option value="医药">医药</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">客户等级</label>
              <select
                className="ios-select"
                value={customerForm.customerGrade}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, customerGrade: e.target.value }))}
              >
                <option value="A">A级（重要客户）</option>
                <option value="B">B级（普通客户）</option>
                <option value="C">C级（潜在客户）</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">联系人</label>
              <div className="relative">
                <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="联系人姓名"
                  value={customerForm.contactPerson}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">电话</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="联系电话"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="email"
                  className="ios-input pl-10"
                  placeholder="邮箱地址"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">商务责任人</label>
              <input
                type="text"
                className="ios-input"
                placeholder="负责商务的人员"
                value={customerForm.maintainer}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, maintainer: e.target.value }))}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#111827] mb-1.5">地址</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-[#6B7280]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="客户地址"
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm((prev) => ({ ...prev, address: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F3F4F6] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowCustomerModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleCreateCustomer} disabled={customerSaving}>
              {customerSaving ? "保存中..." : "创建客户"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

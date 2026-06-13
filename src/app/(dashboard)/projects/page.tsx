"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Briefcase,
  MapPin,
  ChevronRight,
  Play,
  Pause,
  Users as UsersIcon,
  Calendar,
  UserCircle,
  User,
  Mail,
  Phone,
} from "lucide-react";
import Modal from "@/components/Modal";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { BatchDeleteBar } from "@/components/BatchDeleteBar";
import { usePagination } from "@/hooks/usePagination";
import PaginationBar from "@/components/PaginationBar";
import { getRowStatusClass } from "@/lib/status-colors";
import { getUserModulePerms, canDeleteFrontend, canEditFrontend } from "@/lib/types/permissions";
import { OWNERSHIP_TYPE_OPTIONS } from "@/lib/constants/customer";
import { PROJECT_CATEGORY_OPTIONS } from "@/lib/constants/project";

interface Customer {
  id: string;
  name: string;
  ownershipType: string | null;
}

interface User {
  id: string;
  realName: string;
  username: string;
  role: string;
  department: string | null;
}

interface ProjectLeadItem {
  id: string;
  projectSourceId: string;
  projectName: string;
  customerId: string;
  currentStatus: string;
  customer: { id: string; name: string };
  project: { id: string; projectCode: string; name: string; status: string } | null;
}

interface Project {
  id: string;
  projectSourceId: string;
  projectCode: string;
  name: string;
  customerId: string;
  projectContent: string | null;
  address: string | null;
  projectCategory: string | null;
  source: string;
  sourceRefId: string | null;
  status: string;
  designManagerId: string | null;
  supervisorLeaderId: string | null;
  startDate: string | null;
  plannedEndDate: string | null;
  actualCloseDate: string | null;
  createdAt: string;
  updatedAt: string;
  designPhases: string | null;
  lastModifiedBy: string | null;
  createdById: string | null;
  customer: Customer;
  projectLead: { projectSourceId: string; projectName: string; currentStatus: string } | null;
  designManager: { id: string; realName: string } | null;
  supervisorLeader: { id: string; realName: string } | null;
  _count: {
    wbsNodes: number;
    designTasks: number;
    outsourcingTasks: number;
    purchaseRequests: number;
  };
}

interface ProjectFormData {
  projectSourceId: string;
  projectCode: string;
  name: string;
  customerId: string;
  projectContent: string;
  address: string;
  projectCategory: string;
  source: string;
  status: string;
  designManagerId: string;
  supervisorLeaderId: string;
  startDate: string;
  plannedEndDate: string;
  actualCloseDate: string;
  projectLeadId: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  implementationEntity: string;
}

const emptyForm: ProjectFormData = {
  projectSourceId: "",
  projectCode: "",
  name: "",
  customerId: "",
  projectContent: "",
  address: "",
  projectCategory: "",
  source: "项目线索",
  status: "执行",
  designManagerId: "",
  supervisorLeaderId: "",
  startDate: "",
  plannedEndDate: "",
  actualCloseDate: "",
  projectLeadId: "",
  contactPerson: "",
  contactPhone: "",
  contactEmail: "",
  implementationEntity: "",
};

const statusConfig: Record<string, { color: string; label: string }> = {
  "执行": { color: "ios-badge-green", label: "执行" },
  "暂停": { color: "ios-badge-orange", label: "暂停" },
  "关闭": { color: "ios-badge-red", label: "关闭" },
};

const statusFlow: Record<string, string[]> = {
  "执行": ["暂停", "关闭"],
  "暂停": ["执行", "关闭"],
  "关闭": [],
};

const sourceOptions = [
  { value: "项目线索", label: "项目线索" },
  { value: "直接委托", label: "直接委托" },
];

export default function ProjectsPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const isAdminUser = currentUser?.username === "admin" || currentUser?.roles?.some((r: any) => r.code === "admin") || false;
  const rolePerms = getUserModulePerms(currentUser, "projects_list");
  const hasFlow = false;
  const [projects, setProjects] = useState<Project[]>([]);
  const { page, pageSize, setPage, setPageSize, pagination, setPagination } = usePagination({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSource, setFilterSource] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projectLeads, setProjectLeads] = useState<ProjectLeadItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<{ id: string; accountName: string }[]>([]);

  const [designPhases, setDesignPhases] = useState<string[]>([]);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [statusChanging, setStatusChanging] = useState<string | null>(null);

  const {
    toggleSelect,
    selectAll,
    clearSelection,
    isAllSelected,
    isSelected,
  } = useBatchSelection(projects.map((d) => d.id));

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    ownershipType: "",
    customerGrade: "C",
  });
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerError, setCustomerError] = useState("");

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/customers?pageSize=200");
      const json = await res.json();
      if (res.ok) setCustomers(json.data);
    } catch {}
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      if (res.ok) setUsers(json.data || json);
    } catch {}
  }, []);

  const fetchProjectLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/project-leads?pageSize=200");
      const json = await res.json();
      if (res.ok) {
        const all = json.data || [];
        setProjectLeads(all.filter((l: ProjectLeadItem) => l.currentStatus === "已中标" || l.currentStatus === "落地"));
      }
    } catch {}
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
    } catch {}
  }, []);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
    if (filterStatus) params.set("status", filterStatus);
    if (filterCategory) params.set("projectCategory", filterCategory);
      if (filterSource) params.set("source", filterSource);
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());

      const res = await fetch(`/api/projects?${params}`);
      const json = await res.json();
      if (res.ok) {
        setProjects(json.data);
        setPagination(json.pagination);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterCategory, filterSource, page, pageSize]);

  useEffect(() => {
    fetchCustomers();
    fetchUsers();
    fetchProjectLeads();
    fetchBankAccounts();
  }, [fetchCustomers, fetchUsers, fetchProjectLeads, fetchBankAccounts]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleOpenCreate = () => {
    setEditingProject(null);
    setForm(emptyForm);
    setDesignPhases([]);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (project: Project) => {
    setEditingProject(project);
    setForm({
      projectSourceId: project.projectSourceId,
      projectCode: project.projectCode,
      name: project.name,
      customerId: project.customerId,
      projectContent: project.projectContent || "",
      address: project.address || "",
      projectCategory: project.projectCategory || "",
      source: project.source,
      status: project.status,
      designManagerId: project.designManagerId || "",
      supervisorLeaderId: project.supervisorLeaderId || "",
      startDate: project.startDate ? project.startDate.split("T")[0] : "",
      plannedEndDate: project.plannedEndDate ? project.plannedEndDate.split("T")[0] : "",
      actualCloseDate: project.actualCloseDate ? project.actualCloseDate.split("T")[0] : "",
      projectLeadId: "",
      contactPerson: "",
      contactPhone: "",
      contactEmail: "",
      implementationEntity: "",
    });
    setFormError("");
    // 初始化设计阶段
    try {
      const phases = project.designPhases ? JSON.parse(project.designPhases) : [];
      setDesignPhases(Array.isArray(phases) ? phases : []);
    } catch {
      setDesignPhases([]);
    }
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.projectCode.trim()) {
      setFormError("项目编号不能为空");
      return;
    }
    if (!form.name.trim()) {
      setFormError("项目名称不能为空");
      return;
    }
    if (!form.customerId) {
      setFormError("请选择客户");
      return;
    }
    if (!form.projectContent.trim()) {
      setFormError("项目内容描述不能为空");
      return;
    }
    if (!form.address.trim()) {
      setFormError("地址不能为空");
      return;
    }
    if (!form.projectCategory) {
      setFormError("请选择类别");
      return;
    }
    if (designPhases.length === 0) {
      setFormError("请选择设计阶段");
      return;
    }
    if (!form.status) {
      setFormError("请选择状态");
      return;
    }
    if (!form.designManagerId) {
      setFormError("请选择设计经理");
      return;
    }
    if (!form.supervisorLeaderId) {
      setFormError("请选择主管领导");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const url = editingProject
        ? `/api/projects/${editingProject.id}`
        : "/api/projects";
      const method = editingProject ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        projectCode: form.projectCode,
        name: form.name,
        customerId: form.customerId,
        projectContent: form.projectContent?.trim() || null,
        address: form.address || null,
        projectCategory: form.projectCategory || null,
        source: form.source,
        status: form.status,
        designManagerId: form.designManagerId || null,
        supervisorLeaderId: form.supervisorLeaderId || null,
        startDate: form.startDate || null,
        plannedEndDate: form.plannedEndDate || null,
        actualCloseDate: form.actualCloseDate || null,
        designPhases: designPhases.length > 0 ? JSON.stringify(designPhases) : null,
      };

      if (form.source === "项目线索") {
        body.projectSourceId = form.projectSourceId;
      } else if (form.source === "直接委托") {
        body.contactPerson = form.contactPerson || null;
        body.contactPhone = form.contactPhone || null;
        body.contactEmail = form.contactEmail || null;
        body.implementationEntity = form.implementationEntity || null;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchProjects();
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
          ownershipType: "",
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

  const handleStatusChange = async (project: Project, newStatus: string) => {
    setStatusChanging(project.id);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        fetchProjects();
        if (detailProject?.id === project.id) {
          setDetailProject({ ...detailProject, status: newStatus });
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

  const handleViewDetail = async (project: Project) => {
    try {
      const res = await fetch(`/api/projects/${project.id}`);
      const json = await res.json();
      if (res.ok) {
        setDetailProject(json.data);
      }
    } catch {
      setDetailProject(project);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    if ((deleteConfirm.status === "执行" || deleteConfirm.status === "关闭") && currentUser?.username !== "admin") {
      alert("执行中或已关闭的项目不能删除，请联系管理员");
      setDeleteConfirm(null);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${deleteConfirm.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchProjects();
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

  const updateForm = (field: keyof ProjectFormData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "source") {
        next.projectSourceId = "";
        next.name = "";
        next.customerId = "";
        next.projectLeadId = "";
        next.contactPerson = "";
        next.contactPhone = "";
        next.contactEmail = "";
        next.implementationEntity = "";
      }
      return next;
    });
    if (field === "projectCategory" && value !== "EP" && value !== "EPcm") {
      // 切换到非 EP/EPcm 类别时，移除"采购"
      setDesignPhases((prev) => prev.filter((p) => p !== "采购"));
    }
    if (formError) setFormError("");
  };

  const handleSelectProjectLead = (leadId: string) => {
    const lead = projectLeads.find((l) => l.id === leadId);
    if (!lead) return;
    setForm((prev) => ({
      ...prev,
      projectLeadId: leadId,
      projectSourceId: lead.projectSourceId,
      name: lead.projectName,
      customerId: lead.customerId,
    }));
    if (formError) setFormError("");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const stats = {
    total: pagination?.total ?? 0,
    executing: projects.filter((p) => p.status === "执行").length,
    paused: projects.filter((p) => p.status === "暂停").length,
  };

  const categoryBadgeColor = (cat: string | null) => {
    if (cat === "设计") return "ios-badge-blue";
    if (cat === "EP") return "ios-badge-orange";
    if (cat === "EPcm") return "ios-badge-green";
    return "ios-badge-gray";
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>项目立项</h1>
            <p>管理项目全生命周期</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新建项目
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-[#1C1917]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">项目总数</p>
            <p className="text-[24px] font-bold text-[#1C1917] leading-tight">{stats.total}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#78716C]/10 flex items-center justify-center">
            <Play className="w-5 h-5 text-[#78716C]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">执行中</p>
            <p className="text-[24px] font-bold text-[#78716C] leading-tight">{stats.executing}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#78716C]/10 flex items-center justify-center">
            <Pause className="w-5 h-5 text-[#78716C]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">已暂停</p>
            <p className="text-[24px] font-bold text-[#78716C] leading-tight">{stats.paused}</p>
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
              placeholder="搜索项目编号、名称、项目源ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            className="ios-select w-[140px]"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部状态</option>
            <option value="执行">执行</option>
            <option value="暂停">暂停</option>
            <option value="关闭">关闭</option>
          </select>

          <select
            className="ios-select w-[120px]"
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部类别</option>
            {PROJECT_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            className="ios-select w-[130px]"
            value={filterSource}
            onChange={(e) => {
              setFilterSource(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部来源</option>
            <option value="项目线索">项目线索</option>
            <option value="直接委托">直接委托</option>
          </select>

          <div className="ml-auto text-[13px] text-[#78716C]">
            共 <span className="font-semibold text-[#1C1917]">{pagination?.total ?? 0}</span> 个项目
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <Briefcase className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>{search || filterStatus || filterCategory || filterSource ? "没有匹配的项目" : "暂无项目，点击右上角新建"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table" style={{ minWidth: 1400, width: '100%' }}>
              <colgroup>
                <col style={{ width: 110 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 'auto' }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 170 }} />
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
                  <th>项目编号</th>
                  <th>项目名称</th>
                  <th>客户</th>
                  <th>类别</th>
                  <th>来源</th>
                  <th>设计经理</th>
                  <th>主管领导</th>
                  <th>状态</th>
                  <th>项目启动时间</th>
                  <th>计划结束时间</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => {
                  return (
                    <tr key={project.id} className={isSelected(project.id) ? "bg-[#1C1917]/5" : ""}>
                      {isAdminUser && (
                        <td className="w-10">
                          <input
                            type="checkbox"
                            className="ios-checkbox"
                            checked={isSelected(project.id)}
                            onChange={() => toggleSelect(project.id)}
                          />
                        </td>
                      )}
                      <td className="whitespace-nowrap">
                        <span className="font-mono text-[13px] font-semibold text-[#1C1917]">
                          {project.projectSourceId}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="font-mono text-[13px]">{project.projectCode}</span>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="font-semibold">{project.name}</span>
                      </td>
                      <td className="whitespace-nowrap">{project.customer.name}</td>
                      <td className="whitespace-nowrap">
                        {project.projectCategory ? (
                          <span className={`ios-badge text-[11px] ${categoryBadgeColor(project.projectCategory)}`}>{project.projectCategory}</span>
                        ) : (
                          <span className="text-[#78716C]">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-[13px] text-[#78716C]">{project.source}</td>
                      <td className="whitespace-nowrap">
                        {project.designManager ? (
                          <span className="text-[13px]">{project.designManager.realName}</span>
                        ) : (
                          <span className="text-[#78716C]">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        {project.supervisorLeader ? (
                          <span className="text-[13px]">{project.supervisorLeader.realName}</span>
                        ) : (
                          <span className="text-[#78716C]">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <select
                          className="ios-select text-[12px] py-1 px-2 w-auto min-w-[80px]"
                          value={project.status}
                          disabled={statusChanging === project.id}
                          onChange={(e) => handleStatusChange(project, e.target.value)}
                        >
                          <option value="执行">执行</option>
                          <option value="暂停">暂停</option>
                          <option value="关闭">关闭</option>
                        </select>
                      </td>
                      <td className="whitespace-nowrap text-[#78716C]">{formatDate(project.startDate)}</td>
                      <td className="whitespace-nowrap text-[#78716C]">{formatDate(project.plannedEndDate)}</td>
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleViewDetail(project)}>
                            <Eye className="w-3.5 h-3.5" />
                            详情
                          </button>
                          {canEditFrontend(hasFlow, rolePerms, "", currentUser?.id ?? "", project.createdById ?? null, isAdminUser) && (
                            <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleOpenEdit(project)}>
                              <Pencil className="w-3.5 h-3.5" />
                              编辑
                            </button>
                          )}

                          {canDeleteFrontend(hasFlow, rolePerms, "", currentUser?.id ?? "", project.createdById ?? null, isAdminUser) && (
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                              onClick={() => setDeleteConfirm(project)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="text-[#78716C] text-[12px] whitespace-nowrap">
                        {project.lastModifiedBy && (
                          <span>{project.lastModifiedBy}</span>
                        )}
                        <span className="block text-[11px]">{formatDate(project.updatedAt)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <PaginationBar pagination={pagination} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </div>
        )}
      </div>

      {isAdminUser && (
        <BatchDeleteBar
          businessType="project"
          selectedIds={projects.filter((d) => isSelected(d.id)).map((d) => d.id)}
          onDeleteSuccess={fetchProjects}
          onClear={clearSelection}
        />
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingProject ? "编辑项目" : "新建项目"}
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
                来源 <span className="text-[#78716C]">*</span>
              </label>
              <select
                className="ios-select"
                value={form.source}
                onChange={(e) => updateForm("source", e.target.value)}
                disabled={!!editingProject}
              >
                {sourceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {form.source === "项目线索" && (
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  选择项目线索
                </label>
                <select
                  className="ios-select"
                  value={form.projectLeadId}
                  onChange={(e) => handleSelectProjectLead(e.target.value)}
                  disabled={!!editingProject}
                >
                  <option value="">请选择项目线索</option>
                  {projectLeads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.project ? `${l.project.projectCode} - ${l.project.name}` : `${l.projectSourceId} - ${l.projectName}`} - {l.customer.name} [{l.currentStatus}]
                    </option>
                  ))}
                </select>
              </div>
            )}

            {editingProject && form.projectSourceId && (
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">项目源ID</label>
                <input
                  type="text"
                  className="ios-input bg-[#FAFAF9]"
                  value={form.projectSourceId}
                  readOnly
                />
              </div>
            )}

            {form.source === "项目线索" && !editingProject && form.projectSourceId && (
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">项目源ID</label>
                <input
                  type="text"
                  className="ios-input bg-[#FAFAF9]"
                  value={form.projectSourceId}
                  readOnly
                />
              </div>
            )}

            {!editingProject && form.source === "直接委托" && (
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">项目源ID</label>
                <input
                  type="text"
                  className="ios-input bg-[#FAFAF9]"
                  value="提交后系统自动生成"
                  readOnly
                />
              </div>
            )}

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                项目编号 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入项目编号"
                value={form.projectCode}
                onChange={(e) => updateForm("projectCode", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                项目名称 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入项目名称"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                客户 <span className="text-[#78716C]">*</span>
              </label>
              <select
                className="ios-select"
                value={form.customerId}
                onChange={(e) => updateForm("customerId", e.target.value)}
              >
                <option value="">请选择客户</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.ownershipType ? ` (${c.ownershipType})` : ""}</option>
                ))}
              </select>
              <button
                type="button"
                className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917] mt-1"
                onClick={() => {
                  setCustomerError("");
                  setShowCustomerModal(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                新增客户
              </button>
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                项目内容描述 <span className="text-[#DC2626]">*</span>
              </label>
              <textarea
                className="ios-input"
                rows={3}
                placeholder="请输入项目概况、范围、技术要求等"
                value={form.projectContent}
                onChange={(e) => updateForm("projectContent", e.target.value)}
                style={{ resize: "vertical", minHeight: 80 }}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">地址 <span className="text-[#DC2626]">*</span></label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="text"
                  className="ios-input pl-10"
                  placeholder="项目地址"
                  value={form.address}
                  onChange={(e) => updateForm("address", e.target.value)}
                />
              </div>
            </div>

            {!editingProject && form.source === "直接委托" && (
              <>
                <div>
                  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">项目联系人</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
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
                  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">联系电话</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
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
                  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">联系邮箱</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
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
                  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">实施主体</label>
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
              </>
            )}

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">类别 <span className="text-[#DC2626]">*</span></label>
              <select
                className="ios-select"
                value={form.projectCategory}
                onChange={(e) => updateForm("projectCategory", e.target.value)}
              >
                <option value="">请选择类别</option>
                {PROJECT_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 设计阶段多选 */}
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                设计阶段（可多选） <span className="text-[#DC2626]">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {(["方案设计", "初步设计", "详细设计", "竣工图设计"] as string[])
                  .concat(
                    form.projectCategory === "EP" || form.projectCategory === "EPcm"
                      ? ["采购"]
                      : []
                  )
                  .map((phase) => {
                    const selected = designPhases.includes(phase);
                    return (
                      <label
                        key={phase}
                        className="flex items-center gap-1.5 cursor-pointer select-none"
                        style={{
                          padding: "6px 14px",
                          border: `1px solid ${selected ? "#3B82F6" : "#D6D3D1"}`,
                          borderRadius: 8,
                          fontSize: 13,
                          background: selected ? "#DBEAFE" : "#fff",
                          color: selected ? "#1D4ED8" : "#1C1917",
                          transition: "all 0.15s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            setDesignPhases((prev) =>
                              prev.includes(phase)
                                ? prev.filter((p) => p !== phase)
                                : [...prev, phase]
                            );
                          }}
                          className="hidden"
                        />
                        {phase}
                      </label>
                    );
                  })}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">状态 <span className="text-[#DC2626]">*</span></label>
              <select
                className="ios-select"
                value={form.status}
                onChange={(e) => updateForm("status", e.target.value)}
              >
                <option value="执行">执行</option>
                <option value="暂停">暂停</option>
                <option value="关闭">关闭</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">设计经理 <span className="text-[#DC2626]">*</span></label>
              <select
                className="ios-select"
                value={form.designManagerId}
                onChange={(e) => updateForm("designManagerId", e.target.value)}
              >
                <option value="">请选择设计经理</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.realName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">主管领导 <span className="text-[#DC2626]">*</span></label>
              <select
                className="ios-select"
                value={form.supervisorLeaderId}
                onChange={(e) => updateForm("supervisorLeaderId", e.target.value)}
              >
                <option value="">请选择主管领导</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.realName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                计划开始时间 <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="date"
                className="ios-input"
                value={form.startDate}
                onChange={(e) => updateForm("startDate", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                计划完成时间 <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="date"
                className="ios-input"
                value={form.plannedEndDate}
                onChange={(e) => updateForm("plannedEndDate", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "保存中..." : editingProject ? "保存修改" : "创建项目"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailProject}
        onClose={() => setDetailProject(null)}
        title="项目详情"
        maxWidth="680px"
      >
        {detailProject && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F5F5F4]">
              <div className="w-12 h-12 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-[#1C1917]" />
              </div>
              <div>
                <p className="text-[17px] font-bold text-[#1C1917]">{detailProject.name}</p>
                <p className="text-[13px] text-[#1C1917] font-mono font-semibold">{detailProject.projectSourceId}</p>
              </div>
              <span className={`ios-badge ml-auto ${statusConfig[detailProject.status]?.color || "ios-badge-gray"}`}>
                {detailProject.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">项目编号</p>
                <p className="text-[14px] font-semibold text-[#1C1917] font-mono">{detailProject.projectCode}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">客户</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{detailProject.customer.name}</p>
              </div>
              {detailProject.projectContent && (
                <div className="col-span-2 p-3 rounded-xl bg-[#FAFAF9]">
                  <p className="text-[12px] text-[#78716C] mb-1">项目内容描述</p>
                  <p className="text-[14px] font-semibold text-[#1C1917] whitespace-pre-wrap">
                    {detailProject.projectContent}
                  </p>
                </div>
              )}
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">类别</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{detailProject.projectCategory || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">来源</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{detailProject.source}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">地址</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{detailProject.address || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">
                  <UserCircle className="w-3 h-3 inline mr-1" />
                  设计经理
                </p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{detailProject.designManager?.realName || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">
                  <UsersIcon className="w-3 h-3 inline mr-1" />
                  主管领导
                </p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{detailProject.supervisorLeader?.realName || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  项目启动时间
                </p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailProject.startDate)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  计划结束时间
                </p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailProject.plannedEndDate)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  实际关闭时间
                </p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailProject.actualCloseDate)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">创建时间</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailProject.createdAt)}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F5F5F4]">
              <p className="text-[13px] font-semibold text-[#1C1917] mb-2">关联统计</p>
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#FAFAF9] text-center">
                  <p className="text-[20px] font-bold text-[#1C1917]">{detailProject._count.wbsNodes}</p>
                  <p className="text-[11px] text-[#78716C]">计划</p>
                </div>
                <div className="p-3 rounded-xl bg-[#FAFAF9] text-center">
                  <p className="text-[20px] font-bold text-[#1C1917]">{detailProject._count.designTasks}</p>
                  <p className="text-[11px] text-[#78716C]">设计任务</p>
                </div>
                <div className="p-3 rounded-xl bg-[#FAFAF9] text-center">
                  <p className="text-[20px] font-bold text-[#1C1917]">{detailProject._count.outsourcingTasks}</p>
                  <p className="text-[11px] text-[#78716C]">外包任务</p>
                </div>
                <div className="p-3 rounded-xl bg-[#FAFAF9] text-center">
                  <p className="text-[20px] font-bold text-[#1C1917]">{detailProject._count.purchaseRequests}</p>
                  <p className="text-[11px] text-[#78716C]">采购申请</p>
                </div>
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
            确定要删除项目 <span className="font-semibold">{deleteConfirm?.projectCode}</span> 吗？
          </p>
          {deleteConfirm && (deleteConfirm.status === "执行" || deleteConfirm.status === "关闭") && currentUser?.username !== "admin" ? (
            <p className="text-[13px] text-[#78716C] mb-4">{deleteConfirm.status}中的项目不能删除，请联系管理员</p>
          ) : (
            <p className="text-[13px] text-[#78716C] mb-6">此操作不可撤销</p>
          )}
          <div className="flex justify-center gap-3">
            <button className="ios-btn ios-btn-secondary" onClick={() => setDeleteConfirm(null)}>取消</button>
            {deleteConfirm && ((deleteConfirm.status !== "执行" && deleteConfirm.status !== "关闭") || currentUser?.username === "admin") && (
              <button className="ios-btn ios-btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "删除中..." : "确认删除"}
              </button>
            )}
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
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {customerError}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              客户名称 <span className="text-[#78716C]">*</span>
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
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">联系人</label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入联系人"
              value={customerForm.contactPerson}
              onChange={(e) => setCustomerForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">电话</label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入电话"
              value={customerForm.phone}
              onChange={(e) => setCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">客户属性</label>
            <select
              className="ios-select"
              value={customerForm.ownershipType}
              onChange={(e) => setCustomerForm((prev) => ({ ...prev, ownershipType: e.target.value }))}
            >
              <option value="">请选择</option>
              {OWNERSHIP_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">客户等级</label>
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

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
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

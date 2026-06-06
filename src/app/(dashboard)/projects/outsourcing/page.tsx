"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Briefcase,
  Clock,
  DollarSign,
  Building2,
  UserCircle,
  Upload,
} from "lucide-react";
import Modal from "@/components/Modal";
import AdminStatusOverride from "@/components/AdminStatusOverride";
import ProjectPicker, { ProjectLeadItem } from "@/components/ProjectPicker";
import { DetailPageLayout } from "@/components/DetailPageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useFlowConfigured } from "@/hooks/useFlowConfigured";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { BatchDeleteBar } from "@/components/BatchDeleteBar";
import { usePagination } from "@/hooks/usePagination";
import PaginationBar from "@/components/PaginationBar";
import { getRowStatusClass } from "@/lib/status-colors";
import { getUserModulePerms } from "@/lib/types/permissions";
import { canDeleteFrontend, canEditFrontend } from "@/lib/types/permissions";

interface Project {
  id: string;
  projectSourceId: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
  supplierType: string | null;
  contactPerson: string | null;
  phone: string | null;
}

interface OutsourcingTask {
  id: string;
  projectSourceId: string;
  type: string;
  targetName: string;
  supplierId: string | null;
  contractId: string | null;
  taskDescription: string;
  workload: string | null;
  deliveryDeadline: string;
  amount: number;
  acceptanceStatus: string;
  approvalStatus: string;
  approvalInstanceId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  project: Project;
  supplier: Supplier | null;
}

interface OutsourcingFormData {
  projectSourceId: string;
  type: string;
  targetName: string;
  supplierId: string;
  taskDescription: string;
  workload: string;
  deliveryDeadline: string;
  amount: string;
  acceptanceStatus: string;
  approvalStatus: string;
}

const emptyForm: OutsourcingFormData = {
  projectSourceId: "",
  type: "",
  targetName: "",
  supplierId: "",
  taskDescription: "",
  workload: "",
  deliveryDeadline: "",
  amount: "",
  acceptanceStatus: "未验收",
  approvalStatus: "草稿",
};

const emptySupplierForm = {
  name: "",
  supplierType: "企业",
  status: "当前有效",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  bankName: "",
  bankAccount: "",
  remark: "",
};

const acceptanceStatusConfig: Record<string, { color: string; label: string }> = {
  "未验收": { color: "ios-badge-orange", label: "未验收" },
  "已验收": { color: "ios-badge-green", label: "已验收" },
  "不合格": { color: "ios-badge-red", label: "不合格" },
};

const approvalStatusConfig: Record<string, { color: string; label: string }> = {
  "草稿": { color: "ios-badge-gray", label: "草稿" },
  "审批中": { color: "ios-badge-blue", label: "审批中" },
  "已批准": { color: "ios-badge-green", label: "已批准" },
  "已驳回": { color: "ios-badge-red", label: "已驳回" },
};

const typeConfig: Record<string, { color: string; label: string }> = {
  to_company: { color: "ios-badge-blue", label: "分包公司" },
  to_person: { color: "ios-badge-green", label: "分包个人" },
};

export default function OutsourcingPage() {
  const { user } = useAuth();
  const isAdminUser = user?.username === "admin" || user?.roles?.some((r: any) => r.code === "admin") || false;
  const rolePerms = getUserModulePerms(user, "outsourcing");
  const hasFlow = user?.moduleFlowStatus?.["outsourcing"] ?? false;
  const { configured: flowConfigured } = useFlowConfigured("outsourcing");
  const [tasks, setTasks] = useState<OutsourcingTask[]>([]);
  const { page, pageSize, setPage, setPageSize, pagination, setPagination } = usePagination({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterAcceptance, setFilterAcceptance] = useState("");
  const [filterApproval, setFilterApproval] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<OutsourcingTask | null>(null);
  const [form, setForm] = useState<OutsourcingFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLeads, setProjectLeads] = useState<ProjectLeadItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [supplierError, setSupplierError] = useState("");
  const supplierFileRef = useRef<HTMLInputElement>(null);
  const [supplierUploading, setSupplierUploading] = useState(false);
  const [supplierUploadName, setSupplierUploadName] = useState("");
  const [supplierAttachmentUrl, setSupplierAttachmentUrl] = useState("");

  const [detailTask, setDetailTask] = useState<OutsourcingTask | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<OutsourcingTask | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    toggleSelect,
    selectAll,
    clearSelection,
    isAllSelected,
    isSelected,
  } = useBatchSelection(tasks.map((d) => d.id));

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects?pageSize=200");
      const json = await res.json();
      if (res.ok) setProjects(json.data);
      const leadsRes = await fetch("/api/project-leads?pageSize=200");
      if (leadsRes.ok) {
        const lj = await leadsRes.json();
        setProjectLeads((lj.data || []).filter((l: { currentStatus: string }) => l.currentStatus !== "放弃"));
      }
    } catch (err) {
      console.error("获取项目列表失败:", err);
    }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch("/api/suppliers?pageSize=200");
      if (res.ok) {
        const json = await res.json();
        setSuppliers(json.data || []);
      }
    } catch (err) {
      console.error("获取供应商列表失败:", err);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterProject) params.set("projectSourceId", filterProject);
      if (filterType) params.set("type", filterType);
      if (filterAcceptance) params.set("acceptanceStatus", filterAcceptance);
      if (filterApproval) params.set("approvalStatus", filterApproval);
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());

      const res = await fetch(`/api/projects/outsourcing?${params}`);
      const json = await res.json();
      if (res.ok) {
        setTasks(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取外包任务列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterProject, filterType, filterAcceptance, filterApproval, page, pageSize]);

  useEffect(() => {
    fetchProjects();
    fetchSuppliers();
  }, [fetchProjects, fetchSuppliers]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleOpenCreate = () => {
    setEditingTask(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (task: OutsourcingTask) => {
    setEditingTask(task);
    setForm({
      projectSourceId: task.projectSourceId,
      type: task.type,
      targetName: task.targetName,
      supplierId: task.supplierId || "",
      taskDescription: task.taskDescription,
      workload: task.workload || "",
      deliveryDeadline: task.deliveryDeadline ? task.deliveryDeadline.split("T")[0] : "",
      amount: String(task.amount),
      acceptanceStatus: task.acceptanceStatus,
      approvalStatus: task.approvalStatus,
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSupplierFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSupplierUploading(true);
    setSupplierError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        setSupplierAttachmentUrl(json.url);
        setSupplierUploadName(file.name);
      } else {
        setSupplierError(json.error || "上传失败");
      }
    } catch {
      setSupplierError("上传失败，请重试");
    } finally {
      setSupplierUploading(false);
      if (supplierFileRef.current) supplierFileRef.current.value = "";
    }
  };

  const handleCreateSupplier = async () => {
    if (!supplierForm.name.trim()) {
      setSupplierError("供应商名称不能为空");
      return;
    }
    setSupplierSaving(true);
    setSupplierError("");
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...supplierForm, attachmentUrl: supplierAttachmentUrl || null }),
      });
      const json = await res.json();
      if (res.ok) {
        const refreshed = await fetch("/api/suppliers?pageSize=200");
        if (refreshed.ok) {
          const refreshedJson = await refreshed.json();
          setSuppliers(refreshedJson.data || []);
        }
        setForm((prev) => ({ ...prev, supplierId: json.data.id }));
        setShowSupplierModal(false);
        setSupplierAttachmentUrl("");
        setSupplierUploadName("");
        setSupplierForm(emptySupplierForm);
      } else {
        setSupplierError(json.error || "创建供应商失败");
      }
    } catch {
      setSupplierError("网络错误，请重试");
    } finally {
      setSupplierSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.projectSourceId) {
      setFormError("请选择项目");
      return;
    }
    if (!form.type) {
      setFormError("请选择类型");
      return;
    }
    if (!form.supplierId && !form.targetName.trim()) {
      setFormError("请选择或输入外包对象");
      return;
    }
    if (!form.taskDescription.trim()) {
      setFormError("任务描述不能为空");
      return;
    }
    if (!form.deliveryDeadline) {
      setFormError("请选择交付截止日");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setFormError("请输入有效金额");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const url = editingTask
        ? `/api/projects/outsourcing/${editingTask.id}`
        : "/api/projects/outsourcing";
      const method = editingTask ? "PUT" : "POST";

      const payload: Record<string, unknown> = { ...form };
      if (form.supplierId) {
        payload.targetName = suppliers.find((s) => s.id === form.supplierId)?.name || form.targetName;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchTasks();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleViewDetail = async (task: OutsourcingTask) => {
    try {
      const res = await fetch(`/api/projects/outsourcing/${task.id}`);
      const json = await res.json();
      if (res.ok) {
        setDetailTask(json.data);
      }
    } catch {
      setDetailTask(task);
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
      const res = await fetch(`/api/projects/outsourcing/${deleteConfirm.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchTasks();
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

  const updateForm = (field: keyof OutsourcingFormData, value: string) => {
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

  const isPastDue = (dateStr: string) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const stats = {
    total: pagination?.total ?? 0,
    pendingAcceptance: tasks.filter((t) => t.acceptanceStatus === "未验收").length,
    totalAmount: tasks.reduce((sum, t) => sum + (t.amount || 0), 0),
  };

  const getProjectName = (projectSourceId: string) => {
    const project = projects.find((p) => p.projectSourceId === projectSourceId);
    return project?.name || projectSourceId;
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>设计外包</h1>
            <p>管理设计分包任务，跟踪验收与审批流程</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate} disabled={!flowConfigured} title={!flowConfigured ? "请先在流程设置中配置外包任务审批流程" : undefined}>
            <Plus className="w-4 h-4" />
            新增外包
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-[#1C1917]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">外包任务数</p>
            <p className="text-[24px] font-bold text-[#1C1917] leading-tight">{stats.total}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#78716C]/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-[#78716C]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">待验收</p>
            <p className="text-[24px] font-bold text-[#78716C] leading-tight">{stats.pendingAcceptance}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#78716C]/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-[#78716C]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">外包总额</p>
            <p className="text-[24px] font-bold text-[#78716C] leading-tight">{formatMoney(stats.totalAmount)}</p>
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
              placeholder="搜索外包对象、任务描述..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            className="ios-select w-[160px]"
            value={filterProject}
            onChange={(e) => {
              setFilterProject(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.projectSourceId}>{p.name}</option>
            ))}
          </select>

          <select
            className="ios-select w-[140px]"
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部类型</option>
            <option value="to_company">分包给公司</option>
            <option value="to_person">分包给个人</option>
          </select>

          <select
            className="ios-select w-[140px]"
            value={filterAcceptance}
            onChange={(e) => {
              setFilterAcceptance(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部验收</option>
            <option value="未验收">未验收</option>
            <option value="已验收">已验收</option>
            <option value="不合格">不合格</option>
          </select>

          <select
            className="ios-select w-[140px]"
            value={filterApproval}
            onChange={(e) => {
              setFilterApproval(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部审批</option>
            <option value="草稿">草稿</option>
            <option value="审批中">审批中</option>
            <option value="已批准">已批准</option>
            <option value="已驳回">已驳回</option>
          </select>

          <div className="ml-auto text-[13px] text-[#78716C]">
            共 <span className="font-semibold text-[#1C1917]">{pagination?.total ?? 0}</span> 条记录
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <Briefcase className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>{search || filterProject || filterType || filterAcceptance || filterApproval ? "没有匹配的外包任务" : "暂无外包任务，点击右上角新增"}</p>
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
                  <th>项目源ID</th>
                  <th>项目名称</th>
                  <th>类型</th>
                  <th>外包对象</th>
                  <th>任务描述</th>
                  <th>工作量</th>
                  <th>交付截止日</th>
                  <th>金额</th>
                  <th>验收状态</th>
                  <th>审批状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const tc = typeConfig[task.type] || { color: "ios-badge-gray", label: task.type };
                  const asc = acceptanceStatusConfig[task.acceptanceStatus] || { color: "ios-badge-gray", label: task.acceptanceStatus };
                  const apsc = approvalStatusConfig[task.approvalStatus] || { color: "ios-badge-gray", label: task.approvalStatus };
                  const pastDue = isPastDue(task.deliveryDeadline);
                  const isCompany = task.type === "to_company";
                  const supplier = task.supplier;
                  return (
                    <tr key={task.id} className={isSelected(task.id) ? "bg-[#1C1917]/5" : ""}>
                      {rolePerms.delete && (
                        <td className="w-10">
                          <input
                            type="checkbox"
                            className="ios-checkbox"
                            checked={isSelected(task.id)}
                            onChange={() => toggleSelect(task.id)}
                          />
                        </td>
                      )}
                      <td>
                        <span className="font-mono text-[13px] font-semibold text-[#1C1917]">
                          {task.projectSourceId}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold">{task.project.name}</span>
                      </td>
                      <td>
                        <span className={`ios-badge ${tc.color}`}>{tc.label}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {isCompany ? (
                            <Building2 className="w-3.5 h-3.5 text-[#78716C]" />
                          ) : (
                            <UserCircle className="w-3.5 h-3.5 text-[#78716C]" />
                          )}
                          <span className="font-semibold">{task.targetName}</span>
                          {supplier?.supplierType && (
                            <span className="ios-badge ios-badge-gray text-[10px]!">{supplier.supplierType}</span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-[200px]">
                        <span className="block truncate" title={task.taskDescription}>
                          {task.taskDescription.length > 40
                            ? task.taskDescription.slice(0, 40) + "..."
                            : task.taskDescription}
                        </span>
                      </td>
                      <td className="text-[#78716C]">{task.workload || "-"}</td>
                      <td>
                        <span className={pastDue ? "text-[#78716C] font-semibold" : "text-[#78716C]"}>
                          {formatDate(task.deliveryDeadline)}
                        </span>
                      </td>
                      <td className="font-semibold">{formatMoney(task.amount)}</td>
                      <td>
                        <span className={`ios-badge ${asc.color}`}>{asc.label}</span>
                      </td>
                      <td>
                        <AdminStatusOverride
                          businessType="outsourcing"
                          businessId={task.id}
                          currentStatus={task.approvalStatus}
                          onStatusChanged={(newStatus) => {
                            setTasks((prev) =>
                              prev.map((t) =>
                                t.id === task.id ? { ...t, approvalStatus: newStatus } : t
                              )
                            );
                          }}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleViewDetail(task)} title="查看">
                            <Eye className="w-3.5 h-3.5" />
                            查看
                          </button>
                          <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleOpenEdit(task)}>
                            <Pencil className="w-3.5 h-3.5" />
                            编辑
                          </button>
                          {canDeleteFrontend(hasFlow, rolePerms, task.approvalStatus, user?.id ?? "", task.createdById ?? null, isAdminUser) && (
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                              onClick={() => setDeleteConfirm(task)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
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

      {rolePerms.delete && (
        <BatchDeleteBar
          businessType="outsourcing"
          selectedIds={tasks.filter((d) => isSelected(d.id)).map((d) => d.id)}
          onDeleteSuccess={fetchTasks}
          onClear={clearSelection}
        />
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTask ? "编辑外包任务" : "新增外包任务"}
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
              <ProjectPicker
                projectLeads={projectLeads}
                value={form.projectSourceId}
                onChange={(id) => updateForm("projectSourceId", id)}
                label="项目"
                placeholder="请选择项目"
                required
                showCustomer={false}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                类型 <span className="text-[#78716C]">*</span>
              </label>
              <select
                className="ios-select"
                value={form.type}
                onChange={(e) => updateForm("type", e.target.value)}
              >
                <option value="">请选择类型</option>
                <option value="to_company">分包给公司</option>
                <option value="to_person">分包给个人</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                外包对象 <span className="text-[#78716C]">*</span>
              </label>
              <div className="flex items-center gap-2">
                <select
                  className="ios-select flex-1"
                  value={form.supplierId}
                  onChange={(e) => {
                    updateForm("supplierId", e.target.value);
                    const s = suppliers.find((s) => s.id === e.target.value);
                    if (s) updateForm("targetName", s.name);
                  }}
                >
                  <option value="">请选择供应商</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.supplierType ? ` (${s.supplierType})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917] whitespace-nowrap"
                  onClick={() => {
                    setSupplierError("");
                    setSupplierForm(emptySupplierForm);
                    setSupplierAttachmentUrl("");
                    setSupplierUploadName("");
                    setShowSupplierModal(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  新增供应商
                </button>
              </div>
            </div>

            <div className={form.type === "to_company" ? "col-span-2" : ""}>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                任务描述 <span className="text-[#78716C]">*</span>
              </label>
              <textarea
                className="ios-input min-h-[80px] resize-y"
                placeholder="请输入任务描述"
                value={form.taskDescription}
                onChange={(e) => updateForm("taskDescription", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">工作量</label>
              <input
                type="text"
                className="ios-input"
                placeholder="如：50张图纸"
                value={form.workload}
                onChange={(e) => updateForm("workload", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                交付截止日 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="date"
                className="ios-input"
                value={form.deliveryDeadline}
                onChange={(e) => updateForm("deliveryDeadline", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                金额 <span className="text-[#78716C]">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="number"
                  className="ios-input pl-10"
                  placeholder="请输入金额"
                  value={form.amount}
                  onChange={(e) => updateForm("amount", e.target.value)}
                />
              </div>
            </div>

            {editingTask && (
              <>
                <div>
                  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">验收状态</label>
                  <select
                    className="ios-select"
                    value={form.acceptanceStatus}
                    onChange={(e) => updateForm("acceptanceStatus", e.target.value)}
                  >
                    <option value="未验收">未验收</option>
                    <option value="已验收">已验收</option>
                    <option value="不合格">不合格</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">审批状态</label>
                  <select
                    className="ios-select"
                    value={form.approvalStatus}
                    onChange={(e) => updateForm("approvalStatus", e.target.value)}
                  >
                    <option value="草稿">草稿</option>
                    <option value="审批中">审批中</option>
                    <option value="已批准">已批准</option>
                    <option value="已驳回">已驳回</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "保存中..." : editingTask ? "保存修改" : "创建任务"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        title="新增供应商"
        maxWidth="600px"
      >
        <div className="space-y-4">
          {supplierError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {supplierError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                供应商名称 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入供应商名称"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">供应商性质</label>
              <select
                className="ios-select"
                value={supplierForm.supplierType}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, supplierType: e.target.value }))}
              >
                <option value="企业">企业</option>
                <option value="政府">政府</option>
                <option value="银行">银行</option>
                <option value="税务">税务</option>
                <option value="政务机构">政务机构</option>
                <option value="个人">个人</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">联系人</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入联系人"
                value={supplierForm.contactPerson}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">电话</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入电话"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">邮箱</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入邮箱"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">地址</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入地址"
                value={supplierForm.address}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">开户行</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入开户行"
                value={supplierForm.bankName}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, bankName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">银行账号</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入银行账号"
                value={supplierForm.bankAccount}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, bankAccount: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">备注</label>
              <textarea
                className="ios-input min-h-[60px] resize-y"
                placeholder="请输入备注"
                value={supplierForm.remark}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, remark: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">供应商资料</label>
              <div className="flex items-center gap-3">
                <input
                  ref={supplierFileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.rar"
                  onChange={handleSupplierFileUpload}
                />
                <button
                  type="button"
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  onClick={() => supplierFileRef.current?.click()}
                  disabled={supplierUploading}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {supplierUploading ? "上传中..." : "选择文件"}
                </button>
                {supplierUploadName && (
                  <span className="text-[12px] text-[#78716C]">{supplierUploadName}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowSupplierModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleCreateSupplier} disabled={supplierSaving}>
              {supplierSaving ? "创建中..." : "确认创建"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailTask}
        onClose={() => setDetailTask(null)}
        title="外包任务详情"
        maxWidth="680px"
      >
        {detailTask && (
          <DetailPageLayout
            title={detailTask.targetName || '外包任务详情'}
            instanceId={detailTask.approvalInstanceId}
            businessType="outsourcing"
            businessId={detailTask.id}
          >
            <div className="flex items-center gap-3 pb-4 border-b border-[#F5F5F4]">
              <div className="w-12 h-12 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-[#1C1917]" />
              </div>
              <div>
                <p className="text-[17px] font-bold text-[#1C1917]">{detailTask.targetName}</p>
                <p className="text-[13px] text-[#1C1917] font-mono font-semibold">{detailTask.projectSourceId}</p>
              </div>
              <span className={`ios-badge ml-auto ${typeConfig[detailTask.type]?.color || "ios-badge-gray"}`}>
                {typeConfig[detailTask.type]?.label || detailTask.type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">项目名称</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{detailTask.project.name}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">类型</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">
                  {typeConfig[detailTask.type]?.label || detailTask.type}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">外包对象</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[14px] font-semibold text-[#1C1917]">{detailTask.targetName}</p>
                  {detailTask.supplier?.supplierType && (
                    <span className="ios-badge ios-badge-gray text-[10px]!">{detailTask.supplier.supplierType}</span>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">
                  {detailTask.type === "to_company" ? "关联合同" : "付款来源"}
                </p>
                {detailTask.type === "to_company" && detailTask.contractId ? (
                  <p className="text-[14px] font-semibold text-[#1C1917]">
                    已自动生成支出合同（审批通过后自动创建）
                  </p>
                ) : detailTask.type === "to_company" ? (
                  <p className="text-[14px] text-[#78716C]">
                    审批通过后将自动生成支出合同
                  </p>
                ) : detailTask.acceptanceStatus === "已验收" ? (
                  <p className="text-[14px] font-semibold text-[#78716C]">
                    已自动创建应付记录（验收通过后自动创建）
                  </p>
                ) : (
                  <p className="text-[14px] text-[#78716C]">
                    验收通过后将自动创建应付记录
                  </p>
                )}
              </div>
              <div className="col-span-2 p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">任务描述</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{detailTask.taskDescription}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">工作量</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{detailTask.workload || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">交付截止日</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailTask.deliveryDeadline)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">金额</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatMoney(detailTask.amount)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">验收状态</p>
                <span className={`ios-badge ${acceptanceStatusConfig[detailTask.acceptanceStatus]?.color || "ios-badge-gray"}`}>
                  {detailTask.acceptanceStatus}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">审批状态</p>
                <AdminStatusOverride
                  businessType="outsourcing"
                  businessId={detailTask.id}
                  currentStatus={detailTask.approvalStatus}
                  onStatusChanged={(newStatus) => {
                    setDetailTask((prev) =>
                      prev ? { ...prev, approvalStatus: newStatus } : prev
                    );
                    setTasks((prev) =>
                      prev.map((t) =>
                        t.id === detailTask.id ? { ...t, approvalStatus: newStatus } : t
                      )
                    );
                  }}
                />
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">创建时间</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailTask.createdAt)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">更新时间</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailTask.updatedAt)}</p>
              </div>
            </div>

          </DetailPageLayout>
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
            确定要删除外包任务 <span className="font-semibold">{deleteConfirm?.targetName}</span> 吗？
          </p>
          <p className="text-[13px] text-[#78716C] mb-6">此操作不可撤销</p>
          <div className="flex justify-center gap-3">
            <button className="ios-btn ios-btn-secondary" onClick={() => setDeleteConfirm(null)}>取消</button>
            <button className="ios-btn ios-btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

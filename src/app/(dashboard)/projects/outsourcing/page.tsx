"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import Modal from "@/components/Modal";
import ProjectPicker, { ProjectLeadItem } from "@/components/ProjectPicker";
import SupplierPicker from "@/components/SupplierPicker";
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
import { OutsourcingDetailCard } from "@/components/detail-cards";
import WbsTaskSelector from "./components/WbsTaskSelector";

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

  const [detailTask, setDetailTask] = useState<OutsourcingTask | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<OutsourcingTask | null>(null);
  const [deleting, setDeleting] = useState(false);

  // WBS 关联状态
  const [selectedWbsIds, setSelectedWbsIds] = useState<string[]>([]);
  const [wbsLineItems, setWbsLineItems] = useState<{ wbsNodeId: string; taskName: string; workload: string; unit: string; unitPrice: string; subtotal: number }[]>([]);

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
    setSelectedWbsIds([]);
    setWbsLineItems([]);
    setShowModal(true);
  };

  const handleOpenEdit = async (task: OutsourcingTask) => {
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

    // 加载 WBS 明细
    try {
      const res = await fetch(`/api/projects/outsourcing/${task.id}`);
      const json = await res.json();
      if (res.ok && json.data?.wbsItems) {
        const items = json.data.wbsItems;
        setSelectedWbsIds(items.map((i: any) => i.wbsNodeId));
        setWbsLineItems(items.map((i: any) => ({
          wbsNodeId: i.wbsNodeId,
          taskName: i.wbsNode?.name || "",
          workload: i.workload ? String(i.workload) : "",
          unit: i.unit || "",
          unitPrice: i.unitPrice ? String(i.unitPrice) : "",
          subtotal: i.subtotal ? Number(i.subtotal) : 0,
        })));
      } else {
        setSelectedWbsIds([]);
        setWbsLineItems([]);
      }
    } catch {
      setSelectedWbsIds([]);
      setWbsLineItems([]);
    }

    setShowModal(true);
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

      // 附带 wbsItems
      if (wbsLineItems.length > 0) {
        payload.wbsItems = wbsLineItems.map((item) => ({
          wbsNodeId: item.wbsNodeId,
          workload: item.workload ? parseFloat(item.workload) : null,
          unit: item.unit || null,
          unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : null,
          subtotal: item.subtotal || 0,
        }));
        // 汇总金额
        const totalAmount = wbsLineItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
        if (totalAmount > 0) payload.amount = totalAmount;
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
        // 加载 WBS 明细用于审批传递
        if (json.data?.wbsItems) {
          const items = json.data.wbsItems;
          setWbsLineItems(items.map((i: any) => ({
            wbsNodeId: i.wbsNodeId,
            taskName: i.wbsNode?.name || "",
            workload: i.workload ? String(i.workload) : "",
            unit: i.unit || "",
            unitPrice: i.unitPrice ? String(i.unitPrice) : "",
            subtotal: i.subtotal ? Number(i.subtotal) : 0,
          })));
        }
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
              <SupplierPicker
                suppliers={suppliers}
                value={form.supplierId}
                onChange={(id, s) => {
                  updateForm("supplierId", id);
                  if (s.name) updateForm("targetName", s.name);
                }}
                label="外包对象"
                placeholder="请选择供应商"
              />
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

            {/* WBS 任务关联 */}
            {form.projectSourceId && (
              <div className="col-span-2">
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  WBS 任务明细
                </label>

                {/* 明细表 */}
                {wbsLineItems.length > 0 && (
                  <div className="border rounded-lg overflow-hidden mb-3">
                    <div className="flex bg-gray-50 border-b text-xs font-medium text-gray-500">
                      <div className="flex-[2] p-2 text-center border-r">WBS 任务</div>
                      <div className="flex-1 p-2 text-center border-r">工作量</div>
                      <div className="flex-1 p-2 text-center border-r">单价(元)</div>
                      <div className="flex-1 p-2 text-center">小计(元)</div>
                    </div>
                    {wbsLineItems.map((item, idx) => (
                      <div key={item.wbsNodeId} className="flex border-b items-center text-xs">
                        <div className="flex-[2] p-2 border-r">{item.taskName || item.wbsNodeId}</div>
                        <div className="flex-1 p-1 border-r flex items-center gap-1">
                          <input
                            type="number"
                            className="w-14 text-center border rounded px-1 py-0.5 text-xs"
                            value={item.workload}
                            placeholder="数量"
                            onChange={(e) => {
                              const next = [...wbsLineItems];
                              const wl = parseFloat(e.target.value) || 0;
                              const up = parseFloat(item.unitPrice) || 0;
                              next[idx] = { ...item, workload: e.target.value, subtotal: wl * up };
                              setWbsLineItems(next);
                            }}
                          />
                          <input
                            className="w-10 text-center border rounded px-1 py-0.5 text-xs"
                            value={item.unit}
                            placeholder="张"
                            onChange={(e) => {
                              const next = [...wbsLineItems];
                              next[idx] = { ...item, unit: e.target.value };
                              setWbsLineItems(next);
                            }}
                          />
                        </div>
                        <div className="flex-1 p-1 border-r">
                          <input
                            type="number"
                            className="w-full text-center border rounded px-1 py-0.5 text-xs"
                            value={item.unitPrice}
                            placeholder="单价"
                            onChange={(e) => {
                              const next = [...wbsLineItems];
                              const wl = parseFloat(item.workload) || 0;
                              const up = parseFloat(e.target.value) || 0;
                              next[idx] = { ...item, unitPrice: e.target.value, subtotal: wl * up };
                              setWbsLineItems(next);
                            }}
                          />
                        </div>
                        <div className="flex-1 p-2 text-center font-semibold text-blue-600">
                          ¥{item.subtotal.toLocaleString()}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end items-center p-2 bg-blue-50 text-sm">
                      <span className="font-semibold mr-2">外包总金额：</span>
                      <span className="text-lg font-bold text-blue-600">
                        ¥{wbsLineItems.reduce((sum, i) => sum + (i.subtotal || 0), 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* WBS 任务选择器 */}
                <div className="border rounded-lg">
                  <div className="p-2 bg-gray-50 border-b text-sm font-medium">
                    选择 WBS 任务（设计阶段）
                  </div>
                  <WbsTaskSelector
                    projectSourceId={form.projectSourceId}
                    selectedIds={selectedWbsIds}
                    onChange={(ids) => {
                      setSelectedWbsIds(ids);
                      // 同步明细表：新增的加入，移除的删掉
                      const newItems = ids.map((id) => {
                        const existing = wbsLineItems.find((i) => i.wbsNodeId === id);
                        if (existing) return existing;
                        return { wbsNodeId: id, taskName: "", workload: "", unit: "张", unitPrice: "", subtotal: 0 };
                      });
                      setWbsLineItems(newItems);
                      // 异步获取任务名
                      fetch(`/api/projects/plans/${form.projectSourceId}/available-tasks`)
                        .then((r) => r.json())
                        .then((data) => {
                          const tasks = data.tasks || [];
                          setWbsLineItems((prev) =>
                            prev.map((item) => {
                              const task = tasks.find((t: any) => t.id === item.wbsNodeId);
                              return { ...item, taskName: task?.name || item.taskName };
                            })
                          );
                        })
                        .catch(() => {});
                    }}
                    excludeOutsourcingId={editingTask?.id}
                    disabled={editingTask?.approvalStatus === "审批中" || editingTask?.approvalStatus === "已批准"}
                  />
                </div>
              </div>
            )}

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
            wbsItems={wbsLineItems.length > 0 ? wbsLineItems.map((i) => ({
              wbsNodeId: i.wbsNodeId,
              workload: i.workload ? parseFloat(i.workload) : null,
              unit: i.unit || null,
              unitPrice: i.unitPrice ? parseFloat(i.unitPrice) : null,
            })) : undefined}
          >
            <OutsourcingDetailCard data={detailTask} />
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

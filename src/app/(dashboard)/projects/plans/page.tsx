"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Briefcase,
  Play,
  CheckCircle,
  Calendar,
  ChevronRight,
} from "lucide-react";
import Modal from "@/components/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { BatchDeleteBar } from "@/components/BatchDeleteBar";
import ProjectPicker, { ProjectLeadItem } from "@/components/ProjectPicker";

interface Project {
  id: string;
  projectSourceId: string;
  name: string;
}

interface ProjectPlan {
  id: string;
  projectSourceId: string;
  planType: string;
  planContent: string;
  startDate: string;
  endDate: string;
  responsibleId: string | null;
  actualProgress: number;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  project: Project;
  responsiblePerson: { id: string; realName: string } | null;
}

interface PlanFormData {
  projectSourceId: string;
  planType: string;
  planContent: string;
  startDate: string;
  endDate: string;
  responsibleId: string;
  actualProgress: string;
  status: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const emptyForm: PlanFormData = {
  projectSourceId: "",
  planType: "",
  planContent: "",
  startDate: "",
  endDate: "",
  responsibleId: "",
  actualProgress: "0",
  status: "未开始",
};

const statusConfig: Record<string, { color: string; label: string }> = {
  "未开始": { color: "ios-badge-gray", label: "未开始" },
  "进行中": { color: "ios-badge-blue", label: "进行中" },
  "已完成": { color: "ios-badge-green", label: "已完成" },
  "已取消": { color: "ios-badge-red", label: "已取消" },
};

const planTypeConfig: Record<string, string> = {
  "里程碑": "ios-badge-blue",
  "设计": "ios-badge-green",
  "采购": "ios-badge-orange",
};

const progressColor = (value: number) => {
  if (value >= 80) return "bg-[#78716C]";
  if (value >= 50) return "bg-[#1C1917]";
  if (value >= 20) return "bg-[#78716C]";
  return "bg-[#78716C]";
};

export default function ProjectPlansPage() {
  const { user } = useAuth();
  const isAdminUser = user?.username === "admin" || user?.roles?.some((r: any) => r.code === "admin") || false;
  const [plans, setPlans] = useState<ProjectPlan[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, pageSize: 20, total: 0, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterPlanType, setFilterPlanType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ProjectPlan | null>(null);
  const [form, setForm] = useState<PlanFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLeads, setProjectLeads] = useState<ProjectLeadItem[]>([]);
  const [users, setUsers] = useState<{id: string; username: string; realName: string}[]>([]);

  const [detailPlan, setDetailPlan] = useState<ProjectPlan | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProjectPlan | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    toggleSelect,
    selectAll,
    clearSelection,
    isAllSelected,
    isSelected,
  } = useBatchSelection(plans.map((d) => d.id));

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

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterProject) params.set("projectSourceId", filterProject);
      if (filterPlanType) params.set("planType", filterPlanType);
      if (filterStatus) params.set("status", filterStatus);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/projects/plans?${params}`);
      const json = await res.json();
      if (res.ok) {
        setPlans(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取项目计划列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterProject, filterPlanType, filterStatus, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchProjects();
    fetch("/api/settings/users").then(res => res.json()).then(json => setUsers(json.data || []));
  }, [fetchProjects]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (plan: ProjectPlan) => {
    setEditingPlan(plan);
    setForm({
      projectSourceId: plan.projectSourceId,
      planType: plan.planType,
      planContent: plan.planContent,
      startDate: plan.startDate ? plan.startDate.split("T")[0] : "",
      endDate: plan.endDate ? plan.endDate.split("T")[0] : "",
      responsibleId: plan.responsibleId || "",
      actualProgress: String(plan.actualProgress),
      status: plan.status,
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.projectSourceId) {
      setFormError("请选择项目");
      return;
    }
    if (!form.planType) {
      setFormError("请选择计划类型");
      return;
    }
    if (!form.planContent.trim()) {
      setFormError("计划内容不能为空");
      return;
    }
    if (!form.startDate) {
      setFormError("请选择开始日期");
      return;
    }
    if (!form.endDate) {
      setFormError("请选择结束日期");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const url = editingPlan
        ? `/api/projects/plans/${editingPlan.id}`
        : "/api/projects/plans";
      const method = editingPlan ? "PUT" : "POST";

      const body: Record<string, unknown> = { ...form };
      if (!editingPlan) {
        delete body.actualProgress;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchPlans();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleViewDetail = async (plan: ProjectPlan) => {
    try {
      const res = await fetch(`/api/projects/plans/${plan.id}`);
      const json = await res.json();
      if (res.ok) {
        setDetailPlan(json.data);
      }
    } catch {
      setDetailPlan(plan);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/plans/${deleteConfirm.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchPlans();
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

  const updateForm = (field: keyof PlanFormData, value: string) => {
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
    inProgress: plans.filter((p) => p.status === "进行中").length,
    completed: plans.filter((p) => p.status === "已完成").length,
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>项目计划</h1>
            <p>管理项目计划，跟踪里程碑、设计与采购进度</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新建计划
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-[#1C1917]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">计划总数</p>
            <p className="text-[24px] font-bold text-[#1C1917] leading-tight">{stats.total}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#78716C]/10 flex items-center justify-center">
            <Play className="w-5 h-5 text-[#78716C]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">进行中</p>
            <p className="text-[24px] font-bold text-[#78716C] leading-tight">{stats.inProgress}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#78716C]/10 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-[#78716C]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">已完成</p>
            <p className="text-[24px] font-bold text-[#78716C] leading-tight">{stats.completed}</p>
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
              placeholder="搜索计划内容..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
          </div>

          <select
            className="ios-select w-[180px]"
            value={filterProject}
            onChange={(e) => {
              setFilterProject(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.projectSourceId}>
                {p.projectSourceId} - {p.name}
              </option>
            ))}
          </select>

          <select
            className="ios-select w-[130px]"
            value={filterPlanType}
            onChange={(e) => {
              setFilterPlanType(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部类型</option>
            <option value="里程碑">里程碑</option>
            <option value="设计">设计</option>
            <option value="采购">采购</option>
          </select>

          <select
            className="ios-select w-[130px]"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部状态</option>
            <option value="未开始">未开始</option>
            <option value="进行中">进行中</option>
            <option value="已完成">已完成</option>
            <option value="已取消">已取消</option>
          </select>

          <div className="ml-auto text-[13px] text-[#78716C]">
            共 <span className="font-semibold text-[#1C1917]">{pagination.total}</span> 条计划
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <Calendar className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>{search || filterProject || filterPlanType || filterStatus ? "没有匹配的项目计划" : "暂无计划，点击右上角新建"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
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
                  <th>计划类型</th>
                  <th>计划内容</th>
                  <th>开始日期</th>
                  <th>结束日期</th>
                  <th>负责人</th>
                  <th>进度</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => {
                  const sc = statusConfig[plan.status] || statusConfig["未开始"];
                  const tc = planTypeConfig[plan.planType] || "ios-badge-gray";
                  return (
                    <tr key={plan.id} className={isSelected(plan.id) ? "bg-[#1C1917]/5" : ""}>
                      {isAdminUser && (
                        <td className="w-10">
                          <input
                            type="checkbox"
                            className="ios-checkbox"
                            checked={isSelected(plan.id)}
                            onChange={() => toggleSelect(plan.id)}
                          />
                        </td>
                      )}
                      <td>
                        <span className="font-mono text-[13px] font-semibold text-[#1C1917]">
                          {plan.projectSourceId}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold">{plan.project?.name || "-"}</span>
                      </td>
                      <td>
                        <span className={`ios-badge ${tc}`}>{plan.planType}</span>
                      </td>
                      <td>
                        <span className="text-[13px]">
                          {plan.planContent.length > 50
                            ? plan.planContent.slice(0, 50) + "..."
                            : plan.planContent}
                        </span>
                      </td>
                      <td className="text-[#78716C]">{formatDate(plan.startDate)}</td>
                      <td className="text-[#78716C]">{formatDate(plan.endDate)}</td>
                      <td>{plan.responsiblePerson?.realName || "-"}</td>
                      <td>
                        <div className="flex items-center gap-2 min-w-[80px]">
                          <div className="flex-1 h-2 rounded-full bg-[#F5F5F4] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${progressColor(plan.actualProgress)}`}
                              style={{ width: `${Math.min(100, Math.max(0, plan.actualProgress))}%` }}
                            />
                          </div>
                          <span className="text-[12px] text-[#78716C] w-8 text-right">{plan.actualProgress}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`ios-badge ${sc.color}`}>{sc.label}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleViewDetail(plan)}>
                            <Eye className="w-3.5 h-3.5" />
                            详情
                          </button>
                          <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleOpenEdit(plan)}>
                            <Pencil className="w-3.5 h-3.5" />
                            编辑
                          </button>
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                            onClick={() => setDeleteConfirm(plan)}
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

      {isAdminUser && (
        <BatchDeleteBar
          businessType="project_plan"
          selectedIds={plans.filter((d) => isSelected(d.id)).map((d) => d.id)}
          onDeleteSuccess={fetchPlans}
          onClear={clearSelection}
        />
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingPlan ? "编辑项目计划" : "新建项目计划"}
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
                计划类型 <span className="text-[#78716C]">*</span>
              </label>
              <select
                className="ios-select"
                value={form.planType}
                onChange={(e) => updateForm("planType", e.target.value)}
              >
                <option value="">请选择类型</option>
                <option value="里程碑">里程碑</option>
                <option value="设计">设计</option>
                <option value="采购">采购</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                计划内容 <span className="text-[#78716C]">*</span>
              </label>
              <textarea
                className="ios-input min-h-[80px] resize-y"
                placeholder="请输入计划内容"
                value={form.planContent}
                onChange={(e) => updateForm("planContent", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                开始日期 <span className="text-[#78716C]">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="date"
                  className="ios-input pl-10"
                  value={form.startDate}
                  onChange={(e) => updateForm("startDate", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                结束日期 <span className="text-[#78716C]">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="date"
                  className="ios-input pl-10"
                  value={form.endDate}
                  onChange={(e) => updateForm("endDate", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">负责人</label>
              <select
                className="ios-select"
                value={form.responsibleId}
                onChange={(e) => updateForm("responsibleId", e.target.value)}
              >
                <option value="">请选择负责人</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.realName}</option>)}
              </select>
            </div>

            {editingPlan && (
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">进度 (%)</label>
                <input
                  type="number"
                  className="ios-input"
                  min="0"
                  max="100"
                  placeholder="0-100"
                  value={form.actualProgress}
                  onChange={(e) => updateForm("actualProgress", e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">状态</label>
              <select
                className="ios-select"
                value={form.status}
                onChange={(e) => updateForm("status", e.target.value)}
              >
                <option value="未开始">未开始</option>
                <option value="进行中">进行中</option>
                <option value="已完成">已完成</option>
                <option value="已取消">已取消</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "保存中..." : editingPlan ? "保存修改" : "创建计划"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailPlan}
        onClose={() => setDetailPlan(null)}
        title="项目计划详情"
        maxWidth="680px"
      >
        {detailPlan && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F5F5F4]">
              <div className="w-12 h-12 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-[#1C1917]" />
              </div>
              <div>
                <p className="text-[17px] font-bold text-[#1C1917]">{detailPlan.project?.name || "-"}</p>
                <p className="text-[13px] text-[#1C1917] font-mono font-semibold">{detailPlan.projectSourceId}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className={`ios-badge ${planTypeConfig[detailPlan.planType] || "ios-badge-gray"}`}>
                  {detailPlan.planType}
                </span>
                <span className={`ios-badge ${statusConfig[detailPlan.status]?.color || "ios-badge-gray"}`}>
                  {detailPlan.status}
                </span>
              </div>
            </div>

            <div>
              <p className="text-[12px] text-[#78716C] mb-1">计划内容</p>
              <p className="text-[14px] text-[#1C1917] leading-relaxed">{detailPlan.planContent}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">开始日期</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailPlan.startDate)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">结束日期</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailPlan.endDate)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">负责人</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{detailPlan.responsiblePerson?.realName || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">版本</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">v{detailPlan.version}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">创建时间</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailPlan.createdAt)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">更新时间</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailPlan.updatedAt)}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#FAFAF9]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] text-[#78716C]">实际进度</p>
                <p className="text-[14px] font-bold text-[#1C1917]">{detailPlan.actualProgress}%</p>
              </div>
              <div className="h-3 rounded-full bg-[#E7E5E4] overflow-hidden">
                <div
                  className={`h-full rounded-full ${progressColor(detailPlan.actualProgress)}`}
                  style={{ width: `${Math.min(100, Math.max(0, detailPlan.actualProgress))}%` }}
                />
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
            确定要删除计划 <span className="font-semibold">{deleteConfirm?.projectSourceId}</span> 吗？
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

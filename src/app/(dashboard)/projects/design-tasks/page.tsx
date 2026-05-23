"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  PenTool,
  Users,
  Clock,
  ExternalLink,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Project {
  id: string;
  projectSourceId: string;
  name: string;
}

interface DesignTask {
  id: string;
  projectSourceId: string;
  discipline: string | null;
  volume: string | null;
  drawingNo: string | null;
  assignedTo: string | null;
  plannedHours: number | null;
  actualHours: number | null;
  fileLink: string | null;
  changeRecord: unknown[];
  createdAt: string;
  updatedAt: string;
  project: Project;
  assignee: { id: string; realName: string } | null;
}

interface DesignTaskFormData {
  projectSourceId: string;
  discipline: string;
  volume: string;
  drawingNo: string;
  assignedTo: string;
  plannedHours: string;
  actualHours: string;
  fileLink: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const emptyForm: DesignTaskFormData = {
  projectSourceId: "",
  discipline: "",
  volume: "",
  drawingNo: "",
  assignedTo: "",
  plannedHours: "",
  actualHours: "",
  fileLink: "",
};

const disciplineConfig: Record<string, { color: string; label: string }> = {
  "工艺": { color: "ios-badge-blue", label: "工艺" },
  "管道": { color: "ios-badge-green", label: "管道" },
  "设备": { color: "ios-badge-orange", label: "设备" },
  "土建": { color: "ios-badge-gray", label: "土建" },
  "电气": { color: "ios-badge-red", label: "电气" },
  "仪表": { color: "ios-badge-blue", label: "仪表" },
  "暖通": { color: "ios-badge-orange", label: "暖通" },
  "给排水": { color: "ios-badge-green", label: "给排水" },
};

const disciplineList = ["工艺", "管道", "设备", "土建", "电气", "仪表", "暖通", "给排水"];

export default function DesignTasksPage() {
  const [tasks, setTasks] = useState<DesignTask[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, pageSize: 20, total: 0, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterDiscipline, setFilterDiscipline] = useState("");
  const [filterAssigned, setFilterAssigned] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<DesignTask | null>(null);
  const [form, setForm] = useState<DesignTaskFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);

  const [detailTask, setDetailTask] = useState<DesignTask | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DesignTask | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects?pageSize=200");
      const json = await res.json();
      if (res.ok) setProjects(json.data);
    } catch (err) {
      console.error("获取项目列表失败:", err);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterProject) params.set("projectSourceId", filterProject);
      if (filterDiscipline) params.set("discipline", filterDiscipline);
      if (filterAssigned) params.set("assigned", filterAssigned);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/projects/design-tasks?${params}`);
      const json = await res.json();
      if (res.ok) {
        setTasks(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取设计任务列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterProject, filterDiscipline, filterAssigned, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleOpenCreate = () => {
    setEditingTask(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (task: DesignTask) => {
    setEditingTask(task);
    setForm({
      projectSourceId: task.projectSourceId,
      discipline: task.discipline || "",
      volume: task.volume || "",
      drawingNo: task.drawingNo || "",
      assignedTo: task.assignedTo || "",
      plannedHours: task.plannedHours != null ? String(task.plannedHours) : "",
      actualHours: task.actualHours != null ? String(task.actualHours) : "",
      fileLink: task.fileLink || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.projectSourceId) {
      setFormError("请选择项目");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const url = editingTask
        ? `/api/projects/design-tasks/${editingTask.id}`
        : "/api/projects/design-tasks";
      const method = editingTask ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

  const handleViewDetail = async (task: DesignTask) => {
    try {
      const res = await fetch(`/api/projects/design-tasks/${task.id}`);
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
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/design-tasks/${deleteConfirm.id}`, { method: "DELETE" });
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

  const updateForm = (field: keyof DesignTaskFormData, value: string) => {
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
    assigned: tasks.filter((t) => t.assignedTo !== null).length,
    plannedHours: tasks.reduce((sum, t) => sum + (t.plannedHours || 0), 0),
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>设计管理</h1>
            <p>管理设计任务，跟踪图纸分配与工时进度</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新建任务
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center">
            <PenTool className="w-5 h-5 text-[#007AFF]" />
          </div>
          <div>
            <p className="text-[13px] text-[#86868B]">设计任务数</p>
            <p className="text-[24px] font-bold text-[#1D1D1F] leading-tight">{stats.total}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#34C759]/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-[#34C759]" />
          </div>
          <div>
            <p className="text-[13px] text-[#86868B]">已分配</p>
            <p className="text-[24px] font-bold text-[#34C759] leading-tight">{stats.assigned}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#FF9500]/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-[#FF9500]" />
          </div>
          <div>
            <p className="text-[13px] text-[#86868B]">总计划工时</p>
            <p className="text-[24px] font-bold text-[#FF9500] leading-tight">{stats.plannedHours}</p>
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
              placeholder="搜索图纸编号、专业..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
          </div>

          <select
            className="ios-select w-[160px]"
            value={filterProject}
            onChange={(e) => {
              setFilterProject(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.projectSourceId}>{p.name}</option>
            ))}
          </select>

          <select
            className="ios-select w-[130px]"
            value={filterDiscipline}
            onChange={(e) => {
              setFilterDiscipline(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部专业</option>
            {disciplineList.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            className="ios-select w-[120px]"
            value={filterAssigned}
            onChange={(e) => {
              setFilterAssigned(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部</option>
            <option value="assigned">已分配</option>
            <option value="unassigned">未分配</option>
          </select>

          <div className="ml-auto text-[13px] text-[#86868B]">
            共 <span className="font-semibold text-[#1D1D1F]">{pagination.total}</span> 条任务
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
              <PenTool className="w-8 h-8 text-[#86868B]" />
            </div>
            <p>{search || filterProject || filterDiscipline || filterAssigned ? "没有匹配的设计任务" : "暂无任务，点击右上角新建"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>项目源ID</th>
                  <th>项目名称</th>
                  <th>专业</th>
                  <th>卷册</th>
                  <th>图纸编号</th>
                  <th>负责人</th>
                  <th>计划工时</th>
                  <th>实际工时</th>
                  <th>工时偏差</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const dc = task.discipline ? (disciplineConfig[task.discipline] || { color: "ios-badge-gray", label: task.discipline }) : null;
                  const deviation = (task.actualHours ?? 0) - (task.plannedHours ?? 0);
                  const overBudget = task.actualHours != null && task.plannedHours != null && task.actualHours > task.plannedHours;
                  return (
                    <tr key={task.id}>
                      <td>
                        <span className="font-mono text-[13px] font-semibold text-[#007AFF]">
                          {task.projectSourceId}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold">{task.project.name}</span>
                      </td>
                      <td>
                        {dc ? (
                          <span className={`ios-badge ${dc.color}`}>{dc.label}</span>
                        ) : (
                          <span className="text-[#86868B]">-</span>
                        )}
                      </td>
                      <td className="text-[#86868B]">{task.volume || "-"}</td>
                      <td>
                        <span className="font-mono text-[13px]">{task.drawingNo || "-"}</span>
                      </td>
                      <td>
                        {task.assignee ? (
                          <span className="font-semibold">{task.assignee.realName}</span>
                        ) : (
                          <span className="text-[#86868B]">未分配</span>
                        )}
                      </td>
                      <td className="text-[#1D1D1F]">{task.plannedHours != null ? task.plannedHours : "-"}</td>
                      <td>
                        <span className={overBudget ? "text-[#FF3B30] font-semibold" : "text-[#1D1D1F]"}>
                          {task.actualHours != null ? task.actualHours : "-"}
                        </span>
                      </td>
                      <td>
                        {task.actualHours != null && task.plannedHours != null ? (
                          <span className={deviation > 0 ? "text-[#FF3B30] font-semibold" : deviation < 0 ? "text-[#34C759] font-semibold" : "text-[#86868B]"}>
                            {deviation > 0 ? `+${deviation}` : deviation}
                          </span>
                        ) : (
                          <span className="text-[#86868B]">-</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleViewDetail(task)}>
                            <Eye className="w-3.5 h-3.5" />
                            详情
                          </button>
                          <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleOpenEdit(task)}>
                            <Pencil className="w-3.5 h-3.5" />
                            编辑
                          </button>
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                            onClick={() => setDeleteConfirm(task)}
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
        title={editingTask ? "编辑设计任务" : "新建设计任务"}
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
                项目 <span className="text-[#FF3B30]">*</span>
              </label>
              <select
                className="ios-select"
                value={form.projectSourceId}
                onChange={(e) => updateForm("projectSourceId", e.target.value)}
              >
                <option value="">请选择项目</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.projectSourceId}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">专业</label>
              <select
                className="ios-select"
                value={form.discipline}
                onChange={(e) => updateForm("discipline", e.target.value)}
              >
                <option value="">请选择专业</option>
                {disciplineList.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">卷册</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入卷册"
                value={form.volume}
                onChange={(e) => updateForm("volume", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">图纸编号</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入图纸编号"
                value={form.drawingNo}
                onChange={(e) => updateForm("drawingNo", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">负责人</label>
              <input
                type="text"
                className="ios-input"
                placeholder="输入负责人用户ID"
                value={form.assignedTo}
                onChange={(e) => updateForm("assignedTo", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">计划工时</label>
              <input
                type="number"
                className="ios-input"
                placeholder="计划工时"
                value={form.plannedHours}
                onChange={(e) => updateForm("plannedHours", e.target.value)}
              />
            </div>

            {editingTask && (
              <div>
                <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">实际工时</label>
                <input
                  type="number"
                  className="ios-input"
                  placeholder="实际工时"
                  value={form.actualHours}
                  onChange={(e) => updateForm("actualHours", e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">文件链接</label>
              <input
                type="url"
                className="ios-input"
                placeholder="请输入文件链接"
                value={form.fileLink}
                onChange={(e) => updateForm("fileLink", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
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
        title="设计任务详情"
        maxWidth="680px"
      >
        {detailTask && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F0F0F0]">
              <div className="w-12 h-12 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center">
                <PenTool className="w-6 h-6 text-[#007AFF]" />
              </div>
              <div>
                <p className="text-[17px] font-bold text-[#1D1D1F]">{detailTask.project.name}</p>
                <p className="text-[13px] text-[#007AFF] font-mono font-semibold">{detailTask.projectSourceId}</p>
              </div>
              {detailTask.discipline && (
                <span className={`ios-badge ml-auto ${(disciplineConfig[detailTask.discipline] || { color: "ios-badge-gray" }).color}`}>
                  {detailTask.discipline}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">卷册</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{detailTask.volume || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">图纸编号</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F] font-mono">{detailTask.drawingNo || "-"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">负责人</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{detailTask.assignee ? detailTask.assignee.realName : "未分配"}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">文件链接</p>
                {detailTask.fileLink ? (
                  <a
                    href={detailTask.fileLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] font-semibold text-[#007AFF] flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    查看文件
                  </a>
                ) : (
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">-</p>
                )}
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">创建时间</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{formatDate(detailTask.createdAt)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-1">更新时间</p>
                <p className="text-[14px] font-semibold text-[#1D1D1F]">{formatDate(detailTask.updatedAt)}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F5F5F7]">
              <p className="text-[13px] font-semibold text-[#1D1D1F] mb-3">工时对比</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-[#86868B] w-16">计划工时</span>
                  <div className="flex-1 h-4 bg-[#E5E5EA] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#007AFF] rounded-full transition-all"
                      style={{
                        width: detailTask.plannedHours ? `${Math.min((detailTask.plannedHours / Math.max(detailTask.plannedHours, detailTask.actualHours || 0)) * 100, 100)}%` : "0%",
                      }}
                    />
                  </div>
                  <span className="text-[13px] font-semibold text-[#1D1D1F] w-12 text-right">{detailTask.plannedHours ?? "-"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-[#86868B] w-16">实际工时</span>
                  <div className="flex-1 h-4 bg-[#E5E5EA] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        backgroundColor: detailTask.actualHours != null && detailTask.plannedHours != null && detailTask.actualHours > detailTask.plannedHours ? "#FF3B30" : "#34C759",
                        width: detailTask.actualHours && detailTask.plannedHours ? `${Math.min((detailTask.actualHours / Math.max(detailTask.plannedHours, detailTask.actualHours)) * 100, 100)}%` : "0%",
                      }}
                    />
                  </div>
                  <span className="text-[13px] font-semibold text-[#1D1D1F] w-12 text-right">{detailTask.actualHours ?? "-"}</span>
                </div>
              </div>
            </div>

            {Array.isArray(detailTask.changeRecord) && detailTask.changeRecord.length > 0 && (
              <div className="pt-3 border-t border-[#F0F0F0]">
                <p className="text-[13px] font-semibold text-[#1D1D1F] mb-2">变更记录</p>
                <div className="space-y-2">
                  {detailTask.changeRecord.map((record, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-[#F5F5F7] text-[13px] text-[#1D1D1F]">
                      {typeof record === "string" ? record : JSON.stringify(record)}
                    </div>
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
            确定要删除设计任务 <span className="font-semibold">{deleteConfirm?.drawingNo || deleteConfirm?.projectSourceId}</span> 吗？
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
    </>
  );
}

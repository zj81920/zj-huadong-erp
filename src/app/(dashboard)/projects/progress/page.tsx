"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  BarChart3,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import Modal from "@/components/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { BatchDeleteBar } from "@/components/BatchDeleteBar";
import { usePagination } from "@/hooks/usePagination";
import PaginationBar from "@/components/PaginationBar";
import { getRowStatusClass } from "@/lib/status-colors";
import { getUserModulePerms, canDeleteFrontend, canEditFrontend } from "@/lib/types/permissions";

interface Project {
  id: string;
  projectSourceId: string;
  name: string;
}

interface ProjectProgress {
  id: string;
  projectSourceId: string;
  taskNode: string;
  plannedPercentage: number;
  actualPercentage: number;
  delayDays: number;
  alertStatus: string;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  project: Project;
}

interface ProgressFormData {
  projectSourceId: string;
  taskNode: string;
  plannedPercentage: string;
  actualPercentage: string;
  delayDays: string;
}

const emptyForm: ProgressFormData = {
  projectSourceId: "",
  taskNode: "",
  plannedPercentage: "",
  actualPercentage: "",
  delayDays: "",
};

const alertStatusConfig: Record<string, { color: string; label: string }> = {
  "正常": { color: "ios-badge-green", label: "正常" },
  "滞后": { color: "ios-badge-red", label: "滞后" },
};

export default function ProjectProgressPage() {
  const { user } = useAuth();
  const isAdminUser = user?.username === "admin" || user?.roles?.some((r: any) => r.code === "admin") || false;
  const rolePerms = getUserModulePerms(user, "projects.progress");
  const hasFlow = false;
  const [records, setRecords] = useState<ProjectProgress[]>([]);
  const { page, pageSize, setPage, setPageSize, pagination, setPagination } = usePagination({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterAlert, setFilterAlert] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ProjectProgress | null>(null);
  const [form, setForm] = useState<ProgressFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);

  const [detailRecord, setDetailRecord] = useState<ProjectProgress | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProjectProgress | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    toggleSelect,
    selectAll,
    clearSelection,
    isAllSelected,
    isSelected,
  } = useBatchSelection(records.map((d) => d.id));

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects?pageSize=200");
      const json = await res.json();
      if (res.ok) setProjects(json.data);
    } catch (err) {
      console.error("获取项目列表失败:", err);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterProject) params.set("projectSourceId", filterProject);
      if (filterAlert) params.set("alertStatus", filterAlert);
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());

      const res = await fetch(`/api/projects/progress?${params}`);
      const json = await res.json();
      if (res.ok) {
        setRecords(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取项目进度列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterProject, filterAlert, page, pageSize]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (record: ProjectProgress) => {
    setEditingRecord(record);
    setForm({
      projectSourceId: record.projectSourceId,
      taskNode: record.taskNode,
      plannedPercentage: String(record.plannedPercentage),
      actualPercentage: String(record.actualPercentage),
      delayDays: String(record.delayDays),
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.projectSourceId) {
      setFormError("请选择所属项目");
      return;
    }
    if (!form.taskNode.trim()) {
      setFormError("任务节点不能为空");
      return;
    }
    if (!form.plannedPercentage) {
      setFormError("请输入计划进度");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload: Record<string, unknown> = {
        projectSourceId: form.projectSourceId,
        taskNode: form.taskNode.trim(),
        plannedPercentage: parseInt(form.plannedPercentage),
        actualPercentage: form.actualPercentage ? parseInt(form.actualPercentage) : 0,
        delayDays: form.delayDays ? parseInt(form.delayDays) : 0,
      };

      const url = editingRecord
        ? `/api/projects/progress/${editingRecord.id}`
        : "/api/projects/progress";
      const method = editingRecord ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const handleViewDetail = async (record: ProjectProgress) => {
    try {
      const res = await fetch(`/api/projects/progress/${record.id}`);
      const json = await res.json();
      if (res.ok) {
        setDetailRecord(json.data);
      }
    } catch {
      setDetailRecord(record);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/progress/${deleteConfirm.id}`, { method: "DELETE" });
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

  const updateForm = (field: keyof ProgressFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const getProgressColor = (actual: number, planned: number) => {
    if (actual >= planned) return "#78716C";
    if (actual >= planned * 0.5) return "#78716C";
    return "#78716C";
  };

  const stats = {
    total: pagination?.total ?? 0,
    normal: records.filter((r) => r.alertStatus === "正常").length,
    delayed: records.filter((r) => r.alertStatus === "滞后").length,
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>项目进度</h1>
            <p>监控项目各节点进度，及时发现滞后预警</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增进度
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-[#1C1917]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">监控节点数</p>
            <p className="text-[24px] font-bold text-[#1C1917] leading-tight">{stats.total}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#78716C]/10 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-[#78716C]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">正常</p>
            <p className="text-[24px] font-bold text-[#78716C] leading-tight">{stats.normal}</p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#78716C]/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-[#78716C]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">滞后</p>
            <p className="text-[24px] font-bold text-[#78716C] leading-tight">{stats.delayed}</p>
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
              placeholder="搜索任务节点..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            className="ios-select w-[200px]"
            value={filterProject}
            onChange={(e) => {
              setFilterProject(e.target.value);
              setPage(1);
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
            className="ios-select w-[140px]"
            value={filterAlert}
            onChange={(e) => {
              setFilterAlert(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部状态</option>
            <option value="正常">正常</option>
            <option value="滞后">滞后</option>
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
        ) : records.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>{search || filterProject || filterAlert ? "没有匹配的进度记录" : "暂无进度记录，点击右上角新增"}</p>
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
                  <th>任务节点</th>
                  <th>计划进度</th>
                  <th>实际进度</th>
                  <th>进度条</th>
                  <th>滞后天数</th>
                  <th>预警状态</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const progressColor = getProgressColor(record.actualPercentage, record.plannedPercentage);
                  return (
                    <tr key={record.id} className={isSelected(record.id) ? "bg-[#1C1917]/5" : ""}>
                      {isAdminUser && (
                        <td className="w-10">
                          <input
                            type="checkbox"
                            className="ios-checkbox"
                            checked={isSelected(record.id)}
                            onChange={() => toggleSelect(record.id)}
                          />
                        </td>
                      )}
                      <td>
                        <span className="font-mono text-[13px] font-semibold text-[#1C1917]">
                          {record.projectSourceId}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold">{record.project.name}</span>
                      </td>
                      <td>
                        <span className="font-semibold">{record.taskNode}</span>
                      </td>
                      <td>{record.plannedPercentage}%</td>
                      <td>{record.actualPercentage}%</td>
                      <td>
                        <div className="w-[100px] h-[6px] bg-[#F5F5F4] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${record.actualPercentage}%`,
                              backgroundColor: progressColor,
                            }}
                          />
                        </div>
                      </td>
                      <td>
                        <span className={record.delayDays > 0 ? "text-[#78716C] font-semibold" : "text-[#78716C]"}>
                          {record.delayDays > 0 ? `+${record.delayDays}` : "0"}
                        </span>
                      </td>
                      <td>
                        <span className={`ios-badge ${alertStatusConfig[record.alertStatus]?.color || "ios-badge-gray"} ${record.alertStatus === "滞后" ? "breathing-alert" : ""}`}>
                          {alertStatusConfig[record.alertStatus]?.label || record.alertStatus}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleViewDetail(record)}>
                            <Eye className="w-3.5 h-3.5" />
                            详情
                          </button>
                          {canEditFrontend(hasFlow, rolePerms, "", user?.id ?? "", null, isAdminUser) && (
                            <button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => handleOpenEdit(record)}>
                              <Pencil className="w-3.5 h-3.5" />
                              编辑
                            </button>
                          )}
                          {canDeleteFrontend(hasFlow, rolePerms, "", user?.id ?? "", null, isAdminUser) && (
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                              onClick={() => setDeleteConfirm(record)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="text-[#78716C] text-[12px] whitespace-nowrap">
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

            <PaginationBar
              pagination={pagination}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {isAdminUser && (
        <BatchDeleteBar
          businessType="project_progress"
          selectedIds={records.filter((d) => isSelected(d.id)).map((d) => d.id)}
          onDeleteSuccess={fetchRecords}
          onClear={clearSelection}
        />
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingRecord ? "编辑进度记录" : "新增进度记录"}
        maxWidth="600px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              所属项目 <span className="text-[#78716C]">*</span>
            </label>
            <select
              className="ios-select"
              value={form.projectSourceId}
              onChange={(e) => updateForm("projectSourceId", e.target.value)}
              disabled={!!editingRecord}
            >
              <option value="">请选择项目</option>
              {projects.map((p) => (
                <option key={p.id} value={p.projectSourceId}>
                  {p.projectSourceId} - {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              任务节点 <span className="text-[#78716C]">*</span>
            </label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入任务节点名称"
              value={form.taskNode}
              onChange={(e) => updateForm("taskNode", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                计划进度 (%) <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="number"
                className="ios-input"
                placeholder="0-100"
                min="0"
                max="100"
                value={form.plannedPercentage}
                onChange={(e) => updateForm("plannedPercentage", e.target.value)}
              />
            </div>

            {editingRecord && (
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  实际进度 (%)
                </label>
                <input
                  type="number"
                  className="ios-input"
                  placeholder="0-100"
                  min="0"
                  max="100"
                  value={form.actualPercentage}
                  onChange={(e) => updateForm("actualPercentage", e.target.value)}
                />
              </div>
            )}

            {editingRecord && (
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  滞后天数
                </label>
                <input
                  type="number"
                  className="ios-input"
                  placeholder="0"
                  min="0"
                  value={form.delayDays}
                  onChange={(e) => updateForm("delayDays", e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "保存中..." : editingRecord ? "保存修改" : "创建记录"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        title="进度详情"
        maxWidth="640px"
      >
        {detailRecord && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F5F5F4]">
              <div className="w-12 h-12 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-[#1C1917]" />
              </div>
              <div>
                <p className="text-[17px] font-bold text-[#1C1917]">{detailRecord.taskNode}</p>
                <p className="text-[13px] text-[#1C1917] font-mono font-semibold">{detailRecord.projectSourceId}</p>
              </div>
              <span className={`ios-badge ml-auto ${alertStatusConfig[detailRecord.alertStatus]?.color || "ios-badge-gray"} ${detailRecord.alertStatus === "滞后" ? "breathing-alert" : ""}`}>
                {detailRecord.alertStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">所属项目</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{detailRecord.project.name}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">滞后天数</p>
                <p className={`text-[14px] font-semibold ${detailRecord.delayDays > 0 ? "text-[#78716C]" : "text-[#1C1917]"}`}>
                  {detailRecord.delayDays > 0 ? `+${detailRecord.delayDays} 天` : "0 天"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">计划进度</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{detailRecord.plannedPercentage}%</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">实际进度</p>
                <p className={`text-[14px] font-semibold ${detailRecord.actualPercentage >= detailRecord.plannedPercentage ? "text-[#78716C]" : "text-[#78716C]"}`}>
                  {detailRecord.actualPercentage}%
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#F5F5F4]">
              <p className="text-[13px] font-semibold text-[#1C1917] mb-3">进度对比</p>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-[#78716C]">计划</span>
                    <span className="font-semibold">{detailRecord.plannedPercentage}%</span>
                  </div>
                  <div className="w-full h-[8px] bg-[#E7E5E4] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1C1917] rounded-full"
                      style={{ width: `${detailRecord.plannedPercentage}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-[#78716C]">实际</span>
                    <span className="font-semibold">{detailRecord.actualPercentage}%</span>
                  </div>
                  <div className="w-full h-[8px] bg-[#E7E5E4] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${detailRecord.actualPercentage}%`,
                        backgroundColor: getProgressColor(detailRecord.actualPercentage, detailRecord.plannedPercentage),
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#F5F5F4]">
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">创建时间</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailRecord.createdAt)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#FAFAF9]">
                <p className="text-[12px] text-[#78716C] mb-1">更新时间</p>
                <p className="text-[14px] font-semibold text-[#1C1917]">{formatDate(detailRecord.updatedAt)}</p>
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
            确定要删除进度节点 <span className="font-semibold">{deleteConfirm?.taskNode}</span> 吗？
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

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Flag,
  AlertCircle,
  Calendar,
  ArrowLeft,
  BookOpen,
} from "lucide-react";
import Modal from "@/components/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { buildWbsTree, type WbsTreeNode } from "@/lib/wbs-utils";

/* ---------- 类型 ---------- */

interface WbsNodeRaw {
  id: string;
  projectSourceId: string;
  parentId: string | null;
  level: number;
  name: string;
  disciplineCode: string | null;
  isMilestone: boolean;
  plannedPct: number;
  actualPct: number;
  delayDays: number;
  alertStatus: string;
  responsibleId: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  version: number;
  responsiblePerson: { id: string; realName: string } | null;
  [key: string]: unknown;
}

interface ProjectInfo {
  id: string;
  projectSourceId: string;
  name: string;
  projectCategory: string | null;
}

interface Discipline {
  id: string;
  code: string;
  name: string;
}

interface UserOption {
  id: string;
  realName: string;
}

/* ---------- 辅助 ---------- */

const levelLabels: Record<number, string> = {
  1: "项目",
  2: "子项",
  3: "专业",
  4: "任务",
};

const statusBadge: Record<string, string> = {
  "未开始": "ios-badge-gray",
  "进行中": "ios-badge-blue",
  "已完成": "ios-badge-green",
  "已滞后": "ios-badge-red",
};

const formatDate = (d: string | null) => {
  if (!d) return "-";
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

/* ========== 主页面 ========== */

export default function WbsPlanPage() {
  const router = useRouter();
  const params = useParams();
  const projectSourceId = params.projectSourceId as string;
  const { user } = useAuth();
  const isAdminUser =
    user?.username === "admin" ||
    user?.roles?.some((r: any) => r.code === "admin") ||
    false;

  /* ---------- 数据状态 ---------- */
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [nodes, setNodes] = useState<WbsNodeRaw[]>([]);
  const [tree, setTree] = useState<WbsTreeNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  /* ---------- 弹窗状态 ---------- */
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [activeNode, setActiveNode] = useState<WbsTreeNode | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  /* 创建表单 */
  const [createForm, setCreateForm] = useState({
    name: "",
    disciplineCode: "",
    responsibleId: "",
    startDate: "",
    endDate: "",
    isMilestone: false,
  });

  /* 编辑表单 */
  const [editForm, setEditForm] = useState({
    name: "",
    disciplineCode: "",
    responsibleId: "",
    startDate: "",
    endDate: "",
    isMilestone: false,
    status: "未开始",
  });

  /* 进度表单 */
  const [progressForm, setProgressForm] = useState({
    plannedPct: 0,
    actualPct: 0,
    status: "未开始",
  });

  /* ---------- 加载数据 ---------- */

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects?pageSize=200&search=${encodeURIComponent(projectSourceId)}`
      );
      const json = await res.json();
      const found = (json.data || []).find(
        (p: ProjectInfo) => p.projectSourceId === projectSourceId
      );
      if (found) setProject(found);
    } catch (err) {
      console.error("获取项目信息失败:", err);
    }
  }, [projectSourceId]);

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/plans/${projectSourceId}`);
      const json = await res.json();
      if (res.ok) {
        const raw: WbsNodeRaw[] = json.data || [];
        setNodes(raw);
        const built = buildWbsTree(raw);
        setTree(built);
        // 默认展开一级节点
        setExpandedIds((prev) => {
          const next = new Set(prev);
          built.forEach((n) => next.add(n.id));
          return next;
        });
      }
    } catch (err) {
      console.error("获取WBS节点失败:", err);
    } finally {
      setLoading(false);
    }
  }, [projectSourceId]);

  useEffect(() => {
    fetchProject();
    fetchNodes();
    fetch("/api/settings/disciplines")
      .then((r) => r.json())
      .then((j) => setDisciplines(j.data || []));
    fetch("/api/users?pageSize=200")
      .then((r) => r.json())
      .then((j) => setUsers(j.data || []));
  }, [fetchProject, fetchNodes]);

  /* ---------- 统计 ---------- */

  const stats = {
    total: nodes.length,
    inProgress: nodes.filter((n) => n.status === "进行中").length,
    completed: nodes.filter((n) => n.status === "已完成").length,
    delayed: nodes.filter((n) => n.alertStatus === "滞后").length,
  };

  /* ---------- 展开/折叠 ---------- */

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ---------- 创建子节点 ---------- */

  const openCreateModal = (parentNode: WbsTreeNode) => {
    setActiveNode(parentNode);
    setCreateForm({
      name: "",
      disciplineCode: "",
      responsibleId: "",
      startDate: "",
      endDate: "",
      isMilestone: false,
    });
    setFormError("");
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!activeNode) return;
    const nextLevel = activeNode.level + 1;
    if (!createForm.name.trim()) {
      setFormError("请输入名称");
      return;
    }
    if (nextLevel === 4 && !createForm.responsibleId) {
      setFormError("请选择负责人");
      return;
    }
    if (nextLevel === 4 && !createForm.startDate) {
      setFormError("请选择开始日期");
      return;
    }
    if (nextLevel === 4 && !createForm.endDate) {
      setFormError("请选择结束日期");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const body: Record<string, unknown> = {
        parentId: activeNode.id,
        level: nextLevel,
        name: createForm.name.trim(),
        isMilestone: createForm.isMilestone,
      };
      if (nextLevel === 3) body.disciplineCode = createForm.disciplineCode || null;
      if (nextLevel === 4) {
        body.responsibleId = createForm.responsibleId || null;
        body.startDate = createForm.startDate;
        body.endDate = createForm.endDate;
      }
      const res = await fetch(`/api/projects/plans/${projectSourceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowCreateModal(false);
        fetchNodes();
      } else {
        const j = await res.json();
        setFormError(j.error || "创建失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- 编辑节点 ---------- */

  const openEditModal = (node: WbsTreeNode) => {
    setActiveNode(node);
    setEditForm({
      name: node.name,
      disciplineCode: (node as unknown as WbsNodeRaw).disciplineCode || "",
      responsibleId: (node as unknown as WbsNodeRaw).responsibleId || "",
      startDate: (node as unknown as WbsNodeRaw).startDate
        ? formatDate((node as unknown as WbsNodeRaw).startDate).toString()
        : "",
      endDate: (node as unknown as WbsNodeRaw).endDate
        ? formatDate((node as unknown as WbsNodeRaw).endDate).toString()
        : "",
      isMilestone: node.isMilestone as boolean,
      status: (node as unknown as WbsNodeRaw).status || "未开始",
    });
    setFormError("");
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!activeNode) return;
    if (!editForm.name.trim()) {
      setFormError("名称不能为空");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        isMilestone: editForm.isMilestone,
        status: editForm.status,
      };
      if (editForm.disciplineCode) body.disciplineCode = editForm.disciplineCode;
      if (editForm.responsibleId) body.responsibleId = editForm.responsibleId;
      if (editForm.startDate) body.startDate = editForm.startDate;
      if (editForm.endDate) body.endDate = editForm.endDate;

      const res = await fetch(
        `/api/projects/plans/${projectSourceId}/nodes/${activeNode.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (res.ok) {
        setShowEditModal(false);
        fetchNodes();
      } else {
        const j = await res.json();
        setFormError(j.error || "更新失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- 删除节点 ---------- */

  const openDeleteConfirm = (node: WbsTreeNode) => {
    setActiveNode(node);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!activeNode) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/plans/${projectSourceId}/nodes/${activeNode.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setShowDeleteConfirm(false);
        fetchNodes();
      } else {
        const j = await res.json();
        alert(j.error || "删除失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- 进度填报 ---------- */

  const openProgressModal = (node: WbsTreeNode) => {
    setActiveNode(node);
    setProgressForm({
      plannedPct: node.plannedPct,
      actualPct: node.actualPct,
      status: (node as unknown as WbsNodeRaw).status || "未开始",
    });
    setFormError("");
    setShowProgressModal(true);
  };

  const handleProgressSubmit = async () => {
    if (!activeNode) return;
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch(
        `/api/projects/plans/${projectSourceId}/nodes/${activeNode.id}/progress`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(progressForm),
        }
      );
      if (res.ok) {
        setShowProgressModal(false);
        fetchNodes();
      } else {
        const j = await res.json();
        setFormError(j.error || "填报失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- 渲染树节点 ---------- */

  const renderNode = (node: WbsTreeNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const raw = node as unknown as WbsNodeRaw;
    const isDelayed = raw.alertStatus === "滞后";
    const isMilestone = node.isMilestone as boolean;
    const level = node.level;

    return (
      <div key={node.id}>
        <div
          className="group flex items-center gap-2 px-4 py-2.5 hover:bg-[#FAFAF9] border-b border-[#F5F5F4] transition-colors duration-100"
          style={{ paddingLeft: `${depth * 28 + 16}px` }}
        >
          {/* 展开/折叠 */}
          <button
            className="w-6 h-6 flex items-center justify-center text-[#78716C] hover:text-[#1C1917] shrink-0"
            onClick={() => hasChildren && toggleExpand(node.id)}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )
            ) : (
              <span className="w-4 h-4 block" />
            )}
          </button>

          {/* 级别标签 */}
          <span className="text-[11px] font-medium text-[#78716C] bg-[#F5F5F4] px-1.5 py-0.5 rounded-md shrink-0">
            {levelLabels[level] || `L${level}`}
          </span>

          {/* 里程碑标记 */}
          {isMilestone && (
            <Flag className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          )}

          {/* 滞后预警 */}
          {isDelayed && (
            <AlertCircle className="w-3.5 h-3.5 text-[#dc2626] shrink-0" />
          )}

          {/* 名称 */}
          <span className="text-[14px] font-medium text-[#1C1917] truncate min-w-0">
            {node.name}
          </span>

          {/* 专业 */}
          {raw.disciplineCode && (
            <span className="text-[11px] text-[#78716C] bg-[#F5F5F4] px-1.5 py-0.5 rounded-md shrink-0">
              {disciplines.find((d) => d.code === raw.disciplineCode)?.name ||
                raw.disciplineCode}
            </span>
          )}

          {/* 负责人 */}
          {raw.responsiblePerson && (
            <span className="text-[12px] text-[#78716C] shrink-0">
              {raw.responsiblePerson.realName}
            </span>
          )}

          {/* 日期 */}
          {raw.startDate && raw.endDate && (
            <span className="text-[11px] text-[#78716C] shrink-0 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(raw.startDate)} ~ {formatDate(raw.endDate)}
            </span>
          )}

          {/* 进度条 */}
          <div className="flex items-center gap-2 ml-auto shrink-0 min-w-[140px]">
            {/* 计划进度 */}
            <div className="flex-1 h-1.5 rounded-full bg-[#F5F5F4] overflow-hidden relative">
              <div
                className="absolute inset-y-0 left-0 bg-blue-300/50 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, node.plannedPct))}%` }}
              />
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${
                  isDelayed ? "bg-[#dc2626]" : "bg-[#22c55e]"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, node.actualPct))}%` }}
              />
            </div>
            <span className="text-[11px] text-[#78716C] w-14 text-right">
              {node.actualPct}/{node.plannedPct}%
            </span>
          </div>

          {/* 状态 */}
          <span
            className={`ios-badge ${statusBadge[raw.status] || "ios-badge-gray"} shrink-0`}
          >
            {raw.status}
          </span>

          {/* 操作按钮（悬浮显示） */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {level < 4 && (
              <button
                className="ios-btn ios-btn-ghost ios-btn-sm"
                onClick={() => openCreateModal(node)}
                title="添加子节点"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              className="ios-btn ios-btn-ghost ios-btn-sm"
              onClick={() => openEditModal(node)}
              title="编辑"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {level === 4 && (
              <button
                className="ios-btn ios-btn-ghost ios-btn-sm"
                onClick={() => openProgressModal(node)}
                title="进度填报"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
              onClick={() => openDeleteConfirm(node)}
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 子节点 */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  /* ---------- 创建弹窗内容（根据层级动态） ---------- */

  const renderCreateForm = () => {
    if (!activeNode) return null;
    const nextLevel = activeNode.level + 1;

    return (
      <div className="space-y-4">
        {formError && (
          <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
            {formError}
          </div>
        )}

        {/* 名称 */}
        <div>
          <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
            {nextLevel === 2 ? "子项名称" : nextLevel === 3 ? "专业名称" : "任务名称"}{" "}
            <span className="text-[#78716C]">*</span>
          </label>
          <input
            type="text"
            className="ios-input"
            placeholder="请输入名称"
            value={createForm.name}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, name: e.target.value }))
            }
          />
        </div>

        {/* 里程碑 */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={createForm.isMilestone}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, isMilestone: e.target.checked }))
            }
            className="ios-checkbox"
          />
          <span className="text-[13px] text-[#1C1917]">标记为里程碑</span>
        </div>

        {/* level=3 选择专业 */}
        {nextLevel === 3 && (
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              专业
            </label>
            <select
              className="ios-select"
              value={createForm.disciplineCode}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, disciplineCode: e.target.value }))
              }
            >
              <option value="">请选择专业</option>
              {disciplines.map((d) => (
                <option key={d.id} value={d.code}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* level=4 任务详情 */}
        {nextLevel === 4 && (
          <>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                负责人 <span className="text-[#78716C]">*</span>
              </label>
              <select
                className="ios-select"
                value={createForm.responsibleId}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, responsibleId: e.target.value }))
                }
              >
                <option value="">请选择负责人</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.realName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  开始日期 <span className="text-[#78716C]">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                  <input
                    type="date"
                    className="ios-input pl-10"
                    value={createForm.startDate}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, startDate: e.target.value }))
                    }
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
                    value={createForm.endDate}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
          <button
            className="ios-btn ios-btn-secondary"
            onClick={() => setShowCreateModal(false)}
          >
            取消
          </button>
          <button
            className="ios-btn ios-btn-primary"
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    );
  };

  /* ---------- 编辑弹窗内容 ---------- */

  const renderEditForm = () => {
    if (!activeNode) return null;
    const raw = activeNode as unknown as WbsNodeRaw;
    const level = activeNode.level;

    return (
      <div className="space-y-4">
        {formError && (
          <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
            {formError}
          </div>
        )}

        <div>
          <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
            名称 <span className="text-[#78716C]">*</span>
          </label>
          <input
            type="text"
            className="ios-input"
            value={editForm.name}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, name: e.target.value }))
            }
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={editForm.isMilestone}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, isMilestone: e.target.checked }))
            }
            className="ios-checkbox"
          />
          <span className="text-[13px] text-[#1C1917]">里程碑</span>
        </div>

        {level >= 3 && (
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              专业
            </label>
            <select
              className="ios-select"
              value={editForm.disciplineCode}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, disciplineCode: e.target.value }))
              }
            >
              <option value="">请选择专业</option>
              {disciplines.map((d) => (
                <option key={d.id} value={d.code}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {level >= 4 && (
          <>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                负责人
              </label>
              <select
                className="ios-select"
                value={editForm.responsibleId}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, responsibleId: e.target.value }))
                }
              >
                <option value="">请选择负责人</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.realName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  开始日期
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                  <input
                    type="date"
                    className="ios-input pl-10"
                    value={editForm.startDate}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, startDate: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  结束日期
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                  <input
                    type="date"
                    className="ios-input pl-10"
                    value={editForm.endDate}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
            状态
          </label>
          <select
            className="ios-select"
            value={editForm.status}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, status: e.target.value }))
            }
          >
            <option value="未开始">未开始</option>
            <option value="进行中">进行中</option>
            <option value="已完成">已完成</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
          <button
            className="ios-btn ios-btn-secondary"
            onClick={() => setShowEditModal(false)}
          >
            取消
          </button>
          <button
            className="ios-btn ios-btn-primary"
            onClick={handleEdit}
            disabled={saving}
          >
            {saving ? "保存中..." : "保存修改"}
          </button>
        </div>
      </div>
    );
  };

  /* ---------- 进度填报弹窗 ---------- */

  const renderProgressForm = () => (
    <div className="space-y-4">
      {formError && (
        <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
          {formError}
        </div>
      )}
      <div>
        <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
          计划完成 (%)
        </label>
        <input
          type="number"
          className="ios-input"
          min={0}
          max={100}
          value={progressForm.plannedPct}
          onChange={(e) =>
            setProgressForm((f) => ({
              ...f,
              plannedPct: Number(e.target.value),
            }))
          }
        />
      </div>
      <div>
        <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
          实际完成 (%)
        </label>
        <input
          type="number"
          className="ios-input"
          min={0}
          max={100}
          value={progressForm.actualPct}
          onChange={(e) =>
            setProgressForm((f) => ({
              ...f,
              actualPct: Number(e.target.value),
            }))
          }
        />
      </div>
      <div>
        <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
          状态
        </label>
        <select
          className="ios-select"
          value={progressForm.status}
          onChange={(e) =>
            setProgressForm((f) => ({ ...f, status: e.target.value }))
          }
        >
          <option value="未开始">未开始</option>
          <option value="进行中">进行中</option>
          <option value="已完成">已完成</option>
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
        <button
          className="ios-btn ios-btn-secondary"
          onClick={() => setShowProgressModal(false)}
        >
          取消
        </button>
        <button
          className="ios-btn ios-btn-primary"
          onClick={handleProgressSubmit}
          disabled={saving}
        >
          {saving ? "提交中..." : "提交"}
        </button>
      </div>
    </div>
  );

  /* ========== 渲染 ========== */

  return (
    <>
      {/* 顶部 */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button
            className="ios-btn ios-btn-ghost ios-btn-sm"
            onClick={() => router.push("/projects/plans")}
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
          <div>
            <h1>{project?.name || projectSourceId}</h1>
            <p className="flex items-center gap-3">
              {project?.projectCategory && (
                <span className="text-[13px] text-[#78716C]">
                  {project.projectCategory}
                </span>
              )}
              <span className="text-[13px] font-mono font-semibold text-[#1C1917]">
                {projectSourceId}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-5 mb-6">
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-[#1C1917]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">节点总数</p>
            <p className="text-[24px] font-bold text-[#1C1917] leading-tight">
              {stats.total}
            </p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">进行中</p>
            <p className="text-[24px] font-bold text-blue-500 leading-tight">
              {stats.inProgress}
            </p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#22c55e]/10 flex items-center justify-center">
            <Flag className="w-5 h-5 text-[#22c55e]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">已完成</p>
            <p className="text-[24px] font-bold text-[#22c55e] leading-tight">
              {stats.completed}
            </p>
          </div>
        </div>
        <div className="bento-card-static flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#dc2626]/10 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-[#dc2626]" />
          </div>
          <div>
            <p className="text-[13px] text-[#78716C]">滞后</p>
            <p className="text-[24px] font-bold text-[#dc2626] leading-tight">
              {stats.delayed}
            </p>
          </div>
        </div>
      </div>

      {/* WBS 树形视图 */}
      <div className="bento-card-static">
        <div className="px-5 py-4 border-b border-[#F5F5F4] flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#1C1917]">WBS 工作分解结构</h2>
          <div className="flex items-center gap-3 text-[12px] text-[#78716C]">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-1.5 rounded-full bg-blue-300/50" />
              计划
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-1.5 rounded-full bg-[#22c55e]" />
              实际
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-1.5 rounded-full bg-[#dc2626]" />
              滞后
            </span>
            <span className="flex items-center gap-1">
              <Flag className="w-3 h-3 text-amber-500" />
              里程碑
            </span>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : tree.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>暂无WBS节点数据</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {tree.map((root) => renderNode(root))}
          </div>
        )}
      </div>

      {/* 创建弹窗 */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={`添加子节点（${activeNode ? levelLabels[activeNode.level + 1] || `L${activeNode.level + 1}` : ""}）`}
        maxWidth="560px"
      >
        {renderCreateForm()}
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="编辑节点"
        maxWidth="560px"
      >
        {renderEditForm()}
      </Modal>

      {/* 进度填报弹窗 */}
      <Modal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        title="进度填报"
        maxWidth="480px"
      >
        {renderProgressForm()}
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="确认删除"
        maxWidth="400px"
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#78716C]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#78716C]" />
          </div>
          <p className="text-[15px] text-[#1C1917] mb-1">
            确定要删除节点{" "}
            <span className="font-semibold">{activeNode?.name}</span> 吗？
          </p>
          <p className="text-[13px] text-[#78716C] mb-6">
            该操作将递归删除所有子节点，不可撤销
          </p>
          <div className="flex justify-center gap-3">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowDeleteConfirm(false)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-danger"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

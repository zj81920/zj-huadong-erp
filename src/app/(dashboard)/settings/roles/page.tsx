"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Users,
  Search,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  departmentId: string | null;
  departmentName: string | null;
  modulePermissions: string;
  subModuleOverrides: string;
  isGlobalVisible: boolean;
  level: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  userCount: number;
}

interface Department {
  id: string;
  name: string;
}

interface RoleFormData {
  name: string;
  description: string;
  departmentId: string;
  accessibleModules: string[];
  isGlobalVisible: boolean;
  level: number;
}

const MODULE_OPTIONS = [
  { key: "business", label: "商务管理" },
  { key: "projects", label: "项目管理" },
  { key: "procurement", label: "项目采购" },
  { key: "contracts", label: "合同管理" },
  { key: "finance", label: "财务管理" },
  { key: "hr", label: "人事行政" },
  { key: "settings", label: "系统设置" },
];

const SUB_MODULE_OPTIONS: Record<string, { key: string; label: string }[]> = {
  business: [
    { key: "business.customers", label: "客户管理" },
    { key: "business.suppliers", label: "供应商管理" },
    { key: "business.project_leads", label: "市场开发" },
    { key: "business.biddings", label: "投标统计" },
    { key: "business.quotations", label: "报价统计" },
  ],
  projects: [
    { key: "projects.list", label: "项目立项" },
    { key: "projects.plans", label: "项目计划" },
    { key: "projects.progress", label: "项目进度" },
    { key: "projects.outsourcing", label: "设计外包" },
  ],
  procurement: [
    { key: "procurement.requests", label: "采购需求" },
    { key: "procurement.inquiries", label: "采购单" },
    { key: "procurement.deliveries", label: "到货验收" },
  ],
  contracts: [
    { key: "contracts.income", label: "收入合同" },
    { key: "contracts.expense", label: "支出合同" },
  ],
  finance: [
    { key: "finance.income", label: "财务收入" },
    { key: "finance.expense", label: "财务支出" },
    { key: "finance.invoices", label: "发票管理" },
    { key: "finance.reports", label: "财务报表" },
    { key: "finance.bank_accounts", label: "银行账户" },
  ],
  hr: [
    { key: "hr.employees", label: "员工档案" },
    { key: "hr.supplies", label: "办公用品" },
    { key: "hr.certificates", label: "证照管理" },
    { key: "hr.seals", label: "印章管理" },
  ],
};

const TAB_MODULE_OPTIONS: Record<string, { key: string; label: string }[]> = {
  "finance.income": [
    { key: "finance.income.contract", label: "合同收入" },
    { key: "finance.income.other", label: "其他收入" },
    { key: "finance.income.shareholder", label: "股东出资" },
    { key: "finance.income.borrowing", label: "其他借入款" },
  ],
  "finance.expense": [
    { key: "finance.expense.contract", label: "合同支出" },
    { key: "finance.expense.other", label: "其他支出" },
    { key: "finance.expense.lending", label: "借出款" },
    { key: "finance.expense.report", label: "费用报销" },
    { key: "finance.expense.salary", label: "工资发放" },
    { key: "finance.expense.return", label: "借入资金归还" },
  ],
};

const DEFAULT_ROLES: { name: string; level: number }[] = [
  { name: "部门负责人", level: 1 },
  { name: "项目经理", level: 2 },
  { name: "项目管理部", level: 3 },
  { name: "行政", level: 4 },
  { name: "采购部", level: 5 },
  { name: "设计负责人/生产经理", level: 6 },
  { name: "财务", level: 7 },
  { name: "出纳", level: 8 },
  { name: "副总经理", level: 9 },
  { name: "总经理", level: 10 },
  { name: "董事长", level: 11 },
];

const emptyForm: RoleFormData = {
  name: "",
  description: "",
  departmentId: "",
  accessibleModules: [],
  isGlobalVisible: false,
  level: 0,
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/roles");
      if (res.ok) {
        const json = await res.json();
        setRoles(json.data);
      }
    } catch {
      console.error("获取角色列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch("/api/departments");
      if (res.ok) {
        const json = await res.json();
        setDepartments(json.data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchDepartments();
  }, [fetchRoles, fetchDepartments]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleInitDefaults = async () => {
    setSaving(true);
    try {
      for (const role of DEFAULT_ROLES) {
        await fetch("/api/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(role),
        });
      }
      setToast({ type: "success", text: "默认角色初始化成功" });
      fetchRoles();
    } catch {
      setToast({ type: "error", text: "初始化默认角色失败" });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingRole(null);
    setForm({ ...emptyForm, level: roles.length + 1 });
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (role: Role) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      description: role.description || "",
      departmentId: role.departmentId || "",
      accessibleModules: (() => { try { return Object.keys(JSON.parse(role.modulePermissions || "{}")); } catch { return []; } })(),
      isGlobalVisible: role.isGlobalVisible || false,
      level: role.level,
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError("角色名称不能为空");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        departmentId: form.departmentId || null,
        modulePermissions: (() => {
          const perms: Record<string, { create: boolean; read: boolean; update: boolean; delete: boolean }> = {};
          for (const mod of form.accessibleModules) {
            perms[mod] = { create: true, read: true, update: true, delete: true };
          }
          return perms;
        })(),
        subModuleOverrides: {},
        isGlobalVisible: form.isGlobalVisible,
        level: form.level,
      };

      const url = editingRole
        ? `/api/roles/${editingRole.id}`
        : "/api/roles";
      const method = editingRole ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        setToast({ type: "success", text: editingRole ? "角色更新成功" : "角色创建成功" });
        fetchRoles();
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
    setDeleteError("");
    try {
      const res = await fetch(`/api/roles/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        setToast({ type: "success", text: "角色删除成功" });
        fetchRoles();
      } else {
        const json = await res.json();
        setDeleteError(json.error || "删除失败");
      }
    } catch {
      setDeleteError("网络错误，请重试");
    } finally {
      setDeleting(false);
    }
  };

  const filteredRoles = roles.filter((role) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      role.name.toLowerCase().includes(q) ||
      (role.description && role.description.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#1C1917]" />
            </div>
            <div>
              <h1>角色设置</h1>
              <p>管理审批流程中的角色，角色用于流程节点配置</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {roles.length === 0 && (
              <button
                className="ios-btn ios-btn-secondary gap-1.5"
                onClick={handleInitDefaults}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                初始化默认角色
              </button>
            )}
            <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4" />
              新增角色
            </button>
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
              placeholder="搜索角色名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="ml-auto text-[13px] text-[#78716C]">
            共 <span className="font-semibold text-[#1C1917]">{roles.length}</span> 个角色
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : roles.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <Shield className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>暂无角色，点击「初始化默认角色」快速创建</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>排序</th>
                  <th>角色名称</th>
                  <th>所属部门</th>
                  <th>描述</th>
                  <th>模块权限</th>
                  <th>全局可见</th>
                  <th>用户数</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((role) => (
                  <tr key={role.id}>
                    <td className="text-center">
                      <span className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-[#FAFAF9] text-[13px] font-semibold text-[#78716C]">
                        {role.level}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <Shield className="w-4 h-4 text-[#1C1917]" />
                        </div>
                        <span className="font-semibold">{role.name}</span>
                      </div>
                    </td>
                    <td>
                      {role.departmentName ? (
                        <span className="text-[13px] bg-[#FAFAF9] rounded-md px-2 py-1 text-[#1C1917]">
                          {role.departmentName}
                        </span>
                      ) : (
                        <span className="text-[#78716C]">-</span>
                      )}
                    </td>
                    <td className="text-[#78716C] max-w-[200px] truncate">
                      {role.description || "-"}
                    </td>
                    <td>
                      <span className="ios-badge ios-badge-gray gap-1">
                        {(() => { try { return Object.keys(JSON.parse(role.modulePermissions || "{}")).length; } catch { return 0; } })()} 个模块
                      </span>
                    </td>
                    <td className="text-center">
                      {role.isGlobalVisible ? (
                        <Check className="w-4 h-4 text-[#78716C] mx-auto" />
                      ) : (
                        <span className="text-[#78716C]">-</span>
                      )}
                    </td>
                    <td>
                      <span className="ios-badge ios-badge-gray gap-1">
                        <Users className="w-3 h-3" />
                        {role.userCount}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {(() => {
                          if (role.code === "admin") {
                            return <span className="ios-badge ios-badge-gray text-[11px]">系统内定</span>;
                          }
                          return (
                            <>
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm"
                                onClick={() => handleOpenEdit(role)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                编辑
                              </button>
                              {role.code !== "finance" && (
                                <button
                                  className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                                  onClick={() => {
                                    setDeleteConfirm(role);
                                    setDeleteError("");
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  删除
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="text-[#78716C] text-[12px] whitespace-nowrap">
                      {role.lastModifiedBy && (
                        <span>{role.lastModifiedBy}</span>
                      )}
                      <span className="block text-[11px]">{formatDate(role.updatedAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredRoles.length === 0 && search && (
              <div className="empty-state">
                <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
                  <Search className="w-8 h-8 text-[#78716C]" />
                </div>
                <p>没有匹配「{search}」的角色</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingRole ? "编辑角色" : "新增角色"}
        maxWidth="520px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {formError}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              角色名称 <span className="text-[#78716C]">*</span>
            </label>
            <input
              type="text"
              className={editingRole?.code === "finance" ? "ios-input !bg-[#FAFAF9] !cursor-not-allowed !text-[#78716C]" : "ios-input"}
              placeholder="如：部门负责人"
              value={form.name}
              disabled={editingRole?.code === "finance"}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                if (formError) setFormError("");
              }}
            />
            {editingRole?.code === "finance" && (
              <p className="text-[11px] text-[#78716C] mt-1">系统角色名称不可修改</p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              所属部门
            </label>
            <select
              className="ios-select"
              value={form.departmentId}
              onChange={(e) => setForm((prev) => ({ ...prev, departmentId: e.target.value }))}
            >
              <option value="">不关联部门</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              描述
            </label>
            <textarea
              className="ios-textarea"
              placeholder="角色描述（选填）"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-2">
              可访问模块
            </label>
            <div className="space-y-2">
              {MODULE_OPTIONS.map((mod) => {
                const subOptions = SUB_MODULE_OPTIONS[mod.key] || [];
                const checked = form.accessibleModules.includes(mod.key);
                const selectedSubs = subOptions.filter((s) => form.accessibleModules.includes(s.key));
                return (
                  <div key={mod.key} className="rounded-xl border border-[#F5F5F4] overflow-hidden">
                    <label
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-150 ${
                        checked ? "bg-[#1C1917]/6" : "bg-white hover:bg-[#FFFFFF]"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                          checked ? "border-[#1C1917] bg-[#1C1917]" : "border-[#D1D5DB] bg-white"
                        }`}
                      >
                        {checked && <span className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                      <span className={`text-[14px] font-semibold flex-1 ${checked ? "text-[#1C1917]" : "text-[#1C1917]"}`}>
                        {mod.label}
                      </span>
                      {checked && subOptions.length > 0 && (
                        <span className="text-[11px] text-[#78716C]">
                          {selectedSubs.length}/{subOptions.length}
                        </span>
                      )}
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={checked}
                        onChange={() => {
                          const newChecked = !checked;
                          setForm((prev) => {
                            let newModules = [...prev.accessibleModules];
                            if (newChecked) {
                              if (!newModules.includes(mod.key)) newModules.push(mod.key);
                            } else {
                              newModules = newModules.filter((m) => m !== mod.key);
                              if (subOptions.length > 0) {
                                const subKeys = subOptions.map((s) => s.key);
                                newModules = newModules.filter((m) => !subKeys.includes(m));
                              }
                            }
                            return { ...prev, accessibleModules: newModules };
                          });
                        }}
                      />
                    </label>
                    {checked && subOptions.length > 0 && (
                      <div className="px-4 pb-3 pt-1 border-t border-[#F5F5F4] bg-[#FFFFFF]">
                        <div className="space-y-1.5">
                          {subOptions.map((sub) => {
                            const subChecked = form.accessibleModules.includes(sub.key);
                            const tabOptions = TAB_MODULE_OPTIONS[sub.key] || [];
                            const selectedTabs = tabOptions.filter((t) => form.accessibleModules.includes(t.key));
                            const allTabsSelected = tabOptions.length > 0 && selectedTabs.length === tabOptions.length;
                            return (
                              <div key={sub.key}>
                                <label className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 text-[13px] ${
                                  subChecked
                                    ? "bg-[#1C1917]/10 text-[#1C1917] font-medium"
                                    : "bg-white text-[#6E6E73] hover:bg-[#F5F5F4]"
                                }`}>
                                  <span
                                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                                      subChecked ? "border-[#1C1917] bg-[#1C1917]" : "border-[#D1D5DB] bg-white"
                                    }`}
                                  >
                                    {subChecked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                  </span>
                                  <span className="flex-1">{sub.label}</span>
                                  <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={subChecked}
                                    onChange={() => {
                                      setForm((prev) => {
                                        let newModules = [...prev.accessibleModules];
                                        if (subChecked) {
                                          newModules = newModules.filter((m) => m !== sub.key);
                                          if (tabOptions.length > 0) {
                                            const tabKeys = tabOptions.map((t) => t.key);
                                            newModules = newModules.filter((m) => !tabKeys.includes(m));
                                          }
                                          const remainingSubs = subOptions.filter(
                                            (s) => s.key !== sub.key && newModules.includes(s.key)
                                          );
                                          if (remainingSubs.length === 0) {
                                            newModules = newModules.filter((m) => m !== mod.key);
                                          }
                                        } else {
                                          if (!newModules.includes(sub.key)) newModules.push(sub.key);
                                          if (!newModules.includes(mod.key)) newModules.push(mod.key);
                                        }
                                        return { ...prev, accessibleModules: newModules };
                                      });
                                    }}
                                  />
                                  {subChecked && tabOptions.length > 0 && (
                                    <span className="text-[11px] text-[#78716C]">
                                      {selectedTabs.length}/{tabOptions.length}
                                    </span>
                                  )}
                                  {subChecked && tabOptions.length > 0 && (
                                    <button
                                      type="button"
                                      className="text-[11px] text-[#1C1917] hover:underline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setForm((prev) => {
                                          let newModules = [...prev.accessibleModules];
                                          const tabKeys = tabOptions.map((t) => t.key);
                                          if (allTabsSelected) {
                                            newModules = newModules.filter((m) => !tabKeys.includes(m));
                                          } else {
                                            for (const tk of tabKeys) {
                                              if (!newModules.includes(tk)) newModules.push(tk);
                                            }
                                          }
                                          return { ...prev, accessibleModules: newModules };
                                        });
                                      }}
                                    >
                                      {allTabsSelected ? "取消全选" : "全选"}
                                    </button>
                                  )}
                                </label>
                                {subChecked && tabOptions.length > 0 && (
                                  <div className="ml-6 mt-1 flex flex-wrap gap-1">
                                    {tabOptions.map((tab) => {
                                      const tabChecked = form.accessibleModules.includes(tab.key);
                                      return (
                                        <label
                                          key={tab.key}
                                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-all duration-150 text-[12px] ${
                                            tabChecked
                                              ? "bg-[#1C1917]/8 text-[#1C1917] font-medium"
                                              : "bg-white text-[#78716C] hover:bg-[#F5F5F4]"
                                          }`}
                                        >
                                          <span
                                            className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                                              tabChecked ? "border-[#1C1917] bg-[#1C1917]" : "border-[#D1D5DB] bg-white"
                                            }`}
                                          >
                                            {tabChecked && <span className="w-1 h-1 rounded-full bg-white" />}
                                          </span>
                                          <span>{tab.label}</span>
                                          <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={tabChecked}
                                            onChange={() => {
                                              setForm((prev) => {
                                                let newModules = [...prev.accessibleModules];
                                                if (tabChecked) {
                                                  newModules = newModules.filter((m) => m !== tab.key);
                                                } else {
                                                  if (!newModules.includes(tab.key)) newModules.push(tab.key);
                                                }
                                                return { ...prev, accessibleModules: newModules };
                                              });
                                            }}
                                          />
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-[#FAFAF9]">
            <div>
              <p className="text-[14px] font-semibold text-[#1C1917]">全局可见</p>
              <p className="text-[12px] text-[#78716C] mt-0.5">开启后该角色可查看所有模块、所有项目数据</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.isGlobalVisible}
              onClick={() => setForm((prev) => ({ ...prev, isGlobalVisible: !prev.isGlobalVisible }))}
              className={`relative inline-flex h-[30px] w-[51px] flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out ${
                form.isGlobalVisible ? "bg-[#1C1917]" : "bg-[#E7E5E4]"
              }`}
            >
              <span
                className={`inline-block h-[26px] w-[26px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                  form.isGlobalVisible ? "translate-x-[23px]" : "translate-x-[1px]"
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              排序
            </label>
            <input
              type="number"
              className="ios-input w-[120px]"
              placeholder="0"
              value={form.level}
              onChange={(e) => setForm((prev) => ({ ...prev, level: parseInt(e.target.value) || 0 }))}
              min={0}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowModal(false)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "保存中..." : editingRole ? "保存修改" : "创建角色"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => {
          setDeleteConfirm(null);
          setDeleteError("");
        }}
        title="确认删除"
        maxWidth="420px"
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#78716C]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#78716C]" />
          </div>
          <p className="text-[15px] text-[#1C1917] mb-1">
            确定要删除角色 <span className="font-semibold">{deleteConfirm?.name}</span> 吗？
          </p>
          {deleteConfirm && deleteConfirm.userCount > 0 && (
            <p className="text-[13px] text-[#78716C] mb-2">
              该角色下有 {deleteConfirm.userCount} 位关联用户，删除后将解除关联
            </p>
          )}
          <p className="text-[13px] text-[#78716C] mb-2">此操作不可撤销</p>

          {deleteError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium flex items-center gap-2 justify-center mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {deleteError}
            </div>
          )}

          <div className="flex justify-center gap-3">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => {
                setDeleteConfirm(null);
                setDeleteError("");
              }}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-[14px] font-semibold backdrop-blur-xl transition-all duration-300 ${
            toast.type === "success"
              ? "bg-[#78716C]/90 text-white"
              : "bg-[#78716C]/90 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast.text}
        </div>
      )}
    </>
  );
}

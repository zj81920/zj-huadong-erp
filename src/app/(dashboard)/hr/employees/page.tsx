"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  UserCheck,
  UserX,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Employee {
  id: string;
  username: string;
  realName: string;
  phone: string | null;
  email: string | null;
  role: string;
  department: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmployeeFormData {
  username: string;
  realName: string;
  phone: string;
  email: string;
  role: string;
  department: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const emptyForm: EmployeeFormData = {
  username: "",
  realName: "",
  phone: "",
  email: "",
  role: "staff",
  department: "",
};

const roleOptions = [
  { value: "admin", label: "管理员" },
  { value: "general_manager", label: "总经理" },
  { value: "deputy_general_manager", label: "副总经理" },
  { value: "chairman", label: "董事长" },
  { value: "project_manager", label: "项目经理" },
  { value: "finance", label: "财务" },
  { value: "procurement", label: "采购部" },
  { value: "design", label: "设计部" },
  { value: "staff", label: "员工" },
];

const roleLabelMap: Record<string, string> = {};
roleOptions.forEach((r) => {
  roleLabelMap[r.value] = r.label;
});

const departmentOptions = [
  "总经理办公室",
  "财务部",
  "采购部",
  "设计部",
  "项目管理部",
  "行政部",
  "市场部",
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterRole) params.set("role", filterRole);
      if (filterDepartment) params.set("department", filterDepartment);
      if (filterStatus) params.set("isActive", filterStatus);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/hr/employees?${params}`);
      const json = await res.json();

      if (res.ok) {
        setEmployees(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取员工列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterRole, filterDepartment, filterStatus, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setForm({
      username: employee.username,
      realName: employee.realName,
      phone: employee.phone || "",
      email: employee.email || "",
      role: employee.role,
      department: employee.department || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.username.trim()) {
      setFormError("用户名不能为空");
      return;
    }
    if (!form.realName.trim()) {
      setFormError("姓名不能为空");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const url = editingEmployee
        ? `/api/hr/employees/${editingEmployee.id}`
        : "/api/hr/employees";
      const method = editingEmployee ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchEmployees();
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
    try {
      const res = await fetch(`/api/hr/employees/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        fetchEmployees();
      } else {
        const json = await res.json();
        alert(json.error || "禁用失败");
        setDeleteConfirm(null);
      }
    } catch {
      alert("网络错误，请重试");
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (employee: Employee) => {
    setTogglingId(employee.id);
    try {
      const res = await fetch(`/api/hr/employees/${employee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !employee.isActive }),
      });

      if (res.ok) {
        fetchEmployees();
      } else {
        const json = await res.json();
        alert(json.error || "状态切换失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setTogglingId(null);
    }
  };

  const updateForm = (field: keyof EmployeeFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>员工档案管理</h1>
            <p>管理公司员工信息，包括基本信息、角色分配与状态管理</p>
          </div>
          <button className="ios-btn ios-btn-primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            新增员工
          </button>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索姓名、用户名..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
          </div>

          <select
            className="ios-select w-[140px]"
            value={filterRole}
            onChange={(e) => {
              setFilterRole(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部角色</option>
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <select
            className="ios-select w-[140px]"
            value={filterDepartment}
            onChange={(e) => {
              setFilterDepartment(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部部门</option>
            {departmentOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            className="ios-select w-[120px]"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部状态</option>
            <option value="true">已启用</option>
            <option value="false">已禁用</option>
          </select>

          <div className="ml-auto text-[13px] text-[#86868B]">
            共 <span className="font-semibold text-[#1D1D1F]">{pagination.total}</span> 条记录
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
              <UserX className="w-8 h-8 text-[#86868B]" />
            </div>
            <p>{search || filterRole || filterDepartment || filterStatus ? "没有匹配的员工记录" : "暂无员工，点击右上角新增"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>用户名</th>
                  <th>手机号</th>
                  <th>邮箱</th>
                  <th>角色</th>
                  <th>部门</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[13px] font-semibold text-[#007AFF]">
                            {employee.realName.charAt(0)}
                          </span>
                        </div>
                        <span className="font-semibold">{employee.realName}</span>
                      </div>
                    </td>
                    <td className="text-[#86868B]">{employee.username}</td>
                    <td>{employee.phone || "-"}</td>
                    <td>{employee.email || "-"}</td>
                    <td>
                      <span className={`ios-badge ${employee.role === "admin" ? "ios-badge-red" : employee.role === "staff" ? "ios-badge-gray" : "ios-badge-blue"}`}>
                        {roleLabelMap[employee.role] || employee.role}
                      </span>
                    </td>
                    <td>
                      {employee.department ? (
                        <span className="ios-badge ios-badge-orange">{employee.department}</span>
                      ) : (
                        <span className="text-[#86868B]">-</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="flex items-center gap-1 cursor-pointer"
                        onClick={() => handleToggleStatus(employee)}
                        disabled={togglingId === employee.id}
                      >
                        {employee.isActive ? (
                          <span className="ios-badge ios-badge-green">
                            <UserCheck className="w-3 h-3" />
                            已启用
                          </span>
                        ) : (
                          <span className="ios-badge ios-badge-red">
                            <UserX className="w-3 h-3" />
                            已禁用
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="text-[#86868B]">{formatDate(employee.createdAt)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => setDetailEmployee(employee)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          详情
                        </button>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenEdit(employee)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        {employee.isActive && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                            onClick={() => setDeleteConfirm(employee)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            禁用
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
        title={editingEmployee ? "编辑员工" : "新增员工"}
        maxWidth="600px"
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
                用户名 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入用户名"
                value={form.username}
                onChange={(e) => updateForm("username", e.target.value)}
                disabled={!!editingEmployee}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                姓名 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入姓名"
                value={form.realName}
                onChange={(e) => updateForm("realName", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">手机号</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入手机号"
                value={form.phone}
                onChange={(e) => updateForm("phone", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">邮箱</label>
              <input
                type="email"
                className="ios-input"
                placeholder="请输入邮箱"
                value={form.email}
                onChange={(e) => updateForm("email", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">角色</label>
              <select
                className="ios-select"
                value={form.role}
                onChange={(e) => updateForm("role", e.target.value)}
              >
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">部门</label>
              <select
                className="ios-select"
                value={form.department}
                onChange={(e) => updateForm("department", e.target.value)}
              >
                <option value="">请选择</option>
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {!editingEmployee && (
            <p className="text-[12px] text-[#86868B]">
              新员工默认密码为 <span className="font-semibold text-[#1D1D1F]">123456</span>，请通知员工登录后及时修改
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
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
              {saving ? "保存中..." : editingEmployee ? "保存修改" : "创建员工"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailEmployee}
        onClose={() => setDetailEmployee(null)}
        title="员工详情"
        maxWidth="500px"
      >
        {detailEmployee && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-[#F0F0F0]">
              <div className="w-14 h-14 rounded-full bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[22px] font-bold text-[#007AFF]">
                  {detailEmployee.realName.charAt(0)}
                </span>
              </div>
              <div>
                <p className="text-[17px] font-bold text-[#1D1D1F]">{detailEmployee.realName}</p>
                <p className="text-[13px] text-[#86868B]">@{detailEmployee.username}</p>
              </div>
              <div className="ml-auto">
                {detailEmployee.isActive ? (
                  <span className="ios-badge ios-badge-green">
                    <UserCheck className="w-3 h-3" />
                    已启用
                  </span>
                ) : (
                  <span className="ios-badge ios-badge-red">
                    <UserX className="w-3 h-3" />
                    已禁用
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="text-[12px] text-[#86868B] mb-0.5">手机号</p>
                <p className="text-[14px] font-medium">{detailEmployee.phone || "-"}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#86868B] mb-0.5">邮箱</p>
                <p className="text-[14px] font-medium">{detailEmployee.email || "-"}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#86868B] mb-0.5">角色</p>
                <p className="text-[14px] font-medium">
                  <span className={`ios-badge ${detailEmployee.role === "admin" ? "ios-badge-red" : "ios-badge-blue"}`}>
                    {roleLabelMap[detailEmployee.role] || detailEmployee.role}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#86868B] mb-0.5">部门</p>
                <p className="text-[14px] font-medium">
                  {detailEmployee.department ? (
                    <span className="ios-badge ios-badge-orange">{detailEmployee.department}</span>
                  ) : (
                    "-"
                  )}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#86868B] mb-0.5">创建时间</p>
                <p className="text-[14px] font-medium">{formatDate(detailEmployee.createdAt)}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#86868B] mb-0.5">更新时间</p>
                <p className="text-[14px] font-medium">{formatDate(detailEmployee.updatedAt)}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="确认禁用"
        maxWidth="400px"
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#FF3B30]" />
          </div>
          <p className="text-[15px] text-[#1D1D1F] mb-1">
            确定要禁用员工 <span className="font-semibold">{deleteConfirm?.realName}</span> 吗？
          </p>
          <p className="text-[13px] text-[#86868B] mb-6">禁用后该员工将无法登录系统，可随时重新启用</p>
          <div className="flex justify-center gap-3">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setDeleteConfirm(null)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "处理中..." : "确认禁用"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

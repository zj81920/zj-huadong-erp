"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  UserCheck,
  UserX,
  Upload,
  FileText,
  X,
  Download,
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
  lastModifiedBy: string | null;
  idNumber: string | null;
  birthDate: string | null;
  position: string | null;
  employmentStatus: string | null;
  hireDate: string | null;
  leaveDate: string | null;
  bankName: string | null;
  bankAccount: string | null;
  baseSalary: number | null;
  socialInsuranceBase: number | null;
  housingFundBase: number | null;
  housingFundRate: number | null;
  socialInsuranceCompanyRate: number | null;
  housingFundCompanyRate: number | null;
  taxDeduction: number | null;
  remark: string | null;
}

interface EmployeeAttachmentItem {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

interface EmployeeFormData {
  username: string;
  realName: string;
  phone: string;
  email: string;
  role: string;
  department: string;
  idNumber: string;
  birthDate: string;
  position: string;
  employmentStatus: string;
  hireDate: string;
  bankName: string;
  bankAccount: string;
  baseSalary: string;
  socialInsuranceBase: string;
  housingFundBase: string;
  housingFundRate: string;
  socialInsuranceCompanyRate: string;
  housingFundCompanyRate: string;
  taxDeduction: string;
  remark: string;
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
  idNumber: "",
  birthDate: "",
  position: "",
  employmentStatus: "active",
  hireDate: "",
  bankName: "",
  bankAccount: "",
  baseSalary: "",
  socialInsuranceBase: "",
  housingFundBase: "",
  housingFundRate: "",
  socialInsuranceCompanyRate: "",
  housingFundCompanyRate: "",
  taxDeduction: "",
  remark: "",
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

const employmentStatusOptions = [
  { value: "active", label: "在职", color: "ios-badge-green" },
  { value: "probation", label: "试用期", color: "ios-badge-blue" },
  { value: "leave", label: "休假中", color: "ios-badge-orange" },
  { value: "resigned", label: "已离职", color: "ios-badge-gray" },
  { value: "dismissed", label: "已辞退", color: "ios-badge-red" },
  { value: "retired", label: "已退休", color: "ios-badge-gray" },
];

const employmentStatusLabelMap: Record<string, string> = {};
const employmentStatusColorMap: Record<string, string> = {};
employmentStatusOptions.forEach((s) => {
  employmentStatusLabelMap[s.value] = s.label;
  employmentStatusColorMap[s.value] = s.color;
});

const fileTypeOptions = [
  { value: "id_card_front", label: "身份证正面" },
  { value: "id_card_back", label: "身份证背面" },
  { value: "education_cert", label: "学历证明" },
  { value: "contract", label: "劳动合同" },
  { value: "bank_card", label: "银行卡照片" },
  { value: "qualification", label: "资格证书" },
  { value: "other", label: "其他证件" },
];

const fileTypeLabelMap: Record<string, string> = {};
fileTypeOptions.forEach((t) => {
  fileTypeLabelMap[t.value] = t.label;
});

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "-";
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? `${age}岁` : "-";
}

function formatMoney(val: number | null | undefined): string {
  if (val == null) return "-";
  return `¥${Number(val).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
  const [filterEmploymentStatus, setFilterEmploymentStatus] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formTab, setFormTab] = useState<"basic" | "hr">("basic");

  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  const [detailAttachments, setDetailAttachments] = useState<EmployeeAttachmentItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadFileType, setUploadFileType] = useState("other");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterRole) params.set("role", filterRole);
      if (filterDepartment) params.set("department", filterDepartment);
      if (filterStatus) params.set("isActive", filterStatus);
      if (filterEmploymentStatus) params.set("employmentStatus", filterEmploymentStatus);
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
  }, [search, filterRole, filterDepartment, filterStatus, filterEmploymentStatus, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const fetchDetailAttachments = async (userId: string) => {
    try {
      const res = await fetch(`/api/hr/employees/${userId}/attachments`);
      if (res.ok) {
        const json = await res.json();
        setDetailAttachments(json.data || []);
      }
    } catch {
      setDetailAttachments([]);
    }
  };

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setForm(emptyForm);
    setFormError("");
    setFormTab("basic");
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
      idNumber: employee.idNumber || "",
      birthDate: employee.birthDate ? employee.birthDate.split("T")[0] : "",
      position: employee.position || "",
      employmentStatus: employee.employmentStatus || "active",
      hireDate: employee.hireDate ? employee.hireDate.split("T")[0] : "",
      bankName: employee.bankName || "",
      bankAccount: employee.bankAccount || "",
      baseSalary: employee.baseSalary != null ? String(employee.baseSalary) : "",
      socialInsuranceBase: employee.socialInsuranceBase != null ? String(employee.socialInsuranceBase) : "",
      housingFundBase: employee.housingFundBase != null ? String(employee.housingFundBase) : "",
      housingFundRate: employee.housingFundRate != null ? String(employee.housingFundRate) : "",
      socialInsuranceCompanyRate: employee.socialInsuranceCompanyRate != null ? String(employee.socialInsuranceCompanyRate) : "",
      housingFundCompanyRate: employee.housingFundCompanyRate != null ? String(employee.housingFundCompanyRate) : "",
      taxDeduction: employee.taxDeduction != null ? String(employee.taxDeduction) : "",
      remark: employee.remark || "",
    });
    setFormError("");
    setFormTab("basic");
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

  const handleOpenDetail = async (employee: Employee) => {
    setDetailEmployee(employee);
    setDetailLoading(true);
    await fetchDetailAttachments(employee.id);
    setDetailLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!detailEmployee || !e.target.files?.length) return;
    const file = e.target.files[0];
    setUploadingFile(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        alert("文件上传失败");
        return;
      }

      const uploadJson = await uploadRes.json();

      const saveRes = await fetch(`/api/hr/employees/${detailEmployee.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: uploadJson.filename || file.name,
          fileUrl: uploadJson.url,
          fileType: uploadFileType,
          fileSize: file.size,
        }),
      });

      if (saveRes.ok) {
        await fetchDetailAttachments(detailEmployee.id);
      } else {
        alert("保存附件记录失败");
      }
    } catch {
      alert("上传失败");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!detailEmployee) return;
    if (!confirm("确定要删除此附件吗？")) return;

    try {
      const res = await fetch(`/api/hr/employees/${detailEmployee.id}/attachments/${attachmentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchDetailAttachments(detailEmployee.id);
      } else {
        alert("删除失败");
      }
    } catch {
      alert("删除失败");
    }
  };

  const updateForm = (field: keyof EmployeeFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const handleIdNumberBlur = () => {
    const idNum = form.idNumber.trim();
    if (idNum.length === 18 && !form.birthDate) {
      const year = idNum.substring(6, 10);
      const month = idNum.substring(10, 12);
      const day = idNum.substring(12, 14);
      const dateStr = `${year}-${month}-${day}`;
      if (!isNaN(new Date(dateStr).getTime())) {
        updateForm("birthDate", dateStr);
      }
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>员工档案管理</h1>
            <p>管理公司员工人事档案、薪酬社保与附件信息</p>
          </div>
          <p className="text-[13px] text-[#78716C]">
            员工账号请在 <span className="font-semibold text-[#1C1917]">系统设置 → 用户管理</span> 中创建，此处管理员工人事档案
          </p>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
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
            className="ios-select w-[120px]"
            value={filterEmploymentStatus}
            onChange={(e) => {
              setFilterEmploymentStatus(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">在职状态</option>
            {employmentStatusOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

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
            <option value="">账号状态</option>
            <option value="true">已启用</option>
            <option value="false">已禁用</option>
          </select>

          <div className="ml-auto text-[13px] text-[#78716C]">
            共 <span className="font-semibold text-[#1C1917]">{pagination.total}</span> 条记录
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <UserX className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>{search || filterRole || filterDepartment || filterStatus || filterEmploymentStatus ? "没有匹配的员工记录" : "暂无员工记录"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>部门</th>
                  <th>岗位</th>
                  <th>在职状态</th>
                  <th>入职日期</th>
                  <th>手机号</th>
                  <th>账号状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[13px] font-semibold text-[#1C1917]">
                            {employee.realName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold block">{employee.realName}</span>
                          <span className="text-[11px] text-[#78716C]">{employee.username}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {employee.department ? (
                        <span className="ios-badge ios-badge-orange">{employee.department}</span>
                      ) : (
                        <span className="text-[#78716C]">-</span>
                      )}
                    </td>
                    <td>{employee.position || <span className="text-[#78716C]">-</span>}</td>
                    <td>
                      <span className={`ios-badge ${employmentStatusColorMap[employee.employmentStatus || "active"]}`}>
                        {employmentStatusLabelMap[employee.employmentStatus || "active"] || employee.employmentStatus}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">{formatDate(employee.hireDate)}</td>
                    <td>{employee.phone || "-"}</td>
                    <td>
                      <button
                        className="flex items-center gap-1 cursor-pointer"
                        onClick={() => handleToggleStatus(employee)}
                        disabled={togglingId === employee.id}
                      >
                        {employee.isActive ? (
                          <span className="ios-badge ios-badge-green">
                            <UserCheck className="w-3 h-3" />
                            启用
                          </span>
                        ) : (
                          <span className="ios-badge ios-badge-red">
                            <UserX className="w-3 h-3" />
                            禁用
                          </span>
                        )}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenDetail(employee)}
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
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
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

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="编辑员工"
        maxWidth="720px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {formError}
            </div>
          )}

          <div className="flex gap-1 bg-[#FAFAF9] rounded-xl p-1">
            <button
              className={`flex-1 py-2 text-[13px] font-semibold rounded-lg transition-all ${formTab === "basic" ? "bg-white text-[#1C1917] shadow-sm" : "text-[#78716C]"}`}
              onClick={() => setFormTab("basic")}
            >
              基本信息
            </button>
            <button
              className={`flex-1 py-2 text-[13px] font-semibold rounded-lg transition-all ${formTab === "hr" ? "bg-white text-[#1C1917] shadow-sm" : "text-[#78716C]"}`}
              onClick={() => setFormTab("hr")}
            >
              人事信息
            </button>
          </div>

          {formTab === "basic" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  用户名 <span className="text-[#78716C]">*</span>
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
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                  姓名 <span className="text-[#78716C]">*</span>
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
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">手机号</label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="请输入手机号"
                  value={form.phone}
                  onChange={(e) => updateForm("phone", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">邮箱</label>
                <input
                  type="email"
                  className="ios-input"
                  placeholder="请输入邮箱"
                  value={form.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">角色</label>
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
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">部门</label>
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
          )}

          {formTab === "hr" && (
            <div className="space-y-5">
              <div>
                <p className="text-[12px] font-semibold text-[#78716C] uppercase tracking-wide mb-3">个人信息</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">身份证号</label>
                    <input
                      type="text"
                      className="ios-input"
                      placeholder="18位身份证号码"
                      maxLength={18}
                      value={form.idNumber}
                      onChange={(e) => updateForm("idNumber", e.target.value)}
                      onBlur={handleIdNumberBlur}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">出生日期</label>
                    <input
                      type="date"
                      className="ios-input"
                      value={form.birthDate}
                      onChange={(e) => updateForm("birthDate", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">岗位/职位</label>
                    <input
                      type="text"
                      className="ios-input"
                      placeholder="请输入岗位"
                      value={form.position}
                      onChange={(e) => updateForm("position", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">在职状态</label>
                    <select
                      className="ios-select"
                      value={form.employmentStatus}
                      onChange={(e) => updateForm("employmentStatus", e.target.value)}
                    >
                      {employmentStatusOptions.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">入职日期</label>
                    <input
                      type="date"
                      className="ios-input"
                      value={form.hireDate}
                      onChange={(e) => updateForm("hireDate", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[12px] font-semibold text-[#78716C] uppercase tracking-wide mb-3">薪酬社保</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">基本工资（月）</label>
                    <input
                      type="number"
                      step="0.01"
                      className="ios-input"
                      placeholder="0.00"
                      value={form.baseSalary}
                      onChange={(e) => updateForm("baseSalary", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">社保缴费基数</label>
                    <input
                      type="number"
                      step="0.01"
                      className="ios-input"
                      placeholder="0.00"
                      value={form.socialInsuranceBase}
                      onChange={(e) => updateForm("socialInsuranceBase", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">公积金缴费基数</label>
                    <input
                      type="number"
                      step="0.01"
                      className="ios-input"
                      placeholder="0.00"
                      value={form.housingFundBase}
                      onChange={(e) => updateForm("housingFundBase", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">公积金个人比例</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="ios-input"
                      placeholder="如 0.12 代表 12%"
                      value={form.housingFundRate}
                      onChange={(e) => updateForm("housingFundRate", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">专项附加扣除/月</label>
                    <input
                      type="number"
                      step="0.01"
                      className="ios-input"
                      placeholder="0.00"
                      value={form.taxDeduction}
                      onChange={(e) => updateForm("taxDeduction", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[12px] font-semibold text-[#78716C] uppercase tracking-wide mb-3">银行信息</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">开户银行</label>
                    <input
                      type="text"
                      className="ios-input"
                      placeholder="如 中国工商银行xx支行"
                      value={form.bankName}
                      onChange={(e) => updateForm("bankName", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">银行账号</label>
                    <input
                      type="text"
                      className="ios-input"
                      placeholder="请输入银行账号"
                      value={form.bankAccount}
                      onChange={(e) => updateForm("bankAccount", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">备注</label>
                <textarea
                  className="ios-input min-h-[72px] resize-none"
                  placeholder="其他备注信息"
                  value={form.remark}
                  onChange={(e) => updateForm("remark", e.target.value)}
                />
              </div>
            </div>
          )}

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
              {saving ? "保存中..." : "保存修改"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!detailEmployee}
        onClose={() => { setDetailEmployee(null); setDetailAttachments([]); }}
        title="员工详情"
        maxWidth="720px"
      >
        {detailEmployee && (
          <div className="space-y-5 -mx-2">
            <div className="flex items-center gap-4 pb-4 border-b border-[#F5F5F4]">
              <div className="w-14 h-14 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[22px] font-bold text-[#1C1917]">
                  {detailEmployee.realName.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-[17px] font-bold text-[#1C1917]">{detailEmployee.realName}</p>
                <p className="text-[13px] text-[#78716C]">@{detailEmployee.username}</p>
              </div>
              <span className={`ios-badge ${employmentStatusColorMap[detailEmployee.employmentStatus || "active"]}`}>
                {employmentStatusLabelMap[detailEmployee.employmentStatus || "active"]}
              </span>
              <span className={`ios-badge ${detailEmployee.isActive ? "ios-badge-green" : "ios-badge-red"}`}>
                {detailEmployee.isActive ? "账号启用" : "账号禁用"}
              </span>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-[#78716C] uppercase tracking-wide mb-3">基本信息</p>
              <div className="grid grid-cols-3 gap-y-3 gap-x-6">
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">部门</p>
                  <p className="text-[14px] font-medium">
                    {detailEmployee.department ? (
                      <span className="ios-badge ios-badge-orange">{detailEmployee.department}</span>
                    ) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">岗位</p>
                  <p className="text-[14px] font-medium">{detailEmployee.position || "-"}</p>
                </div>
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">角色</p>
                  <p className="text-[14px] font-medium">
                    <span className={`ios-badge ${detailEmployee.role === "admin" ? "ios-badge-red" : "ios-badge-blue"}`}>
                      {roleLabelMap[detailEmployee.role] || detailEmployee.role}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">手机号</p>
                  <p className="text-[14px] font-medium">{detailEmployee.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">邮箱</p>
                  <p className="text-[14px] font-medium">{detailEmployee.email || "-"}</p>
                </div>
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">入职日期</p>
                  <p className="text-[14px] font-medium">{formatDate(detailEmployee.hireDate)}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-[#78716C] uppercase tracking-wide mb-3">身份信息</p>
              <div className="grid grid-cols-3 gap-y-3 gap-x-6">
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">身份证号</p>
                  <p className="text-[14px] font-medium">{detailEmployee.idNumber || "-"}</p>
                </div>
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">出生日期</p>
                  <p className="text-[14px] font-medium">
                    {formatDate(detailEmployee.birthDate)}
                    {detailEmployee.birthDate && (
                      <span className="text-[#78716C] text-[12px] ml-1.5">({calcAge(detailEmployee.birthDate)})</span>
                    )}
                  </p>
                </div>
                {detailEmployee.leaveDate && (
                  <div>
                    <p className="text-[12px] text-[#78716C] mb-0.5">离职日期</p>
                    <p className="text-[14px] font-medium">{formatDate(detailEmployee.leaveDate)}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-[#78716C] uppercase tracking-wide mb-3">薪酬社保</p>
              <div className="grid grid-cols-3 gap-y-3 gap-x-6">
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">基本工资</p>
                  <p className="text-[14px] font-semibold text-[#1C1917]">{formatMoney(detailEmployee.baseSalary)}</p>
                </div>
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">社保基数</p>
                  <p className="text-[14px] font-medium">{formatMoney(detailEmployee.socialInsuranceBase)}</p>
                </div>
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">公积金基数</p>
                  <p className="text-[14px] font-medium">{formatMoney(detailEmployee.housingFundBase)}</p>
                </div>
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">公积金比例</p>
                  <p className="text-[14px] font-medium">
                    {detailEmployee.housingFundRate != null
                      ? `${(Number(detailEmployee.housingFundRate) * 100).toFixed(2)}%`
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">社保公司比例</p>
                  <p className="text-[14px] font-medium">
                    {detailEmployee.socialInsuranceCompanyRate != null
                      ? `${(Number(detailEmployee.socialInsuranceCompanyRate) * 100).toFixed(2)}%`
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">公积金公司比例</p>
                  <p className="text-[14px] font-medium">
                    {detailEmployee.housingFundCompanyRate != null
                      ? `${(Number(detailEmployee.housingFundCompanyRate) * 100).toFixed(2)}%`
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">专项附加扣除</p>
                  <p className="text-[14px] font-medium">{formatMoney(detailEmployee.taxDeduction)}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-[#78716C] uppercase tracking-wide mb-3">银行信息</p>
              <div className="grid grid-cols-3 gap-y-3 gap-x-6">
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">开户银行</p>
                  <p className="text-[14px] font-medium">{detailEmployee.bankName || "-"}</p>
                </div>
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">银行账号</p>
                  <p className="text-[14px] font-medium">{detailEmployee.bankAccount || "-"}</p>
                </div>
              </div>
            </div>

            {detailEmployee.remark && (
              <div>
                <p className="text-[12px] font-semibold text-[#78716C] uppercase tracking-wide mb-3">备注</p>
                <p className="text-[14px] text-[#1C1917] bg-[#FAFAF9] rounded-xl p-3">{detailEmployee.remark}</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-semibold text-[#78716C] uppercase tracking-wide">证件附件</p>
                <div className="flex items-center gap-2">
                  <select
                    className="ios-select w-[120px] text-[12px] py-1.5"
                    value={uploadFileType}
                    onChange={(e) => setUploadFileType(e.target.value)}
                  >
                    {fileTypeOptions.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <button
                    className="ios-btn ios-btn-primary ios-btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingFile ? "上传中..." : "上传附件"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>

              {detailLoading ? (
                <div className="text-center py-6 text-[#78716C] text-[13px]">加载附件...</div>
              ) : detailAttachments.length === 0 ? (
                <div className="text-center py-8 bg-[#FAFAF9] rounded-xl">
                  <FileText className="w-8 h-8 text-[#78716C] mx-auto mb-2" />
                  <p className="text-[13px] text-[#78716C]">暂无附件</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {detailAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-[#FAFAF9] hover:bg-[#E7E5E4] transition-colors"
                    >
                      <FileText className="w-5 h-5 text-[#1C1917] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1C1917] truncate">{att.fileName}</p>
                        <p className="text-[11px] text-[#78716C]">
                          {fileTypeLabelMap[att.fileType] || att.fileType}
                          {att.fileSize > 0 && ` · ${(att.fileSize / 1024).toFixed(1)}KB`}
                          {` · ${formatDate(att.createdAt)}`}
                        </p>
                      </div>
                      <a
                        href={att.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ios-btn ios-btn-ghost ios-btn-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                        onClick={() => handleDeleteAttachment(att.id)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#F5F5F4]">
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">创建时间</p>
                <p className="text-[13px] font-medium">{formatDate(detailEmployee.createdAt)}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">最后修改</p>
                <p className="text-[13px] font-medium">
                  {detailEmployee.lastModifiedBy && <span>{detailEmployee.lastModifiedBy} · </span>}
                  {formatDate(detailEmployee.updatedAt)}
                </p>
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
          <div className="w-14 h-14 rounded-full bg-[#78716C]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#78716C]" />
          </div>
          <p className="text-[15px] text-[#1C1917] mb-1">
            确定要禁用员工 <span className="font-semibold">{deleteConfirm?.realName}</span> 吗？
          </p>
          <p className="text-[13px] text-[#78716C] mb-6">禁用后该员工将无法登录系统，可随时重新启用</p>
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

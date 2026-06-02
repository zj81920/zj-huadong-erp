"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  FileText,
  Eye,
  ChevronRight,
  User,
  Building2,
  X,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Customer {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  industryType: string | null;
}

interface Project {
  id: string;
  projectSourceId: string;
  name: string;
  projectCode: string;
}

interface ProjectLeadItem {
  id: string;
  projectSourceId: string;
  projectName: string;
  customerId: string;
  customer: { id: string; name: string };
  currentStatus: string;
}

interface SplitStage {
  name: string;
  amount: number | string;
}

interface IncomeContract {
  id: string;
  contractNo: string;
  projectSourceId: string | null;
  customerId: string;
  signedDate: string | null;
  totalAmount: string;
  splitStages: SplitStage[];
  status: string;
  approvalInstanceId: string | null;
  scannedUrl: string | null;
  createdAt: string;
  updatedAt: string;
  customer: Customer;
  project: Project | null;
}

interface ContractFormData {
  contractNo: string;
  projectSourceId: string;
  customerId: string;
  totalAmount: string;
  signedDate: string;
  splitStages: SplitStage[];
  scannedUrl: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const emptyForm: ContractFormData = {
  contractNo: "",
  projectSourceId: "",
  customerId: "",
  totalAmount: "",
  signedDate: "",
  splitStages: [],
  scannedUrl: "",
};

const statusBadgeMap: Record<string, string> = {
  "草稿": "ios-badge-gray",
  "审批中": "ios-badge-blue",
  "已批准": "ios-badge-green",
  "已驳回": "ios-badge-red",
  "合同归档": "ios-badge-gray",
};

const statusActionsMap: Record<
  string,
  { label: string; nextStatus: string }[]
> = {
  "草稿": [{ label: "提交审批", nextStatus: "审批中" }],
  "审批中": [
    { label: "审批通过", nextStatus: "已批准" },
    { label: "驳回", nextStatus: "已驳回" },
  ],
  "已批准": [{ label: "合同归档", nextStatus: "合同归档" }],
};

export default function IncomeContractsPage() {
  const [contracts, setContracts] = useState<IncomeContract[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProject, setFilterProject] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingContract, setEditingContract] =
    useState<IncomeContract | null>(null);
  const [form, setForm] = useState<ContractFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<IncomeContract | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const [showDetail, setShowDetail] = useState(false);
  const [detailContract, setDetailContract] =
    useState<IncomeContract | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLeads, setProjectLeads] = useState<ProjectLeadItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    industryType: "",
    customerGrade: "C",
  });
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerError, setCustomerError] = useState("");

  const [showLeadPicker, setShowLeadPicker] = useState(false);
  const [leadSearchText, setLeadSearchText] = useState("");

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      if (filterProject) params.set("projectSourceId", filterProject);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/income-contracts?${params}`);
      const json = await res.json();

      if (res.ok) {
        setContracts(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取收入合同列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterProject, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch("/api/projects?pageSize=200");
        if (res.ok) {
          const json = await res.json();
          setProjects(json.data || []);
        }
      } catch {
        setProjects([]);
      }
    };

    const fetchProjectLeads = async () => {
      try {
        const res = await fetch("/api/project-leads?pageSize=200");
        if (res.ok) {
          const json = await res.json();
          setProjectLeads(
            (json.data || []).filter(
              (l: { currentStatus: string }) => l.currentStatus !== "放弃"
            )
          );
        }
      } catch {
        setProjectLeads([]);
      }
    };

    const fetchCustomers = async () => {
      try {
        const res = await fetch("/api/customers?pageSize=200");
        if (res.ok) {
          const json = await res.json();
          setCustomers(json.data || []);
        }
      } catch {
        setCustomers([]);
      }
    };

    fetchProjects();
    fetchProjectLeads();
    fetchCustomers();
  }, []);

  const generateContractNo = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `SR-${y}${m}${d}-001`;
  };

  const handleOpenCreate = () => {
    setEditingContract(null);
    setForm({ ...emptyForm, contractNo: generateContractNo() });
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (contract: IncomeContract) => {
    setEditingContract(contract);
    setForm({
      contractNo: contract.contractNo,
      projectSourceId: contract.projectSourceId || "",
      customerId: contract.customerId,
      totalAmount: contract.totalAmount,
      signedDate: contract.signedDate
        ? new Date(contract.signedDate).toISOString().split("T")[0]
        : "",
      splitStages: Array.isArray(contract.splitStages)
        ? contract.splitStages.map((s) => ({ ...s }))
        : [],
      scannedUrl: contract.scannedUrl || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleOpenDetail = async (contract: IncomeContract) => {
    setDetailLoading(true);
    setShowDetail(true);
    try {
      const res = await fetch(`/api/income-contracts/${contract.id}`);
      if (res.ok) {
        const json = await res.json();
        setDetailContract(json.data);
      } else {
        setDetailContract(contract);
      }
    } catch {
      setDetailContract(contract);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.contractNo.trim()) {
      setFormError("合同编号不能为空");
      return;
    }
    if (!form.customerId) {
      setFormError("请选择客户");
      return;
    }
    if (!form.totalAmount || parseFloat(form.totalAmount) <= 0) {
      setFormError("合同金额必须大于0");
      return;
    }

    const stagesTotal = form.splitStages.reduce((sum, s) => {
      const val = typeof s.amount === "string" ? parseFloat(s.amount) : s.amount;
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
    if (form.splitStages.length > 0 && stagesTotal > parseFloat(form.totalAmount)) {
      setFormError("分期金额总和不能超过合同金额");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const url = editingContract
        ? `/api/income-contracts/${editingContract.id}`
        : "/api/income-contracts";
      const method = editingContract ? "PUT" : "POST";

      const payload = {
        contractNo: form.contractNo,
        projectSourceId: form.projectSourceId || null,
        customerId: form.customerId,
        totalAmount: form.totalAmount,
        signedDate: form.signedDate || null,
        splitStages: form.splitStages,
        scannedUrl: form.scannedUrl || null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchContracts();
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
      const res = await fetch(`/api/income-contracts/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        fetchContracts();
      } else {
        const json = await res.json();
        alert(json.error || "删除失败");
        setDeleteConfirm(null);
      }
    } catch {
      alert("网络错误，请重试");
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (
    contract: IncomeContract,
    nextStatus: string
  ) => {
    try {
      const res = await fetch(`/api/income-contracts/${contract.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        fetchContracts();
      } else {
        const json = await res.json();
        alert(json.error || "状态变更失败");
      }
    } catch {
      alert("网络错误，请重试");
    }
  };

  const updateForm = (field: keyof ContractFormData, value: string | SplitStage[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError("");
  };

  const addSplitStage = () => {
    setForm((prev) => ({
      ...prev,
      splitStages: [...prev.splitStages, { name: "", amount: "" }],
    }));
    if (formError) setFormError("");
  };

  const removeSplitStage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      splitStages: prev.splitStages.filter((_, i) => i !== index),
    }));
    if (formError) setFormError("");
  };

  const updateSplitStage = (
    index: number,
    field: keyof SplitStage,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      splitStages: prev.splitStages.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      ),
    }));
    if (formError) setFormError("");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "¥0.00";
    return `¥${num.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: string) => {
    if (status === "关闭") {
      return "ios-badge bg-[#6E6E73]/15 text-[#48484A]";
    }
    return `ios-badge ${statusBadgeMap[status] || "ios-badge-gray"}`;
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
        const refreshed = await fetch("/api/customers?pageSize=200");
        if (refreshed.ok) {
          const refreshedJson = await refreshed.json();
          setCustomers(refreshedJson.data || []);
        }
        setForm((prev) => ({ ...prev, customerId: json.data.id }));
        setShowCustomerModal(false);
        setCustomerForm({
          name: "",
          contactPerson: "",
          phone: "",
          industryType: "",
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

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>收入合同</h1>
            <p>管理收入合同信息，跟踪合同状态与分期付款</p>
          </div>
          <button
            className="ios-btn ios-btn-primary"
            onClick={handleOpenCreate}
          >
            <Plus className="w-4 h-4" />
            新增合同
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
              placeholder="搜索合同编号..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
          </div>

          <select
            className="ios-select w-[140px]"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部状态</option>
            <option value="草稿">草稿</option>
            <option value="审批中">审批中</option>
            <option value="生效">生效</option>
            <option value="变更中">变更中</option>
            <option value="关闭">关闭</option>
          </select>

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
                {p.name} ({p.projectSourceId})
              </option>
            ))}
          </select>

          <div className="ml-auto text-[13px] text-[#86868B]">
            共{" "}
            <span className="font-semibold text-[#1D1D1F]">
              {pagination.total}
            </span>{" "}
            条记录
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : contracts.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
              <FileText className="w-8 h-8 text-[#86868B]" />
            </div>
            <p>
              {search || filterStatus || filterProject
                ? "没有匹配的合同记录"
                : "暂无合同，点击右上角新增"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>合同编号</th>
                  <th>客户名称</th>
                  <th>关联项目</th>
                  <th>合同金额</th>
                  <th>签订日期</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-[#007AFF]" />
                        </div>
                        <span className="font-semibold">
                          {contract.contractNo}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#86868B]" />
                        {contract.customer.name}
                      </div>
                    </td>
                    <td className="text-[#86868B]">
                      {contract.project ? (
                        <div>
                          <span className="font-semibold text-[#1D1D1F]">{contract.project.name}</span>
                          <span className="block text-[11px] text-[#86868B]">{contract.projectSourceId}</span>
                        </div>
                      ) : contract.projectSourceId || "-"}
                    </td>
                    <td className="font-semibold">
                      {formatAmount(contract.totalAmount)}
                    </td>
                    <td className="text-[#86868B]">
                      {formatDate(contract.signedDate)}
                    </td>
                    <td>
                      <span className={getStatusBadge(contract.status)}>
                        {contract.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => handleOpenDetail(contract)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          查看
                        </button>
                        {(contract.status === "草稿" || contract.status === "已驳回") && (
                          <>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => handleOpenEdit(contract)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              编辑
                            </button>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                              onClick={() => setDeleteConfirm(contract)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              删除
                            </button>
                          </>
                        )}
                        {statusActionsMap[contract.status] && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF]!"
                            onClick={() =>
                              handleStatusChange(
                                contract,
                                statusActionsMap[contract.status][0].nextStatus
                              )
                            }
                          >
                            {statusActionsMap[contract.status][0].label}
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                        {contract.status === "生效" &&
                          statusActionsMap["生效"] &&
                          statusActionsMap["生效"].length > 1 && (
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                              onClick={() =>
                                handleStatusChange(contract, "关闭")
                              }
                            >
                              关闭
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
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                >
                  上一页
                </button>
                <span className="text-[13px] text-[#86868B] px-3">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
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
        title={editingContract ? "编辑收入合同" : "新增收入合同"}
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
                合同编号 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="SR-YYYYMMDD-XXX"
                value={form.contractNo}
                onChange={(e) => updateForm("contractNo", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                客户 <span className="text-[#FF3B30]">*</span>
              </label>
              {form.projectSourceId ? (
                <input
                  type="text"
                  className="ios-input bg-[#F5F5F7]"
                  value={
                    projectLeads.find((l) => l.projectSourceId === form.projectSourceId)?.customer?.name ||
                    customers.find((c) => c.id === form.customerId)?.name ||
                    ""
                  }
                  readOnly
                />
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <select
                      className="ios-select flex-1"
                      value={form.customerId}
                      onChange={(e) => updateForm("customerId", e.target.value)}
                    >
                      <option value="">请选择客户</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF] whitespace-nowrap"
                      onClick={() => {
                        setCustomerError("");
                        setCustomerForm({
                          name: "",
                          contactPerson: "",
                          phone: "",
                          industryType: "",
                          customerGrade: "C",
                        });
                        setShowCustomerModal(true);
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新增客户
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                关联项目
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center ios-input min-h-[40px]">
                  {form.projectSourceId ? (
                    <>
                      <span className="flex-1 truncate text-[13px]">
                        <span className="font-mono font-semibold text-[#007AFF]">{form.projectSourceId}</span>
                        <span className="mx-1">-</span>
                        <span>{projectLeads.find((l) => l.projectSourceId === form.projectSourceId)?.projectName || ""}</span>
                      </span>
                      <X
                        className="w-4 h-4 text-[#86868B] hover:text-[#FF3B30] flex-shrink-0 cursor-pointer"
                        onClick={() => setForm((prev) => ({ ...prev, projectSourceId: "" }))}
                      />
                    </>
                  ) : (
                    <span className="flex-1 text-[13px] text-[#86868B]">不关联项目</span>
                  )}
                </div>
                <button
                  type="button"
                  className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF] whitespace-nowrap"
                  onClick={() => {
                    setLeadSearchText("");
                    setShowLeadPicker(true);
                  }}
                >
                  <Search className="w-3.5 h-3.5" />
                  选择项目
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                合同金额 <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="ios-input"
                placeholder="请输入合同金额"
                value={form.totalAmount}
                onChange={(e) => updateForm("totalAmount", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                签订日期
              </label>
              <input
                type="date"
                className="ios-input"
                value={form.signedDate}
                onChange={(e) => updateForm("signedDate", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                扫描件URL
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="合同扫描件链接"
                value={form.scannedUrl}
                onChange={(e) => updateForm("scannedUrl", e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F]">
                分期付款
              </label>
              <button
                type="button"
                className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF]!"
                onClick={addSplitStage}
              >
                <Plus className="w-3.5 h-3.5" />
                添加阶段
              </button>
            </div>
            {form.splitStages.length === 0 ? (
              <div className="text-[13px] text-[#86868B] py-3 text-center rounded-xl bg-[#F5F5F7]">
                暂无分期，点击"添加阶段"创建
              </div>
            ) : (
              <div className="space-y-2">
                {form.splitStages.map((stage, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-3 rounded-xl bg-[#F5F5F7]"
                  >
                    <span className="text-[12px] font-semibold text-[#86868B] w-6 flex-shrink-0">
                      P{index + 1}
                    </span>
                    <input
                      type="text"
                      className="ios-input flex-1"
                      placeholder="阶段名称"
                      value={stage.name}
                      onChange={(e) =>
                        updateSplitStage(index, "name", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="ios-input w-[140px]"
                      placeholder="金额"
                      value={stage.amount}
                      onChange={(e) =>
                        updateSplitStage(index, "amount", e.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="w-8 h-8 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 flex items-center justify-center flex-shrink-0 transition-colors duration-150"
                      onClick={() => removeSplitStage(index)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#FF3B30]" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 text-[13px]">
                  <span className="text-[#86868B]">分期合计</span>
                  <span className="font-semibold text-[#1D1D1F]">
                    {formatAmount(
                      form.splitStages.reduce((sum, s) => {
                        const val =
                          typeof s.amount === "string"
                            ? parseFloat(s.amount)
                            : s.amount;
                        return sum + (isNaN(val) ? 0 : val);
                      }, 0)
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

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
              {saving
                ? "保存中..."
                : editingContract
                  ? "保存修改"
                  : "创建合同"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        title="收入合同详情"
        maxWidth="640px"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : detailContract ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#007AFF]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#007AFF]" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1D1D1F]">
                    {detailContract.contractNo}
                  </h3>
                  <p className="text-[13px] text-[#86868B]">
                    {detailContract.projectSourceId || "未关联项目"}
                  </p>
                </div>
              </div>
              <span className={getStatusBadge(detailContract.status)}>
                {detailContract.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-[12px] text-[#86868B] mb-0.5">客户名称</p>
                <p className="text-[14px] font-medium text-[#1D1D1F] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#86868B]" />
                  {detailContract.customer.name}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#86868B] mb-0.5">合同金额</p>
                <p className="text-[14px] font-bold text-[#007AFF]">
                  {formatAmount(detailContract.totalAmount)}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#86868B] mb-0.5">签订日期</p>
                <p className="text-[14px] text-[#1D1D1F]">
                  {formatDate(detailContract.signedDate)}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#86868B] mb-0.5">创建时间</p>
                <p className="text-[14px] text-[#1D1D1F]">
                  {formatDate(detailContract.createdAt)}
                </p>
              </div>
              {detailContract.customer.contactPerson && (
                <div>
                  <p className="text-[12px] text-[#86868B] mb-0.5">联系人</p>
                  <p className="text-[14px] text-[#1D1D1F]">
                    {detailContract.customer.contactPerson}
                  </p>
                </div>
              )}
              {detailContract.customer.phone && (
                <div>
                  <p className="text-[12px] text-[#86868B] mb-0.5">联系电话</p>
                  <p className="text-[14px] text-[#1D1D1F]">
                    {detailContract.customer.phone}
                  </p>
                </div>
              )}
            </div>

            {detailContract.scannedUrl && (
              <div>
                <p className="text-[12px] text-[#86868B] mb-0.5">扫描件</p>
                <a
                  href={detailContract.scannedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] text-[#007AFF] hover:underline"
                >
                  {detailContract.scannedUrl}
                </a>
              </div>
            )}

            {detailContract.splitStages &&
              Array.isArray(detailContract.splitStages) &&
              detailContract.splitStages.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[13px] font-semibold text-[#1D1D1F]">
                      分期付款 ({detailContract.splitStages.length}期)
                    </p>
                    <span className="text-[13px] font-bold text-[#007AFF]">
                      合计{" "}
                      {formatAmount(
                        detailContract.splitStages.reduce((sum, s) => {
                          const val =
                            typeof s.amount === "string"
                              ? parseFloat(s.amount)
                              : s.amount;
                          return sum + (isNaN(val) ? 0 : val);
                        }, 0)
                      )}
                    </span>
                  </div>
                  <table className="ios-table text-[13px]">
                    <thead>
                      <tr>
                        <th>阶段</th>
                        <th>名称</th>
                        <th>金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailContract.splitStages.map((stage, index) => (
                        <tr key={index}>
                          <td className="text-[#86868B]">P{index + 1}</td>
                          <td>{stage.name || "-"}</td>
                          <td className="font-semibold">
                            {formatAmount(stage.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        ) : (
          <div className="text-center py-10 text-[#86868B]">
            未找到合同信息
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
            确定要删除收入合同{" "}
            <span className="font-semibold">{deleteConfirm?.contractNo}</span>{" "}
            吗？
          </p>
          <p className="text-[13px] text-[#86868B] mb-6">此操作不可撤销</p>
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
              {deleting ? "删除中..." : "确认删除"}
            </button>
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
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">
              {customerError}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
              客户名称 <span className="text-[#FF3B30]">*</span>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">联系人</label>
              <input
                type="text"
                className="ios-input"
                placeholder="联系人"
                value={customerForm.contactPerson}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">电话</label>
              <input
                type="text"
                className="ios-input"
                placeholder="联系电话"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">行业类型</label>
              <select
                className="ios-select"
                value={customerForm.industryType}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, industryType: e.target.value }))}
              >
                <option value="">请选择</option>
                <option value="石化">石化</option>
                <option value="医药">医药</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">客户等级</label>
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
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowCustomerModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleCreateCustomer} disabled={customerSaving}>
              {customerSaving ? "保存中..." : "确认创建"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showLeadPicker}
        onClose={() => setShowLeadPicker(false)}
        title="选择关联项目"
        maxWidth="720px"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索项目源ID、项目名称、客户名称..."
              value={leadSearchText}
              onChange={(e) => setLeadSearchText(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto rounded-xl border border-[#E5E5EA]">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>项目源ID</th>
                  <th>项目名称</th>
                  <th>客户</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {projectLeads
                  .filter((l) => {
                    if (!leadSearchText) return true;
                    const q = leadSearchText.toLowerCase();
                    return (
                      l.projectSourceId.toLowerCase().includes(q) ||
                      l.projectName.toLowerCase().includes(q) ||
                      l.customer.name.toLowerCase().includes(q)
                    );
                  })
                  .map((l) => (
                    <tr key={l.projectSourceId}>
                      <td>
                        <span className="font-mono text-[13px] font-semibold text-[#007AFF]">
                          {l.projectSourceId}
                        </span>
                      </td>
                      <td className="font-semibold">{l.projectName}</td>
                      <td>{l.customer.name}</td>
                      <td>
                        <span className="ios-badge ios-badge-blue">{l.currentStatus}</span>
                      </td>
                      <td>
                        <button
                          className={`ios-btn ios-btn-sm ${
                            form.projectSourceId === l.projectSourceId
                              ? "ios-btn-primary"
                              : "ios-btn-secondary"
                          }`}
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              projectSourceId: l.projectSourceId,
                              customerId: l.customerId,
                            }));
                            setShowLeadPicker(false);
                            setLeadSearchText("");
                            if (formError) setFormError("");
                          }}
                        >
                          {form.projectSourceId === l.projectSourceId ? "已选择" : "选择"}
                        </button>
                      </td>
                    </tr>
                  ))}
                {projectLeads.filter((l) => {
                  if (!leadSearchText) return true;
                  const q = leadSearchText.toLowerCase();
                  return (
                    l.projectSourceId.toLowerCase().includes(q) ||
                    l.projectName.toLowerCase().includes(q) ||
                    l.customer.name.toLowerCase().includes(q)
                  );
                }).length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-[#86868B]">
                      无匹配项目
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowLeadPicker(false)}
            >
              关闭
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

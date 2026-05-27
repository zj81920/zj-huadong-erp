"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  FileText,
  Eye,
  ChevronRight,
  Building2,
  X,
  Upload,
  FileCheck,
} from "lucide-react";
import Modal from "@/components/Modal";

interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
}

interface ProjectItem {
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

interface ExpenseContract {
  id: string;
  contractNo: string;
  projectSourceId: string | null;
  supplierId: string | null;
  signedDate: string | null;
  totalAmount: string;
  paymentTerms: string | null;
  status: string;
  contractType: string;
  approvalInstanceId: string | null;
  scannedUrl: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: Supplier | null;
  project: ProjectItem | null;
}

interface ContractFormData {
  contractNo: string;
  projectSourceId: string;
  supplierId: string;
  inquiryId: string;
  contractType: string;
  totalAmount: string;
  paymentTerms: string;
  signedDate: string;
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
  supplierId: "",
  inquiryId: "",
  contractType: "其他",
  totalAmount: "",
  paymentTerms: "",
  signedDate: "",
  scannedUrl: "",
};

const statusBadgeMap: Record<string, string> = {
  草稿: "ios-badge-gray",
  审批中: "ios-badge-blue",
  已批准: "ios-badge-green",
  已驳回: "ios-badge-red",
  合同归档: "ios-badge-gray",
};

const statusActionsMap: Record<
  string,
  { label: string; nextStatus: string }[]
> = {
  草稿: [{ label: "提交审批", nextStatus: "审批中" }],
  审批中: [
    { label: "审批通过", nextStatus: "已批准" },
    { label: "驳回", nextStatus: "已驳回" },
  ],
  已批准: [{ label: "合同归档", nextStatus: "合同归档" }],
};

const contractTypes = ["项目采购", "设计外包", "其他", "公司行政采购"];

export default function ExpenseContractsPage() {
  const [contracts, setContracts] = useState<ExpenseContract[]>([]);
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
  const [filterContractType, setFilterContractType] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingContract, setEditingContract] =
    useState<ExpenseContract | null>(null);
  const [form, setForm] = useState<ContractFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteConfirm, setDeleteConfirm] =
    useState<ExpenseContract | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showDetail, setShowDetail] = useState(false);
  const [detailContract, setDetailContract] =
    useState<ExpenseContract | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [projectLeads, setProjectLeads] = useState<ProjectLeadItem[]>([]);
  const [showLeadPicker, setShowLeadPicker] = useState(false);
  const [leadSearchText, setLeadSearchText] = useState("");

  const [availableInquiries, setAvailableInquiries] = useState<
    {
      id: string;
      purchaseRequestId: string;
      projectSourceId: string;
      recommendedSupplierId: string | null;
      purchaseRequest: { id: string; requestNo: string; spec: string | null; quantity: string | null };
    }[]
  >([]);

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
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
  });
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [supplierError, setSupplierError] = useState("");
  const supplierFileRef = useRef<HTMLInputElement>(null);
  const [supplierUploading, setSupplierUploading] = useState(false);
  const [supplierUploadName, setSupplierUploadName] = useState("");
  const [supplierAttachmentUrl, setSupplierAttachmentUrl] = useState("");

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      if (filterProject) params.set("projectSourceId", filterProject);
      if (filterContractType) params.set("contractType", filterContractType);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const res = await fetch(`/api/expense-contracts?${params}`);
      const json = await res.json();

      if (res.ok) {
        setContracts(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取支出合同列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, [
    search,
    filterStatus,
    filterProject,
    filterContractType,
    pagination.page,
    pagination.pageSize,
  ]);

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

    const fetchSuppliers = async () => {
      try {
        const res = await fetch("/api/suppliers?pageSize=200");
        if (res.ok) {
          const json = await res.json();
          setSuppliers(json.data || []);
        } else {
          setSuppliers([]);
        }
      } catch {
        setSuppliers([]);
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

    const fetchAvailableInquiries = async () => {
      try {
        const res = await fetch("/api/purchase-contracts?mode=available-inquiries");
        if (res.ok) {
          const json = await res.json();
          setAvailableInquiries(json.data || []);
        }
      } catch {
        setAvailableInquiries([]);
      }
    };

    fetchProjects();
    fetchSuppliers();
    fetchProjectLeads();
    fetchAvailableInquiries();
  }, []);

  const generateContractNo = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `ZC-${y}${m}${d}-001`;
  };

  const handleOpenCreate = () => {
    setEditingContract(null);
    setForm({ ...emptyForm, contractNo: generateContractNo() });
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (contract: ExpenseContract) => {
    setEditingContract(contract);
    setForm({
      contractNo: contract.contractNo,
      projectSourceId: contract.projectSourceId || "",
      supplierId: contract.supplierId || "",
      inquiryId: (contract as ExpenseContract & { inquiryId?: string }).inquiryId || "",
      contractType: contract.contractType || "其他",
      totalAmount: contract.totalAmount,
      paymentTerms: contract.paymentTerms || "",
      signedDate: contract.signedDate
        ? new Date(contract.signedDate).toISOString().split("T")[0]
        : "",
      scannedUrl: contract.scannedUrl || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleOpenDetail = async (contract: ExpenseContract) => {
    setDetailLoading(true);
    setShowDetail(true);
    try {
      const res = await fetch(`/api/expense-contracts/${contract.id}`);
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
    if (!form.totalAmount || parseFloat(form.totalAmount) <= 0) {
      setFormError("合同金额必须大于0");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        ...form,
        projectSourceId: form.projectSourceId || null,
        supplierId: form.supplierId || null,
        inquiryId: form.inquiryId || null,
      };

      const url = editingContract
        ? `/api/expense-contracts/${editingContract.id}`
        : "/api/expense-contracts";
      const method = editingContract ? "PUT" : "POST";

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
      const res = await fetch(
        `/api/expense-contracts/${deleteConfirm.id}`,
        { method: "DELETE" }
      );

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
    contract: ExpenseContract,
    nextStatus: string
  ) => {
    try {
      const res = await fetch(`/api/expense-contracts/${contract.id}`, {
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

  const updateForm = (field: keyof ContractFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
        setSupplierForm({
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
        });
      } else {
        setSupplierError(json.error || "创建供应商失败");
      }
    } catch {
      setSupplierError("网络错误，请重试");
    } finally {
      setSupplierSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>支出合同</h1>
            <p>管理支出合同信息，支持项目级和公司级支出合同</p>
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
            <option value="__company__">公司级</option>
            {projects.map((p) => (
              <option key={p.id} value={p.projectSourceId}>
                {p.name} ({p.projectSourceId})
              </option>
            ))}
          </select>

          <select
            className="ios-select w-[160px]"
            value={filterContractType}
            onChange={(e) => {
              setFilterContractType(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部类型</option>
            {contractTypes.map((t) => (
              <option key={t} value={t}>
                {t}
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
              {search || filterStatus || filterProject || filterContractType
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
                  <th>关联项目</th>
                  <th>供应商</th>
                  <th>合同类型</th>
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
                      {contract.project ? (
                        <div>
                          <span className="font-semibold text-[#1D1D1F]">{contract.project.name}</span>
                          <span className="block text-[11px] text-[#86868B]">{contract.projectSourceId}</span>
                        </div>
                      ) : contract.projectSourceId ? (
                        <span className="text-[#86868B]">{contract.projectSourceId}</span>
                      ) : (
                        <span className="ios-badge ios-badge-green">公司级</span>
                      )}
                    </td>
                    <td>
                      {contract.supplier ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#86868B]" />
                          {contract.supplier.name}
                        </div>
                      ) : (
                        <span className="text-[#86868B]">-</span>
                      )}
                    </td>
                    <td>
                      <span className="ios-badge ios-badge-blue">
                        {contract.contractType}
                      </span>
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
                        {contract.status === "草稿" && (
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
        title={editingContract ? "编辑支出合同" : "新增支出合同"}
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
                placeholder="ZC-YYYYMMDD-XXX"
                value={form.contractNo}
                onChange={(e) => updateForm("contractNo", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                合同类型
              </label>
              <select
                className="ios-select"
                value={form.contractType}
                onChange={(e) => updateForm("contractType", e.target.value)}
              >
                {contractTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
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
                    <span className="flex-1 text-[13px] text-[#86868B]">不关联（公司级）</span>
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
              {form.projectSourceId && (
                <p className="text-[11px] text-[#86868B] mt-1">
                  审批流程包含"项目管理部"节点
                </p>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                供应商
              </label>
              <div className="flex items-center gap-2">
                <select
                  className="ios-select flex-1"
                  value={form.supplierId}
                  onChange={(e) => updateForm("supplierId", e.target.value)}
                >
                  <option value="">请选择供应商</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF] whitespace-nowrap"
                  onClick={() => {
                    setSupplierError("");
                    setSupplierForm({
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
                    });
                    setShowSupplierModal(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  新增供应商
                </button>
              </div>
            </div>

            {form.contractType === "项目采购" && (
              <div>
                <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                  关联询价单
                </label>
                <select
                  className="ios-select"
                  value={form.inquiryId}
                  onChange={(e) => updateForm("inquiryId", e.target.value)}
                >
                  <option value="">不关联询价单</option>
                  {availableInquiries.map((inq) => (
                    <option key={inq.id} value={inq.id}>
                      {inq.purchaseRequest.requestNo}
                      {inq.purchaseRequest.spec ? ` - ${inq.purchaseRequest.spec}` : ""}
                      {inq.recommendedSupplierId ? " (已推荐供应商)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

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

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                付款条款
              </label>
              <textarea
                className="ios-input min-h-[80px] resize-y"
                placeholder="请输入付款条款"
                value={form.paymentTerms}
                onChange={(e) => updateForm("paymentTerms", e.target.value)}
              />
            </div>

            <div className="col-span-2">
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
        title="支出合同详情"
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
                    {detailContract.projectSourceId
                      ? detailContract.projectSourceId
                      : "公司级支出"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!detailContract.projectSourceId && (
                  <span className="ios-badge ios-badge-green">公司级</span>
                )}
                <span className={getStatusBadge(detailContract.status)}>
                  {detailContract.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-[12px] text-[#86868B] mb-0.5">合同类型</p>
                <p className="text-[14px]">
                  <span className="ios-badge ios-badge-blue">
                    {detailContract.contractType}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#86868B] mb-0.5">供应商</p>
                <p className="text-[14px] font-medium text-[#1D1D1F] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#86868B]" />
                  {detailContract.supplier?.name || "-"}
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
              {detailContract.project && (
                <div>
                  <p className="text-[12px] text-[#86868B] mb-0.5">关联项目</p>
                  <p className="text-[14px] text-[#1D1D1F]">
                    {detailContract.project.name} ({detailContract.project.projectCode})
                  </p>
                </div>
              )}
            </div>

            {detailContract.paymentTerms && (
              <div>
                <p className="text-[12px] text-[#86868B] mb-0.5">付款条款</p>
                <p className="text-[14px] text-[#1D1D1F] whitespace-pre-wrap">
                  {detailContract.paymentTerms}
                </p>
              </div>
            )}

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
            确定要删除支出合同{" "}
            <span className="font-semibold">
              {deleteConfirm?.contractNo}
            </span>{" "}
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

      <Modal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        title="新增供应商"
        maxWidth="520px"
      >
        <div className="space-y-4">
          {supplierError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">
              {supplierError}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
              供应商名称 <span className="text-[#FF3B30]">*</span>
            </label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入供应商名称"
              value={supplierForm.name}
              onChange={(e) => {
                setSupplierForm((prev) => ({ ...prev, name: e.target.value }));
                if (supplierError) setSupplierError("");
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">供应商性质</label>
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
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">联系人</label>
              <input
                type="text"
                className="ios-input"
                placeholder="联系人姓名"
                value={supplierForm.contactPerson}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">电话</label>
              <input
                type="text"
                className="ios-input"
                placeholder="联系电话"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">邮箱</label>
              <input
                type="text"
                className="ios-input"
                placeholder="邮箱地址"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">地址</label>
            <input
              type="text"
              className="ios-input"
              placeholder="供应商地址"
              value={supplierForm.address}
              onChange={(e) => setSupplierForm((prev) => ({ ...prev, address: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">开户行信息</label>
              <input
                type="text"
                className="ios-input"
                placeholder="开户行名称"
                value={supplierForm.bankName}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, bankName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">开户行账号</label>
              <input
                type="text"
                className="ios-input"
                placeholder="银行账号"
                value={supplierForm.bankAccount}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, bankAccount: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">备注</label>
            <textarea
              className="ios-input min-h-[60px] resize-none"
              placeholder="备注信息"
              value={supplierForm.remark}
              onChange={(e) => setSupplierForm((prev) => ({ ...prev, remark: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">供应商资料</label>
            <input
              ref={supplierFileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.rar"
              onChange={handleSupplierFileUpload}
            />
            {supplierAttachmentUrl ? (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] mb-2">
                <FileCheck className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
                <span className="flex-1 text-[13px] text-[#1D1D1F] truncate">
                  {supplierUploadName || "已上传文件"}
                </span>
                <button
                  type="button"
                  className="text-[#86868B] hover:text-[#FF3B30]"
                  onClick={() => {
                    setSupplierAttachmentUrl("");
                    setSupplierUploadName("");
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className="ios-btn ios-btn-secondary w-full"
              disabled={supplierUploading}
              onClick={() => supplierFileRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              {supplierUploading ? "上传中..." : supplierAttachmentUrl ? "重新上传" : "选择文件上传"}
            </button>
            <p className="text-[12px] text-[#86868B] mt-1">
              支持 PDF、Word、Excel、图片、压缩包，最大 10MB
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowSupplierModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleCreateSupplier} disabled={supplierSaving}>
              {supplierSaving ? "保存中..." : "确认创建"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

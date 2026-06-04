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
  User,
  Building2,
  X,
  Upload,
  FileCheck,
} from "lucide-react";
import Modal from "@/components/Modal";
import AdminStatusOverride from "@/components/AdminStatusOverride";
import { DetailPageLayout } from "@/components/DetailPageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useFlowConfigured } from "@/hooks/useFlowConfigured";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { BatchDeleteBar } from "@/components/BatchDeleteBar";
import { getUserModulePerms } from "@/lib/types/permissions";
import { canDeleteFrontend, canEditFrontend } from "@/lib/types/permissions";
import { useRouter } from "next/navigation";

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
  projectCode: string;
  name: string;
  customerId: string;
}

interface ProjectLeadItem {
  id: string;
  projectSourceId: string;
  projectName: string;
  customerId: string;
  customer: { id: string; name: string };
  currentStatus: string;
  project: { id: string; projectCode: string; name: string; status: string } | null;
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
  archivedUrl: string | null;
  taxRate: string | null;
  pricingMethod: string | null;
  contractSummary: string | null;
  paymentTerms: string | null;
  organizationId: string | null;
  lastModifiedBy: string | null;
  createdById: string | null;
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
  splitStages: SplitStage[];
  draftFiles: string[];
  taxRate: string;
  pricingMethod: string;
  contractSummary: string;
  paymentTerms: string;
  organizationId: string;
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
  splitStages: [],
  draftFiles: [],
  taxRate: "",
  pricingMethod: "",
  contractSummary: "",
  paymentTerms: "",
  organizationId: "",
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
  "审批中": [{ label: "前往审批中心", nextStatus: "" }],
  "已批准": [{ label: "合同归档", nextStatus: "合同归档" }],
};

export default function IncomeContractsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdminUser = user?.username === "admin" || user?.roles?.some((r: any) => r.code === "admin") || false;
  const rolePerms = getUserModulePerms(user, "income_contract");
  const hasFlow = user?.moduleFlowStatus?.["income_contract"] ?? false;
  const { configured: flowConfigured } = useFlowConfigured("income_contract");
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
  const [filterOrg, setFilterOrg] = useState("");
  const [organizations, setOrganizations] = useState<any[]>([]);

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

  const [archiveContract, setArchiveContract] = useState<IncomeContract | null>(null);
  const [archiveFiles, setArchiveFiles] = useState<string[]>([]);
  const [archiveUploading, setArchiveUploading] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const archiveFileRef = useRef<HTMLInputElement>(null);

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

  const [contractInvoices, setContractInvoices] = useState<any[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNo: "",
    invoiceCode: "",
    invoiceType: "增值税专用发票",
    invoiceDate: new Date().toISOString().split("T")[0],
    amount: "",
    taxRate: "6",
    taxAmount: "",
    totalAmount: "",
    buyerName: "",
    buyerTaxNo: "",
    remark: "",
    attachments: [] as string[],
  });
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceUploading, setInvoiceUploading] = useState(false);
  const [invoiceUploadName, setInvoiceUploadName] = useState("");
  const invoiceFileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const draftFileRef = useRef<HTMLInputElement>(null);

  const { toggleSelect, selectAll, clearSelection, isAllSelected, selectedCount, isSelected } = useBatchSelection(contracts.map((d) => d.id));

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      if (filterProject) params.set("projectSourceId", filterProject);
      if (filterOrg) params.set("organizationId", filterOrg);
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
  }, [search, filterStatus, filterProject, filterOrg, pagination.page, pagination.pageSize]);

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

    const fetchOrganizations = async () => {
      try {
        const res = await fetch("/api/organizations");
        if (res.ok) {
          const json = await res.json();
          setOrganizations(json.data || []);
        }
      } catch {
        setOrganizations([]);
      }
    };
    fetchOrganizations();
  }, []);

  const handleOpenCreate = () => {
    setEditingContract(null);
    // 默认选择总公司（type=PARENT），没有则选第一个
    const defaultOrg = organizations.find((o: any) => o.type === "PARENT") || organizations[0];
    setForm({ ...emptyForm, organizationId: defaultOrg?.id || "" });
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (contract: IncomeContract) => {
    setEditingContract(contract);
    let draftFiles: string[] = [];
    try {
      if (contract.scannedUrl) {
        const parsed = JSON.parse(contract.scannedUrl);
        draftFiles = Array.isArray(parsed) ? parsed : [contract.scannedUrl];
      }
    } catch {
      draftFiles = contract.scannedUrl ? [contract.scannedUrl] : [];
    }
    setForm({
      contractNo: contract.contractNo,
      projectSourceId: contract.projectSourceId || "",
      customerId: contract.customerId,
      totalAmount: contract.totalAmount,
      splitStages: Array.isArray(contract.splitStages)
        ? contract.splitStages.map((s) => ({ ...s }))
        : [],
      draftFiles,
      taxRate: contract.taxRate || "",
      pricingMethod: contract.pricingMethod || "",
      contractSummary: contract.contractSummary || "",
      paymentTerms: contract.paymentTerms || "",
      organizationId: contract.organizationId || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const fetchContractInvoices = async (contractId: string) => {
    try {
      const res = await fetch(`/api/invoices?sourceType=income_contract&sourceId=${contractId}&pageSize=200`);
      if (res.ok) {
        const json = await res.json();
        setContractInvoices(json.data || []);
      }
    } catch {}
  };

  useEffect(() => {
    const amt = parseFloat(invoiceForm.amount) || 0;
    const rate = parseFloat(invoiceForm.taxRate) / 100 || 0;
    const tax = amt * rate;
    setInvoiceForm(prev => ({ ...prev, taxAmount: tax.toFixed(2), totalAmount: (amt + tax).toFixed(2) }));
  }, [invoiceForm.amount, invoiceForm.taxRate]);

  const handleInvoiceFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInvoiceUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        setInvoiceForm(prev => ({ ...prev, attachments: [...prev.attachments, json.url] }));
        setInvoiceUploadName(file.name);
      } else {
        setInvoiceError(json.error || "上传失败");
      }
    } catch {
      setInvoiceError("上传失败，请重试");
    } finally {
      setInvoiceUploading(false);
      if (invoiceFileRef.current) invoiceFileRef.current.value = "";
    }
  };

  const handleInvoiceSubmit = async () => {
    if (!invoiceForm.invoiceNo.trim()) {
      setInvoiceError("发票号码不能为空");
      return;
    }
    if (!invoiceForm.amount || parseFloat(invoiceForm.amount) <= 0) {
      setInvoiceError("不含税金额必须大于0");
      return;
    }
    if (!detailContract) return;

    setInvoiceSaving(true);
    setInvoiceError("");
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNo: invoiceForm.invoiceNo,
          invoiceCode: invoiceForm.invoiceCode || null,
          invoiceType: invoiceForm.invoiceType,
          invoiceDate: invoiceForm.invoiceDate || null,
          amount: invoiceForm.amount,
          taxRate: invoiceForm.taxRate,
          taxAmount: invoiceForm.taxAmount,
          totalAmount: invoiceForm.totalAmount,
          buyerName: invoiceForm.buyerName || null,
          buyerTaxNo: invoiceForm.buyerTaxNo || null,
          remark: invoiceForm.remark || null,
          attachments: invoiceForm.attachments.length > 0 ? invoiceForm.attachments : null,
          sourceType: "income_contract",
          sourceId: detailContract.id,
          invoiceCategory: "开票",
          projectSourceId: detailContract.projectSourceId || null,
          status: "已登记",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setShowInvoiceModal(false);
        setInvoiceForm({
          invoiceNo: "",
          invoiceCode: "",
          invoiceType: "增值税专用发票",
          invoiceDate: new Date().toISOString().split("T")[0],
          amount: "",
          taxRate: "6",
          taxAmount: "",
          totalAmount: "",
          buyerName: "",
          buyerTaxNo: "",
          remark: "",
          attachments: [],
        });
        setInvoiceUploadName("");
        fetchContractInvoices(detailContract.id);
      } else {
        setInvoiceError(json.error || "开票失败");
      }
    } catch {
      setInvoiceError("网络错误，请重试");
    } finally {
      setInvoiceSaving(false);
    }
  };

  const handleOpenDetail = async (contract: IncomeContract) => {
    setDetailLoading(true);
    setShowDetail(true);
    setContractInvoices([]);
    try {
      const res = await fetch(`/api/income-contracts/${contract.id}`);
      if (res.ok) {
        const json = await res.json();
        setDetailContract(json.data);
        fetchContractInvoices(json.data.id);
      } else {
        setDetailContract(contract);
        fetchContractInvoices(contract.id);
      }
    } catch {
      setDetailContract(contract);
      fetchContractInvoices(contract.id);
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
        splitStages: form.splitStages,
        scannedUrl: form.draftFiles.length > 0 ? JSON.stringify(form.draftFiles) : null,
        taxRate: form.taxRate || null,
        pricingMethod: form.pricingMethod || null,
        contractSummary: form.contractSummary || null,
        paymentTerms: form.paymentTerms || null,
        organizationId: form.organizationId || null,
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
    if (!canDeleteFrontend(hasFlow, rolePerms, deleteConfirm.status, user?.id ?? "", deleteConfirm.createdById ?? null, isAdminUser)) {
      alert("无权删除该记录");
      setDeleteConfirm(null);
      return;
    }

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

  const handleSubmitApproval = async (contract: IncomeContract) => {
    try {
      const res = await fetch("/api/approval-instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: "income_contract",
          businessId: contract.id,
          flowLevel: "common",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        fetchContracts();
      } else {
        alert(json.error || "提交审批失败");
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
            disabled={!flowConfigured}
            title={flowConfigured ? undefined : "请先在流程设置中配置收入合同审批流程"}
          >
            <Plus className="w-4 h-4" />
            新增合同
          </button>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="filter-bar">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
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

          <select
            className="ios-select w-[160px]"
            value={filterOrg || ''}
            onChange={(e) => {
              setFilterOrg(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">全部主体</option>
            {organizations.map((org: any) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>

          <div className="ml-auto text-[13px] text-[#78716C]">
            共{" "}
            <span className="font-semibold text-[#1C1917]">
              {pagination.total}
            </span>{" "}
            条记录
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : contracts.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
              <FileText className="w-8 h-8 text-[#78716C]" />
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
                  {rolePerms.delete && <th className="w-10"><input type="checkbox" className="ios-checkbox" checked={isAllSelected} onChange={() => isAllSelected ? clearSelection() : selectAll()} /></th>}
                  <th>合同编号</th>
                  <th>客户名称</th>
                  <th>关联项目</th>
                  <th>合同金额</th>
                  <th>税率</th>
                  <th>计价方式</th>
                  <th>状态</th>
                  <th>最后修改</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr key={contract.id} className={isSelected(contract.id) ? "bg-[#1C1917]/5" : ""}>
                    {rolePerms.delete && <td className="w-10"><input type="checkbox" className="ios-checkbox" checked={isSelected(contract.id)} onChange={() => toggleSelect(contract.id)} /></td>}
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-[#1C1917]" />
                        </div>
                        <span className="font-semibold">
                          {contract.contractNo}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#78716C]" />
                        {contract.customer.name}
                      </div>
                    </td>
                    <td className="text-[#78716C]">
                      {contract.project ? (
                        <div>
                          <span className="font-semibold text-[#1C1917]">{contract.project.name}</span>
                          <span className="block text-[11px] text-[#78716C]">{contract.projectSourceId}</span>
                        </div>
                      ) : contract.projectSourceId || "-"}
                    </td>
                    <td className="font-semibold">
                      {formatAmount(contract.totalAmount)}
                    </td>
                    <td className="text-[#78716C]">
                      {contract.taxRate || "-"}
                    </td>
                    <td className="text-[#78716C]">
                      {contract.pricingMethod || "-"}
                    </td>
                    <td>
                      <span className={getStatusBadge(contract.status)}>
                        {contract.status}
                      </span>
                    </td>
                    <td className="text-[#78716C] text-[12px] whitespace-nowrap">
                      {contract.lastModifiedBy && (
                        <span>{contract.lastModifiedBy}</span>
                      )}
                      <span className="block text-[11px]">{formatDate(contract.updatedAt)}</span>
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
                        {(canEditFrontend(hasFlow, rolePerms, contract.status, user?.id ?? "", contract.createdById ?? null, isAdminUser) || canDeleteFrontend(hasFlow, rolePerms, contract.status, user?.id ?? "", contract.createdById ?? null, isAdminUser)) && (
                          <>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => handleOpenEdit(contract)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              编辑
                            </button>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                              onClick={() => setDeleteConfirm(contract)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              删除
                            </button>
                          </>
                        )}
                        {statusActionsMap[contract.status] && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                            onClick={() => {
                              const next = statusActionsMap[contract.status][0];
                              if (next.nextStatus === "合同归档") {
                                setArchiveContract(contract);
                                setArchiveFiles([]);
                              } else if (!next.nextStatus) {
                                window.location.href = "/approvals";
                              } else if (next.nextStatus === "审批中") {
                                handleSubmitApproval(contract);
                              } else {
                                handleStatusChange(contract, next.nextStatus);
                              }
                            }}
                          >
                            {statusActionsMap[contract.status][0].label}
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                        {contract.status === "生效" &&
                          statusActionsMap["生效"] &&
                          statusActionsMap["生效"].length > 1 && (
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
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
              <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-[#F5F5F4]">
                <button
                  className="ios-btn ios-btn-secondary ios-btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                >
                  上一页
                </button>
                <span className="text-[13px] text-[#78716C] px-3">
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

        {rolePerms.delete && <BatchDeleteBar businessType="income_contract" selectedIds={contracts.filter(d => isSelected(d.id)).map(d => d.id)} onDeleteSuccess={fetchContracts} onClear={clearSelection} />}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingContract ? "编辑收入合同" : "新增收入合同"}
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
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                合同编号 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入合同编号"
                value={form.contractNo}
                onChange={(e) => updateForm("contractNo", e.target.value)}
              />
            </div>

            {/* 所属主体 */}
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                所属主体 <span className="text-[#78716C]">*</span>
              </label>
              <select
                className="ios-select"
                value={form.organizationId || ''}
                onChange={(e) => updateForm("organizationId", e.target.value)}
              >
                <option value="">请选择主体</option>
                {organizations.map((org: any) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                客户 <span className="text-[#78716C]">*</span>
              </label>
              {form.projectSourceId ? (
                <input
                  type="text"
                  className="ios-input bg-[#FAFAF9]"
                  value={
                    projects.find((p) => p.projectSourceId === form.projectSourceId)?.name
                      ? (() => {
                          const proj = projects.find((p) => p.projectSourceId === form.projectSourceId);
                          const cust = customers.find((c) => c.id === form.customerId);
                          return cust?.name || "";
                        })()
                      : customers.find((c) => c.id === form.customerId)?.name || ""
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
                      className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917] whitespace-nowrap"
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
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                关联项目
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center ios-input min-h-[40px]">
                  {form.projectSourceId ? (
                    <>
                      <span className="flex-1 truncate text-[13px]">
                        <span className="font-mono font-semibold text-[#1C1917]">{form.projectSourceId}</span>
                        <span className="mx-1">-</span>
                        <span>{projects.find((p) => p.projectSourceId === form.projectSourceId)?.name || ""}</span>
                      </span>
                      <X
                        className="w-4 h-4 text-[#78716C] hover:text-[#78716C] flex-shrink-0 cursor-pointer"
                        onClick={() => setForm((prev) => ({ ...prev, projectSourceId: "", customerId: "" }))}
                      />
                    </>
                  ) : (
                    <span className="flex-1 text-[13px] text-[#78716C]">不关联项目</span>
                  )}
                </div>
                <button
                  type="button"
                  className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917] whitespace-nowrap"
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
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                合同金额 <span className="text-[#78716C]">*</span>
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
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                合同税率
              </label>
              <select
                className="ios-select"
                value={form.taxRate}
                onChange={(e) => updateForm("taxRate", e.target.value)}
              >
                <option value="">请选择税率</option>
                <option value="1%">1%</option>
                <option value="3%">3%</option>
                <option value="5%">5%</option>
                <option value="6%">6%</option>
                <option value="9%">9%</option>
                <option value="13%">13%</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                计价方式
              </label>
              <select
                className="ios-select"
                value={form.pricingMethod}
                onChange={(e) => updateForm("pricingMethod", e.target.value)}
              >
                <option value="">请选择计价方式</option>
                <option value="总价合同">总价合同</option>
                <option value="单价合同">单价合同</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              合同草稿
            </label>
            <input
              ref={draftFileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const formData = new FormData();
                  formData.append("file", file);
                  const res = await fetch("/api/upload", { method: "POST", body: formData });
                  const json = await res.json();
                  if (res.ok) {
                    const newFiles = [...form.draftFiles, json.url];
                    setForm((prev) => ({ ...prev, draftFiles: newFiles }));
                    try {
                      setAiAnalyzing(true);
                      const aiRes = await fetch("/api/ai/analyze-contract", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ fileUrls: newFiles }),
                      });
                      const aiJson = await aiRes.json();
                      if (aiRes.ok && aiJson.data) {
                        setForm((prev) => ({
                          ...prev,
                          contractSummary: aiJson.data.summary || prev.contractSummary,
                          paymentTerms: aiJson.data.paymentTerms || prev.paymentTerms,
                        }));
                      }
                    } catch {
                      // AI 分析失败不影响主流程
                    } finally {
                      setAiAnalyzing(false);
                    }
                  }
                } catch {
                  // 上传失败
                } finally {
                  setUploading(false);
                  if (draftFileRef.current) draftFileRef.current.value = "";
                }
              }}
            />
            {form.draftFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {form.draftFiles.map((url, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[12px]">
                    <FileCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#1C1917] hover:underline truncate max-w-[150px]">
                      {url.split("/").pop() || `文件${idx + 1}`}
                    </a>
                    <button
                      type="button"
                      className="text-[#78716C] hover:text-[#78716C]"
                      onClick={() => setForm((prev) => ({ ...prev, draftFiles: prev.draftFiles.filter((_, i) => i !== idx) }))}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="ios-btn ios-btn-secondary w-full"
              disabled={uploading}
              onClick={() => draftFileRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              {uploading ? "上传中..." : "选择合同草稿文件上传"}
            </button>
            <p className="text-[12px] text-[#78716C] mt-1">
              支持 PDF、DOC、DOCX、JPG、PNG 格式，上传后自动AI分析
            </p>
          </div>

          {aiAnalyzing && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#1C1917]/5 text-[#1C1917] text-[13px]">
              <div className="w-4 h-4 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
              AI 正在分析合同内容...
            </div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              合同概要 {aiAnalyzing && <span className="text-[#78716C] font-normal">（AI生成中...）</span>}
            </label>
            <textarea
              className="ios-input min-h-[80px] resize-none"
              placeholder="上传合同草稿后AI自动生成，也可手动输入（不超过300字）"
              value={form.contractSummary}
              onChange={(e) => updateForm("contractSummary", e.target.value)}
              maxLength={300}
            />
            <p className="text-[11px] text-[#78716C] mt-1 text-right">{form.contractSummary.length}/300</p>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              付款方式 {aiAnalyzing && <span className="text-[#78716C] font-normal">（AI生成中...）</span>}
            </label>
            <textarea
              className="ios-input min-h-[60px] resize-none"
              placeholder="上传合同草稿后AI自动生成，也可手动输入"
              value={form.paymentTerms}
              onChange={(e) => updateForm("paymentTerms", e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[13px] font-semibold text-[#1C1917]">
                分期付款
              </label>
              <button
                type="button"
                className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                onClick={addSplitStage}
              >
                <Plus className="w-3.5 h-3.5" />
                添加阶段
              </button>
            </div>
            {form.splitStages.length === 0 ? (
              <div className="text-[13px] text-[#78716C] py-3 text-center rounded-xl bg-[#FAFAF9]">
                暂无分期，点击"添加阶段"创建
              </div>
            ) : (
              <div className="space-y-2">
                {form.splitStages.map((stage, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-3 rounded-xl bg-[#FAFAF9]"
                  >
                    <span className="text-[12px] font-semibold text-[#78716C] w-6 flex-shrink-0">
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
                      className="w-8 h-8 rounded-full bg-[#78716C]/10 hover:bg-[#78716C]/20 flex items-center justify-center flex-shrink-0 transition-colors duration-150"
                      onClick={() => removeSplitStage(index)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#78716C]" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 text-[13px]">
                  <span className="text-[#78716C]">分期合计</span>
                  <span className="font-semibold text-[#1C1917]">
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
            <div className="w-8 h-8 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : detailContract ? (
          <DetailPageLayout
            title={detailContract.contractNo}
            instanceId={detailContract.approvalInstanceId}
            businessType="income_contract"
            businessId={detailContract.id}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1C1917]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#1C1917]" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1C1917]">
                    {detailContract.contractNo}
                  </h3>
                  <p className="text-[13px] text-[#78716C]">
                    {detailContract.projectSourceId || "未关联项目"}
                  </p>
                </div>
              </div>
              <AdminStatusOverride
                businessType="income_contract"
                businessId={detailContract.id}
                currentStatus={detailContract.status}
                onStatusChanged={(newStatus) => {
                  setDetailContract(prev => prev ? { ...prev, status: newStatus } : prev);
                  setContracts(prev => prev.map(r => r.id === detailContract.id ? { ...r, status: newStatus } : r));
                }}
                size="md"
              />
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">客户名称</p>
                <p className="text-[14px] font-medium text-[#1C1917] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#78716C]" />
                  {detailContract.customer.name}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">合同金额</p>
                <p className="text-[14px] font-bold text-[#1C1917]">
                  {formatAmount(detailContract.totalAmount)}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">合同税率</p>
                <p className="text-[14px] text-[#1C1917]">
                  {detailContract.taxRate || "-"}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">计价方式</p>
                <p className="text-[14px] text-[#1C1917]">
                  {detailContract.pricingMethod || "-"}
                </p>
              </div>
              {detailContract.signedDate && (
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">签订日期</p>
                  <p className="text-[14px] text-[#1C1917]">
                    {formatDate(detailContract.signedDate)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">创建时间</p>
                <p className="text-[14px] text-[#1C1917]">
                  {formatDate(detailContract.createdAt)}
                </p>
              </div>
              {detailContract.customer.contactPerson && (
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">联系人</p>
                  <p className="text-[14px] text-[#1C1917]">
                    {detailContract.customer.contactPerson}
                  </p>
                </div>
              )}
              {detailContract.customer.phone && (
                <div>
                  <p className="text-[12px] text-[#78716C] mb-0.5">联系电话</p>
                  <p className="text-[14px] text-[#1C1917]">
                    {detailContract.customer.phone}
                  </p>
                </div>
              )}
            </div>

            {detailContract.contractSummary && (
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">合同概要</p>
                <p className="text-[14px] text-[#1C1917] whitespace-pre-wrap leading-relaxed bg-[#FAFAF9] p-3 rounded-xl">
                  {detailContract.contractSummary}
                </p>
              </div>
            )}

            {detailContract.paymentTerms && (
              <div>
                <p className="text-[12px] text-[#78716C] mb-0.5">付款方式</p>
                <p className="text-[14px] text-[#1C1917] whitespace-pre-wrap leading-relaxed bg-[#FAFAF9] p-3 rounded-xl">
                  {detailContract.paymentTerms}
                </p>
              </div>
            )}

            {detailContract.scannedUrl && (
              <div>
                <p className="text-[12px] text-[#78716C] mb-1">合同草稿</p>
                {(() => {
                  let files: string[] = [];
                  try {
                    const parsed = JSON.parse(detailContract.scannedUrl);
                    files = Array.isArray(parsed) ? parsed : [detailContract.scannedUrl];
                  } catch {
                    files = [detailContract.scannedUrl];
                  }
                  return (
                    <div className="flex flex-wrap gap-2">
                      {files.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[12px] text-[#1C1917] hover:underline"
                        >
                          <FileCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                          {url.split("/").pop() || `文件${idx + 1}`}
                        </a>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {detailContract.archivedUrl && (() => {
              let files: string[] = [];
              try {
                const parsed = JSON.parse(detailContract.archivedUrl);
                files = Array.isArray(parsed) ? parsed : [detailContract.archivedUrl];
              } catch {
                files = [detailContract.archivedUrl];
              }
              return (
                <div>
                  <p className="text-[12px] text-[#78716C] mb-1">归档扫描件</p>
                  <div className="flex flex-wrap gap-2">
                    {files.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[12px] text-[#1C1917] hover:underline"
                      >
                        <FileCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
                        {url.split("/").pop() || `扫描件${idx + 1}`}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}

            {detailContract.splitStages &&
              Array.isArray(detailContract.splitStages) &&
              detailContract.splitStages.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[13px] font-semibold text-[#1C1917]">
                      分期付款 ({detailContract.splitStages.length}期)
                    </p>
                    <span className="text-[13px] font-bold text-[#1C1917]">
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
                          <td className="text-[#78716C]">P{index + 1}</td>
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#78716C]" />
                  <p className="text-[13px] font-semibold text-[#1C1917]">
                    开票登记 ({contractInvoices.length})
                  </p>
                </div>
                <button
                  className="ios-btn ios-btn-primary ios-btn-sm"
                  onClick={() => {
                    setInvoiceError("");
                    setInvoiceForm({
                      invoiceNo: "",
                      invoiceCode: "",
                      invoiceType: "增值税专用发票",
                      invoiceDate: new Date().toISOString().split("T")[0],
                      amount: "",
                      taxRate: "6",
                      taxAmount: "",
                      totalAmount: "",
                      buyerName: detailContract.customer?.name || "",
                      buyerTaxNo: "",
                      remark: "",
                      attachments: [],
                    });
                    setInvoiceUploadName("");
                    setShowInvoiceModal(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  开票
                </button>
              </div>

              {contractInvoices.length > 0 ? (
                <>
                  <table className="ios-table text-[12px]">
                    <thead>
                      <tr>
                        <th>发票号码</th>
                        <th>发票类型</th>
                        <th>价税合计</th>
                        <th>开票日期</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contractInvoices.map((inv: any) => (
                        <tr key={inv.id}>
                          <td className="font-medium font-mono">{inv.invoiceNo}</td>
                          <td>
                            <span className="ios-badge ios-badge-blue text-[11px]">{inv.invoiceType}</span>
                          </td>
                          <td className="font-mono font-semibold text-[#1C1917]">
                            {parseFloat(inv.totalAmount || inv.amount || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-[#78716C]">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("zh-CN") : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 p-3 rounded-xl bg-[#FAFAF9]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] text-[#78716C]">已开票金额 / 合同总额</span>
                      <span className="text-[13px] font-semibold text-[#1C1917]">
                        ¥{contractInvoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.totalAmount || inv.amount || 0)), 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                        {" / "}
                        {formatAmount(detailContract.totalAmount)}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#E7E5E4] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#1C1917] transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (contractInvoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.totalAmount || inv.amount || 0)), 0) / Math.max(0.01, parseFloat(detailContract.totalAmount || "0"))) * 100).toFixed(1)}%`,
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-[#78716C] text-[13px] rounded-xl bg-[#FAFAF9]">
                  暂无开票记录
                </div>
              )}
            </div>

            {(detailContract.status === "已批准" || detailContract.status === "合同归档" || detailContract.status === "生效") && (
              <div className="flex justify-end pt-4 border-t border-[#F5F5F4]">
                <button
                  className="ios-btn ios-btn-secondary"
                  onClick={() => router.push(`/contracts/change-orders/new?contractType=income_contract&contractId=${detailContract.id}`)}
                >
                  发起变更
                </button>
              </div>
            )}
          </DetailPageLayout>
        ) : (
          <div className="text-center py-10 text-[#78716C]">
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
          <div className="w-14 h-14 rounded-full bg-[#78716C]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#78716C]" />
          </div>
          <p className="text-[15px] text-[#1C1917] mb-1">
            确定要删除收入合同{" "}
            <span className="font-semibold">{deleteConfirm?.contractNo}</span>{" "}
            吗？
          </p>
          <p className="text-[13px] text-[#78716C] mb-6">此操作不可撤销</p>
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
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {customerError}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
              客户名称 <span className="text-[#78716C]">*</span>
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
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">联系人</label>
              <input
                type="text"
                className="ios-input"
                placeholder="联系人"
                value={customerForm.contactPerson}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">电话</label>
              <input
                type="text"
                className="ios-input"
                placeholder="联系电话"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">行业类型</label>
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
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">客户等级</label>
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

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
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
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索项目源ID、立项编号、项目名称、客户名称..."
              value={leadSearchText}
              onChange={(e) => setLeadSearchText(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto rounded-xl border border-[#E7E5E4]">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>项目源ID</th>
                  <th>立项编号</th>
                  <th>项目名称</th>
                  <th>客户</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {projects
                  .filter((p) => {
                    if (!leadSearchText) return true;
                    const q = leadSearchText.toLowerCase();
                    const custName = customers.find((c) => c.id === p.customerId)?.name || "";
                    return (
                      p.projectSourceId.toLowerCase().includes(q) ||
                      p.projectCode.toLowerCase().includes(q) ||
                      p.name.toLowerCase().includes(q) ||
                      custName.toLowerCase().includes(q)
                    );
                  })
                  .map((p) => {
                    const custName = customers.find((c) => c.id === p.customerId)?.name || "";
                    return (
                      <tr key={p.projectSourceId}>
                        <td>
                          <span className="font-mono text-[13px] font-semibold text-[#1C1917]">
                            {p.projectSourceId}
                          </span>
                        </td>
                        <td className="font-mono text-[13px]">{p.projectCode}</td>
                        <td className="font-semibold">{p.name}</td>
                        <td>{custName}</td>
                        <td>
                          <button
                            className={`ios-btn ios-btn-sm ${
                              form.projectSourceId === p.projectSourceId
                                ? "ios-btn-primary"
                                : "ios-btn-secondary"
                            }`}
                            onClick={() => {
                              setForm((prev) => ({
                                ...prev,
                                projectSourceId: p.projectSourceId,
                                customerId: p.customerId,
                              }));
                              setShowLeadPicker(false);
                              setLeadSearchText("");
                              if (formError) setFormError("");
                            }}
                          >
                            {form.projectSourceId === p.projectSourceId ? "已选择" : "选择"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                {projects.filter((p) => {
                  if (!leadSearchText) return true;
                  const q = leadSearchText.toLowerCase();
                  const custName = customers.find((c) => c.id === p.customerId)?.name || "";
                  return (
                    p.projectSourceId.toLowerCase().includes(q) ||
                    p.projectCode.toLowerCase().includes(q) ||
                    p.name.toLowerCase().includes(q) ||
                    custName.toLowerCase().includes(q)
                  );
                }).length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-[#78716C]">
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
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title="开票登记"
        maxWidth="640px"
      >
        <div className="space-y-4">
          {invoiceError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">
              {invoiceError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                发票号码 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入发票号码"
                value={invoiceForm.invoiceNo}
                onChange={(e) => {
                  setInvoiceForm(prev => ({ ...prev, invoiceNo: e.target.value }));
                  if (invoiceError) setInvoiceError("");
                }}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">发票代码</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入发票代码"
                value={invoiceForm.invoiceCode}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoiceCode: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">发票类型</label>
              <select
                className="ios-select"
                value={invoiceForm.invoiceType}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoiceType: e.target.value }))}
              >
                <option value="增值税专用发票">增值税专用发票</option>
                <option value="增值税普通发票">增值税普通发票</option>
                <option value="增值税电子发票">增值税电子发票</option>
                <option value="收据">收据</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">开票日期</label>
              <input
                type="date"
                className="ios-input"
                value={invoiceForm.invoiceDate}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                不含税金额 <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="ios-input"
                placeholder="请输入不含税金额"
                value={invoiceForm.amount}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">税率</label>
              <select
                className="ios-select"
                value={invoiceForm.taxRate}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, taxRate: e.target.value }))}
              >
                <option value="3">3%</option>
                <option value="6">6%</option>
                <option value="9">9%</option>
                <option value="13">13%</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">税额（自动计算）</label>
              <input
                type="text"
                className="ios-input bg-[#FAFAF9]"
                value={invoiceForm.taxAmount ? `¥${invoiceForm.taxAmount}` : ""}
                readOnly
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">价税合计（自动计算）</label>
              <input
                type="text"
                className="ios-input bg-[#FAFAF9] font-semibold text-[#1C1917]"
                value={invoiceForm.totalAmount ? `¥${invoiceForm.totalAmount}` : ""}
                readOnly
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">购方名称</label>
              <input
                type="text"
                className="ios-input"
                placeholder="默认从客户信息带入"
                value={invoiceForm.buyerName}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, buyerName: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">购方税号</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入纳税人识别号"
                value={invoiceForm.buyerTaxNo}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, buyerTaxNo: e.target.value }))}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">备注</label>
              <textarea
                className="ios-input min-h-[60px] resize-none"
                placeholder="备注信息"
                value={invoiceForm.remark}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, remark: e.target.value }))}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">发票扫描件</label>
              <input
                ref={invoiceFileRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.ofd"
                onChange={handleInvoiceFileUpload}
              />
              {invoiceForm.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {invoiceForm.attachments.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[12px]">
                      <FileCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                      <span className="text-[#1C1917] truncate max-w-[150px]">{invoiceUploadName || `附件${idx + 1}`}</span>
                      <button
                        type="button"
                        className="text-[#78716C] hover:text-[#78716C]"
                        onClick={() => setInvoiceForm(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="ios-btn ios-btn-secondary w-full"
                disabled={invoiceUploading}
                onClick={() => invoiceFileRef.current?.click()}
              >
                <Upload className="w-4 h-4" />
                {invoiceUploading ? "上传中..." : "选择发票扫描件上传"}
              </button>
              <p className="text-[12px] text-[#78716C] mt-1">
                支持 PDF、JPG、PNG、OFD 格式
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4] mt-2">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowInvoiceModal(false)}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={handleInvoiceSubmit}
              disabled={invoiceSaving}
            >
              {invoiceSaving ? "提交中..." : "确认开票"}
            </button>
          </div>
        </div>
      </Modal>

      <input
        ref={archiveFileRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setArchiveUploading(true);
          try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            const json = await res.json();
            if (res.ok) {
              setArchiveFiles(prev => [...prev, json.url]);
            }
          } catch {
            // 上传失败
          } finally {
            setArchiveUploading(false);
            if (archiveFileRef.current) archiveFileRef.current.value = "";
          }
        }}
      />

      <Modal
        isOpen={!!archiveContract}
        onClose={() => setArchiveContract(null)}
        title="合同归档"
        maxWidth="480px"
      >
        {archiveContract && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#FAFAF9]">
              <p className="text-[13px] text-[#78716C] mb-1">合同编号</p>
              <p className="text-[15px] font-bold text-[#1C1917]">{archiveContract.contractNo}</p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                上传盖章扫描件 <span className="text-[#78716C]">*</span>
              </label>
              {archiveFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {archiveFiles.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[12px]">
                      <FileCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#1C1917] hover:underline truncate max-w-[150px]">
                        {url.split("/").pop() || `文件${idx + 1}`}
                      </a>
                      <button
                        type="button"
                        className="text-[#78716C] hover:text-[#78716C]"
                        onClick={() => setArchiveFiles(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="ios-btn ios-btn-secondary w-full"
                disabled={archiveUploading}
                onClick={() => archiveFileRef.current?.click()}
              >
                <Upload className="w-4 h-4" />
                {archiveUploading ? "上传中..." : "选择盖章扫描件上传"}
              </button>
              <p className="text-[12px] text-[#78716C] mt-1">
                支持 PDF、JPG、PNG 格式，至少上传1个文件
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="ios-btn ios-btn-secondary"
                onClick={() => setArchiveContract(null)}
              >
                取消
              </button>
              <button
                className="ios-btn !bg-[#1C1917] !text-white text-sm hover:!bg-[#0066DD] disabled:opacity-50 flex items-center gap-1"
                disabled={archiveFiles.length === 0 || archiveSaving}
                onClick={async () => {
                  if (archiveFiles.length === 0) {
                    alert("请上传至少1个盖章扫描件");
                    return;
                  }
                  setArchiveSaving(true);
                  try {
                    const res = await fetch(`/api/income-contracts/${archiveContract.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        status: "合同归档",
                        archivedUrl: JSON.stringify(archiveFiles),
                      }),
                    });
                    if (res.ok) {
                      setArchiveContract(null);
                      fetchContracts();
                    } else {
                      const json = await res.json();
                      alert(json.error || "归档失败");
                    }
                  } catch {
                    alert("网络错误");
                  } finally {
                    setArchiveSaving(false);
                  }
                }}
              >
                {archiveSaving ? "归档中..." : "确认归档"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

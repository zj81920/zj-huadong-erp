"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
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
import AdminStatusOverride from "@/components/AdminStatusOverride";
import ProjectPicker from "@/components/ProjectPicker";
import { ApprovalTimeline } from "@/components/ApprovalComponents";
import { useAuth } from "@/contexts/AuthContext";
import { useFlowConfigured } from "@/hooks/useFlowConfigured";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { BatchDeleteBar } from "@/components/BatchDeleteBar";

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
  project: { id: string; projectCode: string; name: string; status: string } | null;
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
  archivedUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  supplier: Supplier | null;
  project: ProjectItem | null;
  settledAmount: string | null;
  invoicedAmount: string | null;
  settlementStatus: string;
  items?: {
    id: string;
    materialName: string;
    spec: string | null;
    unit: string | null;
    quantity: number | null;
    unitPrice: number | null;
    totalPrice: number | null;
  }[];
  deliveryReceipts?: {
    id: string;
    deliveryDate: string;
    receivedQuantity: string;
    deliveryAmount: string | null;
    acceptedAmount: string | null;
    inspectionResult: string;
    receiptStatus: string;
    invoiceMatched: boolean;
  }[];
  inquiry?: {
    id: string;
    purchaseRequest: {
      id: string;
      requestNo: string;
      items: {
        id: string;
        materialName: string;
        spec: string | null;
        unit: string | null;
        quantity: number | null;
      }[];
    };
  } | null;
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
  draftFiles: string[];
  taxRate: string;
  pricingMethod: string;
  contractSummary: string;
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
  draftFiles: [],
  taxRate: "",
  pricingMethod: "",
  contractSummary: "",
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
  审批中: [{ label: "前往审批中心", nextStatus: "" }],
  已批准: [{ label: "合同归档", nextStatus: "合同归档" }],
};

const contractTypes = ["项目采购", "设计外包", "其他", "公司行政采购"];

export default function ExpenseContractsPage() {
  const { user } = useAuth();
  const { configured: flowConfigured } = useFlowConfigured("expense_contract");
  const isAdminUser = user?.username === "admin";
  const searchParams = useSearchParams();
  const fromInquiryId = searchParams.get("fromInquiry");

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

  const [archiveContract, setArchiveContract] = useState<ExpenseContract | null>(null);
  const [archiveFiles, setArchiveFiles] = useState<string[]>([]);
  const [archiveUploading, setArchiveUploading] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const archiveFileRef = useRef<HTMLInputElement>(null);

  const [showDetail, setShowDetail] = useState(false);
  const [detailContract, setDetailContract] =
    useState<ExpenseContract | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [projectLeads, setProjectLeads] = useState<ProjectLeadItem[]>([]);

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
    sellerName: "",
    sellerTaxNo: "",
    remark: "",
    attachments: [] as string[],
  });
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const invoiceFileRef = useRef<HTMLInputElement>(null);
  const [invoiceUploading, setInvoiceUploading] = useState(false);
  const [invoiceUploadName, setInvoiceUploadName] = useState("");

  const [uploading, setUploading] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const draftFileRef = useRef<HTMLInputElement>(null);

  const [approvalInstance, setApprovalInstance] = useState<any>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);

  const { toggleSelect, selectAll, clearSelection, isAllSelected, selectedCount, isSelected } = useBatchSelection(contracts.map((d) => d.id));

  const fetchApprovalInstance = useCallback(async (instanceId: string) => {
    setApprovalLoading(true);
    try {
      const res = await fetch(`/api/approval-instances/${instanceId}`);
      if (res.ok) {
        const json = await res.json();
        setApprovalInstance(json.data);
      } else {
        setApprovalInstance(null);
      }
    } catch {
      setApprovalInstance(null);
    } finally {
      setApprovalLoading(false);
    }
  }, []);

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
        const res = await fetch("/api/expense-contracts?mode=available-inquiries");
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

  useEffect(() => {
    if (!fromInquiryId) return;

    const autoFillFromInquiry = async () => {
      try {
        const res = await fetch(`/api/inquiries/${fromInquiryId}`);
        if (!res.ok) return;
        const json = await res.json();
        const inquiry = json.data;

        if (!inquiry || inquiry.status !== "已批准") return;

        const linkedContract = await fetch(`/api/expense-contracts?search=&pageSize=200`);
        if (linkedContract.ok) {
          const lcJson = await linkedContract.json();
          const alreadyLinked = (lcJson.data || []).some(
            (c: ExpenseContract & { inquiryId?: string }) => c.inquiryId === fromInquiryId
          );
          if (alreadyLinked) return;
        }

        const contractNo = generateContractNo();

        let totalFromQuote = 0;
        if (inquiry.supplierQuotes && inquiry.supplierQuotes.length > 0) {
          const confirmedQuote = inquiry.supplierQuotes.find(
            (sq: { supplierId: string; round: number }) =>
              sq.supplierId === inquiry.confirmedSupplierId && sq.round === inquiry.confirmedRound
          );
          if (confirmedQuote) {
            totalFromQuote = confirmedQuote.items?.reduce(
              (sum: number, qi: { totalPrice?: number | null }) => sum + (qi.totalPrice ? Number(qi.totalPrice) : 0),
              0
            ) || confirmedQuote.totalPrice || 0;
          }
        }

        setEditingContract(null);
        setForm({
          contractNo,
          projectSourceId: inquiry.projectSourceId || "",
          supplierId: inquiry.confirmedSupplierId || "",
          inquiryId: inquiry.id,
          contractType: "项目采购",
          totalAmount: totalFromQuote > 0 ? String(totalFromQuote) : "",
          paymentTerms: "",
          signedDate: new Date().toISOString().split("T")[0],
          scannedUrl: "",
          draftFiles: [],
          taxRate: "",
          pricingMethod: "",
          contractSummary: "",
        });
        setFormError("");
        setShowModal(true);
      } catch {}
    };

    const timer = setTimeout(autoFillFromInquiry, 500);
    return () => clearTimeout(timer);
  }, [fromInquiryId]);

  const generateContractNo = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const unique = Date.now().toString(36).slice(-3).toUpperCase();
    return `ZC-${y}${m}${d}-${unique}`;
  };

  const handleOpenCreate = () => {
    setEditingContract(null);
    setForm({ ...emptyForm, contractNo: generateContractNo() });
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (contract: ExpenseContract) => {
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
      supplierId: contract.supplierId || "",
      inquiryId: (contract as ExpenseContract & { inquiryId?: string }).inquiryId || "",
      contractType: contract.contractType || "其他",
      totalAmount: contract.totalAmount,
      paymentTerms: contract.paymentTerms || "",
      signedDate: contract.signedDate
        ? new Date(contract.signedDate).toISOString().split("T")[0]
        : "",
      scannedUrl: contract.scannedUrl || "",
      draftFiles,
      taxRate: (contract as ExpenseContract & { taxRate?: string }).taxRate || "",
      pricingMethod: (contract as ExpenseContract & { pricingMethod?: string }).pricingMethod || "",
      contractSummary: (contract as ExpenseContract & { contractSummary?: string }).contractSummary || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleOpenDetail = async (contract: ExpenseContract) => {
    setDetailLoading(true);
    setShowDetail(true);
    setContractInvoices([]);
    setApprovalInstance(null);
    try {
      const res = await fetch(`/api/expense-contracts/${contract.id}`);
      if (res.ok) {
        const json = await res.json();
        setDetailContract(json.data);
        fetchContractInvoices(json.data.id);
        if (json.data.approvalInstanceId) {
          fetchApprovalInstance(json.data.approvalInstanceId);
        }
      } else {
        setDetailContract(contract);
        fetchContractInvoices(contract.id);
        if (contract.approvalInstanceId) {
          fetchApprovalInstance(contract.approvalInstanceId);
        }
      }
    } catch {
      setDetailContract(contract);
      fetchContractInvoices(contract.id);
      if (contract.approvalInstanceId) {
        fetchApprovalInstance(contract.approvalInstanceId);
      }
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
        scannedUrl: form.draftFiles.length > 0 ? JSON.stringify(form.draftFiles) : null,
        taxRate: form.taxRate || null,
        pricingMethod: form.pricingMethod || null,
        contractSummary: form.contractSummary || null,
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
    if (deleteConfirm.status !== "草稿" && deleteConfirm.status !== "已驳回" && !isAdminUser) {
      alert("该记录已进入审批流程，仅管理员可删除");
      setDeleteConfirm(null);
      return;
    }

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

  const handleSubmitApproval = async (contract: ExpenseContract) => {
    try {
      const res = await fetch("/api/approval-instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: "expense_contract",
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

  const fetchContractInvoices = async (contractId: string) => {
    try {
      const res = await fetch(`/api/invoices?sourceType=expense_contract&sourceId=${contractId}&pageSize=200`);
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
          sellerName: invoiceForm.sellerName || null,
          sellerTaxNo: invoiceForm.sellerTaxNo || null,
          remark: invoiceForm.remark || null,
          attachments: invoiceForm.attachments.length > 0 ? invoiceForm.attachments : null,
          sourceType: "expense_contract",
          sourceId: detailContract.id,
          invoiceCategory: "收票",
          projectSourceId: detailContract.projectSourceId || null,
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
          sellerName: "",
          sellerTaxNo: "",
          remark: "",
          attachments: [],
        });
        setInvoiceUploadName("");
        fetchContractInvoices(detailContract.id);
      } else {
        setInvoiceError(json.error || "发票登记失败");
      }
    } catch {
      setInvoiceError("网络错误，请重试");
    } finally {
      setInvoiceSaving(false);
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
            disabled={!flowConfigured}
            title={flowConfigured ? undefined : "请先在流程设置中配置支出合同审批流程"}
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
                  {isAdminUser && <th className="w-10"><input type="checkbox" className="ios-checkbox" checked={isAllSelected} onChange={() => isAllSelected ? clearSelection() : selectAll()} /></th>}
                  <th>合同编号</th>
                  <th>关联项目</th>
                  <th>供应商</th>
                  <th>合同类型</th>
                  <th>合同金额</th>
                  <th>签订日期</th>
                  <th>状态</th>
                  <th>操作</th>
                  <th>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr key={contract.id} className={isSelected(contract.id) ? "bg-[#007AFF]/5" : ""}>
                    {isAdminUser && <td className="w-10"><input type="checkbox" className="ios-checkbox" checked={isSelected(contract.id)} onChange={() => toggleSelect(contract.id)} /></td>}
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
                      <AdminStatusOverride
                        businessType="expense_contract"
                        businessId={contract.id}
                        currentStatus={contract.status}
                        onStatusChanged={(newStatus) => {
                          setContracts(prev => prev.map(r => r.id === contract.id ? { ...r, status: newStatus } : r));
                        }}
                      />
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
                        {(contract.status === "草稿" || contract.status === "已驳回" || isAdminUser) && (
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
                    <td className="text-[#86868B] text-[12px] whitespace-nowrap">
                      {contract.lastModifiedBy && (
                        <span>{contract.lastModifiedBy}</span>
                      )}
                      <span className="block text-[11px]">{formatDate(contract.updatedAt)}</span>
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

        {isAdminUser && <BatchDeleteBar businessType="expense_contract" selectedIds={contracts.filter(d => isSelected(d.id)).map(d => d.id)} onDeleteSuccess={fetchContracts} onClear={clearSelection} />}
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
              <ProjectPicker
                projectLeads={projectLeads}
                value={form.projectSourceId}
                onChange={(id) => setForm((prev) => ({ ...prev, projectSourceId: id }))}
                label="关联项目"
                placeholder="不关联（公司级）"
              />
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

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
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
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
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
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
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
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#007AFF] hover:underline truncate max-w-[150px]">
                      {url.split("/").pop() || `文件${idx + 1}`}
                    </a>
                    <button
                      type="button"
                      className="text-[#86868B] hover:text-[#FF3B30]"
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
            <p className="text-[12px] text-[#86868B] mt-1">
              支持 PDF、DOC、DOCX、JPG、PNG 格式，上传后自动AI分析
            </p>
          </div>

          {aiAnalyzing && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#007AFF]/5 text-[#007AFF] text-[13px]">
              <div className="w-4 h-4 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
              AI 正在分析合同内容...
            </div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
              合同概要 {aiAnalyzing && <span className="text-[#86868B] font-normal">（AI生成中...）</span>}
            </label>
            <textarea
              className="ios-input min-h-[80px] resize-none"
              placeholder="上传合同草稿后AI自动生成，也可手动输入（不超过300字）"
              value={form.contractSummary}
              onChange={(e) => updateForm("contractSummary", e.target.value)}
              maxLength={300}
            />
            <p className="text-[11px] text-[#86868B] mt-1 text-right">{form.contractSummary.length}/300</p>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
              付款条款 {aiAnalyzing && <span className="text-[#86868B] font-normal">（AI生成中...）</span>}
            </label>
            <textarea
              className="ios-input min-h-[60px] resize-none"
              placeholder="上传合同草稿后AI自动生成，也可手动输入"
              value={form.paymentTerms}
              onChange={(e) => updateForm("paymentTerms", e.target.value)}
            />
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
                  <p className="text-[12px] text-[#86868B] mb-1">归档扫描件</p>
                  <div className="flex flex-wrap gap-2">
                    {files.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[12px] text-[#007AFF] hover:underline"
                      >
                        <FileCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
                        {url.split("/").pop() || `扫描件${idx + 1}`}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}

            {detailContract.inquiry && (
              <div className="p-3 rounded-xl bg-[#F5F5F7]">
                <p className="text-[12px] text-[#86868B] mb-2">关联询价单</p>
                <div className="text-[13px] mb-2">
                  <span className="text-[#86868B]">采购需求：</span>
                  <span className="text-[#1D1D1F] font-medium">
                    {detailContract.inquiry.purchaseRequest.requestNo}
                  </span>
                  <span className="text-[#86868B] ml-3">
                    ({detailContract.inquiry.purchaseRequest.items?.length || 0}项物资)
                  </span>
                </div>
                {detailContract.items && detailContract.items.length > 0 ? (
                  <table className="ios-table text-[12px]">
                    <thead>
                      <tr>
                        <th>物资名称</th>
                        <th>规格型号</th>
                        <th>数量</th>
                        <th>单位</th>
                        <th>单价(元)</th>
                        <th>明细总价(元)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailContract.items.map((item) => (
                        <tr key={item.id}>
                          <td className="font-medium">{item.materialName}</td>
                          <td>{item.spec || "-"}</td>
                          <td>{item.quantity ?? "-"}</td>
                          <td>{item.unit || "-"}</td>
                          <td className="font-mono">
                            {item.unitPrice != null ? `¥${Number(item.unitPrice).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}` : "-"}
                          </td>
                          <td className="font-mono font-semibold text-[#007AFF]">
                            {item.totalPrice != null ? `¥${Number(item.totalPrice).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  detailContract.inquiry.purchaseRequest.items && detailContract.inquiry.purchaseRequest.items.length > 0 && (
                    <table className="ios-table text-[12px]">
                      <thead><tr><th>物资名称</th><th>规格型号</th><th>数量</th><th>单位</th></tr></thead>
                      <tbody>
                        {detailContract.inquiry.purchaseRequest.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.materialName}</td>
                            <td>{item.spec || "-"}</td>
                            <td>{item.quantity || "-"}</td>
                            <td>{item.unit || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#86868B]" />
                  <p className="text-[13px] font-semibold text-[#1D1D1F]">
                    发票登记 ({contractInvoices.length})
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
                        sellerName: detailContract.supplier?.name || "",
                        sellerTaxNo: "",
                        remark: "",
                        attachments: [],
                      });
                      setInvoiceUploadName("");
                      setShowInvoiceModal(true);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    登记发票
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
                          <th>状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contractInvoices.map((inv) => (
                          <tr key={inv.id}>
                            <td className="font-medium font-mono">{inv.invoiceNo}</td>
                            <td>
                              <span className="ios-badge ios-badge-blue text-[11px]">{inv.invoiceType}</span>
                            </td>
                            <td className="font-mono font-semibold text-[#007AFF]">
                              {parseFloat(inv.totalAmount || inv.amount || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-[#86868B]">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("zh-CN") : "-"}</td>
                            <td>
                              <span className={`ios-badge ${inv.status === "verified" ? "ios-badge-green" : inv.status === "rejected" ? "ios-badge-red" : "ios-badge-gray"}`}>
                                {inv.status === "verified" ? "已核验" : inv.status === "rejected" ? "已退回" : "待核验"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3 p-3 rounded-xl bg-[#F5F5F7]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] text-[#86868B]">已收票金额 / 合同总额</span>
                        <span className="text-[13px] font-semibold text-[#1D1D1F]">
                          ¥{contractInvoices.reduce((sum, inv) => sum + (parseFloat(inv.totalAmount || inv.amount || 0)), 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                          {" / "}
                          {formatAmount(detailContract.totalAmount)}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#E5E5EA] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#007AFF] transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (contractInvoices.reduce((sum, inv) => sum + (parseFloat(inv.totalAmount || inv.amount || 0)), 0) / Math.max(0.01, parseFloat(detailContract.totalAmount || "0"))) * 100).toFixed(1)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-[#86868B] text-[13px] rounded-xl bg-[#F5F5F7]">
                    暂无发票记录
                  </div>
                )}
              </div>

            {detailContract.deliveryReceipts && detailContract.deliveryReceipts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileCheck className="w-4 h-4 text-[#86868B]" />
                  <p className="text-[13px] font-semibold text-[#1D1D1F]">
                    到货验收记录 ({detailContract.deliveryReceipts.length})
                  </p>
                </div>
                <div className="space-y-2">
                  {detailContract.deliveryReceipts.map((receipt) => (
                    <div key={receipt.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#F5F5F7]">
                      <div className="text-[13px]">
                        <span className="text-[#1D1D1F] font-medium">{receipt.receivedQuantity}</span>
                        {receipt.deliveryAmount && <span className="text-[#007AFF] ml-2 font-semibold">¥{parseFloat(receipt.deliveryAmount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</span>}
                        <span className="text-[#86868B] ml-2">{new Date(receipt.deliveryDate).toLocaleDateString("zh-CN")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="ios-badge ios-badge-gray text-[11px]">{receipt.receiptStatus}</span>
                        <span className="ios-badge ios-badge-gray text-[11px]">{receipt.inspectionResult}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailContract.contractType === "项目采购" && (
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-[#F5F5F7]">
                <div>
                  <p className="text-[12px] text-[#86868B] mb-0.5">合同金额</p>
                  <p className="text-[14px] font-bold text-[#1D1D1F]">{formatAmount(detailContract.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-[12px] text-[#86868B] mb-0.5">已结算金额</p>
                  <p className="text-[14px] font-bold text-[#007AFF]">{formatAmount(detailContract.settledAmount || "0")}</p>
                </div>
                <div>
                  <p className="text-[12px] text-[#86868B] mb-0.5">结算状态</p>
                  <p className="text-[14px]">
                    <span className={`ios-badge ${detailContract.settlementStatus === "settled" ? "ios-badge-green" : detailContract.settlementStatus === "partial" ? "ios-badge-orange" : "ios-badge-gray"}`}>
                      {detailContract.settlementStatus === "settled" ? "已结清" : detailContract.settlementStatus === "partial" ? "部分结算" : "未结算"}
                    </span>
                  </p>
                </div>
              </div>
            )}

            <ApprovalTimeline instance={approvalInstance} loading={approvalLoading} />
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

      <Modal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        title="登记发票"
        maxWidth="640px"
      >
        <div className="space-y-4">
          {invoiceError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">
              {invoiceError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                发票号码 <span className="text-[#FF3B30]">*</span>
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
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">发票代码</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入发票代码"
                value={invoiceForm.invoiceCode}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoiceCode: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">发票类型</label>
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
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">开票日期</label>
              <input
                type="date"
                className="ios-input"
                value={invoiceForm.invoiceDate}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                不含税金额 <span className="text-[#FF3B30]">*</span>
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
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">税率</label>
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
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">税额（自动计算）</label>
              <input
                type="text"
                className="ios-input bg-[#F5F5F7]"
                value={invoiceForm.taxAmount ? `¥${invoiceForm.taxAmount}` : ""}
                readOnly
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">价税合计（自动计算）</label>
              <input
                type="text"
                className="ios-input bg-[#F5F5F7] font-semibold text-[#007AFF]"
                value={invoiceForm.totalAmount ? `¥${invoiceForm.totalAmount}` : ""}
                readOnly
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">销方名称</label>
              <input
                type="text"
                className="ios-input"
                placeholder="默认从供应商带入"
                value={invoiceForm.sellerName}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, sellerName: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">销方税号</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入纳税人识别号"
                value={invoiceForm.sellerTaxNo}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, sellerTaxNo: e.target.value }))}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">备注</label>
              <textarea
                className="ios-input min-h-[60px] resize-none"
                placeholder="备注信息"
                value={invoiceForm.remark}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, remark: e.target.value }))}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">发票扫描件</label>
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
                      <span className="text-[#1D1D1F] truncate max-w-[150px]">{invoiceUploadName || `附件${idx + 1}`}</span>
                      <button
                        type="button"
                        className="text-[#86868B] hover:text-[#FF3B30]"
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
              <p className="text-[12px] text-[#86868B] mt-1">
                支持 PDF、JPG、PNG、OFD 格式
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0] mt-2">
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
              {invoiceSaving ? "提交中..." : "确认登记"}
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
            <div className="p-4 rounded-xl bg-[#F5F5F7]">
              <p className="text-[13px] text-[#86868B] mb-1">合同编号</p>
              <p className="text-[15px] font-bold text-[#1D1D1F]">{archiveContract.contractNo}</p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                上传盖章扫描件 <span className="text-[#FF3B30]">*</span>
              </label>
              {archiveFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {archiveFiles.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[12px]">
                      <FileCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#007AFF] hover:underline truncate max-w-[150px]">
                        {url.split("/").pop() || `文件${idx + 1}`}
                      </a>
                      <button
                        type="button"
                        className="text-[#86868B] hover:text-[#FF3B30]"
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
              <p className="text-[12px] text-[#86868B] mt-1">
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
                className="ios-btn !bg-[#007AFF] !text-white text-sm hover:!bg-[#0066DD] disabled:opacity-50 flex items-center gap-1"
                disabled={archiveFiles.length === 0 || archiveSaving}
                onClick={async () => {
                  if (archiveFiles.length === 0) {
                    alert("请上传至少1个盖章扫描件");
                    return;
                  }
                  setArchiveSaving(true);
                  try {
                    const res = await fetch(`/api/expense-contracts/${archiveContract.id}`, {
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

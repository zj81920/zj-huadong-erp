"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import CounterpartySearch from "@/components/CounterpartySearch";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Wallet,
  ArrowDownCircle,
  DollarSign,
  Landmark,
  FileText,
  CreditCard,
  ChevronRight,
  Eye,
  X,
  MinusCircle,
  Building2,
  Paperclip,
  RotateCcw,
} from "lucide-react";
import Modal from "@/components/Modal";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { BatchDeleteBar } from "@/components/BatchDeleteBar";
import ProjectPicker from "@/components/ProjectPicker";
import { ApprovalTimeline } from "@/components/ApprovalComponents";
import { deleteUploadedFile } from "@/lib/upload-helpers";
import { useFlowConfigured } from "@/hooks/useFlowConfigured";
import { getUserModulePerms } from "@/lib/types/permissions";
import { canDeleteFrontend, canEditFrontend } from "@/lib/types/permissions";
import { usePagination } from "@/hooks/usePagination";
import PaginationBar from "@/components/PaginationBar";
import { getRowStatusClass } from "@/lib/status-colors";
import { NonContractExpenseDetailCard, LendingOutDetailCard, ExpenseReportDetailCard, SalaryPaymentDetailCard, BorrowingReturnDetailCard } from '@/components/detail-cards';

interface ExpenseContract {
  id: string;
  contractNo: string;
  projectSourceId: string | null;
  supplierId: string | null;
  totalAmount: string;
  contractType: string;
  status: string;
  supplier: { id: string; name: string; bankName: string | null; bankAccount: string | null } | null;
  project: { name: string; projectSourceId: string } | null;
  invoicedAmount: string | null;
}

interface OutsourcingSource {
  id: string;
  targetName: string;
  type: string;
  taskDescription: string;
  amount: number;
  acceptanceStatus: string;
  approvalStatus: string;
  project: { name: string; projectSourceId: string } | null;
}

interface Payable {
  id: string;
  sourceType: string;
  sourceId: string;
  projectSourceId: string | null;
  dueDate: string;
  amount: number;
  paidAmount: number;
  invoicedAmount: number;
  status: string;
  project: { name: string; projectSourceId: string } | null;
  sourceContract: ExpenseContract | null;
  sourceOutsourcing: OutsourcingSource | null;
}

interface PaymentApplication {
  id: string;
  payableId: string;
  applicantId: string;
  amount: number;
  approvalStatus: string;
  paymentReason: string | null;
  createdAt: string;
  approvalInstanceId: string | null;
  payable: Payable;
  applicant: { id: string; realName: string };
  paymentVouchers: {
    id: string;
    amount: number;
    paymentDate: string;
    bankAccount: string | null;
    paymentMethod: string | null;
    paymentReason: string | null;
    remark: string | null;
  }[];
}

interface PaymentVoucher {
  id: string;
  payableId: string;
  amount: number;
  paymentDate: string;
  bankAccount: string | null;
  payable: Payable;
}

interface NonContractExpense {
  id: string;
  projectSourceId: string | null;
  amount: number;
  transactionDate: string;
  counterparty: string | null;
  counterpartyBankName?: string | null;
  counterpartyBankAccount?: string | null;
  description: string | null;
  status: string;
  approvalInstanceId: string | null;
  invoicedAmount?: number;
  invoiceStatus?: string;
  project: { name: string } | null;
  bankAccountId: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  bankAccount: { id: string; accountName: string; bankName: string; accountNo: string } | null;
  createdById: string | null;
}

interface LendingOut {
  id: string;
  lendingType: string;
  projectSourceId: string | null;
  biddingId: string | null;
  borrowerName: string;
  amount: number;
  returnedAmount: number;
  remainingAmount: number;
  lendingDate: string;
  expectedReturnDate: string | null;
  description: string | null;
  status: string;
  approvalInstanceId: string | null;
  returns?: { id: string; amount: number; returnDate: string; remark: string | null }[];
  bankAccountId: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  bankAccount: { id: string; accountName: string; bankName: string; accountNo: string } | null;
  createdById: string | null;
}

interface LendingReturn {
  id: string;
  lendingId: string;
  amount: number;
  returnDate: string;
  remark: string | null;
}

interface Bidding {
  id: string;
  projectSourceId: string;
  bondAmount: number | null;
  bidResult: string | null;
  projectLead: { projectName: string };
}

interface ExpenseReport {
  id: string;
  projectSourceId: string | null;
  applicantId: string;
  expenseType: string;
  amount: number;
  description: string | null;
  status: string;
  approvalInstanceId: string | null;
  loanOffsetAmount: number;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  applicant: { id: string; realName: string };
  project: { name: string } | null;
  items: {
    id: string;
    expenseType: string;
    amount: number;
    description: string | null;
    projectSourceId: string | null;
    invoiceAttachments: string[];
    project?: { name: string } | null;
  }[];
  bankAccountId: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  bankAccount: { id: string; accountName: string; bankName: string; accountNo: string } | null;
  createdById: string | null;
}

interface SalaryBatchItem {
  id: string;
  employeeId: string;
  baseSalary: number;
  bonus: number;
  allowance: number;
  grossSalary: number;
  socialInsurancePersonal: number;
  socialInsuranceCompany: number;
  housingFundPersonal: number;
  housingFundCompany: number;
  incomeTax: number;
  otherDeduction: number;
  totalDeduction: number;
  netSalary: number;
  remark: string | null;
  employee: { id: string; realName: string; username: string };
}

interface SalaryBatch {
  id: string;
  batchNo: string;
  period: string;
  title: string;
  employeeCount: number;
  totalGrossSalary: number;
  totalSocialInsurancePersonal: number;
  totalSocialInsuranceCompany: number;
  totalHousingFundPersonal: number;
  totalHousingFundCompany: number;
  totalIncomeTax: number;
  totalOtherDeduction: number;
  totalNetSalary: number;
  totalBankOutflow: number;
  status: string;
  approvalInstanceId: string | null;
  bankAccountId: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string | null;
  items: SalaryBatchItem[];
  bankAccount: { id: string; accountName: string; bankName: string; accountNo: string } | null;
  createdById: string | null;
}

interface BorrowingReturnApplication {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  sourceAmount: string;
  returnAmount: string;
  returnDate: string;
  remark: string | null;
  status: string;
  approvalInstanceId: string | null;
  executedAt: string | null;
  createdAt: string;
  bankAccountId: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  bankAccount: { id: string; accountName: string; bankName: string; accountNo: string } | null;
  createdById: string | null;
}

interface User {
  id: string;
  realName: string;
  username: string;
}

interface ProjectLeadItem {
  projectSourceId: string;
  projectName: string;
  customerId: string;
  customer: { id: string; name: string };
  currentStatus: string;
  project: { id: string; projectCode: string; name: string; status: string } | null;
}

interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNo: string;
  accountType: string;
  isActive: boolean;
}

type TabType = "contractExpense" | "otherExpense" | "lendingOut" | "expenseReport" | "salaryPayment" | "borrowingReturn";

type ModalType =
  | "paymentApplication"
  | "otherExpenseForm"
  | "lendingOutForm"
  | "lendingReturnForm"
  | "expenseReportForm"
  | "salaryBatchEdit"
  | "deleteConfirm"
  | "statusFlow"
  | "detail"
  | "borrowingReturnDetail"
  | "otherExpenseDetail"
  | "lendingOutDetail"
  | "expenseReportDetail"
  | "salaryPaymentDetail"
  | "supplementInvoice"
  | null;

const sourceTypeMap: Record<string, string> = {
  expense_contract: "支出合同",
  expense_report: "费用报销",
  loan_request: "备用金借款",
  income_contract: "收入合同",
  non_contract_income: "其他收入",
  non_contract_expense: "其他支出",
};

const appStatusConfig: Record<string, { color: string; label: string }> = {
  草稿: { color: "ios-badge-gray", label: "草稿" },
  审批中: { color: "ios-badge-orange", label: "审批中" },
  已批准: { color: "ios-badge-green", label: "已批准" },
  已驳回: { color: "ios-badge-red", label: "已驳回" },
  已付款: { color: "ios-badge-blue", label: "已付款" },
  未还清: { color: "ios-badge-orange", label: "未还清" },
  已还清: { color: "ios-badge-green", label: "已还清" },
  未付: { color: "ios-badge-orange", label: "未付款" },
  部分付款: { color: "ios-badge-blue", label: "部分付款" },
  已付: { color: "ios-badge-green", label: "已付清" },
};

const appStatusFlow: Record<string, string[]> = {
  草稿: ["审批中"],
  审批中: [],
  已批准: [],
  已驳回: [],
};

const lendingStatusFlow: Record<string, string[]> = {
  草稿: ["审批中"],
  审批中: [],
  已批准: [],
  已驳回: [],
  未还清: [],
  已还清: [],
};

const lendingTypeOptions = ["投标保证金", "押金", "备用金", "其他借出款"];
const expenseItemTypes = ["差旅费", "交通费", "办公用品", "招待费", "其他"];

const emptyPaymentAppForm = {
  payableId: "",
  applicantId: "",
  amount: "",
  paymentReason: "",
  paymentMethod: "",
  bankAccount: "",
  remark: "",
};

const emptyOtherExpenseForm = {
  amount: "",
  counterparty: "",
  counterpartyBankName: "",
  counterpartyBankAccount: "",
  transactionDate: "",
  description: "",
  projectSourceId: "",
  invoiceStatus: "无需开票",
};

const emptyInlineInvoiceForm = {
  invoiceNo: "",
  invoiceDate: "",
  amount: "",
  taxRate: "6",
  attachments: [] as string[],
};

const emptyLendingOutForm = {
  lendingType: "",
  biddingId: "",
  borrowerName: "",
  borrowerBankName: "",
  borrowerBankAccount: "",
  amount: "",
  lendingDate: "",
  expectedReturnDate: "",
  description: "",
};

const emptyLendingReturnForm = {
  lendingId: "",
  amount: "",
  returnDate: "",
  remark: "",
};

const emptyExpenseItem = {
  expenseType: "",
  amount: "",
  description: "",
  relateProject: false,
  projectSourceId: "",
  invoiceAttachments: [] as string[],
};

const emptyExpenseReportForm = {
  applicantId: "",
  items: [{ ...emptyExpenseItem }],
};

export default function FinanceExpensePage() {
  const { user: currentUser, modulePermissions } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("contractExpense");

  const [payables, setPayables] = useState<Payable[]>([]);
  const [paymentApplications, setPaymentApplications] = useState<PaymentApplication[]>([]);
  const [paymentVouchers, setPaymentVouchers] = useState<PaymentVoucher[]>([]);
  const [nonContractExpenses, setNonContractExpenses] = useState<NonContractExpense[]>([]);
  const [lendingOuts, setLendingOuts] = useState<LendingOut[]>([]);
  const [expenseReports, setExpenseReports] = useState<ExpenseReport[]>([]);
  const [salaryBatches, setSalaryBatches] = useState<SalaryBatch[]>([]);
  const [borrowingReturnApps, setBorrowingReturnApps] = useState<BorrowingReturnApplication[]>([]);

  const [detailBorrowingReturnApp, setDetailBorrowingReturnApp] = useState<BorrowingReturnApplication | null>(null);
  const [detailOtherExpense, setDetailOtherExpense] = useState<NonContractExpense | null>(null);
  const [detailLendingOut, setDetailLendingOut] = useState<LendingOut | null>(null);
  const [detailExpenseReport, setDetailExpenseReport] = useState<ExpenseReport | null>(null);
  const [salaryBatchDetail, setSalaryBatchDetail] = useState<SalaryBatch | null>(null);
  const [approvalInstance, setApprovalInstance] = useState<any>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);

  const { configured: nonContractExpenseFlowConfigured } = useFlowConfigured("non_contract_expense");
  const { configured: paymentAppFlowConfigured } = useFlowConfigured("payment_application");
  const { configured: lendingOutFlowConfigured } = useFlowConfigured("lending_out");
  const { configured: expenseReportFlowConfigured } = useFlowConfigured("expense_report");
  const { configured: salaryPaymentFlowConfigured } = useFlowConfigured("salary_payment");
  const { configured: borrowingReturnFlowConfigured } = useFlowConfigured("borrowing_return_application");

  const flowConfigMap: Record<string, boolean> = {
    contractExpense: paymentAppFlowConfigured,
    otherExpense: nonContractExpenseFlowConfigured,
    lendingOut: lendingOutFlowConfigured,
    expenseReport: expenseReportFlowConfigured,
    salaryPayment: salaryPaymentFlowConfigured,
    borrowingReturn: borrowingReturnFlowConfigured,
  };

  const [users, setUsers] = useState<User[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [projectLeads, setProjectLeads] = useState<ProjectLeadItem[]>([]);
  const [biddings, setBiddings] = useState<Bidding[]>([]);

  // 每个 Tab 独立的分页实例
  const contractExpensePg = usePagination({});
  const otherExpensePg = usePagination({});
  const lendingOutPg = usePagination({});
  const expenseReportPg = usePagination({});
  const salaryPg = usePagination({});
  const borrowingReturnPg = usePagination({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalType, setModalType] = useState<ModalType>(null);
  const [editingOtherExpense, setEditingOtherExpense] = useState<NonContractExpense | null>(null);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchFormPeriod, setBatchFormPeriod] = useState("");
  const [batchFormTitle, setBatchFormTitle] = useState("");
  const [batchFormRemark, setBatchFormRemark] = useState("");
  // 新建批次时的预览明细（含 excluded 标记）
  const [batchPreviewItems, setBatchPreviewItems] = useState<(SalaryBatchItem & { excluded: boolean })[]>([]);
  const [batchPreviewLoading, setBatchPreviewLoading] = useState(false);
  const [editingBatchItems, setEditingBatchItems] = useState<SalaryBatchItem[]>([]);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);

  const [paymentAppForm, setPaymentAppForm] = useState(emptyPaymentAppForm);
  const [otherExpenseForm, setOtherExpenseForm] = useState(emptyOtherExpenseForm);
  const [hasInvoice, setHasInvoice] = useState(false);
  const [inlineInvoiceForm, setInlineInvoiceForm] = useState(emptyInlineInvoiceForm);
  const [lendingOutForm, setLendingOutForm] = useState(emptyLendingOutForm);
  const [lendingReturnForm, setLendingReturnForm] = useState(emptyLendingReturnForm);
  const [expenseReportForm, setExpenseReportForm] = useState(emptyExpenseReportForm);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; status: string; createdById?: string | null } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [returnTargetLending, setReturnTargetLending] = useState<LendingOut | null>(null);
  const [statusFlowTarget, setStatusFlowTarget] = useState<{ type: string; id: string; status: string } | null>(null);
  const [detailTarget, setDetailTarget] = useState<{ type: string; id: string } | null>(null);
  const [payableAppInstances, setPayableAppInstances] = useState<Record<string, any>>({});
  const [payableAppInstancesLoading, setPayableAppInstancesLoading] = useState(false);

  const [editingPaymentAppId, setEditingPaymentAppId] = useState<string | null>(null);
  const [editingPaymentAppForm, setEditingPaymentAppForm] = useState({ amount: "", paymentReason: "", applicantId: "" });
  const [reSubmitting, setReSubmitting] = useState(false);

  const {
    toggleSelect: toggleSelectOtherExpense,
    selectAll: selectAllOtherExpense,
    clearSelection: clearSelectionOtherExpense,
    isAllSelected: isAllSelectedOtherExpense,
    isSelected: isSelectedOtherExpense,
  } = useBatchSelection(nonContractExpenses.map((d) => d.id));

  const {
    toggleSelect: toggleSelectLendingOut,
    selectAll: selectAllLendingOut,
    clearSelection: clearSelectionLendingOut,
    isAllSelected: isAllSelectedLendingOut,
    isSelected: isSelectedLendingOut,
  } = useBatchSelection(lendingOuts.map((d) => d.id));

  const {
    toggleSelect: toggleSelectExpenseReport,
    selectAll: selectAllExpenseReport,
    clearSelection: clearSelectionExpenseReport,
    isAllSelected: isAllSelectedExpenseReport,
    isSelected: isSelectedExpenseReport,
  } = useBatchSelection(expenseReports.map((d) => d.id));

  const {
    toggleSelect: toggleSelectSalary,
    selectAll: selectAllSalary,
    clearSelection: clearSelectionSalary,
    isAllSelected: isAllSelectedSalary,
    isSelected: isSelectedSalary,
  } = useBatchSelection(salaryBatches.map((d) => d.id));

  const {
    toggleSelect: toggleSelectBorrowReturn,
    selectAll: selectAllBorrowReturn,
    clearSelection: clearSelectionBorrowReturn,
    isAllSelected: isAllSelectedBorrowReturn,
    isSelected: isSelectedBorrowReturn,
  } = useBatchSelection(borrowingReturnApps.map((d) => d.id));

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatAmount = (amount: number) => {
    return `¥${Number(amount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: string) => {
    const config = appStatusConfig[status] || appStatusConfig["草稿"];
    return <span className={`ios-badge ${config.color}`}>{config.label}</span>;
  };

  const fetchPayables = useCallback(async () => {
    setLoading(true);
    try {
      const params1 = new URLSearchParams();
      params1.set("sourceType", "expense_contract");
      params1.set("page", contractExpensePg.page.toString());
      params1.set("pageSize", contractExpensePg.pageSize.toString());
      const params2 = new URLSearchParams();
      params2.set("sourceType", "outsourcing");
      params2.set("page", contractExpensePg.page.toString());
      params2.set("pageSize", contractExpensePg.pageSize.toString());
      const [contractRes, outsourcingRes] = await Promise.all([
        fetch(`/api/payables?${params1}`),
        fetch(`/api/payables?${params2}`),
      ]);
      const contractJson = await contractRes.json();
      const outsourcingJson = await outsourcingRes.json();
      const all = [
        ...(contractRes.ok ? contractJson.data || [] : []),
        ...(outsourcingRes.ok ? outsourcingJson.data || [] : []),
      ];
      all.sort((a: Payable, b: Payable) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
      setPayables(all);
    } catch (err) {
      console.error("获取应付记录失败:", err);
    } finally {
      setLoading(false);
    }
  }, [contractExpensePg.page, contractExpensePg.pageSize]);

  const fetchPaymentApplications = useCallback(async () => {
    try {
      const res = await fetch("/api/payment-applications?pageSize=200");
      const json = await res.json();
      if (res.ok) setPaymentApplications(json.data || []);
    } catch (err) {
      console.error("获取付款申请失败:", err);
    }
  }, []);

  const fetchPaymentVouchers = useCallback(async () => {
    try {
      const res = await fetch("/api/payment-vouchers?pageSize=200");
      const json = await res.json();
      if (res.ok) setPaymentVouchers(json.data || []);
    } catch (err) {
      console.error("获取付款凭证失败:", err);
    }
  }, []);

  const fetchNonContractExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", otherExpensePg.page.toString());
      params.set("pageSize", otherExpensePg.pageSize.toString());
      const res = await fetch(`/api/non-contract-expenses?${params}`);
      const json = await res.json();
      if (res.ok) {
        setNonContractExpenses(json.data || []);
        if (json.pagination) otherExpensePg.setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取其他支出失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, otherExpensePg.page, otherExpensePg.pageSize]);

  const fetchLendingOuts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("include", "returns");
      params.set("page", lendingOutPg.page.toString());
      params.set("pageSize", lendingOutPg.pageSize.toString());
      const res = await fetch(`/api/lending-outs?${params}`);
      const json = await res.json();
      if (res.ok) {
        setLendingOuts(json.data || []);
        if (json.pagination) lendingOutPg.setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取借出款失败:", err);
    } finally {
      setLoading(false);
    }
  }, [lendingOutPg.page, lendingOutPg.pageSize]);

  const fetchBiddings = useCallback(async () => {
    try {
      const res = await fetch("/api/biddings?pageSize=200");
      const json = await res.json();
      if (res.ok) setBiddings(json.data || []);
    } catch (err) {
      console.error("获取投标记录失败:", err);
    }
  }, []);

  const fetchExpenseReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("include", "items,applicant");
      params.set("page", expenseReportPg.page.toString());
      params.set("pageSize", expenseReportPg.pageSize.toString());
      const res = await fetch(`/api/expense-reports?${params}`);
      const json = await res.json();
      if (res.ok) {
        setExpenseReports(json.data || []);
        if (json.pagination) expenseReportPg.setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取费用报销失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, expenseReportPg.page, expenseReportPg.pageSize]);

  const fetchSalaryBatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", salaryPg.page.toString());
      params.set("pageSize", salaryPg.pageSize.toString());
      const res = await fetch(`/api/salary-batches?${params}`);
      const json = await res.json();
      if (res.ok) {
        setSalaryBatches(json.data || []);
        if (json.pagination) salaryPg.setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取工资批次失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, salaryPg.page, salaryPg.pageSize]);

  const fetchBorrowingReturnApps = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", borrowingReturnPg.page.toString());
      params.set("pageSize", borrowingReturnPg.pageSize.toString());
      const res = await fetch(`/api/borrowing-return-applications?${params}`);
      const json = await res.json();
      if (res.ok) {
        setBorrowingReturnApps(json.data || []);
        if (json.pagination) borrowingReturnPg.setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取借入资金归还失败:", err);
    } finally {
      setLoading(false);
    }
  }, [borrowingReturnPg.page, borrowingReturnPg.pageSize]);

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

  const fetchReferenceData = useCallback(async () => {
    try {
      const [usersRes, leadsRes, bankAccountsRes] = await Promise.all([
        fetch("/api/users?pageSize=200"),
        fetch("/api/project-leads?pageSize=200"),
        fetch("/api/bank-accounts?isActive=true&pageSize=200"),
      ]);
      if (usersRes.ok) {
        const j = await usersRes.json();
        setUsers(j.data || []);
        if (currentUser?.id) {
          setPaymentAppForm((prev) => ({ ...prev, applicantId: currentUser.id }));
          setExpenseReportForm((prev) => ({ ...prev, applicantId: currentUser.id }));
        }
      }
      if (leadsRes.ok) {
        const j = await leadsRes.json();
        setProjectLeads((j.data || []).filter((l: { currentStatus: string }) => l.currentStatus !== "放弃"));
      }
      if (bankAccountsRes.ok) {
        const j = await bankAccountsRes.json();
        setBankAccounts(j.data || []);
      }
    } catch (err) {
      console.error("获取参考数据失败:", err);
    }
  }, []);

  useEffect(() => {
    fetchReferenceData();
    fetchBiddings();
  }, [fetchReferenceData, fetchBiddings]);

  useEffect(() => {
    if (activeTab === "contractExpense") {
      fetchPayables();
      fetchPaymentApplications();
      fetchPaymentVouchers();
    } else if (activeTab === "otherExpense") {
      fetchNonContractExpenses();
    } else if (activeTab === "lendingOut") {
      fetchLendingOuts();
    } else if (activeTab === "expenseReport") {
      fetchExpenseReports();
    } else if (activeTab === "salaryPayment") {
      fetchSalaryBatches();
    } else if (activeTab === "borrowingReturn") {
      fetchBorrowingReturnApps();
    }
  }, [activeTab, fetchPayables, fetchPaymentApplications, fetchPaymentVouchers, fetchNonContractExpenses, fetchLendingOuts, fetchExpenseReports, fetchSalaryBatches, fetchBorrowingReturnApps]);

  useEffect(() => {
    // 从 statusFlowTarget 或 detailTarget 获取应付记录 ID
    const payableId =
      (statusFlowTarget?.type === "payableApps" ? statusFlowTarget.id : null) ||
      (detailTarget?.type === "payable" ? detailTarget.id : null);

    if (!payableId) {
      setPayableAppInstances({});
      return;
    }
    const apps = getPayableApplications(payableId);
    const instanceIds = apps.map((a) => a.approvalInstanceId).filter(Boolean) as string[];
    if (instanceIds.length === 0) return;

    setPayableAppInstancesLoading(true);
    Promise.all(
      instanceIds.map(async (id) => {
        try {
          const res = await fetch(`/api/approval-instances/${id}`);
          if (res.ok) {
            const json = await res.json();
            return { id, data: json.data };
          }
        } catch {}
        return { id, data: null };
      })
    ).then((results) => {
      const map: Record<string, any> = {};
      results.forEach((r) => {
        if (r.data) map[r.id] = r.data;
      });
      setPayableAppInstances(map);
    }).finally(() => {
      setPayableAppInstancesLoading(false);
    });
  }, [statusFlowTarget, detailTarget]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearch("");
    contractExpensePg.setPage(1);
    otherExpensePg.setPage(1);
    lendingOutPg.setPage(1);
    expenseReportPg.setPage(1);
    salaryPg.setPage(1);
    borrowingReturnPg.setPage(1);
  };

  const openPaymentAppModal = () => {
    setPaymentAppForm(emptyPaymentAppForm);
    setFormError("");
    setModalType("paymentApplication");
  };

  const handleSubmitPaymentApp = async () => {
    if (!paymentAppForm.payableId) { setFormError("请选择应付记录"); return; }
    if (!paymentAppForm.applicantId) { setFormError("请选择申请人"); return; }
    if (!paymentAppForm.amount || Number(paymentAppForm.amount) <= 0) { setFormError("请输入有效金额"); return; }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/payment-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payableId: paymentAppForm.payableId,
          applicantId: paymentAppForm.applicantId,
          amount: Number(paymentAppForm.amount),
          paymentReason: paymentAppForm.paymentReason || null,
          paymentMethod: paymentAppForm.paymentMethod || null,
          bankAccount: paymentAppForm.bankAccount || null,
          remark: paymentAppForm.remark || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        const appId = json.data?.id;
        if (appId) {
          const approvalRes = await fetch("/api/approval-instances", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessType: "payment_application",
              businessId: appId,
              flowLevel: "common",
              businessTitle: paymentAppForm.paymentReason || "付款申请",
            }),
          });
          if (approvalRes.ok) {
            await fetch(`/api/payment-applications/${appId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ approvalStatus: "审批中" }),
            });
          } else {
            const errJson = await approvalRes.json();
            setFormError(errJson.error || "发起审批失败");
            setSaving(false);
            return;
          }
        }
        setModalType(null);
        setPaymentAppForm(emptyPaymentAppForm);
        fetchPayables();
        fetchPaymentApplications();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const openCreateOtherExpense = () => {
    setEditingOtherExpense(null);
    setOtherExpenseForm(emptyOtherExpenseForm);
    setFormError("");
    setModalType("otherExpenseForm");
  };

  const openEditOtherExpense = (item: NonContractExpense) => {
    setEditingOtherExpense(item);
    setOtherExpenseForm({
      amount: String(item.amount),
      counterparty: item.counterparty || "",
      counterpartyBankName: item.counterpartyBankName || "",
      counterpartyBankAccount: item.counterpartyBankAccount || "",
      transactionDate: formatDate(item.transactionDate),
      description: item.description || "",
      projectSourceId: item.projectSourceId || "",
      invoiceStatus: item.invoiceStatus || "无需开票",
    });
    setFormError("");
    setModalType("otherExpenseForm");
  };

  const handleSubmitOtherExpense = async () => {
    if (!otherExpenseForm.amount || Number(otherExpenseForm.amount) <= 0) {
      setFormError("请输入有效金额");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const body = {
        amount: Number(otherExpenseForm.amount),
        counterparty: otherExpenseForm.counterparty.trim() || null,
        counterpartyBankName: otherExpenseForm.counterpartyBankName.trim() || null,
        counterpartyBankAccount: otherExpenseForm.counterpartyBankAccount.trim() || null,
        transactionDate: otherExpenseForm.transactionDate || new Date().toISOString(),
        description: otherExpenseForm.description.trim() || null,
        projectSourceId: otherExpenseForm.projectSourceId || null,
        invoiceStatus: otherExpenseForm.invoiceStatus,
      };
      const url = editingOtherExpense
        ? `/api/non-contract-expenses/${editingOtherExpense.id}`
        : "/api/non-contract-expenses";
      const method = editingOtherExpense ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        const createdExpense = json.data;

        // 如果有发票则同步创建
        if (hasInvoice && inlineInvoiceForm.invoiceNo.trim()) {
          const taxRate = Number(inlineInvoiceForm.taxRate) / 100;
          const amount = Number(inlineInvoiceForm.amount) || 0;
          const taxAmount = amount * taxRate;
          const totalAmount = amount + taxAmount;
          await fetch("/api/invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoiceNo: inlineInvoiceForm.invoiceNo.trim(),
              invoiceType: "增值税普通发票",
              invoiceCategory: "收票",
              invoiceDate: inlineInvoiceForm.invoiceDate || otherExpenseForm.transactionDate,
              amount,
              taxRate,
              taxAmount,
              totalAmount: totalAmount || Number(otherExpenseForm.amount),
              sourceType: "non_contract_expense",
              sourceId: editingOtherExpense?.id || createdExpense?.id,
              sellerName: otherExpenseForm.counterparty.trim() || null,
              attachments: inlineInvoiceForm.attachments,
              status: "已登记",
            }),
          }).catch((err) => {
            console.error("创建发票失败:", err);
          });
        }

        if (otherExpenseForm.counterparty.trim()) {
          await fetch("/api/counterparty", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: otherExpenseForm.counterparty.trim(),
              bankName: otherExpenseForm.counterpartyBankName.trim() || null,
              bankAccount: otherExpenseForm.counterpartyBankAccount.trim() || null,
            }),
          }).catch((err) => {
            console.error("保存往来信息失败:", err);
          });
        }
        setModalType(null);
        setOtherExpenseForm(emptyOtherExpenseForm);
        setEditingOtherExpense(null);
        setHasInvoice(false);
        setInlineInvoiceForm(emptyInlineInvoiceForm);
        fetchNonContractExpenses();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOtherExpense = async () => {
    if (!deleteTarget || deleteTarget.type !== "otherExpense") return;
    if (!canDeleteFrontend(ncExpenseHasFlow, ncExpensePerms, deleteTarget.status, currentUser?.id ?? "", deleteTarget.createdById ?? null, isAdmin)) {
      alert("无权删除该记录");
      setDeleteTarget(null);
      setModalType(null);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/non-contract-expenses/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteTarget(null);
        setModalType(null);
        fetchNonContractExpenses();
      } else {
        const json = await res.json();
        alert(json.error || "删除失败");
        setDeleteTarget(null);
        setModalType(null);
      }
    } catch {
      alert("网络错误");
      setDeleteTarget(null);
      setModalType(null);
    } finally {
      setDeleting(false);
    }
  };

  const openLendingOutModal = () => {
    setLendingOutForm(emptyLendingOutForm);
    setFormError("");
    setModalType("lendingOutForm");
  };

  const handleSubmitLendingOut = async () => {
    if (!lendingOutForm.lendingType) { setFormError("请选择借出类型"); return; }
    if (!lendingOutForm.borrowerName.trim()) { setFormError("请输入借入方"); return; }
    if (!lendingOutForm.amount || Number(lendingOutForm.amount) <= 0) { setFormError("请输入有效金额"); return; }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/lending-outs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lendingType: lendingOutForm.lendingType,
          biddingId: lendingOutForm.biddingId || null,
          borrowerName: lendingOutForm.borrowerName.trim(),
          borrowerBankName: lendingOutForm.borrowerBankName.trim() || null,
          borrowerBankAccount: lendingOutForm.borrowerBankAccount.trim() || null,
          amount: Number(lendingOutForm.amount),
          lendingDate: lendingOutForm.lendingDate || new Date().toISOString(),
          expectedReturnDate: lendingOutForm.expectedReturnDate || null,
          description: lendingOutForm.description.trim() || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        if (lendingOutForm.borrowerName.trim()) {
          fetch("/api/counterparty", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: lendingOutForm.borrowerName.trim(),
              bankName: lendingOutForm.borrowerBankName.trim() || null,
              bankAccount: lendingOutForm.borrowerBankAccount.trim() || null,
            }),
          }).catch((err) => console.error("自动保存往来信息失败:", err));
        }
        setModalType(null);
        setLendingOutForm(emptyLendingOutForm);
        fetchLendingOuts();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const openLendingReturnModal = (lending: LendingOut) => {
    setReturnTargetLending(lending);
    setLendingReturnForm({
      lendingId: lending.id,
      amount: "",
      returnDate: "",
      remark: "",
    });
    setFormError("");
    setModalType("lendingReturnForm");
  };

  const handleSubmitLendingReturn = async () => {
    if (!lendingReturnForm.amount || Number(lendingReturnForm.amount) <= 0) {
      setFormError("请输入有效金额");
      return;
    }
    if (returnTargetLending && Number(lendingReturnForm.amount) > returnTargetLending.remainingAmount) {
      setFormError("收回金额不能超过未收回金额");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/lending-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lendingId: lendingReturnForm.lendingId,
          amount: Number(lendingReturnForm.amount),
          returnDate: lendingReturnForm.returnDate || new Date().toISOString(),
          remark: lendingReturnForm.remark || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setModalType(null);
        setLendingReturnForm(emptyLendingReturnForm);
        setReturnTargetLending(null);
        fetchLendingOuts();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const openExpenseReportModal = () => {
    setExpenseReportForm({
      applicantId: currentUser?.id || "",
      items: [{ ...emptyExpenseItem }],
    });
    setFormError("");
    setModalType("expenseReportForm");
  };

  const addExpenseItem = () => {
    setExpenseReportForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...emptyExpenseItem }],
    }));
  };

  const removeExpenseItem = (index: number) => {
    setExpenseReportForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateExpenseItem = (index: number, field: string, value: string | boolean) => {
    setExpenseReportForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      if (field === "relateProject" && value === false) {
        items[index].projectSourceId = "";
      }
      return { ...prev, items };
    });
  };

  const getExpenseTotal = () => {
    return expenseReportForm.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  };

  const handleInvoiceUpload = async (index: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const json = await res.json();
        setExpenseReportForm((prev) => {
          const items = [...prev.items];
          const attachments = items[index].invoiceAttachments || [];
          items[index] = {
            ...items[index],
            invoiceAttachments: [...attachments, json.url],
          };
          return { ...prev, items };
        });
      } else {
        const json = await res.json();
        alert(json.error || "上传失败");
      }
    } catch {
      alert("上传失败，请重试");
    }
  };

  const removeAttachment = async (itemIndex: number, attachIndex: number) => {
    const urlToDelete = expenseReportForm.items[itemIndex]?.invoiceAttachments?.[attachIndex];
    if (urlToDelete) await deleteUploadedFile(urlToDelete);
    setExpenseReportForm((prev) => {
      const items = [...prev.items];
      const attachments = items[itemIndex].invoiceAttachments || [];
      items[itemIndex] = {
        ...items[itemIndex],
        invoiceAttachments: attachments.filter((_: string, i: number) => i !== attachIndex),
      };
      return { ...prev, items };
    });
  };

  const handleSubmitExpenseReport = async () => {
    if (!expenseReportForm.applicantId) { setFormError("报销人信息缺失"); return; }
    if (expenseReportForm.items.length === 0) { setFormError("请至少添加一条明细"); return; }
    for (let i = 0; i < expenseReportForm.items.length; i++) {
      const item = expenseReportForm.items[i];
      if (!item.description || !item.description.trim()) { setFormError(`第${i + 1}行费用说明必填`); return; }
      if (!item.amount || Number(item.amount) <= 0) { setFormError(`第${i + 1}行报销金额无效`); return; }
      if (!item.expenseType) { setFormError(`第${i + 1}行费用类型必填`); return; }
      if (!item.invoiceAttachments || item.invoiceAttachments.length === 0) { setFormError(`第${i + 1}行请上传发票`); return; }
    }
    setSaving(true);
    setFormError("");
    try {
      const total = getExpenseTotal();
      const firstExpenseType = expenseReportForm.items[0]?.expenseType || "其他";
      const res = await fetch("/api/expense-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId: expenseReportForm.applicantId,
          expenseType: firstExpenseType,
          amount: total,
          status: "草稿",
          items: expenseReportForm.items.map((item) => ({
            expenseType: item.expenseType,
            amount: Number(item.amount),
            description: item.description.trim() || null,
            projectSourceId: item.relateProject ? item.projectSourceId || null : null,
            invoiceAttachments: item.invoiceAttachments || [],
          })),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setModalType(null);
        setExpenseReportForm({ applicantId: currentUser?.id || "", items: [{ ...emptyExpenseItem }] });
        fetchExpenseReports();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenBatchForm = async () => {
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setBatchFormPeriod(defaultPeriod);
    setBatchFormTitle(`${defaultPeriod}月工资发放`);
    setBatchFormRemark("");
    setBatchPreviewItems([]);
    setEditingBatchId(null);
    setFormError("");
    setShowBatchForm(true);

    // 加载在职员工薪酬预览
    setBatchPreviewLoading(true);
    try {
      const res = await fetch(`/api/salary-batches/preview?period=${defaultPeriod}`);
      if (res.ok) {
        const json = await res.json();
        setBatchPreviewItems(
          json.data?.items?.map((item: SalaryBatchItem) => ({ ...item, excluded: false })) || []
        );
      }
    } catch {
      // 预览加载失败，后续新建时会由后端兜底
    } finally {
      setBatchPreviewLoading(false);
    }
  };

  const handleCreateBatch = async () => {
    if (!batchFormPeriod) { setFormError("请选择工资周期"); return; }
    if (!batchFormTitle) { setFormError("请输入批次名称"); return; }
    const activeItems = batchPreviewItems.filter((item) => !item.excluded);
    if (activeItems.length === 0) { setFormError("至少需要一名发放员工"); return; }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/salary-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: batchFormPeriod,
          title: batchFormTitle,
          remark: batchFormRemark,
          items: activeItems.map((item) => ({
            employeeId: item.employeeId,
            baseSalary: item.baseSalary,
            bonus: item.bonus,
            allowance: item.allowance,
            grossSalary: item.grossSalary,
            socialInsurancePersonal: item.socialInsurancePersonal,
            socialInsuranceCompany: item.socialInsuranceCompany,
            housingFundPersonal: item.housingFundPersonal,
            housingFundCompany: item.housingFundCompany,
            incomeTax: item.incomeTax,
            otherDeduction: item.otherDeduction,
            totalDeduction: item.totalDeduction,
            netSalary: item.netSalary,
          })),
        }),
      });
      if (res.ok) {
        setShowBatchForm(false);
        setBatchPreviewItems([]);
        fetchSalaryBatches();
      } else {
        const json = await res.json();
        setFormError(json.error || "创建失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleEditBatch = async (batch: SalaryBatch) => {
    setEditingBatchId(batch.id);
    setEditingBatchItems(batch.items);
    setBatchFormPeriod(batch.period);
    setBatchFormTitle(batch.title);
    setBatchFormRemark(batch.remark || "");
    setFormError("");
    setModalType("salaryBatchEdit");
  };

  const handleSaveBatchItems = async () => {
    if (!editingBatchId) return;
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch(`/api/salary-batches/${editingBatchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: batchFormTitle,
          remark: batchFormRemark,
          items: editingBatchItems.map(item => ({
            id: item.id,
            baseSalary: item.baseSalary,
            bonus: item.bonus,
            allowance: item.allowance,
            socialInsurancePersonal: item.socialInsurancePersonal,
            housingFundPersonal: item.housingFundPersonal,
            incomeTax: item.incomeTax,
            otherDeduction: item.otherDeduction,
            remark: item.remark,
          })),
        }),
      });
      if (res.ok) {
        setModalType(null);
        fetchSalaryBatches();
      } else {
        const json = await res.json();
        setFormError(json.error || "保存失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBatch = async (batchId: string, status: string) => {
    if (!confirm("确定删除此批次？")) return;
    if (!canDeleteFrontend(salaryPaymentHasFlow, salaryPaymentPerms, status, currentUser?.id ?? "", null, isAdmin)) {
      alert("无权删除该记录");
      return;
    }
    try {
      const res = await fetch(`/api/salary-batches/${batchId}`, { method: "DELETE" });
      if (res.ok) fetchSalaryBatches();
      else {
        const json = await res.json();
        alert(json.error || "删除失败");
      }
    } catch {
      alert("删除失败");
    }
  };

  const handleDeletePayable = async (id: string) => {
    if (!confirm("确定要删除该应付记录吗？此操作不可撤销。")) return;
    try {
      const res = await fetch(`/api/payables/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchPayables();
      } else {
        const json = await res.json();
        alert(json.error || "删除失败");
      }
    } catch {
      alert("删除失败");
    }
  };

  const handleDeleteLendingOut = async (id: string) => {
    if (!confirm("确定要删除该借出款记录吗？此操作不可撤销。")) return;
    try {
      const res = await fetch(`/api/lending-outs/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchLendingOuts();
      } else {
        const json = await res.json();
        alert(json.error || "删除失败");
      }
    } catch {
      alert("删除失败");
    }
  };

  const handleDeleteExpenseReport = async (id: string) => {
    if (!confirm("确定要删除该费用报销记录吗？此操作不可撤销。")) return;
    try {
      const res = await fetch(`/api/expense-reports/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchExpenseReports();
      } else {
        const json = await res.json();
        alert(json.error || "删除失败");
      }
    } catch {
      alert("删除失败");
    }
  };

  const handleSubmitBatchApproval = async (batch: SalaryBatch) => {
    try {
      const res = await fetch("/api/approval-instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: "salary_payment",
          businessId: batch.id,
          flowLevel: "common",
          businessTitle: batch.title || batch.batchNo || "工资发放",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        await fetch(`/api/salary-batches/${batch.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "审批中" }),
        });
        fetchSalaryBatches();
      } else {
        alert(json.error || "提交审批失败");
      }
    } catch {
      alert("提交审批失败");
    }
  };

  const updateBatchItem = (idx: number, field: string, value: string) => {
    setEditingBatchItems(prev => {
      const items = [...prev];
      const item = { ...items[idx], [field]: Number(value) || 0 };
      item.grossSalary = item.baseSalary + item.bonus + item.allowance;
      item.totalDeduction = item.socialInsurancePersonal + item.housingFundPersonal + item.incomeTax + item.otherDeduction;
      item.netSalary = Math.round((item.grossSalary - item.totalDeduction) * 100) / 100;
      items[idx] = item;
      return items;
    });
  };

  // 新建批次弹窗：更新预览明细项
  const updatePreviewItem = (idx: number, field: string, value: string) => {
    setBatchPreviewItems(prev => {
      const items = [...prev];
      const item = { ...items[idx], [field]: Number(value) || 0 };
      item.grossSalary = item.baseSalary + item.bonus + item.allowance;
      item.totalDeduction = item.socialInsurancePersonal + item.housingFundPersonal + item.incomeTax + item.otherDeduction;
      item.netSalary = Math.round((item.grossSalary - item.totalDeduction) * 100) / 100;
      items[idx] = item;
      return items;
    });
  };

  // 新建批次弹窗：切换排除/恢复员工
  const toggleExcludeEmployee = (idx: number) => {
    setBatchPreviewItems(prev => {
      const items = [...prev];
      items[idx] = { ...items[idx], excluded: !items[idx].excluded };
      return items;
    });
  };

  const handleStatusChange = async (type: string, id: string, newStatus: string) => {
    try {
      // 对于需要审批的业务类型，从草稿/已驳回提交到审批中时，需要创建审批实例
      if (newStatus === "审批中") {
        const businessTypeMap: Record<string, string> = {
          nonContractExpense: "non_contract_expense",
          lendingOut: "lending_out",
          expenseReport: "expense_report",
        };
        const businessType = businessTypeMap[type];
        if (businessType) {
          const res = await fetch("/api/approval-instances", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessType,
              businessId: id,
              flowLevel: "common",
            }),
          });
          const json = await res.json();
          if (res.ok) {
            if (type === "nonContractExpense") fetchNonContractExpenses();
            else if (type === "lendingOut") fetchLendingOuts();
            else if (type === "expenseReport") fetchExpenseReports();
            return;
          } else {
            alert(json.error || "提交审批失败");
            return;
          }
        }
      }

      let url = "";
      if (type === "expenseReport") url = `/api/expense-reports/${id}`;
      else if (type === "salaryPayment") url = `/api/salary-batches/${id}`;
      else if (type === "nonContractExpense") url = `/api/non-contract-expenses/${id}`;
      else if (type === "lendingOut") url = `/api/lending-outs/${id}`;
      else if (type === "paymentApplication") url = `/api/payment-applications/${id}`;
      else return;
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        if (type === "expenseReport") fetchExpenseReports();
        else if (type === "salaryPayment") fetchSalaryBatches();
        else if (type === "nonContractExpense") fetchNonContractExpenses();
        else if (type === "lendingOut") fetchLendingOuts();
        else if (type === "paymentApplication") fetchPaymentApplications();
      } else {
        const json = await res.json();
        alert(json.error || "状态变更失败");
      }
    } catch {
      alert("网络错误");
    }
  };

  const TAB_PERMISSION_MAP: Record<string, string> = {
    contractExpense: "finance.expense.contract",
    otherExpense: "finance.expense.other",
    lendingOut: "finance.expense.lending",
    expenseReport: "finance.expense.report",
    salaryPayment: "finance.expense.salary",
    borrowingReturn: "finance.expense.return",
  };

  const allTabs = [
    { key: "contractExpense" as TabType, label: "合同支出", icon: <ArrowDownCircle className="w-4 h-4" /> },
    { key: "otherExpense" as TabType, label: "其他支出", icon: <DollarSign className="w-4 h-4" /> },
    { key: "lendingOut" as TabType, label: "借出款", icon: <Landmark className="w-4 h-4" /> },
    { key: "expenseReport" as TabType, label: "费用报销", icon: <FileText className="w-4 h-4" /> },
    { key: "salaryPayment" as TabType, label: "工资发放", icon: <CreditCard className="w-4 h-4" /> },
    { key: "borrowingReturn" as TabType, label: "借入资金归还", icon: <RotateCcw className="w-4 h-4" /> },
  ];

  const userModules: string[] = [...modulePermissions.accessibleSubModules];
  const tabPermValues = Object.values(TAB_PERMISSION_MAP);
  const hasTabPermissions = userModules.some((m) => tabPermValues.includes(m));
  const isAdmin = currentUser?.roles?.some((r: any) => r.code === "admin") || currentUser?.username === "admin";
  // 各子模块权限
  const ncExpensePerms = getUserModulePerms(currentUser, "non_contract_expense");
  const ncExpenseHasFlow = currentUser?.moduleFlowStatus?.["non_contract_expense"] ?? false;
  const lendingOutPerms = getUserModulePerms(currentUser, "lending_out");
  const lendingOutHasFlow = currentUser?.moduleFlowStatus?.["lending_out"] ?? false;
  const expenseReportPerms = getUserModulePerms(currentUser, "expense_report");
  const expenseReportHasFlow = currentUser?.moduleFlowStatus?.["expense_report"] ?? false;
  const salaryPaymentPerms = getUserModulePerms(currentUser, "salary_payment");
  const salaryPaymentHasFlow = currentUser?.moduleFlowStatus?.["salary_payment"] ?? false;
  const borrowingReturnPerms = getUserModulePerms(currentUser, "borrowing_return_application");
  const borrowingReturnHasFlow = currentUser?.moduleFlowStatus?.["borrowing_return_application"] ?? false;
  const tabs = (!hasTabPermissions || isAdmin) ? allTabs : allTabs.filter((tab) => userModules.includes(TAB_PERMISSION_MAP[tab.key]));

  const getPrimaryBtnLabel = () => {
    if (activeTab === "otherExpense") return "新增支出";
    if (activeTab === "lendingOut") return "新增借出";
    if (activeTab === "expenseReport") return "新增报销";
    if (activeTab === "borrowingReturn") return "";
    return "新建批次";
  };

  const handlePrimaryAction = () => {
    if (activeTab === "otherExpense") openCreateOtherExpense();
    else if (activeTab === "lendingOut") openLendingOutModal();
    else if (activeTab === "expenseReport") openExpenseReportModal();
    else if (activeTab === "borrowingReturn") return;
    else handleOpenBatchForm();
  };

  const getPayableApplications = (payableId: string) => {
    return paymentApplications.filter((pa) => pa.payableId === payableId);
  };

  const getPayableVouchers = (payableId: string) => {
    return paymentVouchers.filter((pv) => pv.payableId === payableId);
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>财务支出</h1>
            <p>管理合同支出、其他支出、借出款、费用报销与工资发放</p>
          </div>
          <button
            className="ios-btn ios-btn-primary"
            onClick={handlePrimaryAction}
            style={activeTab === "borrowingReturn" || activeTab === "contractExpense" ? { display: "none" } : undefined}
            disabled={!flowConfigMap[activeTab]}
            title={!flowConfigMap[activeTab] ? "请先在流程设置中配置审批流程" : undefined}
          >
            <Plus className="w-4 h-4" />
            {getPrimaryBtnLabel()}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`ios-btn ${activeTab === tab.key ? "ios-btn-primary" : "ios-btn-secondary"}`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "contractExpense" && (
        <div className="bento-card-static">
          {loading ? (
            <div className="empty-state">
              <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
              <p>加载中...</p>
            </div>
          ) : payables.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
                <ArrowDownCircle className="w-8 h-8 text-[#78716C]" />
              </div>
              <p>暂无合同支出记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr>
                    <th>项目</th>
                    <th>合同编号</th>
                    <th>收款方</th>
                    <th>合同金额</th>
                    <th>已付金额</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {payables.map((p) => {
                    const apps = getPayableApplications(p.id);
                    const unpaid = p.amount - p.paidAmount;
                    const isOutsourcing = p.sourceType === "outsourcing";
                    const sourceNo = isOutsourcing
                      ? `外包-${p.sourceOutsourcing?.targetName || p.sourceId.slice(-6)}`
                      : p.sourceContract?.contractNo || p.sourceId;
                    const projectName = p.sourceContract?.project?.name
                      || p.sourceOutsourcing?.project?.name
                      || p.project?.name;
                    const counterparty = isOutsourcing
                      ? p.sourceOutsourcing?.targetName
                      : p.sourceContract?.supplier?.name;
                    const sourceAmount = isOutsourcing
                      ? (p.sourceOutsourcing ? formatAmount(Number(p.sourceOutsourcing.amount)) : "-")
                      : (p.sourceContract ? formatAmount(parseFloat(p.sourceContract.totalAmount)) : "-");
                    return (
                      <tr key={p.id} className={getRowStatusClass(p.status)}>
                        <td>
                          {projectName ? (
                            <div>
                              <span className="font-semibold text-[#1C1917]">{projectName}</span>
                              <span className="block text-[11px] text-[#78716C]">{p.projectSourceId}</span>
                            </div>
                          ) : p.projectSourceId || "-"}
                        </td>
                        <td className="font-mono text-[13px] font-semibold text-[#1C1917]">
                          {sourceNo}
                        </td>
                        <td>
                          {counterparty ? (
                            <div className="flex items-center gap-1.5">
                              {isOutsourcing ? (
                                <span className="ios-badge ios-badge-green text-[11px]!">个人</span>
                              ) : (
                                <Building2 className="w-3.5 h-3.5 text-[#78716C]" />
                              )}
                              {counterparty}
                            </div>
                          ) : "-"}
                        </td>
                        <td className="font-semibold">{sourceAmount}</td>
                        <td className="font-semibold">{formatAmount(p.paidAmount)}</td>
                        <td>{getStatusBadge(p.status)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => {
                                setDetailTarget({ type: "payable", id: p.id });
                                setModalType("detail");
                              }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              详情
                            </button>
                            {unpaid > 0 && !apps.some((a) => a.approvalStatus === "草稿" || a.approvalStatus === "审批中") && (
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                                onClick={() => {
                                  setPaymentAppForm((prev) => ({ ...prev, payableId: p.id, amount: String(unpaid) }));
                                  setFormError("");
                                  setModalType("paymentApplication");
                                }}
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                付款
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                                onClick={() => handleDeletePayable(p.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <PaginationBar pagination={contractExpensePg.pagination} onPageChange={contractExpensePg.setPage} onPageSizeChange={contractExpensePg.setPageSize} />
            </div>
          )}
        </div>
      )}

      {activeTab === "otherExpense" && (
        <>
        <div className="bento-card-static">
          <div className="filter-bar">
            <div className="relative flex-1 min-w-[200px] max-w-[360px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
              <input
                type="text"
                className="ios-input pl-10"
                placeholder="搜索交易对方、说明..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  otherExpensePg.setPage(1);
                }}
              />
            </div>
            <div className="ml-auto text-[13px] text-[#78716C]">
              共 <span className="font-semibold text-[#1C1917]">{otherExpensePg.pagination?.total ?? 0}</span> 条记录
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
              <p>加载中...</p>
            </div>
          ) : nonContractExpenses.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
                <DollarSign className="w-8 h-8 text-[#78716C]" />
              </div>
              <p>{search ? "没有匹配的支出记录" : "暂无其他支出记录"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr>
                    {ncExpensePerms.delete && (
                      <th className="w-10">
                        <input
                          type="checkbox"
                          className="ios-checkbox"
                          checked={isAllSelectedOtherExpense}
                          onChange={() => isAllSelectedOtherExpense ? clearSelectionOtherExpense() : selectAllOtherExpense()}
                        />
                      </th>
                    )}
                    <th>交易对方</th>
                    <th>金额</th>
                    <th>日期</th>
                    <th>说明</th>
                    <th>项目</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {nonContractExpenses.map((item) => {
                    const nextStatuses = appStatusFlow[item.status] || [];
                    return (
                      <tr key={item.id} className={`${getRowStatusClass(item.status)} ${isSelectedOtherExpense(item.id) ? "bg-[#1C1917]/5" : ""}`}>
                        {ncExpensePerms.delete && (
                          <td className="w-10">
                            <input
                              type="checkbox"
                              className="ios-checkbox"
                              checked={isSelectedOtherExpense(item.id)}
                              onChange={() => toggleSelectOtherExpense(item.id)}
                            />
                          </td>
                        )}
                        <td className="font-semibold">{item.counterparty || "-"}</td>
                        <td className="text-[#78716C] font-semibold">{formatAmount(item.amount)}</td>
                        <td className="text-[#78716C]">{formatDate(item.transactionDate)}</td>
                        <td className="text-[#78716C] max-w-[200px] truncate">{item.description || "-"}</td>
                        <td className="text-[#78716C]">{item.project?.name || item.projectSourceId || "-"}</td>

                        <td>
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => {
                                setDetailOtherExpense(item);
                                setApprovalInstance(null);
                                if (item.approvalInstanceId) {
                                  fetchApprovalInstance(item.approvalInstanceId);
                                }
                                setModalType("otherExpenseDetail");
                              }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              查看
                            </button>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => openEditOtherExpense(item)}
                              disabled={!canEditFrontend(ncExpenseHasFlow, ncExpensePerms, item.status, currentUser?.id ?? "", item.createdById ?? null, isAdmin)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {(canDeleteFrontend(ncExpenseHasFlow, ncExpensePerms, item.status, currentUser?.id ?? "", item.createdById ?? null, isAdmin)) && (
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                                onClick={() => {
                                  setDeleteTarget({ type: "otherExpense", id: item.id, status: item.status });
                                  setModalType("deleteConfirm");
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {nextStatuses.map((ns) => (
                              <button
                                key={ns}
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                                onClick={() => handleStatusChange("nonContractExpense", item.id, ns)}
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                                {ns}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <PaginationBar pagination={otherExpensePg.pagination} onPageChange={otherExpensePg.setPage} onPageSizeChange={otherExpensePg.setPageSize} />
            </div>          )}
        </div>

        {ncExpensePerms.delete && (
          <BatchDeleteBar
            businessType="non_contract_expense"
            selectedIds={nonContractExpenses.filter((d) => isSelectedOtherExpense(d.id)).map((d) => d.id)}
            onDeleteSuccess={fetchNonContractExpenses}
            onClear={clearSelectionOtherExpense}
          />
        )}
        </>
      )}

      {activeTab === "lendingOut" && (
        <>
        <div className="bento-card-static">
          {loading ? (
            <div className="empty-state">
              <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
              <p>加载中...</p>
            </div>
          ) : lendingOuts.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
                <Landmark className="w-8 h-8 text-[#78716C]" />
              </div>
              <p>暂无借出款记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr>
                    {lendingOutPerms.delete && (
                      <th className="w-10">
                        <input
                          type="checkbox"
                          className="ios-checkbox"
                          checked={isAllSelectedLendingOut}
                          onChange={() => isAllSelectedLendingOut ? clearSelectionLendingOut() : selectAllLendingOut()}
                        />
                      </th>
                    )}
                    <th>借出类型</th>
                    <th>借入方</th>
                    <th>借出金额</th>
                    <th>已收回</th>
                    <th>未收回</th>
                    <th>借出日期</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {lendingOuts.map((item) => {
                    const nextStatuses = lendingStatusFlow[item.status] || [];
                    return (
                      <tr key={item.id} className={`${getRowStatusClass(item.status)} ${isSelectedLendingOut(item.id) ? "bg-[#1C1917]/5" : ""}`}>
                        {lendingOutPerms.delete && (
                          <td className="w-10">
                            <input
                              type="checkbox"
                              className="ios-checkbox"
                              checked={isSelectedLendingOut(item.id)}
                              onChange={() => toggleSelectLendingOut(item.id)}
                            />
                          </td>
                        )}
                        <td>
                          <span className="ios-badge ios-badge-blue">{item.lendingType}</span>
                        </td>
                        <td className="font-semibold">{item.borrowerName}</td>
                        <td className="text-[#78716C] font-semibold">{formatAmount(item.amount)}</td>
                        <td className="font-semibold">{formatAmount(item.returnedAmount)}</td>
                        <td className="font-semibold text-[#78716C]">{formatAmount(item.remainingAmount)}</td>
                        <td className="text-[#78716C]">{formatDate(item.lendingDate)}</td>
                        <td>
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => {
                                setDetailLendingOut(item);
                                setApprovalInstance(null);
                                if (item.approvalInstanceId) {
                                  fetchApprovalInstance(item.approvalInstanceId);
                                }
                                setModalType("lendingOutDetail");
                              }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              查看
                            </button>
                            {item.remainingAmount > 0 && (
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                                onClick={() => openLendingReturnModal(item)}
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                收回
                              </button>
                            )}
                            {canDeleteFrontend(lendingOutHasFlow, lendingOutPerms, item.status, currentUser?.id ?? "", item.createdById ?? null, isAdmin) && (
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                                onClick={() => handleDeleteLendingOut(item.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {nextStatuses.map((ns) => (
                              <button
                                key={ns}
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                                onClick={() => handleStatusChange("lendingOut", item.id, ns)}
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                                {ns}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <PaginationBar pagination={lendingOutPg.pagination} onPageChange={lendingOutPg.setPage} onPageSizeChange={lendingOutPg.setPageSize} />
            </div>
          )}
        </div>

        {lendingOutPerms.delete && (
          <BatchDeleteBar
            businessType="lending_out"
            selectedIds={lendingOuts.filter((d) => isSelectedLendingOut(d.id)).map((d) => d.id)}
            onDeleteSuccess={fetchLendingOuts}
            onClear={clearSelectionLendingOut}
          />
        )}
        </>
      )}

      {activeTab === "expenseReport" && (
        <>
        <div className="bento-card-static">
          <div className="filter-bar">
            <div className="relative flex-1 min-w-[200px] max-w-[360px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
              <input
                type="text"
                className="ios-input pl-10"
                placeholder="搜索申请人、报销类型..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  expenseReportPg.setPage(1);
                }}
              />
            </div>
            <div className="ml-auto text-[13px] text-[#78716C]">
              共 <span className="font-semibold text-[#1C1917]">{expenseReportPg.pagination?.total ?? 0}</span> 条记录
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
              <p>加载中...</p>
            </div>
          ) : expenseReports.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
                <FileText className="w-8 h-8 text-[#78716C]" />
              </div>
              <p>{search ? "没有匹配的报销记录" : "暂无费用报销记录"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr>
                    {expenseReportPerms.delete && (
                      <th className="w-10">
                        <input
                          type="checkbox"
                          className="ios-checkbox"
                          checked={isAllSelectedExpenseReport}
                          onChange={() => isAllSelectedExpenseReport ? clearSelectionExpenseReport() : selectAllExpenseReport()}
                        />
                      </th>
                    )}
                    <th>申请人</th>
                    <th>报销类型</th>
                    <th>总金额</th>
                    <th>状态</th>
                    <th>操作</th>
                    <th>最后修改</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseReports.map((item) => {
                    const nextStatuses = appStatusFlow[item.status] || [];
                    return (
                      <tr key={item.id} className={`${getRowStatusClass(item.status)} ${isSelectedExpenseReport(item.id) ? "bg-[#1C1917]/5" : ""}`}>
                        {expenseReportPerms.delete && (
                          <td className="w-10">
                            <input
                              type="checkbox"
                              className="ios-checkbox"
                              checked={isSelectedExpenseReport(item.id)}
                              onChange={() => toggleSelectExpenseReport(item.id)}
                            />
                          </td>
                        )}
                        <td className="font-semibold">{item.applicant?.realName || "-"}</td>
                        <td>
                          <span className="ios-badge ios-badge-blue">{item.expenseType}</span>
                        </td>
                        <td className="text-[#78716C] font-semibold">{formatAmount(item.amount)}</td>
                        <td>
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => {
                                setDetailExpenseReport(item);
                                setApprovalInstance(null);
                                if (item.approvalInstanceId) {
                                  fetchApprovalInstance(item.approvalInstanceId);
                                }
                                setModalType("expenseReportDetail");
                              }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              查看
                            </button>
                            {canDeleteFrontend(expenseReportHasFlow, expenseReportPerms, item.status, currentUser?.id ?? "", item.createdById ?? null, isAdmin) && (
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                                onClick={() => handleDeleteExpenseReport(item.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {nextStatuses.map((ns) => (
                              <button
                                key={ns}
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                                onClick={() => handleStatusChange("expenseReport", item.id, ns)}
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                                {ns}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="text-[#78716C] text-[12px] whitespace-nowrap">
                          {item.lastModifiedBy && (
                            <span>{item.lastModifiedBy}</span>
                          )}
                          <span className="block text-[11px]">{formatDate(item.updatedAt)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <PaginationBar pagination={expenseReportPg.pagination} onPageChange={expenseReportPg.setPage} onPageSizeChange={expenseReportPg.setPageSize} />
            </div>
          )}
        </div>

        {expenseReportPerms.delete && (
          <BatchDeleteBar
            businessType="expense_report"
            selectedIds={expenseReports.filter((d) => isSelectedExpenseReport(d.id)).map((d) => d.id)}
            onDeleteSuccess={fetchExpenseReports}
            onClear={clearSelectionExpenseReport}
          />
        )}
        </>
      )}

      {activeTab === "salaryPayment" && (
        <>
        <div className="bento-card-static">
          <div className="filter-bar">
            <div className="relative flex-1 min-w-[200px] max-w-[360px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
              <input
                type="text"
                className="ios-input pl-10"
                placeholder="搜索批次号、批次名称..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  salaryPg.setPage(1);
                }}
              />
            </div>
            <div className="ml-auto text-[13px] text-[#78716C]">
              共 <span className="font-semibold text-[#1C1917]">{salaryPg.pagination?.total ?? 0}</span> 条记录
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
              <p>加载中...</p>
            </div>
          ) : salaryBatches.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-[#78716C]" />
              </div>
              <p>{search ? "没有匹配的工资批次" : "暂无工资发放批次"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr>
                    {salaryPaymentPerms.delete && (
                      <th className="w-10">
                        <input
                          type="checkbox"
                          className="ios-checkbox"
                          checked={isAllSelectedSalary}
                          onChange={() => isAllSelectedSalary ? clearSelectionSalary() : selectAllSalary()}
                        />
                      </th>
                    )}
                    <th>批次号</th>
                    <th>批次名称</th>
                    <th>工资周期</th>
                    <th>人数</th>
                    <th>应发总额</th>
                    <th>实发总额</th>
                    <th>银行总支出</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryBatches.map((batch) => (
                    <tr key={batch.id} className={`${getRowStatusClass(batch.status)} ${isSelectedSalary(batch.id) ? "bg-[#1C1917]/5" : ""}`}>
                        {salaryPaymentPerms.delete && (
                        <td className="w-10">
                          <input
                            type="checkbox"
                            className="ios-checkbox"
                            checked={isSelectedSalary(batch.id)}
                            onChange={() => toggleSelectSalary(batch.id)}
                          />
                        </td>
                      )}
                      <td className="font-mono text-[13px]">{batch.batchNo}</td>
                      <td className="font-semibold">{batch.title}</td>
                      <td className="font-mono text-[13px]">{batch.period}</td>
                      <td>{batch.employeeCount}</td>
                      <td>{formatAmount(batch.totalGrossSalary)}</td>
                      <td className="font-semibold">{formatAmount(batch.totalNetSalary)}</td>
                      <td className="text-[#78716C]">{formatAmount(batch.totalBankOutflow)}</td>
                      <td>
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={() => {
                              setSalaryBatchDetail(batch);
                              setApprovalInstance(null);
                              if (batch.approvalInstanceId) fetchApprovalInstance(batch.approvalInstanceId);
                              setModalType("salaryPaymentDetail");
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            查看
                          </button>
                          {(canEditFrontend(salaryPaymentHasFlow, salaryPaymentPerms, batch.status, currentUser?.id ?? "", batch.createdById ?? null, isAdmin) || canDeleteFrontend(salaryPaymentHasFlow, salaryPaymentPerms, batch.status, currentUser?.id ?? "", batch.createdById ?? null, isAdmin)) && (
                            <>
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm"
                                onClick={() => handleEditBatch(batch)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                编辑
                              </button>
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                                onClick={() => handleDeleteBatch(batch.id, batch.status)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                删除
                              </button>
                            </>
                          )}
                          {batch.status === "草稿" && salaryPaymentFlowConfigured && (
                            <button
                              className="ios-btn ios-btn-primary ios-btn-sm"
                              onClick={() => handleSubmitBatchApproval(batch)}
                            >
                              提交审批
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationBar pagination={salaryPg.pagination} onPageChange={salaryPg.setPage} onPageSizeChange={salaryPg.setPageSize} />
            </div>
          )}
        </div>

        {salaryPaymentPerms.delete && (
          <BatchDeleteBar
            businessType="salary_payment"
            selectedIds={salaryBatches.filter((d) => isSelectedSalary(d.id)).map((d) => d.id)}
            onDeleteSuccess={fetchSalaryBatches}
            onClear={clearSelectionSalary}
          />
        )}
        </>
      )}

      {activeTab === "borrowingReturn" && (
        <>
        <div className="bento-card-static">
          {loading ? (
            <div className="empty-state">
              <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
              <p>加载中...</p>
            </div>
          ) : borrowingReturnApps.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
                <RotateCcw className="w-8 h-8 text-[#78716C]" />
              </div>
              <p>暂无借入资金归还记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr>
                    {borrowingReturnPerms.delete && (
                      <th className="w-10">
                        <input
                          type="checkbox"
                          className="ios-checkbox"
                          checked={isAllSelectedBorrowReturn}
                          onChange={() => isAllSelectedBorrowReturn ? clearSelectionBorrowReturn() : selectAllBorrowReturn()}
                        />
                      </th>
                    )}
                    <th>来源类型</th>
                    <th>来源名称</th>
                    <th>原始金额</th>
                    <th>归还金额</th>
                    <th>归还日期</th>
                    <th>状态</th>
                    <th>审批状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {borrowingReturnApps.map((item) => (
                    <tr key={item.id} className={`${getRowStatusClass(item.status)} ${isSelectedBorrowReturn(item.id) ? "bg-[#1C1917]/5" : ""}`}>
                      {borrowingReturnPerms.delete && (
                        <td className="w-10">
                          <input
                            type="checkbox"
                            className="ios-checkbox"
                            checked={isSelectedBorrowReturn(item.id)}
                            onChange={() => toggleSelectBorrowReturn(item.id)}
                          />
                        </td>
                      )}
                      <td>
                        <span className="ios-badge ios-badge-blue">{sourceTypeMap[item.sourceType] || item.sourceType}</span>
                      </td>
                      <td className="font-semibold">{item.sourceName}</td>
                      <td className="text-[#78716C]">{formatAmount(parseFloat(item.sourceAmount))}</td>
                      <td className="text-[#78716C] font-semibold">{formatAmount(parseFloat(item.returnAmount))}</td>
                      <td className="text-[#78716C]">{formatDate(item.returnDate)}</td>
                      <td>{getStatusBadge(item.status)}</td>

                      <td>
                        <button
                          className="ios-btn ios-btn-ghost ios-btn-sm"
                          onClick={() => {
                            setDetailBorrowingReturnApp(item);
                            setApprovalInstance(null);
                            if (item.approvalInstanceId) {
                              fetchApprovalInstance(item.approvalInstanceId);
                            }
                            setModalType("borrowingReturnDetail");
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationBar pagination={borrowingReturnPg.pagination} onPageChange={borrowingReturnPg.setPage} onPageSizeChange={borrowingReturnPg.setPageSize} />
            </div>
          )}
        </div>

        {borrowingReturnPerms.delete && (
          <BatchDeleteBar
            businessType="borrowing_return_application"
            selectedIds={borrowingReturnApps.filter((d) => isSelectedBorrowReturn(d.id)).map((d) => d.id)}
            onDeleteSuccess={fetchBorrowingReturnApps}
            onClear={clearSelectionBorrowReturn}
          />
        )}
        </>
      )}

      <Modal
        isOpen={modalType === "paymentApplication"}
        onClose={() => setModalType(null)}
        title="付款申请"
        maxWidth="520px"
      >
        <div className="space-y-5">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">{formError}</div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">关联应付记录 <span className="text-[#78716C]">*</span></label>
            <select
              className="ios-select"
              value={paymentAppForm.payableId}
              onChange={(e) => setPaymentAppForm((p) => ({ ...p, payableId: e.target.value }))}
            >
              <option value="">请选择应付记录</option>
              {payables
                .filter((p) => p.status === "未付" || p.status === "部分付款")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sourceContract?.contractNo || p.sourceId} - {p.sourceContract?.supplier?.name || "-"} - 应付{formatAmount(p.amount)} 未付{formatAmount(p.amount - p.paidAmount)}
                  </option>
                ))}
            </select>
          </div>

          {paymentAppForm.payableId && (() => {
            const selectedPayable = payables.find((p) => p.id === paymentAppForm.payableId);
            if (!selectedPayable) return null;
            const isOutsourcing = selectedPayable.sourceType === "outsourcing";
            const outsourcing = selectedPayable.sourceOutsourcing;
            const contract = selectedPayable.sourceContract;
            const sourceNo = isOutsourcing
              ? `外包-${outsourcing?.targetName || selectedPayable.sourceId.slice(-6)}`
              : contract?.contractNo || selectedPayable.sourceId;
            const counterparty = isOutsourcing ? outsourcing?.targetName : contract?.supplier?.name;
            const projectName = contract?.project?.name || outsourcing?.project?.name || selectedPayable.project?.name;
            const projectId = contract?.project?.projectSourceId || outsourcing?.project?.projectSourceId || selectedPayable.projectSourceId;
            const sourceAmount = isOutsourcing
              ? (outsourcing ? Number(outsourcing.amount) : 0)
              : (contract ? parseFloat(contract.totalAmount) : 0);
            const invoicedAmount = contract?.invoicedAmount ? parseFloat(contract.invoicedAmount) : 0;
            const supplier = contract?.supplier;
            const bankName = supplier?.bankName;
            const bankAccount = supplier?.bankAccount;
            return (
              <div className="p-4 rounded-xl bg-[#FAFAF9] space-y-3">
                <div className="flex items-center gap-2 text-[13px]">
                  <FileText className="w-3.5 h-3.5 text-[#1C1917] shrink-0" />
                  <span className="font-mono font-semibold text-[#1C1917]">{sourceNo}</span>
                  <span className="text-[#A8A29E]">|</span>
                  {isOutsourcing ? (
                    <span className="ios-badge ios-badge-green text-[11px]!">个人</span>
                  ) : (
                    <Building2 className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                  )}
                  <span className="truncate">{counterparty || "-"}</span>
                </div>
                {projectName && (
                  <div className="flex items-center gap-1.5 text-[12px]">
                    <span className="text-[#78716C]">关联项目:</span>
                    <span className="font-semibold text-[#1C1917]">{projectName}</span>
                    <span className="text-[#78716C]">({projectId})</span>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-3 pt-2 border-t border-[#E7E5E4]">
                  <div className="text-center">
                    <p className="text-[11px] text-[#78716C] mb-0.5">合同金额</p>
                    <p className="text-[15px] font-bold text-[#1C1917]">{formatAmount(sourceAmount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] text-[#78716C] mb-0.5">已收票</p>
                    <p className="text-[15px] font-bold text-[#1C1917]">{formatAmount(invoicedAmount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] text-[#78716C] mb-0.5">已付</p>
                    <p className="text-[15px] font-bold text-[#1C1917]">{formatAmount(selectedPayable.paidAmount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] text-[#78716C] mb-0.5">未付</p>
                    <p className="text-[15px] font-bold text-[#1C1917]">{formatAmount(selectedPayable.amount - selectedPayable.paidAmount)}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-[#E7E5E4]">
                  <div className="flex items-center gap-2 text-[12px] text-[#78716C] mb-1.5">
                    <span>🏦</span>
                    <span className="font-semibold">收款方银行信息</span>
                  </div>
                  {bankName || bankAccount ? (
                    <div className="text-[13px] space-y-0.5">
                      <p><span className="text-[#78716C]">开户行：</span><span className="font-semibold text-[#1C1917]">{bankName || "-"}</span></p>
                      <p><span className="text-[#78716C]">账  号：</span><span className="font-mono font-semibold text-[#1C1917]">{bankAccount || "-"}</span></p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#A8A29E]">暂无银行账户信息</p>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">本次付款金额 <span className="text-[#78716C]">*</span></label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#78716C] text-[15px] font-medium">¥</span>
                <input
                  type="number"
                  className="ios-input pl-8 text-[17px] font-semibold"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={paymentAppForm.amount}
                  onChange={(e) => setPaymentAppForm((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">付款事由</label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="请输入付款事由"
                  value={paymentAppForm.paymentReason}
                  onChange={(e) => setPaymentAppForm((p) => ({ ...p, paymentReason: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">申请人 <span className="text-[#78716C]">*</span></label>
                <select
                  className="ios-select"
                  value={paymentAppForm.applicantId}
                  onChange={(e) => setPaymentAppForm((p) => ({ ...p, applicantId: e.target.value }))}
                >
                  <option value="">请选择申请人</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.realName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">备注</label>
              <input
                type="text"
                className="ios-input"
                placeholder="选填"
                value={paymentAppForm.remark}
                onChange={(e) => setPaymentAppForm((p) => ({ ...p, remark: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button className="ios-btn ios-btn-secondary" onClick={() => setModalType(null)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmitPaymentApp} disabled={saving}>
              {saving ? "保存中..." : "提交付款申请"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalType === "otherExpenseForm"}
        onClose={() => setModalType(null)}
        title={editingOtherExpense ? "编辑支出" : "新增其他支出"}
        maxWidth="520px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">{formError}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">金额（元） <span className="text-[#78716C]">*</span></label>
              <input
                type="number"
                className="ios-input"
                placeholder="请输入金额"
                min="0"
                step="0.01"
                value={otherExpenseForm.amount}
                onChange={(e) => setOtherExpenseForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">交易对方</label>
              <CounterpartySearch
                value={otherExpenseForm.counterparty}
                onChange={(name) => setOtherExpenseForm((p) => ({ ...p, counterparty: name }))}
                onSelect={(record) =>
                  setOtherExpenseForm((p) => ({
                    ...p,
                    counterpartyBankName: record.bankName || p.counterpartyBankName,
                    counterpartyBankAccount: record.bankAccount || p.counterpartyBankAccount,
                  }))
                }
                placeholder="请输入交易对方（可从往来信息中选择）"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">开户行</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入开户行"
                value={otherExpenseForm.counterpartyBankName || ""}
                onChange={(e) => setOtherExpenseForm((p) => ({ ...p, counterpartyBankName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">银行账号</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入银行账号"
                value={otherExpenseForm.counterpartyBankAccount || ""}
                onChange={(e) => setOtherExpenseForm((p) => ({ ...p, counterpartyBankAccount: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">交易日期</label>
            <input
              type="date"
              className="ios-input"
              value={otherExpenseForm.transactionDate}
              onChange={(e) => setOtherExpenseForm((p) => ({ ...p, transactionDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">说明</label>
            <textarea
              className="ios-textarea"
              placeholder="请输入说明"
              value={otherExpenseForm.description}
              onChange={(e) => setOtherExpenseForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div>
            <ProjectPicker
              projectLeads={projectLeads}
              value={otherExpenseForm.projectSourceId}
              onChange={(id) => setOtherExpenseForm((p) => ({ ...p, projectSourceId: id }))}
              label="关联项目"
            />
          </div>
          {/* 发票信息区域 */}
          <div className="border-t border-[#F5F5F4] pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-semibold text-[#1C1917]">发票信息</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-[13px] text-[#78716C]">有发票</span>
                <input
                  type="checkbox"
                  checked={hasInvoice}
                  onChange={(e) => {
                    setHasInvoice(e.target.checked);
                    if (!e.target.checked) {
                      setOtherExpenseForm((p) => ({ ...p, invoiceStatus: "待补票" }));
                    } else {
                      setOtherExpenseForm((p) => ({ ...p, invoiceStatus: "已收票" }));
                    }
                  }}
                />
              </label>
            </div>
            {hasInvoice && (
              <div className="space-y-3 p-3 rounded-xl bg-[#FAFAF9]">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] text-[#78716C] mb-1">发票号码 <span className="text-[#78716C]">*</span></label>
                    <input
                      type="text"
                      className="ios-input text-[13px]"
                      placeholder="请输入发票号码"
                      value={inlineInvoiceForm.invoiceNo}
                      onChange={(e) => setInlineInvoiceForm((p) => ({ ...p, invoiceNo: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#78716C] mb-1">开票日期 <span className="text-[#78716C]">*</span></label>
                    <input
                      type="date"
                      className="ios-input text-[13px]"
                      value={inlineInvoiceForm.invoiceDate}
                      onChange={(e) => setInlineInvoiceForm((p) => ({ ...p, invoiceDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] text-[#78716C] mb-1">不含税金额</label>
                    <input
                      type="number"
                      className="ios-input text-[13px]"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      value={inlineInvoiceForm.amount}
                      onChange={(e) => setInlineInvoiceForm((p) => ({ ...p, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#78716C] mb-1">税率（%）</label>
                    <input
                      type="number"
                      className="ios-input text-[13px]"
                      placeholder="6"
                      min="0"
                      max="100"
                      value={inlineInvoiceForm.taxRate}
                      onChange={(e) => setInlineInvoiceForm((p) => ({ ...p, taxRate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button className="ios-btn ios-btn-secondary" onClick={() => setModalType(null)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmitOtherExpense} disabled={saving}>
              {saving ? "保存中..." : editingOtherExpense ? "保存修改" : "创建支出"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalType === "lendingOutForm"}
        onClose={() => setModalType(null)}
        title="新增借出款"
        maxWidth="520px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">{formError}</div>
          )}
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">借出类型 <span className="text-[#78716C]">*</span></label>
            <select
              className="ios-select"
              value={lendingOutForm.lendingType}
              onChange={(e) => setLendingOutForm((p) => ({ ...p, lendingType: e.target.value, biddingId: "" }))}
            >
              <option value="">请选择</option>
              {lendingTypeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {lendingOutForm.lendingType === "投标保证金" && (
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">关联投标</label>
              <select
                className="ios-select"
                value={lendingOutForm.biddingId}
                onChange={(e) => setLendingOutForm((p) => ({ ...p, biddingId: e.target.value }))}
              >
                <option value="">请选择投标</option>
                {biddings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.projectLead?.projectName || b.projectSourceId} - 保证金{formatAmount(b.bondAmount || 0)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">借入方 <span className="text-[#78716C]">*</span></label>
            <CounterpartySearch
              value={lendingOutForm.borrowerName}
              onChange={(name) => setLendingOutForm((p) => ({ ...p, borrowerName: name }))}
              onSelect={(bank) => setLendingOutForm((p) => ({ ...p, borrowerBankName: bank.bankName, borrowerBankAccount: bank.bankAccount }))}
              placeholder="请输入借入方"
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">开户行</label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入开户行"
              value={lendingOutForm.borrowerBankName}
              onChange={(e) => setLendingOutForm((p) => ({ ...p, borrowerBankName: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">银行账号</label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入银行账号"
              value={lendingOutForm.borrowerBankAccount}
              onChange={(e) => setLendingOutForm((p) => ({ ...p, borrowerBankAccount: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">借出金额（元） <span className="text-[#78716C]">*</span></label>
              <input
                type="number"
                className="ios-input"
                placeholder="请输入金额"
                min="0"
                step="0.01"
                value={lendingOutForm.amount}
                onChange={(e) => setLendingOutForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">借出日期</label>
              <input
                type="date"
                className="ios-input"
                value={lendingOutForm.lendingDate}
                onChange={(e) => setLendingOutForm((p) => ({ ...p, lendingDate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">预计归还日期</label>
            <input
              type="date"
              className="ios-input"
              value={lendingOutForm.expectedReturnDate}
              onChange={(e) => setLendingOutForm((p) => ({ ...p, expectedReturnDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">说明</label>
            <textarea
              className="ios-textarea"
              placeholder="请输入说明"
              value={lendingOutForm.description}
              onChange={(e) => setLendingOutForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button className="ios-btn ios-btn-secondary" onClick={() => setModalType(null)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmitLendingOut} disabled={saving}>
              {saving ? "保存中..." : "创建借出"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalType === "lendingReturnForm"}
        onClose={() => { setModalType(null); setReturnTargetLending(null); }}
        title="收回借出款"
        maxWidth="520px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">{formError}</div>
          )}
          {returnTargetLending && (
            <div className="p-3 rounded-xl bg-[#FAFAF9]">
              <p className="text-[13px] text-[#78716C] mb-1">借出记录</p>
              <p className="text-[14px] font-semibold">{returnTargetLending.borrowerName} - {formatAmount(returnTargetLending.amount)}</p>
              <div className="flex gap-4 mt-1 text-[12px] text-[#78716C]">
                <span>已收回: {formatAmount(returnTargetLending.returnedAmount)}</span>
                <span>剩余: {formatAmount(returnTargetLending.remainingAmount)}</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">收回金额（元） <span className="text-[#78716C]">*</span></label>
              <input
                type="number"
                className="ios-input"
                placeholder="请输入金额"
                min="0"
                max={returnTargetLending?.remainingAmount}
                step="0.01"
                value={lendingReturnForm.amount}
                onChange={(e) => setLendingReturnForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">收回日期</label>
              <input
                type="date"
                className="ios-input"
                value={lendingReturnForm.returnDate}
                onChange={(e) => setLendingReturnForm((p) => ({ ...p, returnDate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">备注</label>
            <textarea
              className="ios-textarea"
              placeholder="请输入备注"
              value={lendingReturnForm.remark}
              onChange={(e) => setLendingReturnForm((p) => ({ ...p, remark: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button className="ios-btn ios-btn-secondary" onClick={() => { setModalType(null); setReturnTargetLending(null); }}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmitLendingReturn} disabled={saving}>
              {saving ? "保存中..." : "确认收回"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalType === "expenseReportForm"}
        onClose={() => setModalType(null)}
        title="新增费用报销"
        maxWidth="960px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">{formError}</div>
          )}
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">报销人</label>
            <input readOnly value={currentUser?.realName || ""} className="ios-input bg-[#FAFAF9]" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-semibold text-[#1C1917]">报销明细</label>
              <button className="ios-btn ios-btn-secondary ios-btn-sm" onClick={addExpenseItem}>
                <Plus className="w-3.5 h-3.5" />
                添加行
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-[#E7E5E4]">
                    <th className="text-left py-2 px-2 text-[12px] font-semibold text-[#78716C]">费用说明 *</th>
                    <th className="text-left py-2 px-2 text-[12px] font-semibold text-[#78716C]">关联项目</th>
                    <th className="text-left py-2 px-2 text-[12px] font-semibold text-[#78716C]">报销金额 *</th>
                    <th className="text-left py-2 px-2 text-[12px] font-semibold text-[#78716C]">费用类型 *</th>
                    <th className="text-left py-2 px-2 text-[12px] font-semibold text-[#78716C]">上传发票 *</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenseReportForm.items.map((item, index) => (
                    <tr key={index} className="border-b border-[#F5F5F4]">
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          className="ios-input w-full !py-1.5 !text-[13px]"
                          placeholder="费用说明"
                          value={item.description}
                          onChange={(e) => updateExpenseItem(index, "description", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded border-[#A8A29E] accent-[#1C1917] shrink-0"
                            checked={item.relateProject}
                            onChange={(e) => updateExpenseItem(index, "relateProject", e.target.checked)}
                          />
                          {item.relateProject ? (
                            <ProjectPicker
                              projectLeads={projectLeads}
                              value={item.projectSourceId}
                              onChange={(id) => updateExpenseItem(index, "projectSourceId", id)}
                              label=""
                              placeholder="选择项目"
                            />
                          ) : (
                            <span className="text-[12px] text-[#78716C]">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          className="ios-input w-full !py-1.5 !text-[13px]"
                          placeholder="金额"
                          min="0"
                          step="0.01"
                          value={item.amount}
                          onChange={(e) => updateExpenseItem(index, "amount", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          className="ios-select w-full !py-1.5 !text-[13px]"
                          value={item.expenseType}
                          onChange={(e) => updateExpenseItem(index, "expenseType", e.target.value)}
                        >
                          <option value="">请选择</option>
                          {expenseItemTypes.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <div className="space-y-1">
                          <button
                            type="button"
                            className="ios-btn ios-btn-secondary ios-btn-sm text-[11px]! gap-1"
                            onClick={() => {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = ".jpg,.jpeg,.png,.pdf";
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) handleInvoiceUpload(index, file);
                              };
                              input.click();
                            }}
                          >
                            <Paperclip className="w-3 h-3" />
                            上传
                          </button>
                          {item.invoiceAttachments && item.invoiceAttachments.length > 0 && (
                            <div className="flex flex-col gap-0.5">
                              {item.invoiceAttachments.map((url: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-1">
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#1C1917] hover:underline truncate max-w-[80px]">
                                    发票{idx + 1}
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => removeAttachment(index, idx)}
                                    className="text-[#78716C] text-[10px] hover:opacity-70 shrink-0"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-1">
                        {expenseReportForm.items.length > 1 && (
                          <button
                            className="p-1 text-[#78716C] hover:bg-[#78716C]/10 rounded-lg"
                            onClick={() => removeExpenseItem(index)}
                          >
                            <MinusCircle className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 p-3 rounded-xl bg-[#FAFAF9] flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#1C1917]">总金额</span>
              <span className="text-[15px] font-bold text-[#78716C]">{formatAmount(getExpenseTotal())}</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button className="ios-btn ios-btn-secondary" onClick={() => setModalType(null)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmitExpenseReport} disabled={saving}>
              {saving ? "保存中..." : "提交报销"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showBatchForm && !editingBatchId}
        onClose={() => { setShowBatchForm(false); setBatchPreviewItems([]); }}
        title="新建工资批次"
        maxWidth="95vw"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">{formError}</div>
          )}
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">工资周期 <span className="text-[#78716C]">*</span></label>
              <input
                type="month"
                className="ios-input"
                value={batchFormPeriod}
                onChange={(e) => setBatchFormPeriod(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">批次名称 <span className="text-[#78716C]">*</span></label>
              <input
                type="text"
                className="ios-input"
                value={batchFormTitle}
                onChange={(e) => setBatchFormTitle(e.target.value)}
              />
            </div>
          </div>

          {batchPreviewLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-[13px] text-[#78716C]">正在加载员工薪酬数据...</div>
            </div>
          ) : batchPreviewItems.length > 0 ? (
            <>
              {/* 汇总信息区 */}
              {(() => {
                const active = batchPreviewItems.filter((it) => !it.excluded);
                const totalGross = active.reduce((s, it) => s + it.grossSalary, 0);
                const totalSIPersonal = active.reduce((s, it) => s + it.socialInsurancePersonal, 0);
                const totalSICompany = active.reduce((s, it) => s + it.socialInsuranceCompany, 0);
                const totalHFPersonal = active.reduce((s, it) => s + it.housingFundPersonal, 0);
                const totalHFCompany = active.reduce((s, it) => s + it.housingFundCompany, 0);
                const totalTax = active.reduce((s, it) => s + it.incomeTax, 0);
                const totalNet = active.reduce((s, it) => s + it.netSalary, 0);
                const totalCompanyCost = totalGross + totalSICompany + totalHFCompany;
                const excludedCount = batchPreviewItems.length - active.length;

                return (
                  <>
                    {/* 第一行：基本指标 */}
                    <div className="flex gap-3 flex-wrap">
                      <div className="flex-1 min-w-[80px] p-3 bg-[#FAFAF9] rounded-xl text-center">
                        <div className="text-[11px] text-[#78716C] mb-1">应发人数</div>
                        <div className="text-xl font-bold text-[#1C1917]">{active.length}</div>
                        <div className="text-[11px] text-[#78716C]">人</div>
                      </div>
                      <div className="flex-1 min-w-[100px] p-3 bg-[#FAFAF9] rounded-xl text-center">
                        <div className="text-[11px] text-[#78716C] mb-1">应发总额</div>
                        <div className="text-lg font-bold text-[#1C1917]">{formatAmount(totalGross)}</div>
                      </div>
                      <div className="flex-1 min-w-[100px] p-3 bg-[#F0FDF4] rounded-xl text-center">
                        <div className="text-[11px] text-[#16A34A] mb-1">实发总额</div>
                        <div className="text-lg font-bold text-[#16A34A]">{formatAmount(totalNet)}</div>
                      </div>
                    </div>

                    {/* 第二行：代扣代缴（个人） */}
                    <div>
                      <div className="text-[12px] font-semibold text-[#78716C] mb-2">代扣代缴（个人）</div>
                      <div className="flex gap-3 flex-wrap">
                        <div className="flex-1 min-w-[100px] p-2.5 bg-[#FFF7ED] rounded-xl text-center">
                          <div className="text-[11px] text-[#78716C] mb-1">代缴社保（个人）</div>
                          <div className="text-base font-bold text-[#1C1917]">{formatAmount(totalSIPersonal)}</div>
                        </div>
                        <div className="flex-1 min-w-[100px] p-2.5 bg-[#FFF7ED] rounded-xl text-center">
                          <div className="text-[11px] text-[#78716C] mb-1">代缴公积金（个人）</div>
                          <div className="text-base font-bold text-[#1C1917]">{formatAmount(totalHFPersonal)}</div>
                        </div>
                        <div className="flex-1 min-w-[100px] p-2.5 bg-[#FFF7ED] rounded-xl text-center">
                          <div className="text-[11px] text-[#78716C] mb-1">代缴个税</div>
                          <div className="text-base font-bold text-[#1C1917]">{formatAmount(totalTax)}</div>
                        </div>
                      </div>
                    </div>

                    {/* 第三行：公司承担 */}
                    <div>
                      <div className="text-[12px] font-semibold text-[#78716C] mb-2">公司承担</div>
                      <div className="flex gap-3 flex-wrap">
                        <div className="flex-1 min-w-[100px] p-2.5 bg-[#EFF6FF] rounded-xl text-center">
                          <div className="text-[11px] text-[#78716C] mb-1">公司社保</div>
                          <div className="text-base font-bold text-[#1C1917]">{formatAmount(totalSICompany)}</div>
                        </div>
                        <div className="flex-1 min-w-[100px] p-2.5 bg-[#EFF6FF] rounded-xl text-center">
                          <div className="text-[11px] text-[#78716C] mb-1">公司公积金</div>
                          <div className="text-base font-bold text-[#1C1917]">{formatAmount(totalHFCompany)}</div>
                        </div>
                        <div className="flex-1 min-w-[100px] p-2.5 bg-[#EFF6FF] rounded-xl text-center">
                          <div className="text-[11px] text-[#78716C] mb-1">公司总成本</div>
                          <div className="text-base font-bold text-[#2563EB]">{formatAmount(totalCompanyCost)}</div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* 发放明细表格 */}
              <div>
                <div className="text-[12px] font-semibold text-[#1C1917] mb-2">发放明细</div>
                <div className="overflow-x-auto border border-[#E7E5E4] rounded-xl">
                  <table className="ios-table text-[12px]">
                    <thead>
                      <tr>
                        <th className="min-w-[60px]">员工</th>
                        <th className="min-w-[80px]">基本工资</th>
                        <th className="min-w-[60px]">奖金</th>
                        <th className="min-w-[60px]">补贴</th>
                        <th className="min-w-[80px]">应发</th>
                        <th className="min-w-[70px]">社保个人</th>
                        <th className="min-w-[70px]">公积金个人</th>
                        <th className="min-w-[60px]">个税</th>
                        <th className="min-w-[60px]">其他扣款</th>
                        <th className="min-w-[80px]">扣合计</th>
                        <th className="min-w-[80px]">实发</th>
                        <th className="min-w-[40px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchPreviewItems.map((item, idx) => (
                        <tr key={item.employeeId} className={item.excluded ? "opacity-50" : ""}>
                          {item.excluded ? (
                            <>
                              <td className="font-semibold whitespace-nowrap line-through text-[#A8A29E]">{item.employee?.realName}</td>
                              <td colSpan={10} className="text-[11px] text-[#A8A29E]">已排除（点击恢复）</td>
                              <td className="text-center">
                                <button
                                  className="text-[#16A34A] hover:opacity-70 text-sm"
                                  onClick={() => toggleExcludeEmployee(idx)}
                                  title="恢复"
                                >↩</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="font-semibold whitespace-nowrap">{item.employee?.realName}</td>
                              <td><input type="number" step="0.01" className="ios-input text-[12px] py-1" value={item.baseSalary} onChange={(e) => updatePreviewItem(idx, "baseSalary", e.target.value)} /></td>
                              <td><input type="number" step="0.01" className="ios-input text-[12px] py-1" value={item.bonus} onChange={(e) => updatePreviewItem(idx, "bonus", e.target.value)} /></td>
                              <td><input type="number" step="0.01" className="ios-input text-[12px] py-1" value={item.allowance} onChange={(e) => updatePreviewItem(idx, "allowance", e.target.value)} /></td>
                              <td className="font-semibold text-[#1C1917]">{formatAmount(item.grossSalary)}</td>
                              <td><input type="number" step="0.01" className="ios-input text-[12px] py-1" value={item.socialInsurancePersonal} onChange={(e) => updatePreviewItem(idx, "socialInsurancePersonal", e.target.value)} /></td>
                              <td><input type="number" step="0.01" className="ios-input text-[12px] py-1" value={item.housingFundPersonal} onChange={(e) => updatePreviewItem(idx, "housingFundPersonal", e.target.value)} /></td>
                              <td><input type="number" step="0.01" className="ios-input text-[12px] py-1" value={item.incomeTax} onChange={(e) => updatePreviewItem(idx, "incomeTax", e.target.value)} /></td>
                              <td><input type="number" step="0.01" className="ios-input text-[12px] py-1" value={item.otherDeduction} onChange={(e) => updatePreviewItem(idx, "otherDeduction", e.target.value)} /></td>
                              <td className="text-[#78716C]">{formatAmount(item.totalDeduction)}</td>
                              <td className="font-semibold text-[#78716C]">{formatAmount(item.netSalary)}</td>
                              <td className="text-center">
                                <button
                                  className="text-[#DC2626] hover:opacity-70 text-sm"
                                  onClick={() => toggleExcludeEmployee(idx)}
                                  title="排除"
                                >✕</button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-[13px] text-[#78716C]">暂无可发放的在职员工</div>
          )}

          {/* 底部 */}
          <div className="flex justify-between items-center pt-4 border-t border-[#F5F5F4]">
            <div className="text-[12px] text-[#78716C]">
              {(() => {
                const activeCount = batchPreviewItems.filter((it) => !it.excluded).length;
                const excludedCount = batchPreviewItems.length - activeCount;
                return `✓ 已包含 ${activeCount} 名在职员工` + (excludedCount > 0 ? ` · 已排除 ${excludedCount} 人` : "");
              })()}
            </div>
            <div className="flex gap-3">
              <button className="ios-btn ios-btn-secondary" onClick={() => { setShowBatchForm(false); setBatchPreviewItems([]); }}>取消</button>
              <button className="ios-btn ios-btn-primary" onClick={handleCreateBatch} disabled={saving}>
                {saving ? "创建中..." : "创建批次"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalType === "salaryBatchEdit"}
        onClose={() => setModalType(null)}
        title="编辑工资明细"
        maxWidth="95vw"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">{formError}</div>
          )}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">批次名称</label>
              <input
                type="text"
                className="ios-input"
                value={batchFormTitle}
                onChange={(e) => setBatchFormTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">备注</label>
              <input
                type="text"
                className="ios-input"
                value={batchFormRemark}
                onChange={(e) => setBatchFormRemark(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="ios-table text-[12px]">
              <thead>
                <tr>
                  <th className="min-w-[60px]">员工</th>
                  <th className="min-w-[80px]">基本工资</th>
                  <th className="min-w-[60px]">奖金</th>
                  <th className="min-w-[60px]">补贴</th>
                  <th className="min-w-[80px]">应发合计</th>
                  <th className="min-w-[70px]">社保个人</th>
                  <th className="min-w-[70px]">公积金个人</th>
                  <th className="min-w-[60px]">个税</th>
                  <th className="min-w-[60px]">其他扣款</th>
                  <th className="min-w-[80px]">扣款合计</th>
                  <th className="min-w-[80px]">实发工资</th>
                </tr>
              </thead>
              <tbody>
                {editingBatchItems.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="font-semibold whitespace-nowrap">{item.employee?.realName}</td>
                    <td><input type="number" step="0.01" className="ios-input text-[12px] py-1" value={item.baseSalary} onChange={(e) => updateBatchItem(idx, "baseSalary", e.target.value)} /></td>
                    <td><input type="number" step="0.01" className="ios-input text-[12px] py-1" value={item.bonus} onChange={(e) => updateBatchItem(idx, "bonus", e.target.value)} /></td>
                    <td><input type="number" step="0.01" className="ios-input text-[12px] py-1" value={item.allowance} onChange={(e) => updateBatchItem(idx, "allowance", e.target.value)} /></td>
                    <td className="font-semibold text-[#1C1917]">{formatAmount(item.grossSalary)}</td>
                    <td><input type="number" step="0.01" className="ios-input text-[12px] py-1" value={item.socialInsurancePersonal} onChange={(e) => updateBatchItem(idx, "socialInsurancePersonal", e.target.value)} /></td>
                    <td><input type="number" step="0.01" className="ios-input text-[12px] py-1" value={item.housingFundPersonal} onChange={(e) => updateBatchItem(idx, "housingFundPersonal", e.target.value)} /></td>
                    <td><input type="number" step="0.01" className="ios-input text-[12px] py-1" value={item.incomeTax} onChange={(e) => updateBatchItem(idx, "incomeTax", e.target.value)} /></td>
                    <td><input type="number" step="0.01" className="ios-input text-[12px] py-1" value={item.otherDeduction} onChange={(e) => updateBatchItem(idx, "otherDeduction", e.target.value)} /></td>
                    <td className="text-[#78716C]">{formatAmount(item.totalDeduction)}</td>
                    <td className="font-semibold text-[#78716C]">{formatAmount(item.netSalary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button className="ios-btn ios-btn-secondary" onClick={() => setModalType(null)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSaveBatchItems} disabled={saving}>
              {saving ? "保存中..." : "保存明细"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalType === "deleteConfirm"}
        onClose={() => { setModalType(null); setDeleteTarget(null); }}
        title="确认删除"
        maxWidth="400px"
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#78716C]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#78716C]" />
          </div>
          <p className="text-[15px] text-[#1C1917] mb-1">确定要删除该记录吗？</p>
          <p className="text-[13px] text-[#78716C] mb-6">此操作不可撤销</p>
          <div className="flex justify-center gap-3">
            <button className="ios-btn ios-btn-secondary" onClick={() => { setModalType(null); setDeleteTarget(null); }}>取消</button>
            <button
              className="ios-btn ios-btn-danger"
              onClick={() => {
                if (deleteTarget?.type === "otherExpense") handleDeleteOtherExpense();
              }}
              disabled={deleting}
            >
              {deleting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalType === "otherExpenseDetail" && !!detailOtherExpense}
        onClose={() => { setModalType(null); setDetailOtherExpense(null); setApprovalInstance(null); }}
        title="其他支出详情"
        maxWidth="640px"
      >
        {detailOtherExpense && (
          <NonContractExpenseDetailCard data={detailOtherExpense} />
        )}
        <ApprovalTimeline instance={approvalInstance} loading={approvalLoading} />
      </Modal>

      {/* 补录发票弹窗 */}
      <Modal
        isOpen={modalType === "supplementInvoice"}
        onClose={() => { setModalType(null); setInlineInvoiceForm(emptyInlineInvoiceForm); }}
        title="补录发票"
        maxWidth="480px"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] text-[#78716C] mb-1">发票号码 <span className="text-[#78716C]">*</span></label>
              <input
                type="text"
                className="ios-input text-[13px]"
                value={inlineInvoiceForm.invoiceNo}
                onChange={(e) => setInlineInvoiceForm((p) => ({ ...p, invoiceNo: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#78716C] mb-1">开票日期 <span className="text-[#78716C]">*</span></label>
              <input
                type="date"
                className="ios-input text-[13px]"
                value={inlineInvoiceForm.invoiceDate}
                onChange={(e) => setInlineInvoiceForm((p) => ({ ...p, invoiceDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] text-[#78716C] mb-1">不含税金额</label>
              <input
                type="number"
                className="ios-input text-[13px]"
                min="0"
                step="0.01"
                value={inlineInvoiceForm.amount}
                onChange={(e) => setInlineInvoiceForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#78716C] mb-1">税率（%）</label>
              <input
                type="number"
                className="ios-input text-[13px]"
                min="0"
                max="100"
                value={inlineInvoiceForm.taxRate}
                onChange={(e) => setInlineInvoiceForm((p) => ({ ...p, taxRate: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-[#F5F5F4]">
            <button className="ios-btn ios-btn-secondary" onClick={() => { setModalType(null); setInlineInvoiceForm(emptyInlineInvoiceForm); }}>取消</button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={async () => {
                if (!inlineInvoiceForm.invoiceNo.trim() || !inlineInvoiceForm.invoiceDate) {
                  alert("请填写发票号码和开票日期");
                  return;
                }
                const taxRate = Number(inlineInvoiceForm.taxRate) / 100;
                const amount = Number(inlineInvoiceForm.amount) || 0;
                const taxAmount = amount * taxRate;
                const totalAmount = amount + taxAmount;
                const res = await fetch("/api/invoices", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    invoiceNo: inlineInvoiceForm.invoiceNo.trim(),
                    invoiceType: "增值税普通发票",
                    invoiceCategory: "收票",
                    invoiceDate: inlineInvoiceForm.invoiceDate,
                    amount,
                    taxRate,
                    taxAmount,
                    totalAmount: totalAmount || Number(detailOtherExpense!.amount),
                    sourceType: "non_contract_expense",
                    sourceId: detailOtherExpense!.id,
                    sellerName: detailOtherExpense!.counterparty || null,
                    status: "已登记",
                  }),
                });
                if (res.ok) {
                  // 更新支出 invoiceStatus
                  await fetch(`/api/non-contract-expenses/${detailOtherExpense!.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ invoiceStatus: "已收票" }),
                  });
                  setModalType(null);
                  setInlineInvoiceForm(emptyInlineInvoiceForm);
                  // 刷新详情
                  if (detailOtherExpense) {
                    const detailRes = await fetch(`/api/non-contract-expenses/${detailOtherExpense.id}`);
                    if (detailRes.ok) {
                      const detailJson = await detailRes.json();
                      setDetailOtherExpense(detailJson.data);
                    }
                  }
                  fetchNonContractExpenses();
                  alert("发票补录成功");
                } else {
                  const json = await res.json();
                  alert(json.error || "补录失败");
                }
              }}
            >
              确认补录
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalType === "lendingOutDetail" && !!detailLendingOut}
        onClose={() => { setModalType(null); setDetailLendingOut(null); setApprovalInstance(null); }}
        title="借出款详情"
        maxWidth="640px"
      >
        {detailLendingOut && (
          <LendingOutDetailCard data={detailLendingOut} />
        )}
        <ApprovalTimeline instance={approvalInstance} loading={approvalLoading} />
      </Modal>

      <Modal
        isOpen={modalType === "expenseReportDetail" && !!detailExpenseReport}
        onClose={() => { setModalType(null); setDetailExpenseReport(null); setApprovalInstance(null); }}
        title="费用报销详情"
        maxWidth="960px"
      >
        {detailExpenseReport && (
          <ExpenseReportDetailCard data={detailExpenseReport} />
        )}
        <ApprovalTimeline instance={approvalInstance} loading={approvalLoading} />
      </Modal>

      <Modal
        isOpen={modalType === "salaryPaymentDetail" && !!salaryBatchDetail}
        onClose={() => { setModalType(null); setSalaryBatchDetail(null); setApprovalInstance(null); }}
        title="工资批次详情"
        maxWidth="95vw"
      >
        {salaryBatchDetail && (
          <SalaryPaymentDetailCard data={salaryBatchDetail} />
        )}
        <ApprovalTimeline instance={approvalInstance} loading={approvalLoading} />
      </Modal>

      <Modal
        isOpen={modalType === "borrowingReturnDetail" && !!detailBorrowingReturnApp}
        onClose={() => { setModalType(null); setDetailBorrowingReturnApp(null); setApprovalInstance(null); }}
        title="借入资金归还详情"
        maxWidth="640px"
      >
        {detailBorrowingReturnApp && (
          <BorrowingReturnDetailCard data={detailBorrowingReturnApp} />
        )}
        <ApprovalTimeline instance={approvalInstance} loading={approvalLoading} />
      </Modal>

      <Modal
        isOpen={modalType === "statusFlow" && !!statusFlowTarget}
        onClose={() => { setModalType(null); setStatusFlowTarget(null); }}
        title={statusFlowTarget?.type === "payableApps" ? "支付记录" : "状态流转"}
        maxWidth={statusFlowTarget?.type === "payableApps" ? "640px" : "400px"}
      >
        {statusFlowTarget && statusFlowTarget.type === "payableApps" && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[#FAFAF9]">
              <p className="text-[13px] text-[#78716C] mb-1">应付状态</p>
              <div>{getStatusBadge(statusFlowTarget.status)}</div>
            </div>

            {(() => {
              const apps = getPayableApplications(statusFlowTarget.id);
              if (apps.length === 0) {
                return (
                  <div className="text-center py-6 text-[#78716C] text-[13px] rounded-xl bg-[#FAFAF9]">
                    暂无付款申请记录
                  </div>
                );
              }
              return (
                <div className="space-y-4">
                  {apps.map((app) => {
                    const instance = app.approvalInstanceId ? payableAppInstances[app.approvalInstanceId] : null;
                    const isRejected = app.approvalStatus === "已驳回";
                    const isEditing = editingPaymentAppId === app.id;
                    return (
                      <div key={app.id} className="rounded-xl border border-[#E7E5E4] overflow-hidden">
                        <div className="p-3 bg-[#FAFAF9]">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold text-[#1C1917]">
                                {app.applicant?.realName || "-"}
                              </span>
                              <span className="text-[12px] text-[#78716C]">
                                {formatDate(app.createdAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(app.approvalStatus)}
                              {isRejected && (
                                <button
                                  className="ios-btn ios-btn-primary ios-btn-sm"
                                  onClick={() => {
                                    setEditingPaymentAppId(app.id);
                                    setEditingPaymentAppForm({
                                      amount: String(app.amount),
                                      paymentReason: app.paymentReason || "",
                                      applicantId: app.applicantId || "",
                                    });
                                  }}
                                >
                                  编辑并重新发起
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-[12px]">
                            <span className="text-[#78716C]">
                              申请金额 <span className="font-semibold text-[#1C1917]">{formatAmount(app.amount)}</span>
                            </span>
                            {app.paymentReason && (
                              <span className="text-[#78716C] truncate max-w-[200px]">
                                事由：{app.paymentReason}
                              </span>
                            )}
                          </div>
                        </div>

                        {isEditing && (
                          <div className="p-3 space-y-3 border-t border-[#E7E5E4]">
                            <div>
                              <label className="block text-[12px] font-semibold text-[#1C1917] mb-1">本次付款金额</label>
                              <input
                                type="number"
                                className="ios-input"
                                step="0.01"
                                min="0"
                                value={editingPaymentAppForm.amount}
                                onChange={(e) => setEditingPaymentAppForm((prev) => ({ ...prev, amount: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-[12px] font-semibold text-[#1C1917] mb-1">付款事由</label>
                              <input
                                type="text"
                                className="ios-input"
                                value={editingPaymentAppForm.paymentReason}
                                onChange={(e) => setEditingPaymentAppForm((prev) => ({ ...prev, paymentReason: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-[12px] font-semibold text-[#1C1917] mb-1">申请人</label>
                              <select
                                className="ios-select"
                                value={editingPaymentAppForm.applicantId}
                                onChange={(e) => setEditingPaymentAppForm((prev) => ({ ...prev, applicantId: e.target.value }))}
                              >
                                <option value="">请选择申请人</option>
                                {users.map((u) => (
                                  <option key={u.id} value={u.id}>{u.realName}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <button
                                className="ios-btn ios-btn-secondary ios-btn-sm"
                                onClick={() => { setEditingPaymentAppId(null); setEditingPaymentAppForm({ amount: "", paymentReason: "", applicantId: "" }); }}
                              >
                                取消
                              </button>
                              <button
                                className="ios-btn ios-btn-primary ios-btn-sm"
                                disabled={reSubmitting || !editingPaymentAppForm.amount || Number(editingPaymentAppForm.amount) <= 0 || !editingPaymentAppForm.applicantId}
                                onClick={async () => {
                                  setReSubmitting(true);
                                  try {
                                    const updateRes = await fetch(`/api/payment-applications/${app.id}`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        amount: editingPaymentAppForm.amount,
                                        paymentReason: editingPaymentAppForm.paymentReason || null,
                                        applicantId: editingPaymentAppForm.applicantId,
                                        approvalStatus: "草稿",
                                        approvalInstanceId: null,
                                      }),
                                    });
                                    if (!updateRes.ok) {
                                      const err = await updateRes.json();
                                      alert(err.error || "更新失败");
                                      setReSubmitting(false);
                                      return;
                                    }

                                    const startRes = await fetch("/api/approval-instances", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        businessType: "payment_application",
                                        businessId: app.id,
                                        flowLevel: "common",
                                      }),
                                    });
                                    if (!startRes.ok) {
                                      const err = await startRes.json();
                                      alert(err.error || "发起审批失败");
                                      setReSubmitting(false);
                                      return;
                                    }

                                    setEditingPaymentAppId(null);
                                    setEditingPaymentAppForm({ amount: "", paymentReason: "", applicantId: "" });
                                    fetchPaymentApplications();
                                    fetchPayables();
                                    const apps = getPayableApplications(statusFlowTarget.id);
                                    const instanceIds = apps.map((a) => a.approvalInstanceId).filter(Boolean) as string[];
                                    if (instanceIds.length > 0) {
                                      setPayableAppInstancesLoading(true);
                                      Promise.all(
                                        instanceIds.map(async (id) => {
                                          try {
                                            const res = await fetch(`/api/approval-instances/${id}`);
                                            if (res.ok) {
                                              const json = await res.json();
                                              return { id, data: json.data };
                                            }
                                          } catch {}
                                          return { id, data: null };
                                        })
                                      ).then((results) => {
                                        const map: Record<string, any> = {};
                                        results.forEach((r) => {
                                          if (r.data) map[r.id] = r.data;
                                        });
                                        setPayableAppInstances(map);
                                      }).finally(() => setPayableAppInstancesLoading(false));
                                    }
                                  } catch {
                                    alert("网络错误");
                                  } finally {
                                    setReSubmitting(false);
                                  }
                                }}
                              >
                                {reSubmitting ? "处理中..." : "保存并重新发起"}
                              </button>
                            </div>
                          </div>
                        )}

                        {app.paymentVouchers && app.paymentVouchers.length > 0 && (
                          <div className="p-3">
                            <p className="text-[12px] font-semibold text-[#1C1917] mb-2">支付凭据</p>
                            <div className="space-y-2">
                              {app.paymentVouchers.map((v) => (
                                <div key={v.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
                                  <div className="text-[12px]">
                                    <span className="font-semibold text-[#1C1917]">{formatAmount(v.amount)}</span>
                                    <span className="text-[#78716C] ml-2">{formatDate(v.paymentDate)}</span>
                                    {v.paymentMethod && <span className="text-[#78716C] ml-2">{v.paymentMethod}</span>}
                                  </div>
                                  {v.bankAccount && (
                                    <span className="text-[11px] text-[#78716C]">{v.bankAccount}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {app.approvalInstanceId && (
                          <div className="px-3 pb-3">
                            <ApprovalTimeline instance={instance} loading={payableAppInstancesLoading && !instance} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
              <button className="ios-btn ios-btn-secondary" onClick={() => { setModalType(null); setStatusFlowTarget(null); }}>关闭</button>
            </div>
          </div>
        )}

        {statusFlowTarget && statusFlowTarget.type !== "payableApps" && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[#FAFAF9]">
              <p className="text-[13px] text-[#78716C] mb-1">当前状态</p>
              <div>{getStatusBadge(statusFlowTarget.status)}</div>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#1C1917] mb-2">可流转状态</p>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const flow = statusFlowTarget.type === "lendingOut" ? lendingStatusFlow : appStatusFlow;
                  const nextStatuses = flow[statusFlowTarget.status] || [];
                  return nextStatuses.length > 0
                    ? nextStatuses.map((ns) => (
                        <button
                          key={ns}
                          className="ios-btn ios-btn-primary ios-btn-sm"
                          onClick={() => {
                            handleStatusChange(statusFlowTarget.type, statusFlowTarget.id, ns);
                            setModalType(null);
                            setStatusFlowTarget(null);
                          }}
                        >
                          {ns}
                        </button>
                      ))
                    : <p className="text-[13px] text-[#78716C]">无可用流转</p>;
                })()}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
              <button className="ios-btn ios-btn-secondary" onClick={() => { setModalType(null); setStatusFlowTarget(null); }}>关闭</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={modalType === "detail" && !!detailTarget}
        onClose={() => { setModalType(null); setDetailTarget(null); }}
        title="详情"
        maxWidth="640px"
      >
        {detailTarget && (() => {
          if (detailTarget.type === "payable") {
            const p = payables.find((x) => x.id === detailTarget.id);
            if (!p) return <p className="text-center text-[#78716C] py-8">数据不存在</p>;
            const apps = getPayableApplications(p.id);
            const isOutsourcing = p.sourceType === "outsourcing";
            const contract = p.sourceContract;
            const outsourcing = p.sourceOutsourcing;
            const sourceNo = isOutsourcing
              ? `外包-${outsourcing?.targetName || p.sourceId.slice(-6)}`
              : contract?.contractNo || p.sourceId;
            const counterparty = isOutsourcing ? outsourcing?.targetName : contract?.supplier?.name;
            const projectName = contract?.project?.name || outsourcing?.project?.name || p.project?.name;
            const projectId = contract?.project?.projectSourceId || outsourcing?.project?.projectSourceId || p.projectSourceId;
            const sourceAmount = isOutsourcing
              ? (outsourcing ? Number(outsourcing.amount) : 0)
              : (contract ? parseFloat(contract.totalAmount) : 0);
            const invoicedAmount = contract?.invoicedAmount ? parseFloat(contract.invoicedAmount) : 0;
            const paidAmount = p.paidAmount;
            const unpaid = p.amount - p.paidAmount;
            const supplier = contract?.supplier;
            const bankName = supplier?.bankName;
            const bankAccount = supplier?.bankAccount;

            return (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#FAFAF9] space-y-3">
                  <div className="flex items-center gap-2 text-[13px]">
                    <FileText className="w-3.5 h-3.5 text-[#1C1917] shrink-0" />
                    <span className="font-mono font-semibold text-[#1C1917]">{sourceNo}</span>
                    <span className="text-[#A8A29E]">|</span>
                    {isOutsourcing ? (
                      <span className="ios-badge ios-badge-green text-[11px]!">个人</span>
                    ) : (
                      <Building2 className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                    )}
                    <span className="truncate">{counterparty || "-"}</span>
                  </div>
                  {projectName && (
                    <div className="flex items-center gap-1.5 text-[12px]">
                      <span className="text-[#78716C]">关联项目:</span>
                      <span className="font-semibold text-[#1C1917]">{projectName}</span>
                      {projectId && <span className="text-[#78716C]">({projectId})</span>}
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-3 pt-2 border-t border-[#E7E5E4]">
                    <div className="text-center">
                      <p className="text-[11px] text-[#78716C] mb-0.5">合同金额</p>
                      <p className="text-[15px] font-bold text-[#1C1917]">{formatAmount(sourceAmount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] text-[#78716C] mb-0.5">已收票</p>
                      <p className="text-[15px] font-bold text-[#1C1917]">{formatAmount(invoicedAmount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] text-[#78716C] mb-0.5">已付</p>
                      <p className="text-[15px] font-bold text-[#1C1917]">{formatAmount(paidAmount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] text-[#78716C] mb-0.5">未付</p>
                      <p className="text-[15px] font-bold text-[#1C1917]">{formatAmount(unpaid)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#FAFAF9] space-y-2">
                  <div className="flex items-center gap-2 text-[12px] text-[#78716C]">
                    <span>🏦</span>
                    <span className="font-semibold">收款方银行信息</span>
                  </div>
                  {bankName || bankAccount ? (
                    <div className="text-[13px] space-y-1">
                      <p><span className="text-[#78716C]">开户行：</span><span className="font-semibold text-[#1C1917]">{bankName || "-"}</span></p>
                      <p><span className="text-[#78716C]">账  号：</span><span className="font-mono font-semibold text-[#1C1917]">{bankAccount ? `****${bankAccount.slice(-4)}` : "-"}</span></p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#A8A29E]">暂无银行账户信息</p>
                  )}
                </div>

                {apps.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-[13px] font-semibold text-[#1C1917]">付款申请记录</p>
                    {apps.map((app) => {
                      const instance = app.approvalInstanceId ? payableAppInstances[app.approvalInstanceId] : null;
                      return (
                        <div key={app.id} className="rounded-xl border border-[#E7E5E4] overflow-hidden">
                          <div className="p-3 bg-[#FAFAF9]">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold text-[#1C1917]">{app.applicant?.realName || "-"}</span>
                                <span className="text-[12px] text-[#78716C]">{formatDate(app.createdAt)}</span>
                              </div>
                              {getStatusBadge(app.approvalStatus)}
                            </div>
                            <div className="flex items-center gap-4 text-[12px]">
                              <span className="text-[#78716C]">
                                申请金额 <span className="font-semibold text-[#1C1917]">{formatAmount(app.amount)}</span>
                              </span>
                              {app.paymentReason && (
                                <span className="text-[#78716C] truncate max-w-[200px]">事由：{app.paymentReason}</span>
                              )}
                            </div>
                          </div>
                          {app.approvalInstanceId && (
                            <div className="px-3 pb-3">
                              <ApprovalTimeline instance={instance} loading={payableAppInstancesLoading && !instance} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-[#78716C] text-[13px] rounded-xl bg-[#FAFAF9]">
                    暂无付款申请记录
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
                  <button className="ios-btn ios-btn-secondary" onClick={() => { setModalType(null); setDetailTarget(null); }}>关闭</button>
                </div>
              </div>
            );
          }
          return <p className="text-center text-[#78716C] py-8">未知类型</p>;
        })()}
      </Modal>
    </>
  );
}
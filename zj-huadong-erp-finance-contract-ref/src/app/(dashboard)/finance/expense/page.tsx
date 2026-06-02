"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
} from "lucide-react";
import Modal from "@/components/Modal";

interface ExpenseContract {
  id: string;
  contractNo: string;
  projectSourceId: string | null;
  supplierId: string | null;
  totalAmount: string;
  contractType: string;
  status: string;
  supplier: { id: string; name: string } | null;
  project: { name: string; projectSourceId: string } | null;
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
  createdAt: string;
  payable: Payable;
  applicant: { id: string; realName: string };
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
  description: string | null;
  status: string;
  project: { name: string } | null;
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
  returns?: { id: string; amount: number; returnDate: string; remark: string | null }[];
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
  loanOffsetAmount: number;
  createdAt: string;
  applicant: { id: string; realName: string };
  project: { name: string } | null;
  items: { id: string; expenseType: string; amount: number; description: string | null; projectSourceId: string | null }[];
}

interface SalaryPayment {
  id: string;
  employeeId: string;
  period: string;
  baseSalary: number;
  bonus: number;
  allowance: number;
  deduction: number;
  netSalary: number;
  paymentDate: string | null;
  status: string;
  remark: string | null;
  createdAt: string;
  employee: { id: string; realName: string; username: string };
}

interface User {
  id: string;
  realName: string;
  username: string;
}

interface Project {
  id: string;
  projectSourceId: string;
  name: string;
  projectCode: string;
}

interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNo: string;
  accountType: string;
  isActive: boolean;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type TabType = "contractExpense" | "otherExpense" | "lendingOut" | "expenseReport" | "salaryPayment";

type ModalType =
  | "paymentApplication"
  | "otherExpenseForm"
  | "lendingOutForm"
  | "lendingReturnForm"
  | "expenseReportForm"
  | "salaryPaymentForm"
  | "deleteConfirm"
  | "statusFlow"
  | null;

const sourceTypeMap: Record<string, string> = {
  expense_contract: "支出合同",
  expense_report: "费用报销",
  loan_request: "备用金借款",
  income_contract: "收入合同",
  non_contract_income: "非合同收入",
  non_contract_expense: "非合同支出",
};

const appStatusConfig: Record<string, { color: string; label: string }> = {
  草稿: { color: "ios-badge-gray", label: "草稿" },
  审批中: { color: "ios-badge-orange", label: "审批中" },
  已批准: { color: "ios-badge-green", label: "已批准" },
  已驳回: { color: "ios-badge-red", label: "已驳回" },
  已付款: { color: "ios-badge-blue", label: "已付款" },
  未还清: { color: "ios-badge-orange", label: "未还清" },
  已还清: { color: "ios-badge-green", label: "已还清" },
};

const appStatusFlow: Record<string, string[]> = {
  草稿: ["审批中"],
  审批中: ["已批准", "已驳回"],
  已批准: [],
  已驳回: [],
};

const lendingStatusFlow: Record<string, string[]> = {
  草稿: ["审批中"],
  审批中: ["已批准", "已驳回"],
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
  transactionDate: "",
  description: "",
  projectSourceId: "",
};

const emptyLendingOutForm = {
  lendingType: "",
  biddingId: "",
  borrowerName: "",
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
};

const emptyExpenseReportForm = {
  applicantId: "",
  expenseType: "其他",
  description: "",
  items: [{ ...emptyExpenseItem }],
};

const emptySalaryPaymentForm = {
  employeeId: "",
  period: "",
  baseSalary: "",
  bonus: "",
  allowance: "",
  deduction: "",
  paymentDate: "",
  remark: "",
};

export default function FinanceExpensePage() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("contractExpense");

  const [payables, setPayables] = useState<Payable[]>([]);
  const [paymentApplications, setPaymentApplications] = useState<PaymentApplication[]>([]);
  const [paymentVouchers, setPaymentVouchers] = useState<PaymentVoucher[]>([]);
  const [nonContractExpenses, setNonContractExpenses] = useState<NonContractExpense[]>([]);
  const [lendingOuts, setLendingOuts] = useState<LendingOut[]>([]);
  const [expenseReports, setExpenseReports] = useState<ExpenseReport[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);

  const [users, setUsers] = useState<User[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [biddings, setBiddings] = useState<Bidding[]>([]);

  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalType, setModalType] = useState<ModalType>(null);
  const [editingOtherExpense, setEditingOtherExpense] = useState<NonContractExpense | null>(null);
  const [editingSalaryPayment, setEditingSalaryPayment] = useState<SalaryPayment | null>(null);

  const [paymentAppForm, setPaymentAppForm] = useState(emptyPaymentAppForm);
  const [otherExpenseForm, setOtherExpenseForm] = useState(emptyOtherExpenseForm);
  const [lendingOutForm, setLendingOutForm] = useState(emptyLendingOutForm);
  const [lendingReturnForm, setLendingReturnForm] = useState(emptyLendingReturnForm);
  const [expenseReportForm, setExpenseReportForm] = useState(emptyExpenseReportForm);
  const [salaryPaymentForm, setSalaryPaymentForm] = useState(emptySalaryPaymentForm);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [returnTargetLending, setReturnTargetLending] = useState<LendingOut | null>(null);
  const [statusFlowTarget, setStatusFlowTarget] = useState<{ type: string; id: string; status: string } | null>(null);

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
      const [contractRes, outsourcingRes] = await Promise.all([
        fetch("/api/payables?sourceType=expense_contract&pageSize=200"),
        fetch("/api/payables?sourceType=outsourcing&pageSize=200"),
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
  }, []);

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
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());
      const res = await fetch(`/api/non-contract-expenses?${params}`);
      const json = await res.json();
      if (res.ok) {
        setNonContractExpenses(json.data || []);
        if (json.pagination) setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取其他支出失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, pagination.page, pagination.pageSize]);

  const fetchLendingOuts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lending-outs?include=returns&pageSize=200");
      const json = await res.json();
      if (res.ok) setLendingOuts(json.data || []);
    } catch (err) {
      console.error("获取借出款失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());
      const res = await fetch(`/api/expense-reports?${params}`);
      const json = await res.json();
      if (res.ok) {
        setExpenseReports(json.data || []);
        if (json.pagination) setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取费用报销失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, pagination.page, pagination.pageSize]);

  const fetchSalaryPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("include", "employee");
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());
      const res = await fetch(`/api/salary-payments?${params}`);
      const json = await res.json();
      if (res.ok) {
        setSalaryPayments(json.data || []);
        if (json.pagination) setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取工资发放失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, pagination.page, pagination.pageSize]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [usersRes, projectsRes, bankAccountsRes] = await Promise.all([
        fetch("/api/users?pageSize=200"),
        fetch("/api/projects?pageSize=200"),
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
      if (projectsRes.ok) {
        const j = await projectsRes.json();
        setProjects(j.data || []);
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
      fetchSalaryPayments();
    }
  }, [activeTab, fetchPayables, fetchPaymentApplications, fetchPaymentVouchers, fetchNonContractExpenses, fetchLendingOuts, fetchExpenseReports, fetchSalaryPayments]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearch("");
    setPagination((prev) => ({ ...prev, page: 1 }));
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
      transactionDate: formatDate(item.transactionDate),
      description: item.description || "",
      projectSourceId: item.projectSourceId || "",
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
        transactionDate: otherExpenseForm.transactionDate || new Date().toISOString(),
        description: otherExpenseForm.description.trim() || null,
        projectSourceId: otherExpenseForm.projectSourceId || null,
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
        setModalType(null);
        setOtherExpenseForm(emptyOtherExpenseForm);
        setEditingOtherExpense(null);
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
          amount: Number(lendingOutForm.amount),
          lendingDate: lendingOutForm.lendingDate || new Date().toISOString(),
          expectedReturnDate: lendingOutForm.expectedReturnDate || null,
          description: lendingOutForm.description.trim() || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
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
      applicantId: "",
      expenseType: "其他",
      description: "",
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

  const handleSubmitExpenseReport = async () => {
    if (!expenseReportForm.applicantId) { setFormError("请选择报销人"); return; }
    if (expenseReportForm.items.length === 0) { setFormError("请至少添加一条明细"); return; }
    for (let i = 0; i < expenseReportForm.items.length; i++) {
      const item = expenseReportForm.items[i];
      if (!item.expenseType) { setFormError(`第${i + 1}行费用类型必填`); return; }
      if (!item.amount || Number(item.amount) <= 0) { setFormError(`第${i + 1}行金额无效`); return; }
    }
    setSaving(true);
    setFormError("");
    try {
      const total = getExpenseTotal();
      const res = await fetch("/api/expense-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId: expenseReportForm.applicantId,
          expenseType: expenseReportForm.expenseType,
          amount: total,
          description: expenseReportForm.description.trim() || null,
          status: "草稿",
          items: expenseReportForm.items.map((item) => ({
            expenseType: item.expenseType,
            amount: Number(item.amount),
            description: item.description.trim() || null,
            projectSourceId: item.relateProject ? item.projectSourceId || null : null,
          })),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setModalType(null);
        setExpenseReportForm({ applicantId: "", expenseType: "其他", description: "", items: [{ ...emptyExpenseItem }] });
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

  const openSalaryPaymentModal = () => {
    setEditingSalaryPayment(null);
    setSalaryPaymentForm(emptySalaryPaymentForm);
    setFormError("");
    setModalType("salaryPaymentForm");
  };

  const openEditSalaryPayment = (item: SalaryPayment) => {
    setEditingSalaryPayment(item);
    setSalaryPaymentForm({
      employeeId: item.employeeId,
      period: item.period,
      baseSalary: String(item.baseSalary),
      bonus: String(item.bonus),
      allowance: String(item.allowance),
      deduction: String(item.deduction),
      paymentDate: item.paymentDate ? formatDate(item.paymentDate) : "",
      remark: item.remark || "",
    });
    setFormError("");
    setModalType("salaryPaymentForm");
  };

  const calcNetSalary = () => {
    const base = Number(salaryPaymentForm.baseSalary) || 0;
    const bonus = Number(salaryPaymentForm.bonus) || 0;
    const allowance = Number(salaryPaymentForm.allowance) || 0;
    const deduction = Number(salaryPaymentForm.deduction) || 0;
    return base + bonus + allowance - deduction;
  };

  const handleSubmitSalaryPayment = async () => {
    if (!salaryPaymentForm.employeeId) { setFormError("请选择员工"); return; }
    if (!salaryPaymentForm.period) { setFormError("请选择工资周期"); return; }
    if (!salaryPaymentForm.baseSalary || Number(salaryPaymentForm.baseSalary) < 0) { setFormError("请输入有效基本工资"); return; }
    setSaving(true);
    setFormError("");
    try {
      const body = {
        employeeId: salaryPaymentForm.employeeId,
        period: salaryPaymentForm.period,
        baseSalary: Number(salaryPaymentForm.baseSalary) || 0,
        bonus: Number(salaryPaymentForm.bonus) || 0,
        allowance: Number(salaryPaymentForm.allowance) || 0,
        deduction: Number(salaryPaymentForm.deduction) || 0,
        netSalary: calcNetSalary(),
        paymentDate: salaryPaymentForm.paymentDate || null,
        remark: salaryPaymentForm.remark.trim() || null,
      };
      const url = editingSalaryPayment
        ? `/api/salary-payments/${editingSalaryPayment.id}`
        : "/api/salary-payments";
      const method = editingSalaryPayment ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        setModalType(null);
        setSalaryPaymentForm(emptySalaryPaymentForm);
        setEditingSalaryPayment(null);
        fetchSalaryPayments();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSalaryPayment = async () => {
    if (!deleteTarget || deleteTarget.type !== "salaryPayment") return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/salary-payments/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteTarget(null);
        setModalType(null);
        fetchSalaryPayments();
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

  const handleStatusChange = async (type: string, id: string, newStatus: string) => {
    try {
      let url = "";
      if (type === "expenseReport") url = `/api/expense-reports/${id}`;
      else if (type === "salaryPayment") url = `/api/salary-payments/${id}`;
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
        else if (type === "salaryPayment") fetchSalaryPayments();
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

  const tabs = [
    { key: "contractExpense" as TabType, label: "合同支出", icon: <ArrowDownCircle className="w-4 h-4" /> },
    { key: "otherExpense" as TabType, label: "其他支出", icon: <DollarSign className="w-4 h-4" /> },
    { key: "lendingOut" as TabType, label: "借出款", icon: <Landmark className="w-4 h-4" /> },
    { key: "expenseReport" as TabType, label: "费用报销", icon: <FileText className="w-4 h-4" /> },
    { key: "salaryPayment" as TabType, label: "工资发放", icon: <CreditCard className="w-4 h-4" /> },
  ];

  const getPrimaryBtnLabel = () => {
    if (activeTab === "contractExpense") return "付款申请";
    if (activeTab === "otherExpense") return "新增支出";
    if (activeTab === "lendingOut") return "新增借出";
    if (activeTab === "expenseReport") return "新增报销";
    return "新增工资";
  };

  const handlePrimaryAction = () => {
    if (activeTab === "contractExpense") openPaymentAppModal();
    else if (activeTab === "otherExpense") openCreateOtherExpense();
    else if (activeTab === "lendingOut") openLendingOutModal();
    else if (activeTab === "expenseReport") openExpenseReportModal();
    else openSalaryPaymentModal();
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
          <button className="ios-btn ios-btn-primary" onClick={handlePrimaryAction}>
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
              <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
              <p>加载中...</p>
            </div>
          ) : payables.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
                <ArrowDownCircle className="w-8 h-8 text-[#86868B]" />
              </div>
              <p>暂无合同支出记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr>
                    <th>来源编号</th>
                    <th>项目名称</th>
                    <th>收款方</th>
                    <th>来源金额</th>
                    <th>应付金额</th>
                    <th>已付金额</th>
                    <th>未付金额</th>
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
                      <tr key={p.id}>
                        <td className="font-mono text-[13px] font-semibold text-[#007AFF]">
                          {sourceNo}
                        </td>
                        <td>
                          {projectName ? (
                            <div>
                              <span className="font-semibold text-[#1D1D1F]">{projectName}</span>
                              <span className="block text-[11px] text-[#86868B]">{p.projectSourceId}</span>
                            </div>
                          ) : p.projectSourceId || "-"}
                        </td>
                        <td>
                          {counterparty ? (
                            <div className="flex items-center gap-1.5">
                              {isOutsourcing ? (
                                <span className="ios-badge ios-badge-green text-[11px]!">个人</span>
                              ) : (
                                <Building2 className="w-3.5 h-3.5 text-[#86868B]" />
                              )}
                              {counterparty}
                            </div>
                          ) : "-"}
                        </td>
                        <td className="font-semibold">{sourceAmount}</td>
                        <td className="font-semibold text-[#FF3B30]">{formatAmount(p.amount)}</td>
                        <td className="font-semibold">{formatAmount(p.paidAmount)}</td>
                        <td className="font-semibold text-[#FF9500]">{formatAmount(unpaid)}</td>
                        <td>{getStatusBadge(p.status)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            {apps.length > 0 && (
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm"
                                onClick={() => {
                                  setStatusFlowTarget({ type: "payableApps", id: p.id, status: p.status });
                                  setModalType("statusFlow");
                                }}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                记录
                              </button>
                            )}
                            {unpaid > 0 && (
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF]!"
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "otherExpense" && (
        <div className="bento-card-static">
          <div className="filter-bar">
            <div className="relative flex-1 min-w-[200px] max-w-[360px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
              <input
                type="text"
                className="ios-input pl-10"
                placeholder="搜索交易对方、说明..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>
            <div className="ml-auto text-[13px] text-[#86868B]">
              共 <span className="font-semibold text-[#1D1D1F]">{pagination.total}</span> 条记录
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
              <p>加载中...</p>
            </div>
          ) : nonContractExpenses.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
                <DollarSign className="w-8 h-8 text-[#86868B]" />
              </div>
              <p>{search ? "没有匹配的支出记录" : "暂无其他支出记录"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr>
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
                      <tr key={item.id}>
                        <td className="font-semibold">{item.counterparty || "-"}</td>
                        <td className="text-[#FF3B30] font-semibold">{formatAmount(item.amount)}</td>
                        <td className="text-[#86868B]">{formatDate(item.transactionDate)}</td>
                        <td className="text-[#86868B] max-w-[200px] truncate">{item.description || "-"}</td>
                        <td className="text-[#86868B]">{item.project?.name || item.projectSourceId || "-"}</td>
                        <td>{getStatusBadge(item.status)}</td>
                        <td>
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => openEditOtherExpense(item)}
                              disabled={item.status !== "草稿" && item.status !== "已驳回"}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                              onClick={() => {
                                setDeleteTarget({ type: "otherExpense", id: item.id });
                                setModalType("deleteConfirm");
                              }}
                              disabled={item.status !== "草稿" && item.status !== "已驳回"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {nextStatuses.map((ns) => (
                              <button
                                key={ns}
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF]!"
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
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-[#F0F0F0]">
                  <button
                    className="ios-btn ios-btn-secondary ios-btn-sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  >
                    上一页
                  </button>
                  <span className="text-[13px] text-[#86868B] px-3">{pagination.page} / {pagination.totalPages}</span>
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
      )}

      {activeTab === "lendingOut" && (
        <div className="bento-card-static">
          {loading ? (
            <div className="empty-state">
              <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
              <p>加载中...</p>
            </div>
          ) : lendingOuts.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
                <Landmark className="w-8 h-8 text-[#86868B]" />
              </div>
              <p>暂无借出款记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr>
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
                      <tr key={item.id}>
                        <td>
                          <span className="ios-badge ios-badge-blue">{item.lendingType}</span>
                        </td>
                        <td className="font-semibold">{item.borrowerName}</td>
                        <td className="text-[#FF3B30] font-semibold">{formatAmount(item.amount)}</td>
                        <td className="font-semibold">{formatAmount(item.returnedAmount)}</td>
                        <td className="font-semibold text-[#FF9500]">{formatAmount(item.remainingAmount)}</td>
                        <td className="text-[#86868B]">{formatDate(item.lendingDate)}</td>
                        <td>{getStatusBadge(item.status)}</td>
                        <td>
                          <div className="flex items-center gap-1 flex-wrap">
                            {item.remainingAmount > 0 && (
                              <button
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF]!"
                                onClick={() => openLendingReturnModal(item)}
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                收回
                              </button>
                            )}
                            {nextStatuses.map((ns) => (
                              <button
                                key={ns}
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF]!"
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
            </div>
          )}
        </div>
      )}

      {activeTab === "expenseReport" && (
        <div className="bento-card-static">
          <div className="filter-bar">
            <div className="relative flex-1 min-w-[200px] max-w-[360px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
              <input
                type="text"
                className="ios-input pl-10"
                placeholder="搜索申请人、报销类型..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>
            <div className="ml-auto text-[13px] text-[#86868B]">
              共 <span className="font-semibold text-[#1D1D1F]">{pagination.total}</span> 条记录
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
              <p>加载中...</p>
            </div>
          ) : expenseReports.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
                <FileText className="w-8 h-8 text-[#86868B]" />
              </div>
              <p>{search ? "没有匹配的报销记录" : "暂无费用报销记录"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr>
                    <th>申请人</th>
                    <th>报销类型</th>
                    <th>总金额</th>
                    <th>状态</th>
                    <th>申请时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseReports.map((item) => {
                    const nextStatuses = appStatusFlow[item.status] || [];
                    return (
                      <tr key={item.id}>
                        <td className="font-semibold">{item.applicant?.realName || "-"}</td>
                        <td>
                          <span className="ios-badge ios-badge-blue">{item.expenseType}</span>
                        </td>
                        <td className="text-[#FF3B30] font-semibold">{formatAmount(item.amount)}</td>
                        <td>{getStatusBadge(item.status)}</td>
                        <td className="text-[#86868B]">{formatDate(item.createdAt)}</td>
                        <td>
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => {
                                setStatusFlowTarget({ type: "expenseReport", id: item.id, status: item.status });
                                setModalType("statusFlow");
                              }}
                              title="查看明细"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {nextStatuses.map((ns) => (
                              <button
                                key={ns}
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF]!"
                                onClick={() => handleStatusChange("expenseReport", item.id, ns)}
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
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-[#F0F0F0]">
                  <button
                    className="ios-btn ios-btn-secondary ios-btn-sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  >
                    上一页
                  </button>
                  <span className="text-[13px] text-[#86868B] px-3">{pagination.page} / {pagination.totalPages}</span>
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
      )}

      {activeTab === "salaryPayment" && (
        <div className="bento-card-static">
          <div className="filter-bar">
            <div className="relative flex-1 min-w-[200px] max-w-[360px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
              <input
                type="text"
                className="ios-input pl-10"
                placeholder="搜索员工、工资周期..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>
            <div className="ml-auto text-[13px] text-[#86868B]">
              共 <span className="font-semibold text-[#1D1D1F]">{pagination.total}</span> 条记录
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
              <p>加载中...</p>
            </div>
          ) : salaryPayments.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-[#86868B]" />
              </div>
              <p>{search ? "没有匹配的工资记录" : "暂无工资发放记录"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr>
                    <th>员工</th>
                    <th>工资周期</th>
                    <th>基本工资</th>
                    <th>奖金</th>
                    <th>补贴</th>
                    <th>扣款</th>
                    <th>实发工资</th>
                    <th>发放日期</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryPayments.map((item) => {
                    const nextStatuses = appStatusFlow[item.status] || [];
                    return (
                      <tr key={item.id}>
                        <td className="font-semibold">{item.employee?.realName || "-"}</td>
                        <td className="font-mono text-[13px]">{item.period}</td>
                        <td className="text-[#86868B]">{formatAmount(item.baseSalary)}</td>
                        <td className="text-[#86868B]">{formatAmount(item.bonus)}</td>
                        <td className="text-[#86868B]">{formatAmount(item.allowance)}</td>
                        <td className="text-[#86868B]">{formatAmount(item.deduction)}</td>
                        <td className="text-[#FF3B30] font-semibold">{formatAmount(item.netSalary)}</td>
                        <td className="text-[#86868B]">{formatDate(item.paymentDate)}</td>
                        <td>{getStatusBadge(item.status)}</td>
                        <td>
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              onClick={() => openEditSalaryPayment(item)}
                              disabled={item.status !== "草稿" && item.status !== "已驳回"}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                              onClick={() => {
                                setDeleteTarget({ type: "salaryPayment", id: item.id });
                                setModalType("deleteConfirm");
                              }}
                              disabled={item.status !== "草稿" && item.status !== "已驳回"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {nextStatuses.map((ns) => (
                              <button
                                key={ns}
                                className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF]!"
                                onClick={() => handleStatusChange("salaryPayment", item.id, ns)}
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
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-[#F0F0F0]">
                  <button
                    className="ios-btn ios-btn-secondary ios-btn-sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  >
                    上一页
                  </button>
                  <span className="text-[13px] text-[#86868B] px-3">{pagination.page} / {pagination.totalPages}</span>
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
      )}

      <Modal
        isOpen={modalType === "paymentApplication"}
        onClose={() => setModalType(null)}
        title="付款申请"
        maxWidth="520px"
      >
        <div className="space-y-5">
          {formError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">{formError}</div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">关联应付记录 <span className="text-[#FF3B30]">*</span></label>
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
            return (
              <div className="p-3.5 rounded-xl bg-[#F5F5F7] space-y-2.5">
                <div className="flex items-center gap-2 text-[13px]">
                  <FileText className="w-3.5 h-3.5 text-[#007AFF] shrink-0" />
                  <span className="font-mono font-semibold text-[#007AFF]">{sourceNo}</span>
                  <span className="text-[#C7C7CC]">|</span>
                  {isOutsourcing ? (
                    <span className="ios-badge ios-badge-green text-[11px]!">个人</span>
                  ) : (
                    <Building2 className="w-3.5 h-3.5 text-[#86868B] shrink-0" />
                  )}
                  <span className="truncate">{counterparty || "-"}</span>
                </div>
                {projectName && (
                  <div className="flex items-center gap-1.5 text-[12px]">
                    <span className="text-[#86868B]">关联项目:</span>
                    <span className="font-semibold text-[#1D1D1F]">{projectName}</span>
                    <span className="text-[#86868B]">({projectId})</span>
                  </div>
                )}
                <div className="flex items-center gap-4 text-[12px]">
                  <span className="text-[#86868B]">{isOutsourcing ? "外包" : "合同"} <span className="font-semibold text-[#1D1D1F]">{formatAmount(sourceAmount)}</span></span>
                  <span className="text-[#86868B]">已付 <span className="font-semibold text-[#34C759]">{formatAmount(selectedPayable.paidAmount)}</span></span>
                  <span className="text-[#86868B]">未付 <span className="font-semibold text-[#FF9500]">{formatAmount(selectedPayable.amount - selectedPayable.paidAmount)}</span></span>
                </div>
              </div>
            );
          })()}

          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">本次付款金额 <span className="text-[#FF3B30]">*</span></label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B] text-[15px] font-medium">¥</span>
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
                <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">付款方式</label>
                <select
                  className="ios-select"
                  value={paymentAppForm.paymentMethod}
                  onChange={(e) => setPaymentAppForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                >
                  <option value="">请选择</option>
                  <option value="银行转账">银行转账</option>
                  <option value="现金">现金</option>
                  <option value="支票">支票</option>
                  <option value="汇票">汇票</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">付款账户</label>
                <select
                  className="ios-select"
                  value={paymentAppForm.bankAccount}
                  onChange={(e) => setPaymentAppForm((p) => ({ ...p, bankAccount: e.target.value }))}
                >
                  <option value="">请选择银行账户</option>
                  {bankAccounts.map((ba) => (
                    <option key={ba.id} value={`${ba.bankName} ${ba.accountNo}`}>
                      {ba.accountName} - {ba.bankName} (****{ba.accountNo.slice(-4)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">付款事由</label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="请输入付款事由"
                  value={paymentAppForm.paymentReason}
                  onChange={(e) => setPaymentAppForm((p) => ({ ...p, paymentReason: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">申请人 <span className="text-[#FF3B30]">*</span></label>
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
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">备注</label>
              <input
                type="text"
                className="ios-input"
                placeholder="选填"
                value={paymentAppForm.remark}
                onChange={(e) => setPaymentAppForm((p) => ({ ...p, remark: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0]">
            <button className="ios-btn ios-btn-secondary" onClick={() => setModalType(null)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmitPaymentApp} disabled={saving}>
              {saving ? "保存中..." : "提交申请"}
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
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">{formError}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">金额（元） <span className="text-[#FF3B30]">*</span></label>
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
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">交易对方</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入交易对方"
                value={otherExpenseForm.counterparty}
                onChange={(e) => setOtherExpenseForm((p) => ({ ...p, counterparty: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">交易日期</label>
            <input
              type="date"
              className="ios-input"
              value={otherExpenseForm.transactionDate}
              onChange={(e) => setOtherExpenseForm((p) => ({ ...p, transactionDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">说明</label>
            <textarea
              className="ios-textarea"
              placeholder="请输入说明"
              value={otherExpenseForm.description}
              onChange={(e) => setOtherExpenseForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">关联项目</label>
            <select
              className="ios-select"
              value={otherExpenseForm.projectSourceId}
              onChange={(e) => setOtherExpenseForm((p) => ({ ...p, projectSourceId: e.target.value }))}
            >
              <option value="">不关联项目</option>
              {projects.map((p) => (
                <option key={p.projectSourceId} value={p.projectSourceId}>
                  {p.projectSourceId} - {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0]">
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
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">{formError}</div>
          )}
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">借出类型 <span className="text-[#FF3B30]">*</span></label>
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
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">关联投标</label>
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
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">借入方 <span className="text-[#FF3B30]">*</span></label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入借入方"
              value={lendingOutForm.borrowerName}
              onChange={(e) => setLendingOutForm((p) => ({ ...p, borrowerName: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">借出金额（元） <span className="text-[#FF3B30]">*</span></label>
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
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">借出日期</label>
              <input
                type="date"
                className="ios-input"
                value={lendingOutForm.lendingDate}
                onChange={(e) => setLendingOutForm((p) => ({ ...p, lendingDate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">预计归还日期</label>
            <input
              type="date"
              className="ios-input"
              value={lendingOutForm.expectedReturnDate}
              onChange={(e) => setLendingOutForm((p) => ({ ...p, expectedReturnDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">说明</label>
            <textarea
              className="ios-textarea"
              placeholder="请输入说明"
              value={lendingOutForm.description}
              onChange={(e) => setLendingOutForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0]">
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
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">{formError}</div>
          )}
          {returnTargetLending && (
            <div className="p-3 rounded-xl bg-[#F5F5F7]">
              <p className="text-[13px] text-[#86868B] mb-1">借出记录</p>
              <p className="text-[14px] font-semibold">{returnTargetLending.borrowerName} - {formatAmount(returnTargetLending.amount)}</p>
              <div className="flex gap-4 mt-1 text-[12px] text-[#86868B]">
                <span>已收回: {formatAmount(returnTargetLending.returnedAmount)}</span>
                <span>剩余: {formatAmount(returnTargetLending.remainingAmount)}</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">收回金额（元） <span className="text-[#FF3B30]">*</span></label>
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
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">收回日期</label>
              <input
                type="date"
                className="ios-input"
                value={lendingReturnForm.returnDate}
                onChange={(e) => setLendingReturnForm((p) => ({ ...p, returnDate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">备注</label>
            <textarea
              className="ios-textarea"
              placeholder="请输入备注"
              value={lendingReturnForm.remark}
              onChange={(e) => setLendingReturnForm((p) => ({ ...p, remark: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0]">
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
        maxWidth="720px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">{formError}</div>
          )}
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">报销人 <span className="text-[#FF3B30]">*</span></label>
            <select
              className="ios-select"
              value={expenseReportForm.applicantId}
              onChange={(e) => setExpenseReportForm((p) => ({ ...p, applicantId: e.target.value }))}
            >
              <option value="">请选择报销人</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.realName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">说明</label>
            <textarea
              className="ios-textarea"
              placeholder="请输入报销说明"
              value={expenseReportForm.description}
              onChange={(e) => setExpenseReportForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-semibold text-[#1D1D1F]">报销明细</label>
              <button className="ios-btn ios-btn-secondary ios-btn-sm" onClick={addExpenseItem}>
                <Plus className="w-3.5 h-3.5" />
                添加行
              </button>
            </div>
            <div className="space-y-3">
              {expenseReportForm.items.map((item, index) => (
                <div key={index} className="p-3 rounded-xl border border-[#E5E5EA] bg-[#FAFAFA]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-semibold text-[#86868B]">第 {index + 1} 行</span>
                    {expenseReportForm.items.length > 1 && (
                      <button
                        className="ios-btn ios-btn-ghost ios-btn-sm text-[#FF3B30]!"
                        onClick={() => removeExpenseItem(index)}
                      >
                        <MinusCircle className="w-3.5 h-3.5" />
                        删除
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-[#1D1D1F] mb-1">费用类型 <span className="text-[#FF3B30]">*</span></label>
                      <select
                        className="ios-select"
                        value={item.expenseType}
                        onChange={(e) => updateExpenseItem(index, "expenseType", e.target.value)}
                      >
                        <option value="">请选择</option>
                        {expenseItemTypes.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#1D1D1F] mb-1">金额（元） <span className="text-[#FF3B30]">*</span></label>
                      <input
                        type="number"
                        className="ios-input"
                        placeholder="请输入金额"
                        min="0"
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => updateExpenseItem(index, "amount", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[12px] font-medium text-[#1D1D1F] mb-1">说明</label>
                      <input
                        type="text"
                        className="ios-input"
                        placeholder="请输入说明"
                        value={item.description}
                        onChange={(e) => updateExpenseItem(index, "description", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-3">
                      <label className="flex items-center gap-2 text-[13px] text-[#1D1D1F] cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-[#C7C7CC] accent-[#007AFF]"
                          checked={item.relateProject}
                          onChange={(e) => updateExpenseItem(index, "relateProject", e.target.checked)}
                        />
                        关联项目
                      </label>
                      {item.relateProject && (
                        <select
                          className="ios-select flex-1"
                          value={item.projectSourceId}
                          onChange={(e) => updateExpenseItem(index, "projectSourceId", e.target.value)}
                        >
                          <option value="">请选择项目</option>
                          {projects.map((p) => (
                            <option key={p.projectSourceId} value={p.projectSourceId}>
                              {p.projectSourceId} - {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 rounded-xl bg-[#F5F5F7] flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#1D1D1F]">总金额</span>
              <span className="text-[15px] font-bold text-[#FF3B30]">{formatAmount(getExpenseTotal())}</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0]">
            <button className="ios-btn ios-btn-secondary" onClick={() => setModalType(null)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmitExpenseReport} disabled={saving}>
              {saving ? "保存中..." : "提交报销"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalType === "salaryPaymentForm"}
        onClose={() => setModalType(null)}
        title={editingSalaryPayment ? "编辑工资发放" : "新增工资发放"}
        maxWidth="520px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#FF3B30]/8 text-[#FF3B30] text-[13px] font-medium">{formError}</div>
          )}
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">员工 <span className="text-[#FF3B30]">*</span></label>
            <select
              className="ios-select"
              value={salaryPaymentForm.employeeId}
              onChange={(e) => setSalaryPaymentForm((p) => ({ ...p, employeeId: e.target.value }))}
            >
              <option value="">请选择员工</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.realName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">工资周期 <span className="text-[#FF3B30]">*</span></label>
            <input
              type="month"
              className="ios-input"
              value={salaryPaymentForm.period}
              onChange={(e) => setSalaryPaymentForm((p) => ({ ...p, period: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">基本工资（元） <span className="text-[#FF3B30]">*</span></label>
              <input
                type="number"
                className="ios-input"
                placeholder="请输入基本工资"
                min="0"
                step="0.01"
                value={salaryPaymentForm.baseSalary}
                onChange={(e) => setSalaryPaymentForm((p) => ({ ...p, baseSalary: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">奖金（元）</label>
              <input
                type="number"
                className="ios-input"
                placeholder="请输入奖金"
                min="0"
                step="0.01"
                value={salaryPaymentForm.bonus}
                onChange={(e) => setSalaryPaymentForm((p) => ({ ...p, bonus: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">补贴（元）</label>
              <input
                type="number"
                className="ios-input"
                placeholder="请输入补贴"
                min="0"
                step="0.01"
                value={salaryPaymentForm.allowance}
                onChange={(e) => setSalaryPaymentForm((p) => ({ ...p, allowance: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">扣款（元）</label>
              <input
                type="number"
                className="ios-input"
                placeholder="请输入扣款"
                min="0"
                step="0.01"
                value={salaryPaymentForm.deduction}
                onChange={(e) => setSalaryPaymentForm((p) => ({ ...p, deduction: e.target.value }))}
              />
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#F5F5F7] flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#1D1D1F]">实发工资</span>
            <span className="text-[15px] font-bold text-[#FF3B30]">{formatAmount(calcNetSalary())}</span>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">发放日期</label>
            <input
              type="date"
              className="ios-input"
              value={salaryPaymentForm.paymentDate}
              onChange={(e) => setSalaryPaymentForm((p) => ({ ...p, paymentDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">备注</label>
            <textarea
              className="ios-textarea"
              placeholder="请输入备注"
              value={salaryPaymentForm.remark}
              onChange={(e) => setSalaryPaymentForm((p) => ({ ...p, remark: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0]">
            <button className="ios-btn ios-btn-secondary" onClick={() => setModalType(null)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmitSalaryPayment} disabled={saving}>
              {saving ? "保存中..." : editingSalaryPayment ? "保存修改" : "创建工资"}
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
          <div className="w-14 h-14 rounded-full bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#FF3B30]" />
          </div>
          <p className="text-[15px] text-[#1D1D1F] mb-1">确定要删除该记录吗？</p>
          <p className="text-[13px] text-[#86868B] mb-6">此操作不可撤销</p>
          <div className="flex justify-center gap-3">
            <button className="ios-btn ios-btn-secondary" onClick={() => { setModalType(null); setDeleteTarget(null); }}>取消</button>
            <button
              className="ios-btn ios-btn-danger"
              onClick={() => {
                if (deleteTarget?.type === "otherExpense") handleDeleteOtherExpense();
                else if (deleteTarget?.type === "salaryPayment") handleDeleteSalaryPayment();
              }}
              disabled={deleting}
            >
              {deleting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalType === "statusFlow" && !!statusFlowTarget}
        onClose={() => { setModalType(null); setStatusFlowTarget(null); }}
        title="状态流转"
        maxWidth="400px"
      >
        {statusFlowTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[#F5F5F7]">
              <p className="text-[13px] text-[#86868B] mb-1">当前状态</p>
              <div>{getStatusBadge(statusFlowTarget.status)}</div>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#1D1D1F] mb-2">可流转状态</p>
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
                    : <p className="text-[13px] text-[#86868B]">无可用流转</p>;
                })()}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-[#F0F0F0]">
              <button className="ios-btn ios-btn-secondary" onClick={() => { setModalType(null); setStatusFlowTarget(null); }}>关闭</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
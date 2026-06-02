"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  TrendingUp,
  Wallet,
  Landmark,
  ArrowUpCircle,
  Eye,
  FileText,
  Building2,
  Receipt,
} from "lucide-react";
import Modal from "@/components/Modal";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { BatchDeleteBar } from "@/components/BatchDeleteBar";
import AdminStatusOverride from "@/components/AdminStatusOverride";
import ProjectPicker from "@/components/ProjectPicker";

interface IncomeContract {
  id: string;
  contractNo: string;
  projectSourceId: string | null;
  customerId: string;
  signedDate: string | null;
  totalAmount: string;
  status: string;
  customer: { name: string; contactPerson: string | null; phone: string | null };
  project: { name: string; projectSourceId: string } | null;
}

interface Receivable {
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
  sourceContract: IncomeContract | null;
}

interface ReceiptVoucher {
  id: string;
  receivableId: string;
  receiptNo: string | null;
  registrant: string | null;
  registerDate: string | null;
  amount: number;
  receiptDate: string;
  receiptReason: string | null;
  receiptMethod: string | null;
  bankAccount: string | null;
  attachments: string | null;
  remark: string | null;
  receivable: Receivable;
}

interface NonContractIncome {
  id: string;
  projectSourceId: string | null;
  amount: number;
  transactionDate: string;
  counterparty: string | null;
  description: string | null;
  status: string;
  project: { name: string } | null;
}

interface Shareholder {
  id: string;
  name: string;
  idNumber: string | null;
  shareRatio: number | null;
  contactPhone: string | null;
}

interface CapitalContribution {
  id: string;
  shareholderId: string;
  amount: number;
  returnedAmount: number;
  remainingAmount: number;
  contributeDate: string;
  method: string | null;
  remark: string | null;
  shareholder: { name: string };
  returns?: CapitalReturn[];
}

interface CapitalReturn {
  id: string;
  contributionId: string;
  amount: number;
  returnDate: string;
  remark: string | null;
}

interface OtherBorrowing {
  id: string;
  lenderName: string;
  amount: number;
  returnedAmount: number;
  remainingAmount: number;
  borrowingDate: string;
  expectedReturnDate: string | null;
  description: string | null;
  status: string;
  returns?: BorrowingReturn[];
}

interface BorrowingReturn {
  id: string;
  borrowingId: string;
  amount: number;
  returnDate: string;
  remark: string | null;
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

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type TabType = "contractIncome" | "otherIncome" | "shareholderCapital" | "otherBorrowing";

const receivableStatusConfig: Record<string, { color: string; label: string }> = {
  未收: { color: "ios-badge-gray", label: "未收" },
  部分收款: { color: "ios-badge-orange", label: "部分" },
  已收: { color: "ios-badge-green", label: "已收" },
  逾期: { color: "ios-badge-red", label: "逾期" },
};

const borrowingStatusConfig: Record<string, { color: string; label: string }> = {
  草稿: { color: "ios-badge-gray", label: "草稿" },
  审批中: { color: "ios-badge-orange", label: "审批中" },
  已批准: { color: "ios-badge-green", label: "已批准" },
  已驳回: { color: "ios-badge-red", label: "已驳回" },
  未还清: { color: "ios-badge-orange", label: "未还清" },
  已还清: { color: "ios-badge-green", label: "已还清" },
};

const methodOptions = ["现金", "实物", "知识产权", "其他"];
const receiptMethodOptions = ["银行转账", "现金", "支票", "汇票", "其他"];

const emptyReceiptForm = {
  receivableId: "",
  receiptNo: "",
  registrant: "",
  registerDate: "",
  amount: "",
  receiptDate: "",
  receiptReason: "",
  receiptMethod: "",
  bankAccount: "",
  attachments: "",
  remark: "",
};

const emptyOtherIncomeForm = {
  amount: "",
  counterparty: "",
  transactionDate: "",
  description: "",
  projectSourceId: "",
};

const emptyContributionForm = {
  shareholderId: "",
  amount: "",
  contributeDate: "",
  method: "",
  remark: "",
};

const emptyBorrowingForm = {
  lenderName: "",
  amount: "",
  borrowingDate: "",
  expectedReturnDate: "",
  description: "",
};

const emptyReturnAppForm = {
  returnAmount: "",
  returnDate: "",
  remark: "",
};

export default function FinanceIncomePage() {
  const { user: currentUser, modulePermissions } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("contractIncome");

  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [otherIncomes, setOtherIncomes] = useState<NonContractIncome[]>([]);
  const [contributions, setContributions] = useState<CapitalContribution[]>([]);
  const [borrowings, setBorrowings] = useState<OtherBorrowing[]>([]);

  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [projectLeads, setProjectLeads] = useState<ProjectLeadItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [users, setUsers] = useState<{id: string; username: string; realName: string}[]>([]);

  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingOtherIncome, setEditingOtherIncome] = useState<NonContractIncome | null>(null);

  const [receiptForm, setReceiptForm] = useState(emptyReceiptForm);
  const [otherIncomeForm, setOtherIncomeForm] = useState(emptyOtherIncomeForm);
  const [contributionForm, setContributionForm] = useState(emptyContributionForm);
  const [borrowingForm, setBorrowingForm] = useState(emptyBorrowingForm);
  const [returnAppForm, setReturnAppForm] = useState(emptyReturnAppForm);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<NonContractIncome | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    toggleSelect,
    selectAll,
    clearSelection,
    isAllSelected,
    isSelected,
  } = useBatchSelection(otherIncomes.map((d) => d.id));

  const [returnTargetContribution, setReturnTargetContribution] = useState<CapitalContribution | null>(null);
  const [returnTargetBorrowing, setReturnTargetBorrowing] = useState<OtherBorrowing | null>(null);

  const [receiptHistory, setReceiptHistory] = useState<ReceiptVoucher[]>([]);
  const [receiptHistoryLoading, setReceiptHistoryLoading] = useState(false);
  const [receiptHistoryReceivable, setReceiptHistoryReceivable] = useState<Receivable | null>(null);
  const [showReceiptHistory, setShowReceiptHistory] = useState(false);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatAmount = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "¥0.00";
    return `¥${num.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: string, isBorrowing = false) => {
    const configMap = isBorrowing ? borrowingStatusConfig : receivableStatusConfig;
    const config = configMap[status] || configMap[isBorrowing ? "草稿" : "未收"];
    return <span className={`ios-badge ${config.color}`}>{config.label}</span>;
  };

  const fetchReceivables = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("sourceType", "income_contract");
      params.set("pageSize", "200");
      const res = await fetch(`/api/receivables?${params}`);
      const json = await res.json();
      if (res.ok) setReceivables(json.data || []);
    } catch (err) {
      console.error("获取应收记录失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOtherIncomes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", pagination.page.toString());
      params.set("pageSize", pagination.pageSize.toString());
      const res = await fetch(`/api/non-contract-incomes?${params}`);
      const json = await res.json();
      if (res.ok) {
        setOtherIncomes(json.data || []);
        if (json.pagination) setPagination(json.pagination);
      }
    } catch (err) {
      console.error("获取其他收入失败:", err);
    } finally {
      setLoading(false);
    }
  }, [search, pagination.page, pagination.pageSize]);

  const fetchContributions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/capital-contributions?pageSize=200");
      const json = await res.json();
      if (res.ok) setContributions(json.data || []);
    } catch (err) {
      console.error("获取出资记录失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBorrowings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/other-borrowings?pageSize=200");
      const json = await res.json();
      if (res.ok) setBorrowings(json.data || []);
    } catch (err) {
      console.error("获取借入款失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [shareholdersRes, leadsRes, bankAccountsRes] = await Promise.all([
        fetch("/api/shareholders?pageSize=200"),
        fetch("/api/project-leads?pageSize=200"),
        fetch("/api/bank-accounts?isActive=true&pageSize=200"),
      ]);
      if (shareholdersRes.ok) {
        const j = await shareholdersRes.json();
        setShareholders(j.data || []);
      }
      if (leadsRes.ok) {
        const j = await leadsRes.json();
        setProjectLeads((j.data || []).filter((l: { currentStatus: string }) => l.currentStatus !== "放弃"));
      }
      if (bankAccountsRes.ok) {
        const j = await bankAccountsRes.json();
        setBankAccounts(j.data || []);
      }
      fetch("/api/settings/users").then(res => res.json()).then(json => {
        const usersData = json.data || [];
        setUsers(usersData);
        if (currentUser?.id) {
          setReceiptForm((prev) => ({ ...prev, registrant: currentUser.id }));
        }
      });
    } catch (err) {
      console.error("获取参考数据失败:", err);
    }
  }, []);

  const fetchReceiptHistory = async (receivable: Receivable) => {
    setReceiptHistoryLoading(true);
    setReceiptHistoryReceivable(receivable);
    setShowReceiptHistory(true);
    try {
      const res = await fetch(`/api/receipt-vouchers?receivableId=${receivable.id}&pageSize=200`);
      const json = await res.json();
      if (res.ok) setReceiptHistory(json.data || []);
    } catch (err) {
      console.error("获取收款记录失败:", err);
    } finally {
      setReceiptHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  useEffect(() => {
    if (activeTab === "contractIncome") fetchReceivables();
    else if (activeTab === "otherIncome") fetchOtherIncomes();
    else if (activeTab === "shareholderCapital") fetchContributions();
    else fetchBorrowings();
  }, [activeTab, fetchReceivables, fetchOtherIncomes, fetchContributions, fetchBorrowings]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearch("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const getSelectedReceivable = (): Receivable | undefined => {
    return receivables.find((r) => r.id === receiptForm.receivableId);
  };

  const getSelectedContract = (): IncomeContract | undefined => {
    const r = getSelectedReceivable();
    return r?.sourceContract || undefined;
  };

  const handleOpenReceiptModal = () => {
    setReceiptForm(emptyReceiptForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenReceiptModalForReceivable = (receivable: Receivable) => {
    setReceiptForm({
      receivableId: receivable.id,
      receiptNo: `SK-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 900 + 100)}`,
      registrant: "",
      registerDate: new Date().toISOString().split("T")[0],
      amount: "",
      receiptDate: new Date().toISOString().split("T")[0],
      receiptReason: "",
      receiptMethod: "银行转账",
      bankAccount: "",
      attachments: "",
      remark: "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmitReceipt = async () => {
    if (!receiptForm.receivableId) { setFormError("请选择应收记录"); return; }
    if (!receiptForm.amount || Number(receiptForm.amount) <= 0) { setFormError("请输入有效金额"); return; }
    const receivable = getSelectedReceivable();
    if (receivable) {
      const remaining = receivable.amount - receivable.paidAmount;
      if (Number(receiptForm.amount) > remaining) {
        setFormError(`本次收款金额不能超过未收金额 ${formatAmount(remaining)}`);
        return;
      }
    }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/receipt-vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receivableId: receiptForm.receivableId,
          receiptNo: receiptForm.receiptNo || null,
          registrant: receiptForm.registrant || null,
          registerDate: receiptForm.registerDate || new Date().toISOString(),
          amount: Number(receiptForm.amount),
          receiptDate: receiptForm.receiptDate || new Date().toISOString(),
          receiptReason: receiptForm.receiptReason || null,
          receiptMethod: receiptForm.receiptMethod || null,
          bankAccount: receiptForm.bankAccount || null,
          attachments: receiptForm.attachments || null,
          remark: receiptForm.remark || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setShowModal(false);
        setReceiptForm(emptyReceiptForm);
        fetchReceivables();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCreateOtherIncome = () => {
    setEditingOtherIncome(null);
    setOtherIncomeForm(emptyOtherIncomeForm);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEditOtherIncome = (item: NonContractIncome) => {
    setEditingOtherIncome(item);
    setOtherIncomeForm({
      amount: String(item.amount),
      counterparty: item.counterparty || "",
      transactionDate: formatDate(item.transactionDate).replace(/-/g, ""),
      description: item.description || "",
      projectSourceId: item.projectSourceId || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmitOtherIncome = async () => {
    if (!otherIncomeForm.amount || Number(otherIncomeForm.amount) <= 0) {
      setFormError("请输入有效金额");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const body = {
        amount: Number(otherIncomeForm.amount),
        counterparty: otherIncomeForm.counterparty.trim() || null,
        transactionDate: otherIncomeForm.transactionDate || new Date().toISOString(),
        description: otherIncomeForm.description.trim() || null,
        projectSourceId: otherIncomeForm.projectSourceId || null,
      };
      const url = editingOtherIncome
        ? `/api/non-contract-incomes/${editingOtherIncome.id}`
        : "/api/non-contract-incomes";
      const method = editingOtherIncome ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        setShowModal(false);
        setOtherIncomeForm(emptyOtherIncomeForm);
        setEditingOtherIncome(null);
        fetchOtherIncomes();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOtherIncome = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.status !== "草稿" && deleteConfirm.status !== "已驳回" && !isAdmin) {
      alert("该记录已进入审批流程，仅管理员可删除");
      setDeleteConfirm(null);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/non-contract-incomes/${deleteConfirm.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchOtherIncomes();
      } else {
        const json = await res.json();
        alert(json.error || "删除失败");
        setDeleteConfirm(null);
      }
    } catch {
      alert("网络错误");
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteReceivable = async (id: string) => {
    if (!confirm("确定要删除该应收记录吗？此操作不可撤销。")) return;
    try {
      const res = await fetch(`/api/receivables/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchReceivables();
      } else {
        const json = await res.json();
        alert(json.error || "删除失败");
      }
    } catch {
      alert("删除失败");
    }
  };

  const handleOpenContributionModal = () => {
    setContributionForm(emptyContributionForm);
    setFormError("");
    setShowModal(true);
  };

  const handleSubmitContribution = async () => {
    if (!contributionForm.shareholderId) { setFormError("请选择股东"); return; }
    if (!contributionForm.amount || Number(contributionForm.amount) <= 0) { setFormError("请输入有效金额"); return; }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/capital-contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareholderId: contributionForm.shareholderId,
          amount: Number(contributionForm.amount),
          contributeDate: contributionForm.contributeDate || new Date().toISOString(),
          method: contributionForm.method || null,
          remark: contributionForm.remark || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setShowModal(false);
        setContributionForm(emptyContributionForm);
        fetchContributions();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCapitalReturnModal = (contribution: CapitalContribution) => {
    setReturnTargetContribution(contribution);
    setReturnAppForm(emptyReturnAppForm);
    setFormError("");
    setShowModal(true);
  };

  const handleSubmitReturnApplication = async () => {
    if (!returnAppForm.returnAmount || Number(returnAppForm.returnAmount) <= 0) {
      setFormError("请输入有效金额");
      return;
    }
    const target = returnTargetContribution || returnTargetBorrowing;
    const remainingAmount = target ? ("remainingAmount" in target ? target.remainingAmount : 0) : 0;
    if (Number(returnAppForm.returnAmount) > remainingAmount) {
      setFormError("归还金额不能超过剩余金额");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const body: Record<string, unknown> = {
        returnAmount: Number(returnAppForm.returnAmount),
        returnDate: returnAppForm.returnDate || new Date().toISOString(),
        remark: returnAppForm.remark || null,
      };
      if (returnTargetContribution) {
        body.sourceType = "shareholder_capital";
        body.sourceId = returnTargetContribution.id;
        body.sourceName = returnTargetContribution.shareholder?.name || "";
        body.sourceAmount = returnTargetContribution.amount;
      } else if (returnTargetBorrowing) {
        body.sourceType = "other_borrowing";
        body.sourceId = returnTargetBorrowing.id;
        body.sourceName = returnTargetBorrowing.lenderName;
        body.sourceAmount = returnTargetBorrowing.amount;
      }
      const res = await fetch("/api/borrowing-return-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        setShowModal(false);
        setReturnAppForm(emptyReturnAppForm);
        setReturnTargetContribution(null);
        setReturnTargetBorrowing(null);
        alert("归还申请已提交，请在财务支出-借入资金归还中查看");
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenBorrowingModal = () => {
    setBorrowingForm(emptyBorrowingForm);
    setFormError("");
    setShowModal(true);
  };

  const handleSubmitBorrowing = async () => {
    if (!borrowingForm.lenderName.trim()) { setFormError("请输入出借方名称"); return; }
    if (!borrowingForm.amount || Number(borrowingForm.amount) <= 0) { setFormError("请输入有效金额"); return; }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/other-borrowings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lenderName: borrowingForm.lenderName.trim(),
          amount: Number(borrowingForm.amount),
          borrowingDate: borrowingForm.borrowingDate || new Date().toISOString(),
          expectedReturnDate: borrowingForm.expectedReturnDate || null,
          description: borrowingForm.description.trim() || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setShowModal(false);
        setBorrowingForm(emptyBorrowingForm);
        fetchBorrowings();
      } else {
        setFormError(json.error || "操作失败");
      }
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenBorrowingReturnModal = (borrowing: OtherBorrowing) => {
    setReturnTargetBorrowing(borrowing);
    setReturnAppForm(emptyReturnAppForm);
    setFormError("");
    setShowModal(true);
  };


  const TAB_PERMISSION_MAP: Record<string, string> = {
    contractIncome: "finance.income.contract",
    otherIncome: "finance.income.other",
    shareholderCapital: "finance.income.shareholder",
    otherBorrowing: "finance.income.borrowing",
  };

  const allTabs = [
    { key: "contractIncome" as TabType, label: "合同收入", icon: <ArrowUpCircle className="w-4 h-4" /> },
    { key: "otherIncome" as TabType, label: "其他收入", icon: <DollarSign className="w-4 h-4" /> },
    { key: "shareholderCapital" as TabType, label: "股东出资", icon: <TrendingUp className="w-4 h-4" /> },
    { key: "otherBorrowing" as TabType, label: "其他借入款", icon: <Landmark className="w-4 h-4" /> },
  ];

  const userModules: string[] = [...modulePermissions.accessibleSubModules];
  const tabPermValues = Object.values(TAB_PERMISSION_MAP);
  const hasTabPermissions = userModules.some((m) => tabPermValues.includes(m));
  const isAdmin = currentUser?.roles?.some((r: any) => r.code === "admin");
  const tabs = (!hasTabPermissions || isAdmin) ? allTabs : allTabs.filter((tab) => userModules.includes(TAB_PERMISSION_MAP[tab.key]));

  const getPrimaryBtnLabel = () => {
    if (activeTab === "contractIncome") return "收款登记";
    if (activeTab === "otherIncome") return "新增收入";
    if (activeTab === "shareholderCapital") return "新增出资";
    return "新增借入";
  };

  const handlePrimaryAction = () => {
    if (activeTab === "contractIncome") handleOpenReceiptModal();
    else if (activeTab === "otherIncome") handleOpenCreateOtherIncome();
    else if (activeTab === "shareholderCapital") handleOpenContributionModal();
    else handleOpenBorrowingModal();
  };

  const selectedContract = getSelectedContract();

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>财务收入</h1>
            <p>管理合同收入、其他收入、股东出资与其他借入款</p>
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

      {activeTab === "contractIncome" && (
        <div className="bento-card-static">
          {loading ? (
            <div className="empty-state">
              <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
              <p>加载中...</p>
            </div>
          ) : receivables.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
                <ArrowUpCircle className="w-8 h-8 text-[#78716C]" />
              </div>
              <p>暂无合同收入记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr>
                    <th>合同编号</th>
                    <th>项目名称</th>
                    <th>付款方</th>
                    <th>合同金额</th>
                    <th>应收金额</th>
                    <th>已收金额</th>
                    <th>未收金额</th>
                    <th>已开票</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-[13px] font-semibold text-[#1C1917]">
                        {r.sourceContract?.contractNo || r.sourceId}
                      </td>
                      <td>
                        {r.sourceContract?.project?.name || r.project?.name ? (
                          <div>
                            <span className="font-semibold text-[#1C1917]">{r.sourceContract?.project?.name || r.project?.name}</span>
                            <span className="block text-[11px] text-[#78716C]">{r.projectSourceId}</span>
                          </div>
                        ) : r.projectSourceId || "-"}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#78716C]" />
                          {r.sourceContract?.customer?.name || "-"}
                        </div>
                      </td>
                      <td className="font-semibold">
                        {formatAmount(r.sourceContract?.totalAmount || 0)}
                      </td>
                      <td className="font-semibold text-[#78716C]">
                        {formatAmount(r.amount)}
                      </td>
                      <td className="font-semibold">
                        {formatAmount(r.paidAmount)}
                      </td>
                      <td className="font-semibold text-[#78716C]">
                        {formatAmount(r.amount - r.paidAmount)}
                      </td>
                      <td className="font-semibold text-[#1C1917]">
                        {formatAmount(r.invoicedAmount)}
                      </td>
                      <td>{getStatusBadge(r.status)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={() => fetchReceiptHistory(r)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            记录
                          </button>
                          {r.status !== "已收" && (
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                              onClick={() => handleOpenReceiptModalForReceivable(r)}
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              收款
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                              onClick={() => handleDeleteReceivable(r.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "otherIncome" && (
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
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>
            <div className="ml-auto text-[13px] text-[#78716C]">
              共 <span className="font-semibold text-[#1C1917]">{pagination.total}</span> 条记录
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
              <p>加载中...</p>
            </div>
          ) : otherIncomes.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
                <DollarSign className="w-8 h-8 text-[#78716C]" />
              </div>
              <p>{search ? "没有匹配的收入记录" : "暂无其他收入记录"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr>
                    {isAdmin && (
                      <th className="w-10">
                        <input
                          type="checkbox"
                          className="ios-checkbox"
                          checked={isAllSelected}
                          onChange={() => isAllSelected ? clearSelection() : selectAll()}
                        />
                      </th>
                    )}
                    <th>交易对方</th>
                    <th>金额</th>
                    <th>交易日期</th>
                    <th>说明</th>
                    <th>项目</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {otherIncomes.map((item) => (
                    <tr key={item.id} className={isSelected(item.id) ? "bg-[#1C1917]/5" : ""}>
                      {isAdmin && (
                        <td className="w-10">
                          <input
                            type="checkbox"
                            className="ios-checkbox"
                            checked={isSelected(item.id)}
                            onChange={() => toggleSelect(item.id)}
                          />
                        </td>
                      )}
                      <td className="font-semibold">{item.counterparty || "-"}</td>
                      <td className="text-[#78716C] font-semibold">{formatAmount(item.amount)}</td>
                      <td className="text-[#78716C]">{formatDate(item.transactionDate)}</td>
                      <td className="text-[#78716C] max-w-[200px] truncate">{item.description || "-"}</td>
                      <td className="text-[#78716C]">{item.project?.name || item.projectSourceId || "-"}</td>
                      <td>
                        <AdminStatusOverride
                          businessType="non_contract_income"
                          businessId={item.id}
                          currentStatus={item.status}
                          onStatusChanged={(newStatus) => {
                            setOtherIncomes((prev) =>
                              prev.map((i) =>
                                i.id === item.id ? { ...i, status: newStatus } : i
                              )
                            );
                          }}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={() => handleOpenEditOtherIncome(item)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {(item.status === "草稿" || item.status === "已驳回" || isAdmin) && (
                            <button
                              className="ios-btn ios-btn-ghost ios-btn-sm text-[#78716C]!"
                              onClick={() => setDeleteConfirm(item)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
                  <span className="text-[13px] text-[#78716C] px-3">{pagination.page} / {pagination.totalPages}</span>
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

        {isAdmin && (
          <BatchDeleteBar
            businessType="non_contract_income"
            selectedIds={otherIncomes.filter((d) => isSelected(d.id)).map((d) => d.id)}
            onDeleteSuccess={fetchOtherIncomes}
            onClear={clearSelection}
          />
        )}
        </>
      )}

      {activeTab === "shareholderCapital" && (
        <div className="bento-card-static">
          {loading ? (
            <div className="empty-state">
              <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
              <p>加载中...</p>
            </div>
          ) : contributions.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-[#78716C]" />
              </div>
              <p>暂无出资记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr>
                    <th>股东名称</th>
                    <th>出资金额</th>
                    <th>已归还</th>
                    <th>剩余金额</th>
                    <th>出资日期</th>
                    <th>出资方式</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((c) => (
                    <tr key={c.id}>
                      <td className="font-semibold">{c.shareholder?.name || "-"}</td>
                      <td className="text-[#78716C] font-semibold">{formatAmount(c.amount)}</td>
                      <td className="font-semibold">{formatAmount(c.returnedAmount)}</td>
                      <td className="font-semibold text-[#78716C]">{formatAmount(c.remainingAmount)}</td>
                      <td className="text-[#78716C]">{formatDate(c.contributeDate)}</td>
                      <td>
                        {c.method ? <span className="ios-badge ios-badge-blue">{c.method}</span> : "-"}
                      </td>
                      <td>
                        {c.remainingAmount > 0 && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                            onClick={() => handleOpenCapitalReturnModal(c)}
                          >
                            <Wallet className="w-3.5 h-3.5" />
                            归还
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "otherBorrowing" && (
        <div className="bento-card-static">
          {loading ? (
            <div className="empty-state">
              <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
              <p>加载中...</p>
            </div>
          ) : borrowings.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 rounded-full bg-[#FAFAF9] flex items-center justify-center">
                <Landmark className="w-8 h-8 text-[#78716C]" />
              </div>
              <p>暂无借入款记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr>
                    <th>出借方</th>
                    <th>借入金额</th>
                    <th>已归还</th>
                    <th>剩余金额</th>
                    <th>借入日期</th>
                    <th>预计归还</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {borrowings.map((b) => (
                    <tr key={b.id}>
                      <td className="font-semibold">{b.lenderName}</td>
                      <td className="text-[#78716C] font-semibold">{formatAmount(b.amount)}</td>
                      <td className="font-semibold">{formatAmount(b.returnedAmount)}</td>
                      <td className="font-semibold text-[#78716C]">{formatAmount(b.remainingAmount)}</td>
                      <td className="text-[#78716C]">{formatDate(b.borrowingDate)}</td>
                      <td className="text-[#78716C]">{formatDate(b.expectedReturnDate)}</td>
                      <td>
                        <AdminStatusOverride
                          businessType="other_borrowing"
                          businessId={b.id}
                          currentStatus={b.status}
                          onStatusChanged={(newStatus) => {
                            setBorrowings((prev) =>
                              prev.map((br) =>
                                br.id === b.id ? { ...br, status: newStatus } : br
                              )
                            );
                          }}
                        />
                      </td>
                      <td>
                        {b.remainingAmount > 0 && (
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
                            onClick={() => handleOpenBorrowingReturnModal(b)}
                          >
                            <Wallet className="w-3.5 h-3.5" />
                            归还
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={showModal && activeTab === "contractIncome"}
        onClose={() => setShowModal(false)}
        title="收款登记"
        maxWidth="520px"
      >
        <div className="space-y-5">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">{formError}</div>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">关联应收记录 <span className="text-[#78716C]">*</span></label>
            <select
              className="ios-select"
              value={receiptForm.receivableId}
              onChange={(e) => {
                const rid = e.target.value;
                setReceiptForm((p) => ({
                  ...p,
                  receivableId: rid,
                  receiptNo: p.receiptNo || `SK-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 900 + 100)}`,
                  registerDate: p.registerDate || new Date().toISOString().split("T")[0],
                  receiptDate: p.receiptDate || new Date().toISOString().split("T")[0],
                }));
              }}
            >
              <option value="">请选择应收记录</option>
              {receivables
                .filter((r) => r.status === "未收" || r.status === "部分收款")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.sourceContract?.contractNo || r.sourceId} - {r.sourceContract?.customer?.name || "-"} - 应收{formatAmount(r.amount)} 未收{formatAmount(r.amount - r.paidAmount)}
                  </option>
                ))}
            </select>
          </div>

          {selectedContract && (() => {
            const receivable = getSelectedReceivable();
            return (
              <div className="p-3.5 rounded-xl bg-[#FAFAF9] space-y-2.5">
                <div className="flex items-center gap-2 text-[13px]">
                  <FileText className="w-3.5 h-3.5 text-[#1C1917] shrink-0" />
                  <span className="font-mono font-semibold text-[#1C1917]">{selectedContract.contractNo}</span>
                  <span className="text-[#A8A29E]">|</span>
                  <Building2 className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                  <span className="truncate">{selectedContract.customer.name}</span>
                </div>
                {selectedContract.project?.name && (
                  <div className="flex items-center gap-1.5 text-[12px]">
                    <span className="text-[#78716C]">关联项目:</span>
                    <span className="font-semibold text-[#1C1917]">{selectedContract.project.name}</span>
                    <span className="text-[#78716C]">({selectedContract.project.projectSourceId})</span>
                  </div>
                )}
                <div className="flex items-center gap-4 text-[12px]">
                  <span className="text-[#78716C]">合同 <span className="font-semibold text-[#1C1917]">{formatAmount(selectedContract.totalAmount)}</span></span>
                  <span className="text-[#78716C]">已收 <span className="font-semibold text-[#78716C]">{receivable ? formatAmount(receivable.paidAmount) : "¥0.00"}</span></span>
                  <span className="text-[#78716C]">未收 <span className="font-semibold text-[#78716C]">{receivable ? formatAmount(receivable.amount - receivable.paidAmount) : "-"}</span></span>
                </div>
              </div>
            );
          })()}

          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">本次收款金额 <span className="text-[#78716C]">*</span></label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#78716C] text-[15px] font-medium">¥</span>
                <input
                  type="number"
                  className="ios-input pl-8 text-[17px] font-semibold"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={receiptForm.amount}
                  onChange={(e) => setReceiptForm((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">收款形式</label>
                <select
                  className="ios-select"
                  value={receiptForm.receiptMethod}
                  onChange={(e) => setReceiptForm((p) => ({ ...p, receiptMethod: e.target.value }))}
                >
                  <option value="">请选择</option>
                  {receiptMethodOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">收款账户</label>
                <select
                  className="ios-select"
                  value={receiptForm.bankAccount}
                  onChange={(e) => setReceiptForm((p) => ({ ...p, bankAccount: e.target.value }))}
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
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">收款事由</label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="请输入收款事由"
                  value={receiptForm.receiptReason}
                  onChange={(e) => setReceiptForm((p) => ({ ...p, receiptReason: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">登记人</label>
                <select
                  className="ios-select"
                  value={receiptForm.registrant}
                  onChange={(e) => setReceiptForm((p) => ({ ...p, registrant: e.target.value }))}
                >
                  <option value="">请选择登记人</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.realName}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">备注</label>
              <input
                type="text"
                className="ios-input"
                placeholder="选填"
                value={receiptForm.remark}
                onChange={(e) => setReceiptForm((p) => ({ ...p, remark: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmitReceipt} disabled={saving}>
              {saving ? "保存中..." : "确认收款"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showReceiptHistory}
        onClose={() => { setShowReceiptHistory(false); setReceiptHistoryReceivable(null); }}
        title={receiptHistoryReceivable ? `收款记录 - ${receiptHistoryReceivable.sourceContract?.contractNo || receiptHistoryReceivable.sourceId}` : "收款记录"}
        maxWidth="720px"
      >
        {receiptHistoryLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : receiptHistory.length === 0 ? (
          <div className="text-center py-10 text-[#78716C]">
            <Receipt className="w-10 h-10 mx-auto mb-3 text-[#78716C]" />
            <p>暂无收款记录</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ios-table text-[13px]">
              <thead>
                <tr>
                  <th>收款单号</th>
                  <th>登记人</th>
                  <th>收款金额</th>
                  <th>收款日期</th>
                  <th>收款形式</th>
                  <th>收款账户</th>
                  <th>收款事由</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {receiptHistory.map((v) => (
                  <tr key={v.id}>
                    <td className="font-mono font-semibold">{v.receiptNo || "-"}</td>
                    <td>{users.find(u => u.id === v.registrant)?.realName || v.registrant || "-"}</td>
                    <td className="font-semibold text-[#78716C]">{formatAmount(v.amount)}</td>
                    <td className="text-[#78716C]">{formatDate(v.receiptDate)}</td>
                    <td>{v.receiptMethod || "-"}</td>
                    <td className="text-[#78716C]">{v.bankAccount || "-"}</td>
                    <td className="text-[#78716C] max-w-[120px] truncate">{v.receiptReason || "-"}</td>
                    <td className="text-[#78716C] max-w-[120px] truncate">{v.remark || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {receiptHistoryReceivable && (
              <div className="mt-4 p-3 rounded-xl bg-[#FAFAF9] flex items-center justify-between text-[13px]">
                <span className="text-[#78716C]">
                  合同金额: <span className="font-semibold text-[#1C1917]">{formatAmount(receiptHistoryReceivable.sourceContract?.totalAmount || 0)}</span>
                </span>
                <span className="text-[#78716C]">
                  应收: <span className="font-semibold text-[#1C1917]">{formatAmount(receiptHistoryReceivable.amount)}</span>
                </span>
                <span className="text-[#78716C]">
                  累计已收: <span className="font-semibold text-[#78716C]">{formatAmount(receiptHistoryReceivable.paidAmount)}</span>
                </span>
                <span className="text-[#78716C]">
                  未收: <span className="font-semibold text-[#78716C]">{formatAmount(receiptHistoryReceivable.amount - receiptHistoryReceivable.paidAmount)}</span>
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showModal && activeTab === "otherIncome"}
        onClose={() => setShowModal(false)}
        title={editingOtherIncome ? "编辑收入" : "新增其他收入"}
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
                value={otherIncomeForm.amount}
                onChange={(e) => setOtherIncomeForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">交易对方</label>
              <input
                type="text"
                className="ios-input"
                placeholder="请输入交易对方"
                value={otherIncomeForm.counterparty}
                onChange={(e) => setOtherIncomeForm((p) => ({ ...p, counterparty: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">交易日期</label>
            <input
              type="date"
              className="ios-input"
              value={otherIncomeForm.transactionDate}
              onChange={(e) => setOtherIncomeForm((p) => ({ ...p, transactionDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">说明</label>
            <textarea
              className="ios-textarea"
              placeholder="请输入说明"
              value={otherIncomeForm.description}
              onChange={(e) => setOtherIncomeForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div>
            <ProjectPicker
              projectLeads={projectLeads}
              value={otherIncomeForm.projectSourceId}
              onChange={(id) => setOtherIncomeForm((p) => ({ ...p, projectSourceId: id }))}
              label="关联项目"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmitOtherIncome} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showModal && activeTab === "shareholderCapital" && !returnTargetContribution}
        onClose={() => setShowModal(false)}
        title="新增股东出资"
        maxWidth="520px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">{formError}</div>
          )}
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">股东 <span className="text-[#78716C]">*</span></label>
            <select
              className="ios-select"
              value={contributionForm.shareholderId}
              onChange={(e) => setContributionForm((p) => ({ ...p, shareholderId: e.target.value }))}
            >
              <option value="">请选择股东</option>
              {shareholders.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.shareRatio ? ` (${s.shareRatio}%)` : ""}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">出资金额（元） <span className="text-[#78716C]">*</span></label>
              <input
                type="number"
                className="ios-input"
                placeholder="请输入金额"
                min="0"
                step="0.01"
                value={contributionForm.amount}
                onChange={(e) => setContributionForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">出资日期</label>
              <input
                type="date"
                className="ios-input"
                value={contributionForm.contributeDate}
                onChange={(e) => setContributionForm((p) => ({ ...p, contributeDate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">出资方式</label>
            <select
              className="ios-select"
              value={contributionForm.method}
              onChange={(e) => setContributionForm((p) => ({ ...p, method: e.target.value }))}
            >
              <option value="">请选择</option>
              {methodOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">备注</label>
            <textarea
              className="ios-textarea"
              placeholder="请输入备注"
              value={contributionForm.remark}
              onChange={(e) => setContributionForm((p) => ({ ...p, remark: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmitContribution} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showModal && (!!returnTargetContribution || !!returnTargetBorrowing)}
        onClose={() => { setShowModal(false); setReturnTargetContribution(null); setReturnTargetBorrowing(null); }}
        title={`归还申请 - ${returnTargetContribution ? "股东出资" : returnTargetBorrowing ? "借入款" : ""}`}
        maxWidth="520px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">{formError}</div>
          )}
          {(returnTargetContribution || returnTargetBorrowing) && (() => {
            const source = returnTargetContribution || returnTargetBorrowing!;
            const sourceName = returnTargetContribution ? returnTargetContribution.shareholder?.name : returnTargetBorrowing!.lenderName;
            const sourceType = returnTargetContribution ? "股东出资" : "其他借入款";
            return (
              <div className="p-3.5 rounded-xl bg-[#FAFAF9] space-y-2 text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="text-[#78716C]">来源类型:</span>
                  <span className="font-semibold text-[#1C1917]">{sourceType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#78716C]">来源名称:</span>
                  <span className="font-semibold text-[#1C1917]">{sourceName}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#78716C]">原始金额: <span className="font-semibold text-[#1C1917]">{formatAmount(source.amount)}</span></span>
                  <span className="text-[#78716C]">剩余金额: <span className="font-semibold text-[#78716C]">{formatAmount(source.remainingAmount)}</span></span>
                </div>
              </div>
            );
          })()}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">归还金额（元） <span className="text-[#78716C]">*</span></label>
              <input
                type="number"
                className="ios-input"
                placeholder="请输入金额"
                min="0"
                step="0.01"
                value={returnAppForm.returnAmount}
                onChange={(e) => setReturnAppForm((p) => ({ ...p, returnAmount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">归还日期</label>
              <input
                type="date"
                className="ios-input"
                value={returnAppForm.returnDate}
                onChange={(e) => setReturnAppForm((p) => ({ ...p, returnDate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">备注</label>
            <textarea
              className="ios-textarea"
              placeholder="请输入备注"
              value={returnAppForm.remark}
              onChange={(e) => setReturnAppForm((p) => ({ ...p, remark: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button className="ios-btn ios-btn-secondary" onClick={() => { setShowModal(false); setReturnTargetContribution(null); setReturnTargetBorrowing(null); }}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmitReturnApplication} disabled={saving}>
              {saving ? "提交中..." : "提交归还申请"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showModal && activeTab === "otherBorrowing" && !returnTargetBorrowing}
        onClose={() => setShowModal(false)}
        title="新增借入款"
        maxWidth="520px"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium">{formError}</div>
          )}
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">出借方名称 <span className="text-[#78716C]">*</span></label>
            <input
              type="text"
              className="ios-input"
              placeholder="请输入出借方名称"
              value={borrowingForm.lenderName}
              onChange={(e) => setBorrowingForm((p) => ({ ...p, lenderName: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">借入金额（元） <span className="text-[#78716C]">*</span></label>
              <input
                type="number"
                className="ios-input"
                placeholder="请输入金额"
                min="0"
                step="0.01"
                value={borrowingForm.amount}
                onChange={(e) => setBorrowingForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">借入日期</label>
              <input
                type="date"
                className="ios-input"
                value={borrowingForm.borrowingDate}
                onChange={(e) => setBorrowingForm((p) => ({ ...p, borrowingDate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">预计归还日期</label>
            <input
              type="date"
              className="ios-input"
              value={borrowingForm.expectedReturnDate}
              onChange={(e) => setBorrowingForm((p) => ({ ...p, expectedReturnDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">说明</label>
            <textarea
              className="ios-textarea"
              placeholder="请输入说明"
              value={borrowingForm.description}
              onChange={(e) => setBorrowingForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button className="ios-btn ios-btn-secondary" onClick={() => setShowModal(false)}>取消</button>
            <button className="ios-btn ios-btn-primary" onClick={handleSubmitBorrowing} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="确认删除"
        maxWidth="400px"
      >
        <div className="space-y-4">
          <p className="text-[15px] text-[#1C1917]">
            确定要删除该收入记录吗？此操作不可撤销。
          </p>
          {deleteConfirm && (
            <div className="p-3 rounded-xl bg-[#FAFAF9] text-[13px]">
              <p>交易对方: <span className="font-semibold">{deleteConfirm.counterparty || "-"}</span></p>
              <p>金额: <span className="font-semibold text-[#78716C]">{formatAmount(deleteConfirm.amount)}</span></p>
              <p>日期: <span className="font-semibold">{formatDate(deleteConfirm.transactionDate)}</span></p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
            <button className="ios-btn ios-btn-secondary" onClick={() => setDeleteConfirm(null)}>取消</button>
            <button className="ios-btn ios-btn-danger" onClick={handleDeleteOtherIncome} disabled={deleting}>
              {deleting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

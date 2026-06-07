"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  Users,
  Landmark,
  HandCoins,
  FileText,
  Briefcase,
  Receipt,
} from "lucide-react";

interface Receivable {
  id: string;
  sourceType: string;
  sourceId: string;
  projectSourceId: string | null;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: string;
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
  status: string;
  project: { name: string; projectSourceId: string } | null;
}

type TabType = "summary" | "projectCost" | "receivableAging" | "payableAging" | "cashflow";

interface Organization {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  type: string;
}

const tabs = [
  { key: "summary" as TabType, label: "收支汇总", icon: <BarChart3 className="w-4 h-4" /> },
  { key: "projectCost" as TabType, label: "项目成本", icon: <DollarSign className="w-4 h-4" /> },
  { key: "receivableAging" as TabType, label: "应收账龄", icon: <TrendingUp className="w-4 h-4" /> },
  { key: "payableAging" as TabType, label: "应付账龄", icon: <TrendingDown className="w-4 h-4" /> },
  { key: "cashflow" as TabType, label: "现金流", icon: <DollarSign className="w-4 h-4" /> },
];

export default function FinanceReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("summary");
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");

  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [nonContractIncomes, setNonContractIncomes] = useState<any[]>([]);
  const [nonContractExpenses, setNonContractExpenses] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [lendings, setLendings] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [expenseReportData, setExpenseReportData] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [receivablesRes, payablesRes, nonContractIncomesRes, nonContractExpensesRes, contributionsRes, borrowingsRes, lendingsRes, salariesRes, expenseReportsRes, orgsRes] = await Promise.all([
        fetch("/api/receivables?pageSize=500"),
        fetch("/api/payables?pageSize=500"),
        fetch("/api/non-contract-incomes?pageSize=500"),
        fetch("/api/non-contract-expenses?pageSize=500"),
        fetch("/api/capital-contributions?pageSize=500"),
        fetch("/api/other-borrowings?pageSize=500"),
        fetch("/api/lending-outs?pageSize=500"),
        fetch("/api/salary-payments?pageSize=500"),
        fetch("/api/expense-reports?pageSize=500"),
        fetch("/api/bank-accounts?pageSize=200"),
      ]);
      if (receivablesRes.ok) {
        const json = await receivablesRes.json();
        setReceivables(json.data || []);
      }
      if (payablesRes.ok) {
        const json = await payablesRes.json();
        setPayables(json.data || []);
      }
      if (nonContractIncomesRes.ok) {
        const json = await nonContractIncomesRes.json();
        setNonContractIncomes(json.data || []);
      }
      if (nonContractExpensesRes.ok) {
        const json = await nonContractExpensesRes.json();
        setNonContractExpenses(json.data || []);
      }
      if (contributionsRes.ok) {
        const json = await contributionsRes.json();
        setContributions(json.data || []);
      }
      if (borrowingsRes.ok) {
        const json = await borrowingsRes.json();
        setBorrowings(json.data || []);
      }
      if (lendingsRes.ok) {
        const json = await lendingsRes.json();
        setLendings(json.data || []);
      }
      if (salariesRes.ok) {
        const json = await salariesRes.json();
        setSalaries(json.data || []);
      }
      if (expenseReportsRes.ok) {
        const json = await expenseReportsRes.json();
        setExpenseReportData(json.data || []);
      }
      if (orgsRes.ok) {
        const json = await orgsRes.json();
        // 从银行账户中筛选公司账户，作为所属主体数据源
        const companyAccounts = (json.data || []).filter((a: any) => a.accountType === "公司账户");
        setOrganizations(companyAccounts);
      }
    } catch (err) {
      console.error("获取报表数据失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatAmount = (amount: number) => `¥${Number(amount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;

  // 按主体过滤数据
  const filteredReceivables = selectedOrgId ? receivables.filter((r: any) => r.organizationId === selectedOrgId) : receivables;
  const filteredPayables = selectedOrgId ? payables.filter((p: any) => p.organizationId === selectedOrgId) : payables;
  const filteredNonContractIncomes = selectedOrgId ? nonContractIncomes.filter((r: any) => r.organizationId === selectedOrgId) : nonContractIncomes;
  const filteredNonContractExpenses = selectedOrgId ? nonContractExpenses.filter((r: any) => r.organizationId === selectedOrgId) : nonContractExpenses;
  const filteredContributions = selectedOrgId ? contributions.filter((r: any) => r.organizationId === selectedOrgId) : contributions;
  const filteredBorrowings = selectedOrgId ? borrowings.filter((r: any) => r.organizationId === selectedOrgId) : borrowings;
  const filteredLendings = selectedOrgId ? lendings.filter((r: any) => r.organizationId === selectedOrgId) : lendings;
  const filteredSalaries = selectedOrgId ? salaries.filter((r: any) => r.organizationId === selectedOrgId) : salaries;
  const filteredExpenseReportData = selectedOrgId ? expenseReportData.filter((r: any) => r.organizationId === selectedOrgId) : expenseReportData;

  const totalReceivablePaid = filteredReceivables.reduce((sum, r) => sum + Number(r.paidAmount || 0), 0);
  const totalPayablePaid = filteredPayables.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);
  const totalNonContractIncome = filteredNonContractIncomes.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalContribution = filteredContributions.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalBorrowing = filteredBorrowings.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalNonContractExpense = filteredNonContractExpenses.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalLending = filteredLendings.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalSalaryPaid = filteredSalaries.reduce((sum, r) => sum + Number(r.netSalary || 0), 0);
  const totalExpenseReport = filteredExpenseReportData.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const totalIncome = totalReceivablePaid + totalNonContractIncome + totalContribution + totalBorrowing;
  const totalExpense = totalPayablePaid + totalNonContractExpense + totalLending + totalSalaryPaid + totalExpenseReport;
  const netProfit = totalIncome - totalExpense;

  const totalReceivableAmount = filteredReceivables.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalPayableAmount = filteredPayables.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const getProjectCostMap = () => {
    const map = new Map<string, { name: string; totalAmount: number; paidAmount: number; expenseReportAmount: number }>();
    filteredPayables.filter((p) => p.projectSourceId).forEach((p) => {
      const existing = map.get(p.projectSourceId!) || {
        name: p.project?.name || p.projectSourceId!,
        totalAmount: 0,
        paidAmount: 0,
        expenseReportAmount: 0,
      };
      existing.totalAmount += Number(p.amount || 0);
      existing.paidAmount += Number(p.paidAmount || 0);
      map.set(p.projectSourceId!, existing);
    });
    filteredExpenseReportData.filter((r) => r.projectSourceId).forEach((r) => {
      const existing = map.get(r.projectSourceId!) || {
        name: r.project?.name || r.projectSourceId!,
        totalAmount: 0,
        paidAmount: 0,
        expenseReportAmount: 0,
      };
      existing.expenseReportAmount += Number(r.amount || 0);
      map.set(r.projectSourceId!, existing);
    });
    return Array.from(map.entries()).map(([id, data]) => ({ id, ...data }));
  };

  const getAgingBuckets = (items: (Receivable | Payable)[], direction: "receive" | "pay") => {
    const now = new Date();
    const buckets = [
      { label: direction === "receive" ? "30天内" : "30天内", range: "<30", amount: 0, count: 0, color: "ios-badge-green" },
      { label: "30-60天", range: "30-60", amount: 0, count: 0, color: "ios-badge-orange" },
      { label: "60-90天", range: "60-90", amount: 0, count: 0, color: "ios-badge-red" },
      { label: "90天以上", range: ">90", amount: 0, count: 0, color: "ios-badge-gray" },
    ];

    const pendingStatus = direction === "receive" ? "已收" : "已付";
    items
      .filter((item) => item.status !== pendingStatus && Number(item.amount) - Number(item.paidAmount) > 0)
      .forEach((item) => {
        const diffDays = Math.floor((now.getTime() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        const remaining = Number(item.amount) - Number(item.paidAmount);
        if (diffDays < 30) { buckets[0].amount += remaining; buckets[0].count++; }
        else if (diffDays < 60) { buckets[1].amount += remaining; buckets[1].count++; }
        else if (diffDays < 90) { buckets[2].amount += remaining; buckets[2].count++; }
        else { buckets[3].amount += remaining; buckets[3].count++; }
      });

    return buckets;
  };

  const getMonthlyData = () => {
    const monthMap = new Map<string, { income: number; expense: number }>();

    filteredReceivables.forEach((r) => {
      if (Number(r.paidAmount) > 0) {
        const date = r.dueDate ? new Date(r.dueDate) : new Date();
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = monthMap.get(key) || { income: 0, expense: 0 };
        existing.income += Number(r.paidAmount);
        monthMap.set(key, existing);
      }
    });

    filteredPayables.forEach((p) => {
      if (Number(p.paidAmount) > 0) {
        const date = p.dueDate ? new Date(p.dueDate) : new Date();
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = monthMap.get(key) || { income: 0, expense: 0 };
        existing.expense += Number(p.paidAmount);
        monthMap.set(key, existing);
      }
    });

    filteredNonContractIncomes.forEach((r) => {
      const date = r.transactionDate ? new Date(r.transactionDate) : new Date();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { income: 0, expense: 0 };
      existing.income += Number(r.amount || 0);
      monthMap.set(key, existing);
    });

    filteredNonContractExpenses.forEach((r) => {
      const date = r.transactionDate ? new Date(r.transactionDate) : new Date();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { income: 0, expense: 0 };
      existing.expense += Number(r.amount || 0);
      monthMap.set(key, existing);
    });

    filteredContributions.forEach((r) => {
      const date = r.contributeDate ? new Date(r.contributeDate) : new Date();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { income: 0, expense: 0 };
      existing.income += Number(r.amount || 0);
      monthMap.set(key, existing);
    });

    filteredBorrowings.forEach((r) => {
      const date = r.borrowingDate ? new Date(r.borrowingDate) : new Date();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { income: 0, expense: 0 };
      existing.income += Number(r.amount || 0);
      monthMap.set(key, existing);
    });

    filteredLendings.forEach((r) => {
      const date = r.lendingDate ? new Date(r.lendingDate) : new Date();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { income: 0, expense: 0 };
      existing.expense += Number(r.amount || 0);
      monthMap.set(key, existing);
    });

    filteredSalaries.forEach((r) => {
      const date = r.paymentDate ? new Date(r.paymentDate) : new Date();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { income: 0, expense: 0 };
      existing.expense += Number(r.netSalary || 0);
      monthMap.set(key, existing);
    });

    filteredExpenseReportData.forEach((r) => {
      const date = r.createdAt ? new Date(r.createdAt) : new Date();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { income: 0, expense: 0 };
      existing.expense += Number(r.amount || 0);
      monthMap.set(key, existing);
    });

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, data]) => ({ month, ...data }));
  };

  if (loading) {
    return (
      <>
        <div className="page-header">
          <div><h1>财务报表</h1><p>收支汇总、项目成本与账龄分析</p></div>
        </div>
        <div className="bento-card-static">
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载数据中...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div><h1>财务报表</h1><p>收支汇总、项目成本与账龄分析</p></div>
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`ios-btn ${activeTab === tab.key ? "ios-btn-primary" : "ios-btn-secondary"}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        {organizations.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <label className="text-[13px] font-semibold text-[#78716C]">经营主体</label>
            <select
              className="ios-select"
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              <option value="">全部（合并报表）</option>
              {organizations.map((org: any) => (
                <option key={org.id} value={org.id}>{org.accountName}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeTab === "summary" && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-5">
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#78716C]/10 flex items-center justify-center">
                  <ArrowUpCircle className="w-5 h-5 text-[#78716C]" />
                </div>
                <span className="text-[13px] font-semibold text-[#78716C]">总收入</span>
              </div>
              <p className="stat-number text-[#78716C]!">{formatAmount(totalIncome)}</p>
              <p className="text-[12px] text-[#78716C] mt-1">应收总额 {formatAmount(totalReceivableAmount)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#78716C]/10 flex items-center justify-center">
                  <ArrowDownCircle className="w-5 h-5 text-[#78716C]" />
                </div>
                <span className="text-[13px] font-semibold text-[#78716C]">总支出</span>
              </div>
              <p className="stat-number text-[#78716C]!">{formatAmount(totalExpense)}</p>
              <p className="text-[12px] text-[#78716C] mt-1">应付总额 {formatAmount(totalPayableAmount)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#1C1917]/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-[#1C1917]" />
                </div>
                <span className="text-[13px] font-semibold text-[#78716C]">净利润</span>
              </div>
              <p className={`stat-number ${netProfit >= 0 ? "text-[#1C1917]!" : "text-[#78716C]!"}`}>
                {netProfit >= 0 ? "" : "-"}{formatAmount(Math.abs(netProfit))}
              </p>
              <p className="text-[12px] text-[#78716C] mt-1">总收入 - 总支出</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#5856D6]/10 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-[#5856D6]" />
                </div>
                <span className="text-[13px] font-semibold text-[#78716C]">合同收入（已收）</span>
              </div>
              <p className="stat-number text-[#5856D6]!">{formatAmount(totalReceivablePaid)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#78716C]/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-[#78716C]" />
                </div>
                <span className="text-[13px] font-semibold text-[#78716C]">其他收入</span>
              </div>
              <p className="stat-number text-[#78716C]!">{formatAmount(totalNonContractIncome)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#78716C]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#78716C]" />
                </div>
                <span className="text-[13px] font-semibold text-[#78716C]">股东出资</span>
              </div>
              <p className="stat-number text-[#78716C]!">{formatAmount(totalContribution)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#1C1917]/10 flex items-center justify-center">
                  <Landmark className="w-5 h-5 text-[#1C1917]" />
                </div>
                <span className="text-[13px] font-semibold text-[#78716C]">借入款</span>
              </div>
              <p className="stat-number text-[#1C1917]!">{formatAmount(totalBorrowing)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#78716C]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#78716C]" />
                </div>
                <span className="text-[13px] font-semibold text-[#78716C]">合同支出（已付）</span>
              </div>
              <p className="stat-number text-[#78716C]!">{formatAmount(totalPayablePaid)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#78716C]/10 flex items-center justify-center">
                  <HandCoins className="w-5 h-5 text-[#78716C]" />
                </div>
                <span className="text-[13px] font-semibold text-[#78716C]">其他支出</span>
              </div>
              <p className="stat-number text-[#78716C]!">{formatAmount(totalNonContractExpense)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#78716C]/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-[#78716C]" />
                </div>
                <span className="text-[13px] font-semibold text-[#78716C]">借出款</span>
              </div>
              <p className="stat-number text-[#78716C]!">{formatAmount(totalLending)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#78716C]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#78716C]" />
                </div>
                <span className="text-[13px] font-semibold text-[#78716C]">工资发放</span>
              </div>
              <p className="stat-number text-[#78716C]!">{formatAmount(totalSalaryPaid)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#5856D6]/10 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-[#5856D6]" />
                </div>
                <span className="text-[13px] font-semibold text-[#78716C]">费用报销</span>
              </div>
              <p className="stat-number text-[#5856D6]!">{formatAmount(totalExpenseReport)}</p>
            </div>
          </div>

          <div className="bento-card-static">
            <h3 className="text-[15px] font-bold text-[#1C1917] mb-4">月度收支明细</h3>
            {getMonthlyData().length === 0 ? (
              <div className="empty-state py-8"><p>暂无月度数据</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="ios-table">
                  <thead>
                    <tr><th>月份</th><th>收入</th><th>支出</th><th>净利润</th></tr>
                  </thead>
                  <tbody>
                    {getMonthlyData().map((row) => (
                      <tr key={row.month}>
                        <td className="font-semibold">{row.month}</td>
                        <td className="text-[#78716C] font-semibold">{formatAmount(row.income)}</td>
                        <td className="text-[#78716C] font-semibold">{formatAmount(row.expense)}</td>
                        <td className={row.income - row.expense >= 0 ? "text-[#1C1917] font-semibold" : "text-[#78716C] font-semibold"}>
                          {formatAmount(row.income - row.expense)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "projectCost" && (
        <div className="bento-card-static">
          <h3 className="text-[15px] font-bold text-[#1C1917] mb-4">项目成本汇总</h3>
          {getProjectCostMap().length === 0 ? (
            <div className="empty-state py-8"><p>暂无项目成本数据</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr><th>项目源ID</th><th>项目名称</th><th>应付总额</th><th>已付总额</th><th>费用报销</th><th>项目总成本</th><th>未付金额</th></tr>
                </thead>
                <tbody>
                  {getProjectCostMap().map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-[13px] text-[#1C1917] font-semibold">{row.id}</td>
                      <td className="font-semibold">{row.name}</td>
                      <td>{formatAmount(row.totalAmount)}</td>
                      <td className="text-[#78716C]">{formatAmount(row.paidAmount)}</td>
                      <td className="text-[#5856D6]">{formatAmount(row.expenseReportAmount)}</td>
                      <td className="font-semibold">{formatAmount(row.totalAmount + row.expenseReportAmount)}</td>
                      <td className="text-[#78716C]">{formatAmount(row.totalAmount - row.paidAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "receivableAging" && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {getAgingBuckets(filteredReceivables, "receive").map((bucket) => (
              <div key={bucket.range} className="bento-card-static">
                <div className="flex items-center justify-between mb-2">
                  <span className={`ios-badge ${bucket.color}`}>{bucket.label}</span>
                  <span className="text-[12px] text-[#78716C]">{bucket.count} 笔</span>
                </div>
                <p className="text-[20px] font-bold text-[#1C1917]">{formatAmount(bucket.amount)}</p>
              </div>
            ))}
          </div>
          <div className="bento-card-static">
            <h3 className="text-[15px] font-bold text-[#1C1917] mb-4">应收账款明细</h3>
            {filteredReceivables.filter((r) => r.status !== "已收" && Number(r.amount) - Number(r.paidAmount) > 0).length === 0 ? (
              <div className="empty-state py-8"><p>暂无未收款记录</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="ios-table">
                  <thead><tr><th>来源类型</th><th>项目</th><th>应收金额</th><th>已收金额</th><th>未收金额</th><th>到期日</th><th>逾期天数</th></tr></thead>
                  <tbody>
                    {filteredReceivables.filter((r) => r.status !== "已收" && Number(r.amount) - Number(r.paidAmount) > 0).map((r) => {
                      const diffDays = Math.floor((Date.now() - new Date(r.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={r.id}>
                          <td><span className="ios-badge ios-badge-blue">{r.sourceType}</span></td>
                          <td className="text-[#78716C]">{r.project?.name || r.projectSourceId || "公司级"}</td>
                          <td>{formatAmount(Number(r.amount))}</td>
                          <td className="text-[#78716C]">{formatAmount(Number(r.paidAmount))}</td>
                          <td className="text-[#78716C] font-semibold">{formatAmount(Number(r.amount) - Number(r.paidAmount))}</td>
                          <td className="text-[#78716C]">{new Date(r.dueDate).toLocaleDateString("zh-CN")}</td>
                          <td>
                            <span className={`ios-badge ${diffDays > 90 ? "ios-badge-red" : diffDays > 60 ? "ios-badge-orange" : diffDays > 30 ? "ios-badge-orange" : "ios-badge-green"}`}>
                              {diffDays > 0 ? `${diffDays}天` : "未到期"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "payableAging" && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {getAgingBuckets(filteredPayables, "pay").map((bucket) => (
              <div key={bucket.range} className="bento-card-static">
                <div className="flex items-center justify-between mb-2">
                  <span className={`ios-badge ${bucket.color}`}>{bucket.label}</span>
                  <span className="text-[12px] text-[#78716C]">{bucket.count} 笔</span>
                </div>
                <p className="text-[20px] font-bold text-[#1C1917]">{formatAmount(bucket.amount)}</p>
              </div>
            ))}
          </div>
          <div className="bento-card-static">
            <h3 className="text-[15px] font-bold text-[#1C1917] mb-4">应付账款明细</h3>
            {filteredPayables.filter((p) => p.status !== "已付" && Number(p.amount) - Number(p.paidAmount) > 0).length === 0 ? (
              <div className="empty-state py-8"><p>暂无未付款记录</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="ios-table">
                  <thead><tr><th>来源类型</th><th>项目</th><th>应付金额</th><th>已付金额</th><th>未付金额</th><th>到期日</th><th>逾期天数</th></tr></thead>
                  <tbody>
                    {filteredPayables.filter((p) => p.status !== "已付" && Number(p.amount) - Number(p.paidAmount) > 0).map((p) => {
                      const diffDays = Math.floor((Date.now() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={p.id}>
                          <td><span className="ios-badge ios-badge-blue">{p.sourceType}</span></td>
                          <td className="text-[#78716C]">{p.project?.name || p.projectSourceId || "公司级"}</td>
                          <td>{formatAmount(Number(p.amount))}</td>
                          <td className="text-[#78716C]">{formatAmount(Number(p.paidAmount))}</td>
                          <td className="text-[#78716C] font-semibold">{formatAmount(Number(p.amount) - Number(p.paidAmount))}</td>
                          <td className="text-[#78716C]">{new Date(p.dueDate).toLocaleDateString("zh-CN")}</td>
                          <td>
                            <span className={`ios-badge ${diffDays > 90 ? "ios-badge-red" : diffDays > 30 ? "ios-badge-orange" : "ios-badge-green"}`}>
                              {diffDays > 0 ? `${diffDays}天` : "未到期"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "cashflow" && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-5">
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#78716C]/10 flex items-center justify-center">
                  <ArrowUpCircle className="w-5 h-5 text-[#78716C]" />
                </div>
                <span className="text-[13px] font-semibold text-[#78716C]">总流入</span>
              </div>
              <p className="stat-number text-[#78716C]!">{formatAmount(totalReceivablePaid + totalNonContractIncome + totalContribution + totalBorrowing)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#78716C]/10 flex items-center justify-center">
                  <ArrowDownCircle className="w-5 h-5 text-[#78716C]" />
                </div>
                <span className="text-[13px] font-semibold text-[#78716C]">总流出</span>
              </div>
              <p className="stat-number text-[#78716C]!">{formatAmount(totalPayablePaid + totalNonContractExpense + totalLending + totalSalaryPaid + totalExpenseReport)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#1C1917]/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-[#1C1917]" />
                </div>
                <span className="text-[13px] font-semibold text-[#78716C]">净现金流</span>
              </div>
              <p className={`stat-number ${(totalReceivablePaid + totalNonContractIncome + totalContribution + totalBorrowing) - (totalPayablePaid + totalNonContractExpense + totalLending + totalSalaryPaid + totalExpenseReport) >= 0 ? "text-[#1C1917]!" : "text-[#78716C]!"}`}>
                {(totalReceivablePaid + totalNonContractIncome + totalContribution + totalBorrowing) - (totalPayablePaid + totalNonContractExpense + totalLending + totalSalaryPaid + totalExpenseReport) >= 0 ? "" : "-"}{formatAmount(Math.abs((totalReceivablePaid + totalNonContractIncome + totalContribution + totalBorrowing) - (totalPayablePaid + totalNonContractExpense + totalLending + totalSalaryPaid + totalExpenseReport)))}
              </p>
            </div>
          </div>

          <div className="bento-card-static">
            <h3 className="text-[15px] font-bold text-[#1C1917] mb-4">流入明细</h3>
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr><th>类别</th><th>金额</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-semibold">合同收入（已收）</td>
                    <td className="text-[#78716C] font-semibold">{formatAmount(totalReceivablePaid)}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">其他收入</td>
                    <td className="text-[#78716C] font-semibold">{formatAmount(totalNonContractIncome)}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">股东出资</td>
                    <td className="text-[#78716C] font-semibold">{formatAmount(totalContribution)}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">借入款</td>
                    <td className="text-[#78716C] font-semibold">{formatAmount(totalBorrowing)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bento-card-static">
            <h3 className="text-[15px] font-bold text-[#1C1917] mb-4">流出明细</h3>
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr><th>类别</th><th>金额</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-semibold">合同支出（已付）</td>
                    <td className="text-[#78716C] font-semibold">{formatAmount(totalPayablePaid)}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">其他支出</td>
                    <td className="text-[#78716C] font-semibold">{formatAmount(totalNonContractExpense)}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">借出款</td>
                    <td className="text-[#78716C] font-semibold">{formatAmount(totalLending)}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">工资发放</td>
                    <td className="text-[#78716C] font-semibold">{formatAmount(totalSalaryPaid)}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">费用报销</td>
                    <td className="text-[#78716C] font-semibold">{formatAmount(totalExpenseReport)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

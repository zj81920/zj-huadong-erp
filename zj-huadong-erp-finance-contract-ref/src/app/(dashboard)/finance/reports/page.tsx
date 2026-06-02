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
      const [receivablesRes, payablesRes, nonContractIncomesRes, nonContractExpensesRes, contributionsRes, borrowingsRes, lendingsRes, salariesRes, expenseReportsRes] = await Promise.all([
        fetch("/api/receivables?pageSize=500"),
        fetch("/api/payables?pageSize=500"),
        fetch("/api/non-contract-incomes?pageSize=500"),
        fetch("/api/non-contract-expenses?pageSize=500"),
        fetch("/api/capital-contributions?pageSize=500"),
        fetch("/api/other-borrowings?pageSize=500"),
        fetch("/api/lending-outs?pageSize=500"),
        fetch("/api/salary-payments?pageSize=500"),
        fetch("/api/expense-reports?pageSize=500"),
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

  const totalReceivablePaid = receivables.reduce((sum, r) => sum + Number(r.paidAmount || 0), 0);
  const totalPayablePaid = payables.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);
  const totalNonContractIncome = nonContractIncomes.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalContribution = contributions.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalBorrowing = borrowings.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalNonContractExpense = nonContractExpenses.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalLending = lendings.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalSalaryPaid = salaries.reduce((sum, r) => sum + Number(r.netSalary || 0), 0);
  const totalExpenseReport = expenseReportData.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const totalIncome = totalReceivablePaid + totalNonContractIncome + totalContribution + totalBorrowing;
  const totalExpense = totalPayablePaid + totalNonContractExpense + totalLending + totalSalaryPaid + totalExpenseReport;
  const netProfit = totalIncome - totalExpense;

  const totalReceivableAmount = receivables.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalPayableAmount = payables.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const getProjectCostMap = () => {
    const map = new Map<string, { name: string; totalAmount: number; paidAmount: number; expenseReportAmount: number }>();
    payables.filter((p) => p.projectSourceId).forEach((p) => {
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
    expenseReportData.filter((r) => r.projectSourceId).forEach((r) => {
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

    receivables.forEach((r) => {
      if (Number(r.paidAmount) > 0) {
        const date = r.dueDate ? new Date(r.dueDate) : new Date();
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = monthMap.get(key) || { income: 0, expense: 0 };
        existing.income += Number(r.paidAmount);
        monthMap.set(key, existing);
      }
    });

    payables.forEach((p) => {
      if (Number(p.paidAmount) > 0) {
        const date = p.dueDate ? new Date(p.dueDate) : new Date();
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = monthMap.get(key) || { income: 0, expense: 0 };
        existing.expense += Number(p.paidAmount);
        monthMap.set(key, existing);
      }
    });

    nonContractIncomes.forEach((r) => {
      const date = r.transactionDate ? new Date(r.transactionDate) : new Date();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { income: 0, expense: 0 };
      existing.income += Number(r.amount || 0);
      monthMap.set(key, existing);
    });

    nonContractExpenses.forEach((r) => {
      const date = r.transactionDate ? new Date(r.transactionDate) : new Date();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { income: 0, expense: 0 };
      existing.expense += Number(r.amount || 0);
      monthMap.set(key, existing);
    });

    contributions.forEach((r) => {
      const date = r.contributeDate ? new Date(r.contributeDate) : new Date();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { income: 0, expense: 0 };
      existing.income += Number(r.amount || 0);
      monthMap.set(key, existing);
    });

    borrowings.forEach((r) => {
      const date = r.borrowingDate ? new Date(r.borrowingDate) : new Date();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { income: 0, expense: 0 };
      existing.income += Number(r.amount || 0);
      monthMap.set(key, existing);
    });

    lendings.forEach((r) => {
      const date = r.lendingDate ? new Date(r.lendingDate) : new Date();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { income: 0, expense: 0 };
      existing.expense += Number(r.amount || 0);
      monthMap.set(key, existing);
    });

    salaries.forEach((r) => {
      const date = r.paymentDate ? new Date(r.paymentDate) : new Date();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { income: 0, expense: 0 };
      existing.expense += Number(r.netSalary || 0);
      monthMap.set(key, existing);
    });

    expenseReportData.forEach((r) => {
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
            <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
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
      </div>

      {activeTab === "summary" && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-5">
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#34C759]/10 flex items-center justify-center">
                  <ArrowUpCircle className="w-5 h-5 text-[#34C759]" />
                </div>
                <span className="text-[13px] font-semibold text-[#86868B]">总收入</span>
              </div>
              <p className="stat-number text-[#34C759]!">{formatAmount(totalIncome)}</p>
              <p className="text-[12px] text-[#86868B] mt-1">应收总额 {formatAmount(totalReceivableAmount)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF3B30]/10 flex items-center justify-center">
                  <ArrowDownCircle className="w-5 h-5 text-[#FF3B30]" />
                </div>
                <span className="text-[13px] font-semibold text-[#86868B]">总支出</span>
              </div>
              <p className="stat-number text-[#FF3B30]!">{formatAmount(totalExpense)}</p>
              <p className="text-[12px] text-[#86868B] mt-1">应付总额 {formatAmount(totalPayableAmount)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#007AFF]/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-[#007AFF]" />
                </div>
                <span className="text-[13px] font-semibold text-[#86868B]">净利润</span>
              </div>
              <p className={`stat-number ${netProfit >= 0 ? "text-[#007AFF]!" : "text-[#FF3B30]!"}`}>
                {netProfit >= 0 ? "" : "-"}{formatAmount(Math.abs(netProfit))}
              </p>
              <p className="text-[12px] text-[#86868B] mt-1">总收入 - 总支出</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#5856D6]/10 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-[#5856D6]" />
                </div>
                <span className="text-[13px] font-semibold text-[#86868B]">合同收入（已收）</span>
              </div>
              <p className="stat-number text-[#5856D6]!">{formatAmount(totalReceivablePaid)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#34C759]/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-[#34C759]" />
                </div>
                <span className="text-[13px] font-semibold text-[#86868B]">其他收入</span>
              </div>
              <p className="stat-number text-[#34C759]!">{formatAmount(totalNonContractIncome)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF9500]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#FF9500]" />
                </div>
                <span className="text-[13px] font-semibold text-[#86868B]">股东出资</span>
              </div>
              <p className="stat-number text-[#FF9500]!">{formatAmount(totalContribution)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#007AFF]/10 flex items-center justify-center">
                  <Landmark className="w-5 h-5 text-[#007AFF]" />
                </div>
                <span className="text-[13px] font-semibold text-[#86868B]">借入款</span>
              </div>
              <p className="stat-number text-[#007AFF]!">{formatAmount(totalBorrowing)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF3B30]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#FF3B30]" />
                </div>
                <span className="text-[13px] font-semibold text-[#86868B]">合同支出（已付）</span>
              </div>
              <p className="stat-number text-[#FF3B30]!">{formatAmount(totalPayablePaid)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#AF52DE]/10 flex items-center justify-center">
                  <HandCoins className="w-5 h-5 text-[#AF52DE]" />
                </div>
                <span className="text-[13px] font-semibold text-[#86868B]">其他支出</span>
              </div>
              <p className="stat-number text-[#AF52DE]!">{formatAmount(totalNonContractExpense)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF9500]/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-[#FF9500]" />
                </div>
                <span className="text-[13px] font-semibold text-[#86868B]">借出款</span>
              </div>
              <p className="stat-number text-[#FF9500]!">{formatAmount(totalLending)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF3B30]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#FF3B30]" />
                </div>
                <span className="text-[13px] font-semibold text-[#86868B]">工资发放</span>
              </div>
              <p className="stat-number text-[#FF3B30]!">{formatAmount(totalSalaryPaid)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#5856D6]/10 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-[#5856D6]" />
                </div>
                <span className="text-[13px] font-semibold text-[#86868B]">费用报销</span>
              </div>
              <p className="stat-number text-[#5856D6]!">{formatAmount(totalExpenseReport)}</p>
            </div>
          </div>

          <div className="bento-card-static">
            <h3 className="text-[15px] font-bold text-[#1D1D1F] mb-4">月度收支明细</h3>
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
                        <td className="text-[#34C759] font-semibold">{formatAmount(row.income)}</td>
                        <td className="text-[#FF3B30] font-semibold">{formatAmount(row.expense)}</td>
                        <td className={row.income - row.expense >= 0 ? "text-[#007AFF] font-semibold" : "text-[#FF3B30] font-semibold"}>
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
          <h3 className="text-[15px] font-bold text-[#1D1D1F] mb-4">项目成本汇总</h3>
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
                      <td className="font-mono text-[13px] text-[#007AFF] font-semibold">{row.id}</td>
                      <td className="font-semibold">{row.name}</td>
                      <td>{formatAmount(row.totalAmount)}</td>
                      <td className="text-[#34C759]">{formatAmount(row.paidAmount)}</td>
                      <td className="text-[#5856D6]">{formatAmount(row.expenseReportAmount)}</td>
                      <td className="font-semibold">{formatAmount(row.totalAmount + row.expenseReportAmount)}</td>
                      <td className="text-[#FF9500]">{formatAmount(row.totalAmount - row.paidAmount)}</td>
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
            {getAgingBuckets(receivables, "receive").map((bucket) => (
              <div key={bucket.range} className="bento-card-static">
                <div className="flex items-center justify-between mb-2">
                  <span className={`ios-badge ${bucket.color}`}>{bucket.label}</span>
                  <span className="text-[12px] text-[#86868B]">{bucket.count} 笔</span>
                </div>
                <p className="text-[20px] font-bold text-[#1D1D1F]">{formatAmount(bucket.amount)}</p>
              </div>
            ))}
          </div>
          <div className="bento-card-static">
            <h3 className="text-[15px] font-bold text-[#1D1D1F] mb-4">应收账款明细</h3>
            {receivables.filter((r) => r.status !== "已收" && Number(r.amount) - Number(r.paidAmount) > 0).length === 0 ? (
              <div className="empty-state py-8"><p>暂无未收款记录</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="ios-table">
                  <thead><tr><th>来源类型</th><th>项目</th><th>应收金额</th><th>已收金额</th><th>未收金额</th><th>到期日</th><th>逾期天数</th></tr></thead>
                  <tbody>
                    {receivables.filter((r) => r.status !== "已收" && Number(r.amount) - Number(r.paidAmount) > 0).map((r) => {
                      const diffDays = Math.floor((Date.now() - new Date(r.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={r.id}>
                          <td><span className="ios-badge ios-badge-blue">{r.sourceType}</span></td>
                          <td className="text-[#86868B]">{r.project?.name || r.projectSourceId || "公司级"}</td>
                          <td>{formatAmount(Number(r.amount))}</td>
                          <td className="text-[#34C759]">{formatAmount(Number(r.paidAmount))}</td>
                          <td className="text-[#FF3B30] font-semibold">{formatAmount(Number(r.amount) - Number(r.paidAmount))}</td>
                          <td className="text-[#86868B]">{new Date(r.dueDate).toLocaleDateString("zh-CN")}</td>
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
            {getAgingBuckets(payables, "pay").map((bucket) => (
              <div key={bucket.range} className="bento-card-static">
                <div className="flex items-center justify-between mb-2">
                  <span className={`ios-badge ${bucket.color}`}>{bucket.label}</span>
                  <span className="text-[12px] text-[#86868B]">{bucket.count} 笔</span>
                </div>
                <p className="text-[20px] font-bold text-[#1D1D1F]">{formatAmount(bucket.amount)}</p>
              </div>
            ))}
          </div>
          <div className="bento-card-static">
            <h3 className="text-[15px] font-bold text-[#1D1D1F] mb-4">应付账款明细</h3>
            {payables.filter((p) => p.status !== "已付" && Number(p.amount) - Number(p.paidAmount) > 0).length === 0 ? (
              <div className="empty-state py-8"><p>暂无未付款记录</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="ios-table">
                  <thead><tr><th>来源类型</th><th>项目</th><th>应付金额</th><th>已付金额</th><th>未付金额</th><th>到期日</th><th>逾期天数</th></tr></thead>
                  <tbody>
                    {payables.filter((p) => p.status !== "已付" && Number(p.amount) - Number(p.paidAmount) > 0).map((p) => {
                      const diffDays = Math.floor((Date.now() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={p.id}>
                          <td><span className="ios-badge ios-badge-blue">{p.sourceType}</span></td>
                          <td className="text-[#86868B]">{p.project?.name || p.projectSourceId || "公司级"}</td>
                          <td>{formatAmount(Number(p.amount))}</td>
                          <td className="text-[#34C759]">{formatAmount(Number(p.paidAmount))}</td>
                          <td className="text-[#FF3B30] font-semibold">{formatAmount(Number(p.amount) - Number(p.paidAmount))}</td>
                          <td className="text-[#86868B]">{new Date(p.dueDate).toLocaleDateString("zh-CN")}</td>
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
                <div className="w-10 h-10 rounded-xl bg-[#34C759]/10 flex items-center justify-center">
                  <ArrowUpCircle className="w-5 h-5 text-[#34C759]" />
                </div>
                <span className="text-[13px] font-semibold text-[#86868B]">总流入</span>
              </div>
              <p className="stat-number text-[#34C759]!">{formatAmount(totalReceivablePaid + totalNonContractIncome + totalContribution + totalBorrowing)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF3B30]/10 flex items-center justify-center">
                  <ArrowDownCircle className="w-5 h-5 text-[#FF3B30]" />
                </div>
                <span className="text-[13px] font-semibold text-[#86868B]">总流出</span>
              </div>
              <p className="stat-number text-[#FF3B30]!">{formatAmount(totalPayablePaid + totalNonContractExpense + totalLending + totalSalaryPaid + totalExpenseReport)}</p>
            </div>
            <div className="bento-card-static">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#007AFF]/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-[#007AFF]" />
                </div>
                <span className="text-[13px] font-semibold text-[#86868B]">净现金流</span>
              </div>
              <p className={`stat-number ${(totalReceivablePaid + totalNonContractIncome + totalContribution + totalBorrowing) - (totalPayablePaid + totalNonContractExpense + totalLending + totalSalaryPaid + totalExpenseReport) >= 0 ? "text-[#007AFF]!" : "text-[#FF3B30]!"}`}>
                {(totalReceivablePaid + totalNonContractIncome + totalContribution + totalBorrowing) - (totalPayablePaid + totalNonContractExpense + totalLending + totalSalaryPaid + totalExpenseReport) >= 0 ? "" : "-"}{formatAmount(Math.abs((totalReceivablePaid + totalNonContractIncome + totalContribution + totalBorrowing) - (totalPayablePaid + totalNonContractExpense + totalLending + totalSalaryPaid + totalExpenseReport)))}
              </p>
            </div>
          </div>

          <div className="bento-card-static">
            <h3 className="text-[15px] font-bold text-[#1D1D1F] mb-4">流入明细</h3>
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr><th>类别</th><th>金额</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-semibold">合同收入（已收）</td>
                    <td className="text-[#34C759] font-semibold">{formatAmount(totalReceivablePaid)}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">其他收入</td>
                    <td className="text-[#34C759] font-semibold">{formatAmount(totalNonContractIncome)}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">股东出资</td>
                    <td className="text-[#34C759] font-semibold">{formatAmount(totalContribution)}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">借入款</td>
                    <td className="text-[#34C759] font-semibold">{formatAmount(totalBorrowing)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bento-card-static">
            <h3 className="text-[15px] font-bold text-[#1D1D1F] mb-4">流出明细</h3>
            <div className="overflow-x-auto">
              <table className="ios-table">
                <thead>
                  <tr><th>类别</th><th>金额</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-semibold">合同支出（已付）</td>
                    <td className="text-[#FF3B30] font-semibold">{formatAmount(totalPayablePaid)}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">其他支出</td>
                    <td className="text-[#FF3B30] font-semibold">{formatAmount(totalNonContractExpense)}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">借出款</td>
                    <td className="text-[#FF3B30] font-semibold">{formatAmount(totalLending)}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">工资发放</td>
                    <td className="text-[#FF3B30] font-semibold">{formatAmount(totalSalaryPaid)}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold">费用报销</td>
                    <td className="text-[#FF3B30] font-semibold">{formatAmount(totalExpenseReport)}</td>
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

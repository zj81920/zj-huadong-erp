"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign,
} from "lucide-react";
import {
  formatAmount, getMonthlyData, getProjectCostMap, getAgingBuckets, computeTotals, computeMoMChange,
  type MonthlyRow, type ProjectCostRow, type AgingBucket, type TotalsResult,
} from "@/lib/finance-reports-utils";

// ========== 类型 ==========
type TabType = "dashboard" | "projectCost" | "aging";

interface Organization {
  id: string;
  accountName?: string;
  name?: string;
}

// 图表配色
const COLORS = {
  income: "#34C759",
  expense: "#FF3B30",
  primary: "#5856D6",
  neutral: "#78716C",
  dark: "#1C1917",
  orange: "#FF9500",
};

const PIE_COLORS = ["#5856D6", "#34C759", "#FF9500", "#FF3B30", "#8E8E93"];

// ========== Tab 定义 ==========
const tabs = [
  { key: "dashboard" as TabType, label: "经营看板", icon: <BarChart3 className="w-4 h-4" /> },
  { key: "projectCost" as TabType, label: "项目成本", icon: <DollarSign className="w-4 h-4" /> },
  { key: "aging" as TabType, label: "账龄分析", icon: <TrendingUp className="w-4 h-4" /> },
];

// ========== 子组件 ==========
function StatCard({ label, value, change, color }: { label: string; value: string; change?: string | null; color: string }) {
  return (
    <div className="bento-card-static" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="text-[13px] font-semibold text-[#78716C]">{label}</div>
      <p className="text-[24px] font-bold mt-1" style={{ color }}>{value}</p>
      {change && <p className="text-[12px] text-[#78716C] mt-1">{change}</p>}
    </div>
  );
}

// ========== 主组件 ==========
export default function FinanceReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [showMonthlyDetail, setShowMonthlyDetail] = useState(false);
  const [agingDirection, setAgingDirection] = useState<"receive" | "pay">("receive");

  // 原始数据
  const [receivables, setReceivables] = useState<any[]>([]);
  const [payables, setPayables] = useState<any[]>([]);
  const [nonContractIncomes, setNonContractIncomes] = useState<any[]>([]);
  const [nonContractExpenses, setNonContractExpenses] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [lendings, setLendings] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [expenseReportData, setExpenseReportData] = useState<any[]>([]);

  // 数据获取
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const urls = [
        "/api/receivables?pageSize=500",
        "/api/payables?pageSize=500",
        "/api/non-contract-incomes?pageSize=500",
        "/api/non-contract-expenses?pageSize=500",
        "/api/capital-contributions?pageSize=500",
        "/api/other-borrowings?pageSize=500",
        "/api/lending-outs?pageSize=500",
        "/api/salary-payments?pageSize=500",
        "/api/expense-reports?pageSize=500",
        "/api/bank-accounts?pageSize=200",
      ];
      const responses = await Promise.all(urls.map(u => fetch(u)));
      const setters = [
        setReceivables, setPayables, setNonContractIncomes, setNonContractExpenses,
        setContributions, setBorrowings, setLendings, setSalaries, setExpenseReportData,
      ];
      for (let i = 0; i < 9; i++) {
        if (responses[i].ok) {
          const json = await responses[i].json();
          setters[i](json.data || []);
        }
      }
      if (responses[9].ok) {
        const json = await responses[9].json();
        const companyAccounts = (json.data || []).filter((a: any) => a.accountType === "公司账户");
        setOrganizations(companyAccounts);
      }
    } catch (err) {
      console.error("获取报表数据失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 按主体过滤
  const filter = <T extends { organizationId?: string }>(items: T[]) =>
    selectedOrgId ? items.filter((r: any) => r.organizationId === selectedOrgId) : items;

  const fReceivables = useMemo(() => filter(receivables), [receivables, selectedOrgId]);
  const fPayables = useMemo(() => filter(payables), [payables, selectedOrgId]);
  const fNonContractIncomes = useMemo(() => filter(nonContractIncomes), [nonContractIncomes, selectedOrgId]);
  const fNonContractExpenses = useMemo(() => filter(nonContractExpenses), [nonContractExpenses, selectedOrgId]);
  const fContributions = useMemo(() => filter(contributions), [contributions, selectedOrgId]);
  const fBorrowings = useMemo(() => filter(borrowings), [borrowings, selectedOrgId]);
  const fLendings = useMemo(() => filter(lendings), [lendings, selectedOrgId]);
  const fSalaries = useMemo(() => filter(salaries), [salaries, selectedOrgId]);
  const fExpenseReportData = useMemo(() => filter(expenseReportData), [expenseReportData, selectedOrgId]);

  // 计算汇总
  const inputs = useMemo(() => ({
    receivables: fReceivables, payables: fPayables,
    nonContractIncomes: fNonContractIncomes, nonContractExpenses: fNonContractExpenses,
    contributions: fContributions, borrowings: fBorrowings,
    lendings: fLendings, salaries: fSalaries, expenseReports: fExpenseReportData,
  }), [fReceivables, fPayables, fNonContractIncomes, fNonContractExpenses, fContributions, fBorrowings, fLendings, fSalaries, fExpenseReportData]);

  const totals: TotalsResult = useMemo(() => computeTotals(inputs), [inputs]);
  const monthlyData: MonthlyRow[] = useMemo(() => getMonthlyData(inputs), [inputs]);
  const projectCosts: ProjectCostRow[] = useMemo(() => getProjectCostMap(fPayables, fExpenseReportData), [fPayables, fExpenseReportData]);
  const receivableAging: AgingBucket[] = useMemo(() => getAgingBuckets(fReceivables, "receive"), [fReceivables]);
  const payableAging: AgingBucket[] = useMemo(() => getAgingBuckets(fPayables, "pay"), [fPayables]);

  // 环比变化
  const momIncome = monthlyData.length >= 2
    ? computeMoMChange(monthlyData[monthlyData.length - 1].income, monthlyData[monthlyData.length - 2].income)
    : null;
  const momExpense = monthlyData.length >= 2
    ? computeMoMChange(monthlyData[monthlyData.length - 1].expense, monthlyData[monthlyData.length - 2].expense)
    : null;
  const momProfit = monthlyData.length >= 2
    ? computeMoMChange(
        monthlyData[monthlyData.length - 1].income - monthlyData[monthlyData.length - 1].expense,
        monthlyData[monthlyData.length - 2].income - monthlyData[monthlyData.length - 2].expense
      )
    : null;

  function formatChange(change: number | null): string | null {
    if (change === null) return null;
    const sign = change >= 0 ? "↑" : "↓";
    return `较上月 ${sign}${Math.abs(change * 100).toFixed(1)}%`;
  }

  // 饼图数据
  const pieData = useMemo(() => [
    { name: "合同收入", value: totals.totalReceivablePaid },
    { name: "其他收入", value: totals.totalNonContractIncome + totals.totalContribution + totals.totalBorrowing },
    { name: "合同支出", value: totals.totalPayablePaid },
    { name: "其他支出", value: totals.totalNonContractExpense + totals.totalLending },
    { name: "工资+报销", value: totals.totalSalaryPaid + totals.totalExpenseReport },
  ].filter(d => d.value > 0), [totals]);

  // 月度趋势图数据（最近12个月）
  const chartMonthlyData = useMemo(() => monthlyData.slice(-12).map(m => ({
    month: m.month,
    收入: m.income,
    支出: m.expense,
  })), [monthlyData]);

  // ========== Loading ==========
  if (loading) {
    return (
      <>
        <div className="page-header">
          <div><h1>财务报表</h1><p>经营看板、项目成本与账龄分析</p></div>
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

  // ========== 渲染 ==========
  return (
    <>
      <div className="page-header">
        <div><h1>财务报表</h1><p>经营看板、项目成本与账龄分析</p></div>
      </div>

      {/* Tab 导航 + 主体筛选 */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {tabs.map(tab => (
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
            <select className="ios-select" value={selectedOrgId} onChange={e => setSelectedOrgId(e.target.value)}>
              <option value="">全部（合并报表）</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.accountName || org.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ==================== Tab 1: 经营看板 ==================== */}
      {activeTab === "dashboard" && (
        <div className="space-y-5">
          {/* KPI 卡片 */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="总收入" value={formatAmount(totals.totalIncome)} change={formatChange(momIncome)} color={COLORS.income} />
            <StatCard label="总支出" value={formatAmount(totals.totalExpense)} change={formatChange(momExpense)} color={COLORS.expense} />
            <StatCard label="净利润" value={formatAmount(totals.netProfit)} change={formatChange(momProfit)} color={COLORS.primary} />
          </div>

          {/* 图表区 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 月度收支趋势柱状图 */}
            <div className="bento-card-static">
              <h3 className="text-[15px] font-bold text-[#1C1917] mb-3">月度收支趋势</h3>
              {chartMonthlyData.length === 0 ? (
                <div className="empty-state py-8"><p>暂无数据</p></div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartMonthlyData} margin={{ top: 5, right: 20, bottom: 5, left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#78716C" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#78716C" }} tickFormatter={(v: number) => `¥${(v / 10000).toFixed(0)}万`} />
                    <Tooltip formatter={(value: number) => formatAmount(value)} />
                    <Bar dataKey="收入" fill={COLORS.income} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="支出" fill={COLORS.expense} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 收支分类占比饼图 */}
            <div className="bento-card-static">
              <h3 className="text-[15px] font-bold text-[#1C1917] mb-3">收支分类占比</h3>
              {pieData.length === 0 ? (
                <div className="empty-state py-8"><p>暂无数据</p></div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatAmount(value)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 收入/支出构成分类卡片 */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="合同收入（已收）" value={formatAmount(totals.totalReceivablePaid)} color={COLORS.income} />
            <StatCard label="其他收入" value={formatAmount(totals.totalNonContractIncome)} color={COLORS.income} />
            <StatCard label="股东出资" value={formatAmount(totals.totalContribution)} color={COLORS.income} />
            <StatCard label="合同支出（已付）" value={formatAmount(totals.totalPayablePaid)} color={COLORS.expense} />
            <StatCard label="其他支出" value={formatAmount(totals.totalNonContractExpense)} color={COLORS.expense} />
            <StatCard label="工资+报销+借出" value={formatAmount(totals.totalSalaryPaid + totals.totalExpenseReport + totals.totalLending)} color={COLORS.expense} />
          </div>

          {/* 月度收支明细表（可折叠） */}
          <div className="bento-card-static">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowMonthlyDetail(!showMonthlyDetail)}>
              <h3 className="text-[15px] font-bold text-[#1C1917]">月度收支明细</h3>
              <span className="text-[13px] text-[#5856D6]">{showMonthlyDetail ? "收起 ▲" : "展开 ▼"}</span>
            </div>
            {showMonthlyDetail && (
              <div className="mt-4 overflow-x-auto">
                {monthlyData.length === 0 ? (
                  <div className="empty-state py-6"><p>暂无月度数据</p></div>
                ) : (
                  <table className="ios-table">
                    <thead><tr><th>月份</th><th>收入</th><th>支出</th><th>净利润</th></tr></thead>
                    <tbody>
                      {monthlyData.slice(-12).map(row => (
                        <tr key={row.month}>
                          <td className="font-semibold">{row.month}</td>
                          <td className="font-semibold">{formatAmount(row.income)}</td>
                          <td className="font-semibold">{formatAmount(row.expense)}</td>
                          <td className={`font-semibold ${row.income - row.expense >= 0 ? "text-[#34C759]" : "text-[#FF3B30]"}`}>
                            {formatAmount(row.income - row.expense)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== Tab 2: 项目成本 ==================== */}
      {activeTab === "projectCost" && (
        <div className="space-y-5">
          {/* 汇总指标 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bento-card-static text-center">
              <div className="text-[13px] font-semibold text-[#78716C]">项目总数</div>
              <p className="text-[24px] font-bold mt-1">{projectCosts.length}</p>
            </div>
            <div className="bento-card-static text-center">
              <div className="text-[13px] font-semibold text-[#78716C]">应付总额</div>
              <p className="text-[24px] font-bold mt-1">{formatAmount(projectCosts.reduce((s, r) => s + r.totalAmount, 0))}</p>
            </div>
            <div className="bento-card-static text-center">
              <div className="text-[13px] font-semibold text-[#78716C]">已付总额</div>
              <p className="text-[24px] font-bold mt-1">{formatAmount(projectCosts.reduce((s, r) => s + r.paidAmount, 0))}</p>
            </div>
          </div>

          {/* 柱状图 */}
          <div className="bento-card-static">
            <h3 className="text-[15px] font-bold text-[#1C1917] mb-3">各项目成本对比</h3>
            {projectCosts.length === 0 ? (
              <div className="empty-state py-8"><p>暂无项目成本数据</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={projectCosts.map(p => ({
                    name: p.name.length > 6 ? p.name.slice(0, 6) + "…" : p.name,
                    应付总额: p.totalAmount,
                    已付总额: p.paidAmount,
                    费用报销: p.expenseReportAmount,
                  }))}
                  margin={{ top: 5, right: 20, bottom: 5, left: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#78716C" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#78716C" }} tickFormatter={(v: number) => `¥${(v / 10000).toFixed(0)}万`} />
                  <Tooltip formatter={(value: number) => formatAmount(value)} />
                  <Bar dataKey="应付总额" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="已付总额" fill={COLORS.income} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="费用报销" fill={COLORS.orange} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 明细表 */}
          <div className="bento-card-static">
            <h3 className="text-[15px] font-bold text-[#1C1917] mb-4">项目成本明细</h3>
            {projectCosts.length === 0 ? (
              <div className="empty-state py-8"><p>暂无项目成本数据</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="ios-table">
                  <thead>
                    <tr><th>项目</th><th>应付</th><th>已付</th><th>未付</th><th>报销</th><th>总成本</th><th>进度</th></tr>
                  </thead>
                  <tbody>
                    {projectCosts.map(row => {
                      const progress = row.totalAmount > 0 ? row.paidAmount / row.totalAmount : 0;
                      const progressColor = progress >= 0.8 ? COLORS.income : progress >= 0.5 ? COLORS.orange : COLORS.expense;
                      return (
                        <tr key={row.id}>
                          <td className="font-semibold">{row.name}</td>
                          <td>{formatAmount(row.totalAmount)}</td>
                          <td>{formatAmount(row.paidAmount)}</td>
                          <td>{formatAmount(row.totalAmount - row.paidAmount)}</td>
                          <td>{formatAmount(row.expenseReportAmount)}</td>
                          <td className="font-semibold">{formatAmount(row.totalAmount + row.expenseReportAmount)}</td>
                          <td style={{ color: progressColor, fontWeight: 600 }}>{(progress * 100).toFixed(1)}%</td>
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

      {/* ==================== Tab 3: 账龄分析 ==================== */}
      {activeTab === "aging" && (
        <div className="space-y-5">
          {/* 应收/应付切换 */}
          <div className="flex gap-2">
            <button
              className={`ios-btn ${agingDirection === "receive" ? "ios-btn-primary" : "ios-btn-secondary"}`}
              onClick={() => setAgingDirection("receive")}
            >
              <TrendingUp className="w-4 h-4" />应收账款
            </button>
            <button
              className={`ios-btn ${agingDirection === "pay" ? "ios-btn-primary" : "ios-btn-secondary"}`}
              onClick={() => setAgingDirection("pay")}
            >
              <TrendingDown className="w-4 h-4" />应付账款
            </button>
          </div>

          {(() => {
            const buckets = agingDirection === "receive" ? receivableAging : payableAging;
            const items = agingDirection === "receive"
              ? fReceivables.filter((r: any) => r.status !== "已收" && Number(r.amount) - Number(r.paidAmount) > 0)
              : fPayables.filter((p: any) => p.status !== "已付" && Number(p.amount) - Number(p.paidAmount) > 0);

            return (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* 横向条形图 */}
                  <div className="bento-card-static">
                    <h3 className="text-[15px] font-bold text-[#1C1917] mb-3">账龄分布</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart
                        data={buckets.map(b => ({ name: b.label, 金额: b.amount }))}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E0" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "#78716C" }} tickFormatter={(v: number) => `¥${(v / 10000).toFixed(0)}万`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#78716C" }} />
                        <Tooltip formatter={(value: number) => formatAmount(value)} />
                        <Bar dataKey="金额" radius={[0, 4, 4, 0]}>
                          {buckets.map((_, idx) => {
                            const barColors = [COLORS.income, COLORS.orange, COLORS.expense, COLORS.neutral];
                            return <Cell key={`cell-${idx}`} fill={barColors[idx] || COLORS.neutral} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 4 段金额卡片 */}
                  <div className="grid grid-cols-2 gap-3">
                    {buckets.map((b, idx) => {
                      const labelColors = [COLORS.income, COLORS.orange, COLORS.expense, COLORS.neutral];
                      return (
                        <div key={b.range} className="bento-card-static text-center py-4">
                          <div className="text-[12px] font-semibold" style={{ color: labelColors[idx] }}>{b.label}</div>
                          <p className="text-[20px] font-bold mt-1">{formatAmount(b.amount)}</p>
                          <p className="text-[12px] text-[#78716C]">{b.count} 笔</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 明细表 */}
                <div className="bento-card-static">
                  <h3 className="text-[15px] font-bold text-[#1C1917] mb-4">
                    {agingDirection === "receive" ? "应收账款明细" : "应付账款明细"}
                  </h3>
                  {items.length === 0 ? (
                    <div className="empty-state py-8"><p>暂无未{agingDirection === "receive" ? "收" : "付"}款记录</p></div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="ios-table">
                        <thead>
                          <tr>
                            <th>来源类型</th><th>项目</th>
                            <th>{agingDirection === "receive" ? "应收" : "应付"}金额</th>
                            <th>{agingDirection === "receive" ? "已收" : "已付"}金额</th>
                            <th>{agingDirection === "receive" ? "未收" : "未付"}金额</th>
                            <th>到期日</th><th>逾期天数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((r: any) => {
                            const diffDays = Math.floor((Date.now() - new Date(r.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                            const overdueColor = diffDays <= 0 ? COLORS.income : diffDays <= 60 ? COLORS.orange : COLORS.expense;
                            return (
                              <tr key={r.id}>
                                <td><span className="ios-badge ios-badge-blue">{r.sourceType}</span></td>
                                <td className="text-[#78716C]">{r.project?.name || r.projectSourceId || "公司级"}</td>
                                <td>{formatAmount(Number(r.amount))}</td>
                                <td>{formatAmount(Number(r.paidAmount))}</td>
                                <td className="font-semibold">{formatAmount(Number(r.amount) - Number(r.paidAmount))}</td>
                                <td className="text-[#78716C]">{new Date(r.dueDate).toLocaleDateString("zh-CN")}</td>
                                <td>
                                  <span className="ios-badge" style={{ backgroundColor: overdueColor + "20", color: overdueColor }}>
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
              </>
            );
          })()}
        </div>
      )}
    </>
  );
}

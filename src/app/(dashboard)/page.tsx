"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  FileText,
  DollarSign,
  Briefcase,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Eye,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface DashboardStats {
  projectCount: number;
  projectByStatus: { status: string; count: number }[];
  employeeCount: number;
  activeEmployeeCount: number;
  incomeContractTotal: number;
  expenseContractTotal: number;
  nonContractIncomeTotal: number;
  nonContractExpenseTotal: number;
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  receivableTotal: number;
  receivablePaid: number;
  payableTotal: number;
  payablePaid: number;
  pendingApprovals: number;
  receivableOverdue: number;
  payableOverdue: number;
  recentProjects: {
    id: string;
    name: string;
    projectCode: string;
    status: string;
    createdAt: string;
    customer: { name: string } | null;
  }[];
}

function formatMoney(val: number): string {
  if (val >= 10000) {
    return `¥${(val / 10000).toFixed(1)}万`;
  }
  return `¥${val.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const statusLabelMap: Record<string, string> = {
  "执行": "执行中",
  "完工": "已完工",
  "暂停": "已暂停",
  "终止": "已终止",
  "跟踪中": "跟踪中",
  "投标中": "投标中",
  "报价中": "报价中",
  "已中标": "已中标",
  "落地": "已落地",
  "已立项": "已立项",
};

const statusColorMap: Record<string, string> = {
  "执行": "bg-[#34C759]",
  "完工": "bg-[#007AFF]",
  "暂停": "bg-[#FF9500]",
  "终止": "bg-[#FF3B30]",
};

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((json) => {
        if (json.projectCount !== undefined) {
          setStats(json);
        }
      })
      .catch((err) => console.error("获取仪表盘数据失败:", err))
      .finally(() => setLoading(false));
  }, []);

  const receivableUnpaid = (stats?.receivableTotal || 0) - (stats?.receivablePaid || 0);
  const payableUnpaid = (stats?.payableTotal || 0) - (stats?.payablePaid || 0);

  const kpiCards = [
    {
      title: "项目总数",
      value: stats ? String(stats.projectCount) : "-",
      subtitle: stats?.activeEmployeeCount ? `${stats.activeEmployeeCount} 名在职员工` : "",
      icon: <Briefcase className="w-5 h-5" />,
      tint: "#007AFF",
      tintLight: "rgba(0, 122, 255, 0.08)",
    },
    {
      title: "总收入",
      value: stats ? formatMoney(stats.totalIncome) : "-",
      subtitle: `合同 ${formatMoney(stats?.incomeContractTotal || 0)}`,
      icon: <TrendingUp className="w-5 h-5" />,
      tint: "#34C759",
      tintLight: "rgba(52, 199, 89, 0.08)",
    },
    {
      title: "总支出",
      value: stats ? formatMoney(stats.totalExpense) : "-",
      subtitle: `合同 ${formatMoney(stats?.expenseContractTotal || 0)}`,
      icon: <TrendingDown className="w-5 h-5" />,
      tint: "#FF9500",
      tintLight: "rgba(255, 149, 0, 0.08)",
    },
    {
      title: "待审批",
      value: stats ? String(stats.pendingApprovals) : "-",
      subtitle: "待您处理",
      icon: <FileText className="w-5 h-5" />,
      tint: "#AF52DE",
      tintLight: "rgba(175, 82, 222, 0.08)",
      onClick: () => router.push("/approvals"),
    },
  ];

  const alertItems: { title: string; description: string; level: "high" | "medium" }[] = [];
  if (stats?.receivableOverdue && stats.receivableOverdue > 0) {
    alertItems.push({
      title: `${stats.receivableOverdue} 笔应收账款已逾期`,
      description: `未收款金额 ${formatMoney(receivableUnpaid)}，请尽快跟进`,
      level: "high",
    });
  }
  if (stats?.payableOverdue && stats.payableOverdue > 0) {
    alertItems.push({
      title: `${stats.payableOverdue} 笔应付账款已逾期`,
      description: `未付款金额 ${formatMoney(payableUnpaid)}，请及时处理`,
      level: "high",
    });
  }

  return (
    <>
      <div className="page-header">
        <h1>总览仪表板</h1>
        <p>系统核心数据概览</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-5">
            {kpiCards.map((card, index) => (
              <div
                key={index}
                className="bento-card glow-soft cursor-pointer flex flex-col justify-between h-full"
                onClick={card.onClick}
              >
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[13px] font-medium text-[#86868B]">{card.title}</span>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: card.tintLight, color: card.tint }}
                    >
                      {card.icon}
                    </div>
                  </div>
                  <div className="text-[36px] font-bold text-[#1D1D1F] tracking-tight leading-none mb-3">
                    {card.value}
                  </div>
                  <div className="mt-auto">
                    <span className="text-[12px] text-[#86868B]">{card.subtitle}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="bento-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#34C759]" />
                  <h3 className="text-[15px] font-bold text-[#1D1D1F]">财务概览</h3>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-[#34C759]/6">
                  <p className="text-[12px] text-[#86868B] mb-1">总收入</p>
                  <p className="text-[18px] font-bold text-[#34C759]">{formatMoney(stats?.totalIncome || 0)}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#FF3B30]/6">
                  <p className="text-[12px] text-[#86868B] mb-1">总支出</p>
                  <p className="text-[18px] font-bold text-[#FF3B30]">{formatMoney(stats?.totalExpense || 0)}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-[#F5F5F7]">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#86868B]">净额</span>
                    <span className={`text-[15px] font-bold ${(stats?.netAmount || 0) >= 0 ? "text-[#34C759]" : "text-[#FF3B30]"}`}>
                      {formatMoney(stats?.netAmount || 0)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[#FF9500]/6">
                    <p className="text-[12px] text-[#86868B] mb-1">待收款</p>
                    <p className="text-[15px] font-bold text-[#FF9500]">{formatMoney(receivableUnpaid)}</p>
                    <p className="text-[11px] text-[#86868B] mt-0.5">应收总额 {formatMoney(stats?.receivableTotal || 0)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#AF52DE]/6">
                    <p className="text-[12px] text-[#86868B] mb-1">待付款</p>
                    <p className="text-[15px] font-bold text-[#AF52DE]">{formatMoney(payableUnpaid)}</p>
                    <p className="text-[11px] text-[#86868B] mt-0.5">应付总额 {formatMoney(stats?.payableTotal || 0)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bento-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[#FF3B30]" />
                  <h3 className="text-[15px] font-bold text-[#1D1D1F]">预警事项</h3>
                  {alertItems.length > 0 && (
                    <span className="ml-auto text-[13px] font-semibold text-[#FF3B30] bg-[#FF3B30]/10 px-2 py-0.5 rounded-full">
                      {alertItems.length} 项
                    </span>
                  )}
                </div>
              </div>
              {alertItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="w-14 h-14 rounded-full bg-[#34C759]/10 flex items-center justify-center mb-3">
                    <DollarSign className="w-7 h-7 text-[#34C759]" />
                  </div>
                  <p className="text-[14px] font-medium text-[#1D1D1F]">暂无预警</p>
                  <p className="text-[12px] text-[#86868B] mt-1">所有款项均正常</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alertItems.map((alert, index) => (
                    <div key={index} className="flex gap-3 p-3 rounded-xl bg-[#F5F5F7] hover:bg-[#EEEEF0] transition-colors duration-150">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${alert.level === "high" ? "bg-[#FF3B30]" : "bg-[#FF9500]"}`} />
                      <div>
                        <p className="text-[13px] font-semibold text-[#1D1D1F]">{alert.title}</p>
                        <p className="text-[12px] text-[#86868B] mt-0.5">{alert.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-[#F0F0F0]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#007AFF]" />
                    <h3 className="text-[15px] font-bold text-[#1D1D1F]">团队概况</h3>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[#007AFF]/6">
                    <p className="text-[12px] text-[#86868B] mb-1">员工总数</p>
                    <p className="text-[18px] font-bold text-[#007AFF]">{stats?.employeeCount || 0}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#34C759]/6">
                    <p className="text-[12px] text-[#86868B] mb-1">在职人数</p>
                    <p className="text-[18px] font-bold text-[#34C759]">{stats?.activeEmployeeCount || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bento-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#007AFF]" />
                <h3 className="text-[15px] font-bold text-[#1D1D1F]">项目概况</h3>
              </div>
              <div className="flex items-center gap-3">
                {stats?.projectByStatus.map((ps) => (
                  <span key={ps.status} className="flex items-center gap-1 text-[12px]">
                    <span className={`w-2 h-2 rounded-full ${statusColorMap[ps.status] || "bg-[#86868B]"}`} />
                    <span className="text-[#86868B]">{statusLabelMap[ps.status] || ps.status}</span>
                    <span className="font-semibold text-[#1D1D1F]">{ps.count}</span>
                  </span>
                ))}
              </div>
            </div>

            {stats?.recentProjects && stats.recentProjects.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="ios-table">
                  <thead>
                    <tr>
                      <th>项目编号</th>
                      <th>项目名称</th>
                      <th>客户</th>
                      <th>状态</th>
                      <th>创建时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentProjects.map((project) => (
                      <tr key={project.id}>
                        <td className="font-mono text-[13px]">{project.projectCode || "-"}</td>
                        <td className="font-semibold">{project.name}</td>
                        <td className="text-[#86868B]">{project.customer?.name || "-"}</td>
                        <td>
                          <span className={`ios-badge ${project.status === "执行" ? "ios-badge-green" : project.status === "完工" ? "ios-badge-blue" : project.status === "暂停" ? "ios-badge-orange" : "ios-badge-gray"}`}>
                            {statusLabelMap[project.status] || project.status}
                          </span>
                        </td>
                        <td className="text-[#86868B] text-[13px] whitespace-nowrap">
                          {new Date(project.createdAt).toLocaleDateString("zh-CN")}
                        </td>
                        <td>
                          <button
                            className="ios-btn ios-btn-ghost ios-btn-sm"
                            onClick={() => router.push(`/projects`)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            查看
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <Briefcase className="w-10 h-10 text-[#86868B] mb-2" />
                <p className="text-[13px] text-[#86868B]">暂无项目</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

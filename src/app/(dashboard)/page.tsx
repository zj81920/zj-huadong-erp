"use client";

import { useState, useEffect } from "react";
import {
  Briefcase,
  Users,
  Eye,
  Sparkles,
  RefreshCw,
  ListTodo,
  FileText,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface DashboardStats {
  projectCount: number;
  projectByStatus: { status: string; count: number }[];
  employeeCount: number;
  activeEmployeeCount: number;
  pendingApprovals: number;
  pendingTodoList: {
    id: string;
    businessType: string;
    businessTitle: string;
    status: string;
    createdAt: string;
  }[];
  recentProjects: {
    id: string;
    name: string;
    projectCode: string;
    status: string;
    createdAt: string;
    customer: { name: string } | null;
  }[];
}

const statusLabelMap: Record<string, string> = {
  "执行": "执行",
  "完工": "关闭",
  "暂停": "暂停",
  "终止": "终止",
};

const statusBarColor: Record<string, string> = {
  "执行": "bg-[#4338CA]",
  "完工": "bg-[#1C1917]",
  "暂停": "bg-[#D97706]",
  "终止": "bg-[#78716C]",
};

const businessTypeLabels: Record<string, string> = {
  income_contract: "收入合同",
  expense_contract: "支出合同",
  non_contract_expense: "其他支出",
  expense_report: "费用报销",
  supplier: "供应商审批",
  purchase_request: "采购需求",
  delivery_receipt: "到货验收",
  outsourcing: "外包任务",
  payment_application: "合同支付",
  lending_out: "借出款",
  salary_payment: "工资发放",
  borrowing_return_application: "借入资金归还",
};

const todoTypeIcons: Record<string, { icon: string; color: string }> = {
  已驳回: { icon: "🟠", color: "text-[#D97706]" },
  审批中: { icon: "🔵", color: "text-[#4338CA]" },
  待归档: { icon: "🟢", color: "text-[#16A34A]" },
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

  const totalProjects = stats?.projectCount || 0;
  const projectByStatus = stats?.projectByStatus || [];

  return (
    <>
      <div className="page-header">
        <h1>总览仪表板</h1>
        <p>工作概览与待办事项</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-text-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* AI 工作概览 */}
          <div className="relative rounded-2xl p-[1.5px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
            <div className="rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-[15px] font-bold text-[#1C1917]">AI 工作概览</h3>
                </div>
                <button className="flex items-center gap-1 text-[12px] text-text-secondary hover:text-text-primary transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                  重新生成
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: "项目提醒",
                    content: totalProjects > 0
                      ? `当前共有 ${totalProjects} 个项目，其中 ${projectByStatus.find(p => p.status === "执行")?.count || 0} 个执行中`
                      : "暂无进行中的项目",
                  },
                  {
                    label: "审批提醒",
                    content: stats?.pendingApprovals
                      ? `您有 ${stats.pendingApprovals} 条待审批事项需要处理`
                      : "暂无待审批事项",
                  },
                  {
                    label: "团队动态",
                    content: stats?.activeEmployeeCount
                      ? `${stats.activeEmployeeCount} 名在职员工，团队运转正常`
                      : "暂无团队数据",
                  },
                ].map((item, i) => (
                  <div key={i} className="p-3 rounded-xl bg-[#FAFAF9]">
                    <p className="text-[12px] font-medium text-text-secondary mb-1">{item.label}</p>
                    <p className="text-[13px] text-text-primary leading-relaxed">{item.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 项目概况 */}
          <div className="bento-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-text-secondary" />
                <h3 className="text-[15px] font-bold text-[#1C1917]">项目概况</h3>
              </div>
              <button
                className="text-[12px] text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors"
                onClick={() => router.push("/projects")}
              >
                查看全部 <ArrowRight className="w-3 h-3" />
              </button>
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
                        <td className="font-mono text-[12px] text-text-secondary">{project.projectCode || "-"}</td>
                        <td className="font-medium">{project.name}</td>
                        <td className="text-text-secondary">{project.customer?.name || "-"}</td>
                        <td>
                          <span className={`ios-badge ${project.status === "执行" ? "ios-badge-green" : project.status === "完工" ? "ios-badge-blue" : project.status === "暂停" ? "ios-badge-orange" : "ios-badge-gray"}`}>
                            {statusLabelMap[project.status] || project.status}
                          </span>
                        </td>
                        <td className="text-text-secondary text-[12px] whitespace-nowrap">
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
                <Briefcase className="w-10 h-10 text-text-secondary mb-2" />
                <p className="text-[13px] text-text-secondary">暂无项目</p>
              </div>
            )}
          </div>

          {/* 项目状态分布 + 团队概况 */}
          <div className="grid grid-cols-2 gap-5">
            {/* 项目状态分布 - 柱状图 */}
            <div className="bento-card">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="w-5 h-5 text-text-secondary" />
                <h3 className="text-[15px] font-bold text-[#1C1917]">项目状态分布</h3>
              </div>
              {projectByStatus.length > 0 ? (
                <div className="space-y-3">
                  {projectByStatus.map((ps) => {
                    const pct = totalProjects > 0 ? Math.round((ps.count / totalProjects) * 100) : 0;
                    return (
                      <div key={ps.status} className="flex items-center gap-3">
                        <span className="text-[13px] text-text-secondary w-12 flex-shrink-0">
                          {statusLabelMap[ps.status] || ps.status}
                        </span>
                        <div className="flex-1 h-7 bg-[#F5F5F4] rounded-full overflow-hidden relative">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${statusBarColor[ps.status] || "bg-[#78716C]"}`}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-end pr-2 text-[11px] font-medium text-text-primary">
                            {ps.count} 个 · {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-[13px] text-text-secondary">暂无项目数据</p>
                </div>
              )}
            </div>

            {/* 团队概况 */}
            <div className="bento-card">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-text-secondary" />
                <h3 className="text-[15px] font-bold text-[#1C1917]">团队概况</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#FAFAF9] text-center">
                  <p className="text-[28px] font-bold text-text-primary">{stats?.employeeCount || 0}</p>
                  <p className="text-[12px] text-text-secondary mt-1">员工总数</p>
                </div>
                <div className="p-4 rounded-xl bg-[#FAFAF9] text-center">
                  <p className="text-[28px] font-bold text-text-primary">{stats?.activeEmployeeCount || 0}</p>
                  <p className="text-[12px] text-text-secondary mt-1">在职人数</p>
                </div>
              </div>
            </div>
          </div>

          {/* 我的待办 */}
          <div className="bento-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-text-secondary" />
                <h3 className="text-[15px] font-bold text-[#1C1917]">我的待办</h3>
                {stats?.pendingTodoList && stats.pendingTodoList.length > 0 && (
                  <span className="text-[12px] font-medium text-text-primary bg-bg-tertiary px-2 py-0.5 rounded">
                    {stats.pendingTodoList.length} 项
                  </span>
                )}
              </div>
              <button
                className="text-[12px] text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors"
                onClick={() => router.push("/approvals")}
              >
                查看全部 <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {stats?.pendingTodoList && stats.pendingTodoList.length > 0 ? (
              <div className="space-y-2">
                {stats.pendingTodoList.slice(0, 5).map((todo) => {
                  const typeInfo = todoTypeIcons[todo.status] || { icon: "⚪", color: "text-text-secondary" };
                  return (
                    <div
                      key={todo.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-[#FAFAF9] hover:bg-[#F5F5F4] transition-colors cursor-pointer"
                      onClick={() => router.push("/approvals")}
                    >
                      <span className="text-[14px]">{typeInfo.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-text-primary truncate">
                          {todo.businessTitle || businessTypeLabels[todo.businessType] || todo.businessType}
                        </p>
                        <p className="text-[11px] text-text-secondary mt-0.5">
                          {businessTypeLabels[todo.businessType] || todo.businessType} · {new Date(todo.createdAt).toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                      <span className={`text-[11px] font-medium ${typeInfo.color} flex-shrink-0`}>
                        {todo.status === "已驳回" ? "待重新提交" : todo.status === "待归档" ? "待归档" : "待审批"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <FileText className="w-8 h-8 text-text-secondary mb-2" />
                <p className="text-[13px] text-text-secondary">暂无待办事项</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

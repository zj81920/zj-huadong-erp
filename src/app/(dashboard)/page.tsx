"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  DollarSign,
  Briefcase,
  ShoppingCart,
  Users,
} from "lucide-react";

interface TodoItem {
  id: string;
  title: string;
  type: string;
  deadline: string;
  done: boolean;
}

interface ProjectItem {
  name: string;
  progress: number;
  status: "正常" | "滞后" | "预警";
  budgetUsed: number;
}

interface AlertItem {
  title: string;
  description: string;
  level: "high" | "medium";
}

interface KPICardData {
  title: string;
  value: string;
  change: string;
  changeType: "up" | "down" | "neutral";
  icon: React.ReactNode;
  tint: string;
  tintLight: string;
}

const kpiCards: KPICardData[] = [
  {
    title: "在研项目",
    value: "24",
    change: "+3 本月",
    changeType: "up",
    icon: <Briefcase className="w-5 h-5" />,
    tint: "#007AFF",
    tintLight: "rgba(0, 122, 255, 0.08)",
  },
  {
    title: "本月产值",
    value: "¥1,286万",
    change: "+12.5%",
    changeType: "up",
    icon: <TrendingUp className="w-5 h-5" />,
    tint: "#34C759",
    tintLight: "rgba(52, 199, 89, 0.08)",
  },
  {
    title: "待收款项",
    value: "¥3,420万",
    change: "-2.3%",
    changeType: "down",
    icon: <DollarSign className="w-5 h-5" />,
    tint: "#FF9500",
    tintLight: "rgba(255, 149, 0, 0.08)",
  },
  {
    title: "待审批",
    value: "17",
    change: "+5 今日",
    changeType: "up",
    icon: <FileText className="w-5 h-5" />,
    tint: "#AF52DE",
    tintLight: "rgba(175, 82, 222, 0.08)",
  },
];

const todoItems: TodoItem[] = [
  { id: "1", title: "审核 PJ-2025-0012 采购需求", type: "采购审批", deadline: "今天 14:00", done: false },
  { id: "2", title: "审批王磊的费用报销单 #20250518003", type: "费用审批", deadline: "今天 17:00", done: false },
  { id: "3", title: "确认扬子石化项目合同变更", type: "合同审批", deadline: "明天 10:00", done: false },
  { id: "4", title: "复核 5 月财务报表", type: "财务审批", deadline: "5月22日", done: true },
  { id: "5", title: "审批设计外包任务书 #OUT-2025-008", type: "外包审批", deadline: "5月23日", done: false },
];

const projectItems: ProjectItem[] = [
  { name: "扬子石化重整项目", progress: 78, status: "正常", budgetUsed: 72 },
  { name: "安庆医药中间体项目", progress: 45, status: "滞后", budgetUsed: 68 },
  { name: "合肥新站原料药项目", progress: 92, status: "正常", budgetUsed: 89 },
  { name: "淮南煤化工配套项目", progress: 23, status: "预警", budgetUsed: 95 },
  { name: "蚌埠生物医药产业园", progress: 61, status: "正常", budgetUsed: 55 },
];

const alertItems: AlertItem[] = [
  { title: "淮南煤化工配套项目预算超支", description: "设计外包费已超出预算 15%，请尽快处理", level: "high" },
  { title: "安庆医药项目进度滞后 12 天", description: "设计图纸交付延迟，影响后续采购计划", level: "high" },
  { title: "3 笔应收账款即将逾期", description: "合计 ¥486万，最迟一笔 5 月 25 日到期", level: "medium" },
];

const recentActivities = [
  { action: "项目立项", target: "蚌埠生物医药产业园", user: "张明", time: "10 分钟前" },
  { action: "采购合同签署", target: "PJ-2025-0010 反应釜采购", user: "李芳", time: "32 分钟前" },
  { action: "费用报销", target: "王磊 ¥3,280", user: "王磊", time: "1 小时前" },
  { action: "投标保证金", target: "中石化安庆项目 ¥50万", user: "陈强", time: "2 小时前" },
  { action: "设计外包验收", target: "OUT-2025-006 土建设计", user: "赵敏", time: "3 小时前" },
];

function KPICard({ data }: { data: KPICardData }) {
  return (
    <div className="bento-card glow-soft cursor-pointer flex flex-col justify-between h-full">
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px] font-medium text-[#86868B]">{data.title}</span>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: data.tintLight, color: data.tint }}
          >
            {data.icon}
          </div>
        </div>
        <div className="text-[36px] font-bold text-[#1D1D1F] tracking-tight leading-none mb-3">
          {data.value}
        </div>
        <div className="flex items-center gap-1 mt-auto">
          {data.changeType === "up" ? (
            <ArrowUpRight className="w-3.5 h-3.5 text-[#34C759]" />
          ) : data.changeType === "down" ? (
            <ArrowDownRight className="w-3.5 h-3.5 text-[#FF3B30]" />
          ) : null}
          <span
            className={`text-[12px] font-semibold ${
              data.changeType === "up" ? "text-[#34C759]" : data.changeType === "down" ? "text-[#FF3B30]" : "text-[#86868B]"
            }`}
          >
            {data.change}
          </span>
        </div>
      </div>
    </div>
  );
}

function AlertCard() {
  return (
    <div className="bento-card breathing-alert">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-5 h-5 text-[#FF3B30]" />
        <h3 className="text-[15px] font-bold text-[#1D1D1F]">预警事项</h3>
        <span className="ml-auto text-[13px] font-semibold text-[#FF3B30] bg-[#FF3B30]/10 px-2 py-0.5 rounded-full">
          {alertItems.length} 项
        </span>
      </div>
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
    </div>
  );
}

function TodoList() {
  const [items, setItems] = useState(todoItems);

  const toggleItem = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  return (
    <div className="bento-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#007AFF]" />
          <h3 className="text-[15px] font-bold text-[#1D1D1F]">待办事项</h3>
        </div>
        <span className="text-[13px] text-[#86868B]">{items.filter((i) => !i.done).length} 待处理</span>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F5F5F7] transition-colors duration-150 group">
            <input type="checkbox" className="ios-checkbox mt-0.5" checked={item.done} onChange={() => toggleItem(item.id)} />
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-medium leading-snug ${item.done ? "text-[#86868B] line-through" : "text-[#1D1D1F]"}`}>
                {item.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-medium text-[#007AFF] bg-[#007AFF]/8 px-1.5 py-0.5 rounded-md">{item.type}</span>
                <span className="text-[11px] text-[#86868B] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.deadline}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectProgress() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "正常": return "bg-[#34C759]";
      case "滞后": return "bg-[#FF9500]";
      case "预警": return "bg-[#FF3B30]";
      default: return "bg-[#86868B]";
    }
  };

  return (
    <div className="bento-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-[#007AFF]" />
          <h3 className="text-[15px] font-bold text-[#1D1D1F]">项目进度</h3>
        </div>
        <span className="text-[13px] text-[#86868B]">5 个进行中</span>
      </div>
      <div className="space-y-4">
        {projectItems.map((project, index) => (
          <div key={index}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[#1D1D1F]">{project.name}</span>
                <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>
              <span className="text-[13px] font-bold text-[#1D1D1F]">{project.progress}%</span>
            </div>
            <div className="h-2 bg-[#F5F5F7] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-[#007AFF] transition-all duration-500 ease-out" style={{ width: `${project.progress}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[11px] text-[#86868B]">预算使用 {project.budgetUsed}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinancialOverview() {
  return (
    <div className="bento-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[#34C759]" />
          <h3 className="text-[15px] font-bold text-[#1D1D1F]">本月收支</h3>
        </div>
        <span className="text-[13px] text-[#86868B]">2025年5月</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-[#34C759]/6">
          <p className="text-[12px] text-[#86868B] mb-1">收入</p>
          <p className="text-[18px] font-bold text-[#34C759]">¥1,286万</p>
        </div>
        <div className="p-3 rounded-xl bg-[#FF3B30]/6">
          <p className="text-[12px] text-[#86868B] mb-1">支出</p>
          <p className="text-[18px] font-bold text-[#FF3B30]">¥892万</p>
        </div>
      </div>
      <div className="p-3 rounded-xl bg-[#F5F5F7]">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[#86868B]">净利润</span>
          <span className="text-[15px] font-bold text-[#1D1D1F]">¥394万</span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <TrendingUp className="w-3.5 h-3.5 text-[#34C759]" />
          <span className="text-[12px] font-medium text-[#34C759]">环比增长 8.2%</span>
        </div>
      </div>
    </div>
  );
}

function RecentActivity() {
  return (
    <div className="bento-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#86868B]" />
          <h3 className="text-[15px] font-bold text-[#1D1D1F]">最近动态</h3>
        </div>
      </div>
      <div className="space-y-3">
        {recentActivities.map((activity, index) => (
          <div key={index} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F5F5F7] transition-colors duration-150">
            <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-[#007AFF]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[#1D1D1F]">
                <span className="font-semibold">{activity.user}</span>
                <span className="text-[#86868B]"> {activity.action} </span>
                <span className="font-medium">{activity.target}</span>
              </p>
            </div>
            <span className="text-[11px] text-[#86868B] flex-shrink-0">{activity.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickActions() {
  const actions = [
    { label: "新建项目", icon: <Briefcase className="w-4 h-4" /> },
    { label: "登记报销", icon: <DollarSign className="w-4 h-4" /> },
    { label: "发起采购", icon: <ShoppingCart className="w-4 h-4" /> },
    { label: "合同登记", icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <div className="bento-card">
      <h3 className="text-[15px] font-bold text-[#1D1D1F] mb-4">快捷操作</h3>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action, index) => (
          <button key={index} className="flex items-center gap-2 p-3 rounded-xl bg-[#F5F5F7] hover:bg-[#007AFF] hover:text-white transition-all duration-200 text-[13px] font-medium text-[#1D1D1F] cursor-pointer">
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <>
      <div className="page-header">
        <h1>总览仪表板</h1>
        <p>欢迎回来，今日有 5 项待办事项需要处理</p>
      </div>

      <div className="grid grid-cols-4 gap-5 auto-rows-[minmax(180px,auto)]">
        {kpiCards.map((card, index) => (
          <KPICard key={index} data={card} />
        ))}

        <div className="col-span-2">
          <AlertCard />
        </div>
        <div className="col-span-2">
          <TodoList />
        </div>

        <div className="col-span-2 row-span-2">
          <ProjectProgress />
        </div>
        <div className="col-span-1">
          <FinancialOverview />
        </div>
        <div className="col-span-1">
          <QuickActions />
        </div>

        <div className="col-span-4">
          <RecentActivity />
        </div>
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Briefcase,
  ShoppingCart,
  FileText,
  BarChart3,
  UserCircle,
  Settings,
  ChevronDown,
  ChevronRight,
  Gem,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
}

interface NavSection {
  title: string;
  icon: React.ReactNode;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "商务管理",
    icon: <Gem className="w-4.5 h-4.5" />,
    items: [
      { label: "客户管理", href: "/business/customers" },
      { label: "供应商管理", href: "/business/suppliers" },
      { label: "市场开发", href: "/business/project-leads" },
      { label: "投标管理", href: "/business/biddings" },
      { label: "商务报价", href: "/business/quotations" },
    ],
  },
  {
    title: "项目管理",
    icon: <Briefcase className="w-4.5 h-4.5" />,
    items: [
      { label: "项目立项", href: "/projects" },
      { label: "项目计划", href: "/projects/plans" },
      { label: "项目进度", href: "/projects/progress" },
      { label: "设计外包", href: "/projects/outsourcing" },
    ],
  },
  {
    title: "采购管理",
    icon: <ShoppingCart className="w-4.5 h-4.5" />,
    items: [
      { label: "采购需求", href: "/procurement/requests" },
      { label: "询价管理", href: "/procurement/inquiries" },
      { label: "到货验收", href: "/procurement/deliveries" },
    ],
  },
  {
    title: "合同管理",
    icon: <FileText className="w-4.5 h-4.5" />,
    items: [
      { label: "收入合同", href: "/contracts/income" },
      { label: "支出合同", href: "/contracts/expense" },
    ],
  },
  {
    title: "财务管理",
    icon: <BarChart3 className="w-4.5 h-4.5" />,
    items: [
      { label: "财务收入", href: "/finance/income" },
      { label: "财务支出", href: "/finance/expense" },
      { label: "财务报表", href: "/finance/reports" },
      { label: "银行账户", href: "/finance/bank-accounts" },
    ],
  },
  {
    title: "人事行政管理",
    icon: <UserCircle className="w-4.5 h-4.5" />,
    items: [
      { label: "员工档案", href: "/hr/employees" },
      { label: "办公用品", href: "/admin/supplies" },
      { label: "证照管理", href: "/admin/certificates" },
      { label: "印章管理", href: "/admin/seals" },
    ],
  },
  {
    title: "系统设置",
    icon: <Settings className="w-4.5 h-4.5" />,
    items: [
      { label: "角色设置", href: "/settings/roles" },
      { label: "用户设置", href: "/settings/users" },
      { label: "流程设置", href: "/settings/approval-flow" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "商务管理",
    "项目管理",
  ]);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href;
  };

  return (
    <aside className="glass-sidebar fixed left-0 top-0 h-full w-[260px] z-50 flex flex-col">
      <Link href="/" className="flex items-center gap-3 px-5 h-16 flex-shrink-0">
        <div className="w-8 h-8 rounded-xl bg-[#007AFF] flex items-center justify-center">
          <LayoutDashboard className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-bold text-[#1D1D1F] leading-tight">
            华东工程 ERP
          </span>
          <span className="text-[11px] text-[#86868B] leading-tight">
            化工医药工程
          </span>
        </div>
      </Link>

      <div className="px-3 mb-2">
        <Link
          href="/"
          className={`nav-item w-full ${isActive("/") ? "active" : ""}`}
        >
          <LayoutDashboard className="w-4.5 h-4.5" />
          <span>总览仪表板</span>
        </Link>
      </div>

      <div className="mx-5 h-px bg-[#E5E5EA] mb-2" />

      <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-6">
        {navSections.map((section) => {
          const isExpanded = expandedSections.includes(section.title);
          return (
            <div key={section.title} className="mb-1">
              <button
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between w-full px-3 py-2 text-[13px] font-semibold text-[#86868B] hover:text-[#1D1D1F] transition-colors duration-150 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  {section.icon}
                  <span>{section.title}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>

              {isExpanded && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-item w-full ${isActive(item.href) ? "active" : ""}`}
                    >
                      <span className="ml-6">{item.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#E5E5EA] flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#007AFF] flex items-center justify-center text-white text-sm font-semibold">
          {user?.realName?.charAt(0) || "用"}
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold text-[#1D1D1F]">
            {user?.realName || "未登录"}
          </span>
          <span className="text-[11px] text-[#86868B]">
            {user?.department || user?.username || ""}
          </span>
        </div>
      </div>
    </aside>
  );
}

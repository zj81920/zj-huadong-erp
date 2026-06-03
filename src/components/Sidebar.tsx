"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SECTION_TO_MODULE, SUB_MODULE_TO_HREF, SubModuleKey } from "@/lib/module-permissions";
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
  group?: string;
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
      { label: "投标统计", href: "/business/biddings" },
      { label: "报价统计", href: "/business/quotations" },
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
    title: "项目采购",
    icon: <ShoppingCart className="w-4.5 h-4.5" />,
    items: [
      { label: "采购需求", href: "/procurement/requests" },
      { label: "采购单", href: "/procurement/inquiries" },
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
      { label: "发票管理", href: "/finance/invoices" },
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
      { label: "用户设置", href: "/settings/users", group: "用户与权限" },
      { label: "角色设置", href: "/settings/roles", group: "用户与权限" },
      { label: "部门设置", href: "/settings/departments", group: "用户与权限" },
      { label: "流程设置", href: "/settings/approval-flow", group: "审批配置" },
      { label: "审批调试", href: "/settings/approval-debug", group: "审批配置" },
      { label: "个人设置", href: "/settings/profile", group: "基础数据" },
      { label: "往来信息管理", href: "/settings/counterparty", group: "基础数据" },
      { label: "AI 模型配置", href: "/settings/ai-model", group: "系统" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { modulePermissions } = useAuth();
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
    <aside className="fixed left-0 top-14 h-[calc(100vh-56px)] w-[240px] z-40 flex flex-col bg-bg-secondary border-r border-border-primary">
      <div className="px-3 py-3 space-y-0.5">
        <Link
          href="/"
          className={`nav-item w-full ${isActive("/") ? "active" : ""}`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>总览仪表板</span>
        </Link>
        <Link
          href="/approvals"
          className={`nav-item w-full ${isActive("/approvals") ? "active" : ""}`}
        >
          <FileText className="w-4 h-4" />
          <span>待审批</span>
        </Link>
      </div>

      <div className="mx-3 h-px bg-border-primary mb-2" />

      <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-6">
        {navSections.map((section) => {
          const moduleKey = SECTION_TO_MODULE[section.title];
          if (moduleKey && !modulePermissions.accessibleModules.includes(moduleKey) && !modulePermissions.isGlobalVisible) {
            return null;
          }
          const isExpanded = expandedSections.includes(section.title);
          return (
            <div key={section.title} className="mb-1">
              <button
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between w-full px-3 py-2 text-[13px] font-semibold text-text-primary hover:text-accent transition-colors duration-150 rounded"
              >
                <div className="flex items-center gap-2">
                  {section.icon}
                  <span>{section.title}</span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-text-tertiary" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
                )}
              </button>

              {isExpanded && (
                <div className="ml-3 mt-0.5 space-y-0.5">
                  {section.items.filter((item) => {
                    const subModuleEntry = Object.entries(SUB_MODULE_TO_HREF).find(([, href]) => item.href === href);
                    if (subModuleEntry) {
                      const subKey = subModuleEntry[0] as SubModuleKey;
                      if (!modulePermissions.isGlobalVisible && !modulePermissions.accessibleSubModules?.includes(subKey)) {
                        return false;
                      }
                    }
                    return true;
                  }).reduce<(React.ReactNode)[]>((acc, item, idx, arr) => {
                    const prevGroup = idx > 0 ? arr[idx - 1].group : undefined;
                    if (item.group && item.group !== prevGroup) {
                      acc.push(
                        <span
                          key={`group-${item.group}`}
                          className="px-3 pt-3 pb-1 text-[11px] font-semibold text-[#A8A29E] uppercase tracking-wider"
                        >
                          {item.group}
                        </span>
                      );
                    }
                    acc.push(
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-item w-full text-[13px] ${isActive(item.href) ? "active" : ""}`}
                      >
                        <span className="ml-4">{item.label}</span>
                      </Link>
                    );
                    return acc;
                  }, [])}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

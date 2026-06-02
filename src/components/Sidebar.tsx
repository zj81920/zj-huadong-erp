"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
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
  ChevronUp,
  Gem,
  KeyRound,
  LogOut,
  X,
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
      { label: "部门设置", href: "/settings/departments" },
      { label: "角色设置", href: "/settings/roles" },
      { label: "用户设置", href: "/settings/users" },
      { label: "流程设置", href: "/settings/approval-flow" },
      { label: "审批调试", href: "/settings/approval-debug" },
      { label: "AI 模型配置", href: "/settings/ai-model" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, modulePermissions, logout } = useAuth();
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "商务管理",
    "项目管理",
  ]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserMenu]);

  const handleChangePassword = async () => {
    setPasswordError("");
    if (!passwordForm.currentPassword) {
      setPasswordError("请输入当前密码");
      return;
    }
    if (!passwordForm.newPassword) {
      setPasswordError("请输入新密码");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("两次输入的密码不一致");
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "修改失败");
        return;
      }
      setShowChangePassword(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      alert("密码修改成功");
    } catch {
      setPasswordError("网络错误，请重试");
    } finally {
      setPasswordLoading(false);
    }
  };

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
    <aside className="fixed left-0 top-0 h-full w-[240px] z-50 flex flex-col bg-bg-secondary border-r border-border-primary">
      <Link href="/" className="flex items-center gap-3 px-5 h-16 flex-shrink-0">
        <div className="flex flex-col">
          <span className="text-[15px] font-bold text-text-primary leading-tight">
            华东工程 ERP
          </span>
          <span className="text-[11px] text-text-secondary leading-tight">
            化工医药工程
          </span>
        </div>
      </Link>

      <div className="px-3 mb-2 space-y-0.5">
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
                className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-semibold text-text-tertiary hover:text-text-primary transition-colors duration-150 rounded uppercase tracking-wider"
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
                  }).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-item w-full ${isActive(item.href) ? "active" : ""}`}
                    >
                      <span className="ml-4">{item.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border-primary relative" ref={menuRef}>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-3 w-full text-left"
        >
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-semibold">
            {user?.realName?.charAt(0) || "用"}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[13px] font-semibold text-text-primary truncate">
              {user?.realName || "未登录"}
            </span>
            <span className="text-[11px] text-text-secondary truncate">
              {user?.department || user?.username || ""}
            </span>
          </div>
          <ChevronUp className={`w-3.5 h-3.5 text-text-secondary transition-transform duration-200 ${showUserMenu ? "" : "rotate-180"}`} />
        </button>

        {showUserMenu && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded border border-border-primary overflow-hidden z-50 shadow-sm">
            <div className="px-3 py-2 border-b border-border-light">
              <div className="text-[13px] font-semibold text-text-primary">{user?.realName}</div>
              <div className="text-[11px] text-text-secondary">{user?.department || ""}</div>
            </div>
            <button
              onClick={() => {
                setShowUserMenu(false);
                setShowChangePassword(true);
              }}
              className="flex items-center gap-3 w-full px-3 py-2 text-[13px] text-text-primary hover:bg-bg-secondary transition-colors"
            >
              <KeyRound className="w-4 h-4 text-text-secondary" />
              修改密码
            </button>
            <button
              onClick={() => {
                setShowUserMenu(false);
                logout();
              }}
              className="flex items-center gap-3 w-full px-3 py-2 text-[13px] text-danger hover:bg-danger-bg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        )}
      </div>

      {showChangePassword && (
        <div
          className="ios-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowChangePassword(false);
              setPasswordError("");
              setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
            }
          }}
        >
          <div className="ios-modal" style={{ maxWidth: "440px" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary">
              <h2 className="text-[15px] font-semibold text-text-primary">修改密码</h2>
              <button
                onClick={() => {
                  setShowChangePassword(false);
                  setPasswordError("");
                  setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                }}
                className="w-7 h-7 rounded bg-bg-secondary hover:bg-bg-tertiary flex items-center justify-center transition-colors duration-150"
              >
                <X className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">当前密码</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="ios-input"
                  placeholder="请输入当前密码"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">新密码</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="ios-input"
                  placeholder="请输入新密码"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">确认新密码</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="ios-input"
                  placeholder="请再次输入新密码"
                  onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
                />
              </div>
              {passwordError && (
                <div className="bg-danger-bg text-danger text-sm rounded px-3 py-2.5 flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger mr-2.5 shrink-0" />
                  {passwordError}
                </div>
              )}
              <button
                onClick={handleChangePassword}
                disabled={passwordLoading}
                className="ios-btn ios-btn-primary w-full !py-2.5 font-medium"
              >
                {passwordLoading ? "提交中..." : "确认修改"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

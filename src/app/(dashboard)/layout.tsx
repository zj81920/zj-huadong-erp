"use client";

import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, UserCircle } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#86868B]">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Sidebar />
      <main className="ml-[260px] min-h-screen p-8">
        <div className="flex justify-end items-center gap-4 mb-4 -mt-2">
          <div className="flex items-center gap-2 text-sm text-[#86868B]">
            <UserCircle className="w-4 h-4" />
            <span>{user?.realName || user?.username || "未登录"}</span>
            {user?.department && (
              <span className="text-xs bg-gray-100 rounded-md px-2 py-0.5">
                {user.department}
              </span>
            )}
            {user?.roles && user.roles.length > 0 && (
              <span className="text-xs bg-blue-50 text-[#007AFF] rounded-md px-2 py-0.5">
                {user.roles.map((r) => r.name).join("、")}
              </span>
            )}
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1 text-xs text-[#86868B] hover:text-[#FF3B30] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            退出
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}

"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import AISearchBar from "@/components/AISearchBar";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();

  // admin 或有 aiFileSearch 权限的用户才能看到 AI 文件检索
  const isAdmin = user?.roles?.some((r) => r.code === "admin");
  const canFileSearch = isAdmin || user?.aiFileSearch;

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-secondary">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header />
      <div className="flex pt-14">
        <Sidebar />
        <main className="ml-[240px] flex-1 min-w-0 min-h-[calc(100vh-56px)] p-6">
          <div className="mb-6 -mt-2">
            {canFileSearch && <AISearchBar />}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import Sidebar from "@/components/Sidebar";
import AISearchBar from "@/components/AISearchBar";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading } = useAuth();

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
      <Sidebar />
      <main className="ml-[240px] min-h-screen p-6">
        <div className="mb-6 -mt-2">
          <AISearchBar />
        </div>
        {children}
      </main>
    </div>
  );
}

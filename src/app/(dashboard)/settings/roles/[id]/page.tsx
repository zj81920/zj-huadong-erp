"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import RoleBasicInfoForm from "@/components/RoleBasicInfoForm";
import RolePermissionMatrix from "@/components/RolePermissionMatrix";
import RoleApprovalRefs from "@/components/RoleApprovalRefs";

type TabKey = "basic" | "permissions" | "refs";

const TABS: { key: TabKey; label: string }[] = [
  { key: "basic", label: "基本信息" },
  { key: "permissions", label: "权限配置" },
  { key: "refs", label: "审批引用" },
];

interface CrudPermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

interface RoleData {
  id: string;
  code: string;
  name: string;
  description: string | null;
  departmentId: string | null;
  departmentName: string | null;
  modulePermissions: Record<string, CrudPermissions>;
  subModuleOverrides: Record<string, Partial<CrudPermissions>>;
  isGlobalVisible: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userCount: number;
}

export default function RoleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [role, setRole] = useState<RoleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/roles/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((json) => {
        setRole(json.data || json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">角色不存在或已被删除</p>
        <button
          onClick={() => router.push("/settings/roles")}
          className="text-sm text-[#78716C] hover:text-[#1C1917] underline"
        >
          返回角色列表
        </button>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case "basic":
        return <RoleBasicInfoForm role={role} onSaved={(updated) => setRole(updated as RoleData)} />;
      case "permissions":
        return <RolePermissionMatrix role={role} onSaved={(updated) => setRole(updated as RoleData)} />;
      case "refs":
        return <RoleApprovalRefs roleCode={role.code} roleName={role.name} />;
    }
  };

  return (
    <div>
      {/* 顶部导航 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/settings/roles")}
          className="p-2 hover:bg-[#F5F5F4] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[#1C1917]">{role.name}</h1>
          <p className="text-sm text-[#78716C]">
            角色详情 · {role.code}
            {role.departmentName && ` · ${role.departmentName}`}
          </p>
        </div>
      </div>

      {/* Tab 容器 */}
      <div className="bg-white rounded-xl border border-[#E7E5E4] overflow-hidden">
        {/* Tab 栏 */}
        <div className="flex border-b border-[#E7E5E4] bg-[#FAFAF9]">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white border-b-2 border-[#1C1917] text-[#1C1917]"
                  : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
        <div className="p-6">{renderTab()}</div>
      </div>
    </div>
  );
}

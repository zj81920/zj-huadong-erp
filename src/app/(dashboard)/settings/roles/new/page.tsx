"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, Shield } from "lucide-react";

interface Department {
  id: string;
  name: string;
}

export default function NewRolePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [isGlobalVisible, setIsGlobalVisible] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((json) => setDepartments(json.data || []))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("角色名称不能为空");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description || null,
          departmentId: departmentId || null,
          isGlobalVisible,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        router.push(`/settings/roles/${json.data.id}`);
      } else {
        setError(json.error || "创建失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSaving(false);
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1C1917]/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#1C1917]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1C1917]">新增角色</h1>
            <p className="text-sm text-[#78716C]">创建一个新的系统角色</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E7E5E4] p-6 max-w-xl">
        <div className="space-y-5">
          {/* 角色名称 */}
          <div>
            <label className="block text-sm font-medium text-[#1C1917] mb-1.5">
              角色名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#E7E5E4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C1917]/10"
              placeholder="请输入角色名称"
            />
          </div>

          {/* 所属部门 */}
          <div>
            <label className="block text-sm font-medium text-[#1C1917] mb-1.5">所属部门</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full rounded-lg border border-[#E7E5E4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C1917]/10 bg-white"
            >
              <option value="">无部门</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-sm font-medium text-[#1C1917] mb-1.5">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[#E7E5E4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C1917]/10 resize-none"
              placeholder="可选的角色描述"
            />
          </div>

          {/* 全局可见 */}
          <div className="flex items-center justify-between rounded-lg border border-[#E7E5E4] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#1C1917]">全局可见</p>
              <p className="text-xs text-[#78716C] mt-0.5">开启后该角色拥有所有模块的全部权限</p>
            </div>
            <button
              type="button"
              onClick={() => setIsGlobalVisible(!isGlobalVisible)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                isGlobalVisible ? "bg-[#1C1917]" : "bg-[#D1D5DB]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  isGlobalVisible ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-600 text-[13px] font-medium">
            {error}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1C1917] px-4 py-2 text-sm font-medium text-white hover:bg-[#292524] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            创建角色
          </button>
          <button
            onClick={() => router.push("/settings/roles")}
            className="rounded-lg border border-[#E7E5E4] px-4 py-2 text-sm text-[#78716C] hover:bg-[#F5F5F4] transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";

interface RoleBasicInfoFormProps {
  role: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    departmentId: string | null;
    isGlobalVisible: boolean;
  };
  onSaved: (updated: unknown) => void;
}

interface Department {
  id: string;
  name: string;
}

export default function RoleBasicInfoForm({ role, onSaved }: RoleBasicInfoFormProps) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description || "");
  const [departmentId, setDepartmentId] = useState(role.departmentId || "");
  const [isGlobalVisible, setIsGlobalVisible] = useState(role.isGlobalVisible);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((json) => setDepartments(json.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSave = async () => {
    if (!name.trim()) {
      setToast({ type: "error", text: "角色名称不能为空" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: "PUT",
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
        setToast({ type: "success", text: "保存成功" });
        onSaved(json.data);
      } else {
        setToast({ type: "error", text: json.error || "保存失败" });
      }
    } catch {
      setToast({ type: "error", text: "网络错误，请重试" });
    } finally {
      setSaving(false);
    }
  };

  const isSystemRole = role.code === "admin" || role.code === "finance";

  return (
    <div className="max-w-xl">
      <div className="space-y-5">
        {/* 角色名称 */}
        <div>
          <label className="block text-sm font-medium text-[#1C1917] mb-1.5">角色名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSystemRole}
            className="w-full rounded-lg border border-[#E7E5E4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C1917]/10 disabled:bg-[#FAFAF9] disabled:text-[#78716C]"
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

      {/* 保存按钮 */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || isSystemRole}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1C1917] px-4 py-2 text-sm font-medium text-white hover:bg-[#292524] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          保存
        </button>
        {isSystemRole && (
          <span className="text-xs text-[#78716C]">系统内定角色，基本信息不可修改</span>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-[14px] font-semibold backdrop-blur-xl bg-[#78716C]/90 text-white`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

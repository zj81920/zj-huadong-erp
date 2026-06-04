"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, RotateCcw } from "lucide-react";
import {
  MODULE_KEYS,
  MODULE_MAP,
  MODULE_SUB_ITEMS,
  SUB_MODULE_MAP,
  type ModuleKey,
  type SubModuleKey,
} from "@/lib/module-permissions";

interface CrudPermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

interface RolePermissionMatrixProps {
  role: {
    id: string;
    code: string;
    name: string;
    isGlobalVisible: boolean;
    modulePermissions: Record<string, CrudPermissions>;
    subModuleOverrides: Record<string, Partial<CrudPermissions>>;
  };
  onSaved: (updated: unknown) => void;
}

const CRUD_ACTIONS: { key: keyof CrudPermissions; label: string }[] = [
  { key: "read", label: "查看" },
  { key: "create", label: "新增" },
  { key: "update", label: "编辑" },
  { key: "delete", label: "删除" },
];

const EMPTY_CRUD: CrudPermissions = { create: false, read: false, update: false, delete: false };

export default function RolePermissionMatrix({ role, onSaved }: RolePermissionMatrixProps) {
  const [modulePerms, setModulePerms] = useState<Record<string, CrudPermissions>>({});
  const [overrides, setOverrides] = useState<Record<string, Partial<CrudPermissions>>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 从 role 属性初始化状态
  useEffect(() => {
    const mp = role.modulePermissions || {};
    // 确保每个已配置的模块都有完整的 CRUD 结构
    const normalized: Record<string, CrudPermissions> = {};
    for (const [key, val] of Object.entries(mp)) {
      const v = val as unknown as CrudPermissions;
      normalized[key] = {
        create: v.create ?? false,
        read: v.read ?? false,
        update: v.update ?? false,
        delete: v.delete ?? false,
      };
    }
    setModulePerms(normalized);
    const rawOverrides = role.subModuleOverrides;
    setOverrides(
      rawOverrides && typeof rawOverrides === "object" && !Array.isArray(rawOverrides)
        ? rawOverrides
        : {}
    );
  }, [role.modulePermissions, role.subModuleOverrides]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 获取子模块的有效权限（考虑覆写）
  const getEffectivePerm = (
    subKey: SubModuleKey,
    action: keyof CrudPermissions
  ): { value: boolean; overridden: boolean } => {
    const subOverride = overrides[subKey];
    if (subOverride && subOverride[action] !== undefined) {
      return { value: subOverride[action]!, overridden: true };
    }
    // 继承父模块权限
    const parent = SUB_MODULE_MAP[subKey]?.parent as ModuleKey | undefined;
    // 对于嵌套子模块（如 finance.income.contract），尝试逐级向上查找
    if (parent && modulePerms[parent]) {
      return { value: modulePerms[parent][action], overridden: false };
    }
    return { value: false, overridden: false };
  };

  // 切换模块级权限，清除该模块下所有子模块覆写
  const handleModuleToggle = (moduleKey: ModuleKey, action: keyof CrudPermissions) => {
    setModulePerms((prev) => {
      const current = prev[moduleKey] || { ...EMPTY_CRUD };
      const newVal = !current[action];
      const updated = { ...prev, [moduleKey]: { ...current, [action]: newVal } };

      // 如果关闭模块级权限，清除该模块下所有子模块的覆写
      if (!newVal) {
        setOverrides((prevOverrides) => {
          const newOverrides = { ...prevOverrides };
          const subItems = MODULE_SUB_ITEMS[moduleKey] || [];
          for (const sub of subItems) {
            delete newOverrides[sub.key];
          }
          return newOverrides;
        });
      }

      return updated;
    });
  };

  // 切换子模块覆写
  const handleSubModuleToggle = (subKey: SubModuleKey, action: keyof CrudPermissions) => {
    setOverrides((prev) => {
      const current = prev[subKey] || {};
      const newVal = !getEffectivePerm(subKey, action).value;
      const updated = { ...prev, [subKey]: { ...current, [action]: newVal } };
      // 如果覆写值与继承值相同，移除覆写
      const parent = SUB_MODULE_MAP[subKey]?.parent as ModuleKey | undefined;
      const inheritedVal = parent && modulePerms[parent] ? modulePerms[parent][action] : false;
      if (newVal === inheritedVal) {
        const cleaned = { ...updated[subKey] };
        delete cleaned[action];
        if (Object.keys(cleaned).length === 0) {
          const { [subKey]: _, ...rest } = updated;
          return rest;
        }
        return { ...updated, [subKey]: cleaned };
      }
      return updated;
    });
  };

  // 重置子模块覆写
  const handleResetOverride = (subKey: SubModuleKey) => {
    setOverrides((prev) => {
      const { [subKey]: _, ...rest } = prev;
      return rest;
    });
  };

  // 保存
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modulePermissions: modulePerms,
          subModuleOverrides: overrides,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setToast({ type: "success", text: "权限配置保存成功" });
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

  if (role.isGlobalVisible) {
    return (
      <div className="text-center py-8">
        <p className="text-[#78716C]">该角色已启用「全局可见」，拥有所有模块的全部权限</p>
        <p className="text-xs text-[#78716C] mt-1">可在「基本信息」中关闭全局可见后再配置细粒度权限</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[#78716C]">
          配置各模块的查看、新增、编辑、删除权限。修改模块级权限会影响所有子模块，子模块可单独覆写。
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1C1917] px-4 py-2 text-sm font-medium text-white hover:bg-[#292524] transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存权限
        </button>
      </div>

      <div className="border border-[#E7E5E4] rounded-xl overflow-hidden">
        {/* 表头 */}
        <div className="grid grid-cols-[1fr_repeat(4,64px)_80px] bg-[#FAFAF9] border-b border-[#E7E5E4]">
          <div className="px-4 py-2.5 text-xs font-semibold text-[#78716C]">模块 / 子模块</div>
          {CRUD_ACTIONS.map((a) => (
            <div key={a.key} className="py-2.5 text-xs font-semibold text-[#78716C] text-center">
              {a.label}
            </div>
          ))}
          <div className="py-2.5 text-xs font-semibold text-[#78716C] text-center">状态</div>
        </div>

        {MODULE_KEYS.map((moduleKey) => {
          const subItems = MODULE_SUB_ITEMS[moduleKey] || [];
          const modulePerm = modulePerms[moduleKey];

          return (
            <div key={moduleKey}>
              {/* 模块级行 */}
              <div className="grid grid-cols-[1fr_repeat(4,64px)_80px] bg-[#FAFAF9] border-b border-[#F5F5F4] hover:bg-[#F5F5F4]/80">
                <div className="px-4 py-3 text-sm font-semibold text-[#1C1917]">
                  {MODULE_MAP[moduleKey]}
                </div>
                {CRUD_ACTIONS.map((action) => (
                  <div key={action.key} className="py-3 flex items-center justify-center">
                    <button
                      onClick={() => handleModuleToggle(moduleKey, action.key)}
                      className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
                        modulePerm?.[action.key]
                          ? "bg-[#1C1917] border-[#1C1917]"
                          : "bg-white border-[#D1D5DB] hover:border-[#78716C]"
                      }`}
                    >
                      {modulePerm?.[action.key] && (
                        <svg className="w-3 h-3 mx-auto text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
                <div className="py-3 text-center">
                  <span className="text-[10px] bg-[#E7E5E4] rounded px-1.5 py-0.5 text-[#78716C] font-medium">
                    模块级
                  </span>
                </div>
              </div>

              {/* 子模块行 */}
              {subItems.map((sub) => {
                const hasOverride = sub.key in overrides;
                const effectiveValues: Record<string, { value: boolean; overridden: boolean }> = {};
                for (const a of CRUD_ACTIONS) {
                  effectiveValues[a.key] = getEffectivePerm(sub.key, a.key);
                }

                return (
                  <div
                    key={sub.key}
                    className={`grid grid-cols-[1fr_repeat(4,64px)_80px] border-b border-[#F5F5F4] ${
                      hasOverride ? "bg-white" : "bg-[#FAFAF9]/50"
                    }`}
                  >
                    <div className={`px-4 py-2.5 pl-10 text-sm ${hasOverride ? "text-[#1C1917]" : "text-[#78716C]"}`}>
                      {sub.label}
                    </div>
                    {CRUD_ACTIONS.map((action) => {
                      const eff = effectiveValues[action.key];
                      return (
                        <div key={action.key} className="py-2.5 flex items-center justify-center">
                          {hasOverride ? (
                            // 覆写状态：可编辑
                            <button
                              onClick={() => handleSubModuleToggle(sub.key, action.key)}
                              className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
                                eff.value
                                  ? "bg-[#1C1917] border-[#1C1917]"
                                  : "bg-white border-[#D1D5DB] hover:border-[#78716C]"
                              }`}
                            >
                              {eff.value && (
                                <svg className="w-3 h-3 mx-auto text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          ) : (
                            // 继承状态：显示继承值，点击转为覆写
                            <button
                              onClick={() => handleSubModuleToggle(sub.key, action.key)}
                              className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
                                eff.value
                                  ? "bg-[#78716C] border-[#78716C]"
                                  : "bg-white border-[#E7E5E4] hover:border-[#D1D5DB]"
                              }`}
                            >
                              {eff.value && (
                                <svg className="w-3 h-3 mx-auto text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <div className="py-2.5 flex items-center justify-center gap-1">
                      {hasOverride ? (
                        <>
                          <span className="text-[10px] bg-white border border-[#E7E5E4] rounded px-1.5 py-0.5 text-[#1C1917] font-medium">
                            已覆写
                          </span>
                          <button
                            onClick={() => handleResetOverride(sub.key)}
                            title="重置为继承"
                            className="p-0.5 hover:bg-[#F5F5F4] rounded transition-colors"
                          >
                            <RotateCcw className="w-3 h-3 text-[#78716C]" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-[#78716C]">继承</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-[14px] font-semibold backdrop-blur-xl bg-[#78716C]/90 text-white">
          {toast.text}
        </div>
      )}
    </div>
  );
}

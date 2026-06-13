"use client";

import { useState, useEffect } from "react";
import { Settings2, Loader2, Check } from "lucide-react";

export default function SystemSettingsPage() {
  const [dsSyncDisabled, setDsSyncDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/system-settings")
      .then((res) => res.json())
      .then((data) => {
        setDsSyncDisabled(data.data?.ds_sync_disabled === "true");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    const newValue = !dsSyncDisabled;
    setSaving(true);
    try {
      const res = await fetch("/api/system-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { ds_sync_disabled: newValue ? "true" : "false" },
        }),
      });
      if (res.ok) {
        setDsSyncDisabled(newValue);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="page-header mb-6">
        <div className="flex items-center gap-3">
          <Settings2 className="w-7 h-7 text-[#1C1917]" />
          <div>
            <h1>系统集成设置</h1>
            <p>管理 ERP 与外部系统的数据同步行为</p>
          </div>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="flex items-center justify-between p-5">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1C1917]">DS 设计审查系统同步</h3>
            <p className="text-[13px] text-[#78716C] mt-1">
              {dsSyncDisabled
                ? "已禁用：项目立项和用户管理将不会同步到 DS 系统"
                : "已启用：项目立项和用户管理数据将自动同步到 DS 系统"}
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={saving}
            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
              dsSyncDisabled ? "bg-gray-300" : "bg-green-500"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${
                dsSyncDisabled ? "translate-x-0" : "translate-x-5"
              }`}
            />
          </button>
        </div>
        {saved && (
          <div className="px-5 pb-4">
            <span className="inline-flex items-center gap-1 text-[13px] text-green-600">
              <Check className="w-4 h-4" /> 保存成功
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

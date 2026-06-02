"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Loader2,
  Check,
  Eye,
  EyeOff,
  Save,
  AlertCircle,
} from "lucide-react";

interface AiSettings {
  ai_model_id: string;
  ai_api_key: string;
  ai_base_url: string;
}

const emptySettings: AiSettings = {
  ai_model_id: "",
  ai_api_key: "",
  ai_base_url: "",
};

export default function AiModelSettingsPage() {
  const [settings, setSettings] = useState<AiSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [authorized, setAuthorized] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system-settings");
      if (res.status === 403) {
        setAuthorized(false);
        return;
      }
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setSettings({
          ai_model_id: data.ai_model_id || "",
          ai_api_key: data.ai_api_key || "",
          ai_base_url: data.ai_base_url || "",
        });
      }
    } catch {
      setError("加载配置失败，请刷新重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings.ai_model_id.trim()) {
      setError("模型ID不能为空");
      return;
    }
    if (!settings.ai_base_url.trim()) {
      setError("API Base URL不能为空");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/system-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            ai_model_id: settings.ai_model_id.trim(),
            ai_api_key: settings.ai_api_key.trim(),
            ai_base_url: settings.ai_base_url.trim(),
          },
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setSuccess(true);
        fetchSettings();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(json.error || "保存失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof AiSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
    if (success) setSuccess(false);
  };

  const maskApiKey = (key: string) => {
    if (!key) return "";
    if (key.length <= 4) return "****";
    return "****" + key.slice(-4);
  };

  const isConfigured = !!(settings.ai_model_id && settings.ai_api_key && settings.ai_base_url);

  if (!authorized) {
    return (
      <>
        <div className="page-header">
          <div className="flex items-center gap-3">
            <Bot className="w-7 h-7 text-[#1C1917]" />
            <div>
              <h1>AI模型配置</h1>
              <p>配置AI对话模型参数</p>
            </div>
          </div>
        </div>
        <div className="bento-card-static">
          <div className="empty-state">
            <div className="w-16 h-16 rounded-full bg-[#78716C]/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-[#78716C]" />
            </div>
            <p>无权访问此页面，仅管理员可配置AI模型</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="w-7 h-7 text-[#1C1917]" />
            <div>
              <h1>AI模型配置</h1>
              <p>配置AI对话模型的连接参数</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`ios-badge ${isConfigured ? "ios-badge-green" : "ios-badge-gray"}`}
            >
              {isConfigured ? "已配置" : "未配置"}
            </span>
          </div>
        </div>
      </div>

      <div className="bento-card-static">
        {loading ? (
          <div className="empty-state">
            <div className="w-10 h-10 border-2 border-[#1C1917] border-t-transparent rounded-full animate-spin" />
            <p>加载中...</p>
          </div>
        ) : (
          <div className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-xl bg-[#78716C]/8 text-[#78716C] text-[13px] font-medium flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                配置保存成功
              </div>
            )}

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                模型ID <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="例如：qwen-long、qwen-plus、qwen-max"
                value={settings.ai_model_id}
                onChange={(e) => updateField("ai_model_id", e.target.value)}
              />
              <p className="mt-1 text-[12px] text-[#78716C]">
                填写阿里云百炼平台的模型名称
              </p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  className="ios-input pr-12"
                  placeholder="请输入API Key"
                  value={showApiKey ? settings.ai_api_key : maskApiKey(settings.ai_api_key)}
                  onChange={(e) => {
                    if (showApiKey) {
                      updateField("ai_api_key", e.target.value);
                    } else {
                      setShowApiKey(true);
                      updateField("ai_api_key", "");
                    }
                  }}
                  onFocus={() => {
                    if (!showApiKey) {
                      setShowApiKey(true);
                    }
                  }}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1C1917] transition-colors"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-[12px] text-[#78716C]">
                阿里云百炼平台API Key，输入后仅显示后4位
              </p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
                API Base URL <span className="text-[#78716C]">*</span>
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder="例如：https://dashscope.aliyuncs.com/compatible-mode/v1"
                value={settings.ai_base_url}
                onChange={(e) => updateField("ai_base_url", e.target.value)}
              />
              <p className="mt-1 text-[12px] text-[#78716C]">
                模型服务的接口地址
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#F5F5F4]">
              <button
                className="ios-btn ios-btn-primary gap-1.5"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                保存配置
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

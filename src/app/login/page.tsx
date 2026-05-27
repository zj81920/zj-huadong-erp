"use client";

import React, { useState } from "react";
import { Lock, User } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "登录失败");
        return;
      }

      window.location.href = "/";
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-[22px] mb-5 shadow-lg shadow-blue-500/20">
            <span className="text-3xl font-bold text-white">华东</span>
          </div>
          <h1 className="text-[28px] font-semibold text-[#1D1D1F] tracking-tight">
            华东工程 ERP 系统
          </h1>
          <p className="text-sm text-[#86868B] mt-2">
            安徽华东化工医药工程有限责任公司
          </p>
        </div>

        <div className="bg-white rounded-[20px] p-8 shadow-sm border border-gray-100/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-2">
                登录账号
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#86868B]" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="ios-input pl-11"
                  placeholder="请输入用户名"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-2">
                登录密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#86868B]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ios-input pl-11"
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-[#FF3B30] text-sm rounded-xl px-4 py-3 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] mr-2.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="ios-btn w-full justify-center !bg-[#007AFF] !text-white !py-3.5 !rounded-xl font-medium hover:!bg-[#0066DD] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? "登录中..." : "登 录"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#86868B] mt-8">
          华东工程 ERP v2.0 &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

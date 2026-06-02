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
    <div className="min-h-screen bg-bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-10">
          <h1 className="text-[24px] font-semibold text-text-primary">
            华东工程 ERP 系统
          </h1>
          <p className="text-sm text-text-secondary mt-2">
            安徽华东化工医药工程有限责任公司
          </p>
        </div>

        <div className="bg-white rounded-md p-8 border border-border-primary">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                登录账号
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-secondary" />
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
              <label className="block text-sm font-medium text-text-primary mb-2">
                登录密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-secondary" />
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
              <div className="bg-danger-bg text-danger text-sm rounded px-4 py-3 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-danger mr-2.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="ios-btn ios-btn-primary w-full justify-center !py-3"
            >
              {loading ? "登录中..." : "登 录"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-text-secondary mt-8">
          华东工程 ERP v2.0 &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

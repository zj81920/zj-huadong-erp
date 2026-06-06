"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, LogOut, User, KeyRound, PenLine } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  description: string | null;
  type: string;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
}

function getTimeAgo(dateStr: string) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

export default function Header() {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const json = await res.json();
        setUnreadCount(json.count || 0);
      }
    } catch {}
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleNotificationClick = async (n: Notification) => {
    if (!n.isRead) {
      try {
        await fetch(`/api/notifications/${n.id}/read`, { method: "PUT" });
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {}
    }
    setShowNotifications(false);
    if (n.relatedId) {
      window.location.href = `/approvals?instanceId=${n.relatedId}`;
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "PUT" });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

  const getInitial = (name: string) => name.charAt(0) || "?";

  return (
    <header className="sticky top-0 z-50 w-full h-14 bg-[#1a1a2e] border-b border-white/10 flex items-center px-4">
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <span className="text-[15px] font-bold text-white leading-tight">华东工程 ERP</span>
      </Link>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        {/* 通知铃铛 */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) fetchNotifications();
              setShowUserMenu(false);
            }}
            className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            <Bell className="w-[18px] h-[18px] text-white" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-11 w-[380px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-[14px] font-bold text-gray-900">通知</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-[12px] text-blue-600 hover:text-blue-700 font-medium">全部已读</button>
                )}
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-gray-400">
                    <Bell className="w-8 h-8 mb-2" />
                    <span className="text-[13px]">暂无通知</span>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!n.isRead ? "bg-blue-50/50" : ""}`}
                    >
                      <div className="flex gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.isRead ? "bg-gray-300" : "bg-blue-500"}`} />
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-gray-900 truncate">{n.title}</div>
                          {n.description && <div className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">{n.description}</div>}
                          <div className="text-[11px] text-gray-400 mt-1">{getTimeAgo(n.createdAt)}</div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        {/* 用户头像 + 姓名 */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-blue-400 flex items-center justify-center text-[12px] font-bold text-white shrink-0 overflow-hidden">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="头像" className="w-full h-full object-cover" />
              ) : (
                getInitial(user?.realName || "")
              )}
            </div>
            <span className="text-[13px] font-medium text-white hidden sm:inline">{user?.realName || "未登录"}</span>
          </button>
          {showUserMenu && (
            <div className="absolute right-0 top-11 w-[200px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-[13px] font-semibold text-gray-900">{user?.realName}</div>
                <div className="text-[11px] text-gray-500">{user?.department || user?.username}</div>
              </div>
              <div className="py-1">
                <Link href="/settings/profile" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors">
                  <User className="w-4 h-4 text-gray-400" />个人设置
                </Link>
                <Link href="/settings/profile?tab=change-password" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors">
                  <KeyRound className="w-4 h-4 text-gray-400" />修改密码
                </Link>
                <Link href="/settings/profile?tab=signature" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors">
                  <PenLine className="w-4 h-4 text-gray-400" />手写签名
                </Link>
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => { setShowUserMenu(false); logout(); }} className="flex items-center gap-3 w-full px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors">
                  <LogOut className="w-4 h-4" />退出登录
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

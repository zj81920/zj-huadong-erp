# 用户个人设置、待办增强与通知系统 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现用户个人设置页面、待办页面三标签增强、顶部Header重构及通知系统
**Architecture:** 基于现有 Next.js App Router + Prisma + 审批引擎扩展，新增 Notification 模型和 API，重构 Layout 布局
**Tech Stack:** Next.js 14+, Prisma, TypeScript, Tailwind CSS

---

### 实现验证清单

在开始实施前，列出所有需要验证的事项，便于完成后逐项核对：

- [ ] Prisma schema 变更后运行 `npx prisma validate` + `npx prisma db push`
- [ ] 所有 TypeScript 文件无类型错误（通过 `npx next build` 验证）
- [ ] Layout 重构后页面正常渲染，侧边栏底部用户区域已移除
- [ ] Header 组件显示正常，通知铃铛和用户下拉菜单交互可用
- [ ] 个人设置页面可正常访问，所有 Tab 切换正常
- [ ] 修改密码功能正常（旧密码验证 → 新密码更新）
- [ ] 头像上传功能正常
- [ ] 签名上传功能正常
- [ ] 待办页面三标签切换正常，数据来源正确
- [ ] 通知生成（审批操作后）正常
- [ ] 通知铃铛未读数正确显示
- [ ] 通知已读标记功能正常
- [ ] 管理员用户编辑中头像管理字段正常显示和保存

---

### Task 1: Prisma Schema 变更

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: User 模型新增 avatarUrl 字段**

在 `prisma/schema.prisma` 的 User 模型中，在 `signatureUrl` 后面添加：

```prisma
  signatureUrl String?  @map("signature_url")
  avatarUrl    String?  @map("avatar_url")  // 新增：用户头像
```

- [ ] **Step 2: 新增 Notification 模型**

在 User 模型后面（`@@map("users")` 之前，或在文件末尾其他模型之前），添加：

```prisma
model Notification {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  title       String
  description String?
  type        String   // "approval_pending" | "approval_completed" | "approval_rejected"
  relatedId   String?  @map("related_id")  // 关联的审批实例 ID
  isRead      Boolean  @default(false) @map("is_read")
  createdAt   DateTime @default(now()) @map("created_at")

  user        User     @relation(fields: [userId], references: [id])

  @@map("notifications")
}
```

并在 User 模型的 `userRoles` 关联后面添加：

```prisma
  notifications          Notification[]
```

- [ ] **Step 3: 运行 Prisma 验证和同步**

```bash
npx prisma validate
npx prisma db push
```

---

### Task 2: 更新 CurrentUser 类型，返回 avatarUrl

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: CurrentUser 接口增加 avatarUrl**

```typescript
export interface CurrentUser {
  id: string;
  username: string;
  realName: string;
  phone: string | null;
  email: string | null;
  department: string | null;
  avatarUrl: string | null;  // 新增
  roles: { id: string; code: string; name: string; isProjectRole: boolean; accessibleModules: string; isGlobalVisible: boolean }[];
}
```

- [ ] **Step 2: getCurrentUser 返回 avatarUrl**

在 `getCurrentUser` 函数的 return 对象中添加：

```typescript
    return {
      id: user.id,
      username: user.username,
      realName: user.realName,
      phone: user.phone,
      email: user.email,
      department: user.department,
      avatarUrl: user.avatarUrl,  // 新增
      roles: user.userRoles.map((ur) => ({
        // ... 保持不变
      })),
    };
```

---

### Task 3: 更新 AuthContext 类型，增加 avatarUrl

**Files:**
- Modify: `src/contexts/AuthContext.tsx`

- [ ] **Step 1: CurrentUser 接口增加 avatarUrl**

```typescript
interface CurrentUser {
  id: string;
  username: string;
  realName: string;
  phone: string | null;
  email: string | null;
  department: string | null;
  avatarUrl: string | null;  // 新增
  roles: UserRole[];
}
```

---

### Task 4: 创建 Header 组件（含通知铃铛 + 用户菜单）

**Files:**
- Create: `src/components/Header.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: 创建 Header 组件**

创建 `src/components/Header.tsx`：

```tsx
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

export default function Header() {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // 获取未读通知数
  const fetchUnreadCount = async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const json = await res.json();
        setUnreadCount(json.count || 0);
      }
    } catch {}
  };

  // 获取通知列表
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
    // 每 60 秒轮询未读数
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // 点击外部关闭下拉
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
    // 标记已读
    if (!n.isRead) {
      try {
        await fetch(`/api/notifications/${n.id}/read`, { method: "PUT" });
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {}
    }
    setShowNotifications(false);
    // 跳转到审批详情
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

  const getInitial = (name: string) => {
    return name.charAt(0) || "?";
  };

  return (
    <header className="sticky top-0 z-50 w-full h-14 bg-[#1a1a2e] border-b border-white/10 flex items-center px-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <span className="text-[15px] font-bold text-white leading-tight">
          华东工程 ERP
        </span>
      </Link>

      {/* 中间区域留给 AISearchBar（由 layout 控制） */}
      <div className="flex-1" />

      {/* 右侧：通知 + 用户 */}
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
            <Bell className="w-4.5 h-4.5 text-white" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* 通知下拉面板 */}
          {showNotifications && (
            <div className="absolute right-0 top-11 w-[380px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-[14px] font-bold text-gray-900">通知</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[12px] text-blue-600 hover:text-blue-700 font-medium"
                  >
                    全部已读
                  </button>
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
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                        !n.isRead ? "bg-blue-50/50" : ""
                      }`}
                    >
                      <div className="flex gap-3">
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            n.isRead ? "bg-gray-300" : "bg-blue-500"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-gray-900 truncate">
                            {n.title}
                          </div>
                          {n.description && (
                            <div className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">
                              {n.description}
                            </div>
                          )}
                          <div className="text-[11px] text-gray-400 mt-1">
                            {getTimeAgo(n.createdAt)}
                          </div>
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
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-blue-400 flex items-center justify-center text-[12px] font-bold text-white shrink-0 overflow-hidden">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="头像" className="w-full h-full object-cover" />
              ) : (
                getInitial(user?.realName || "")
              )}
            </div>
            <span className="text-[13px] font-medium text-white hidden sm:inline">
              {user?.realName || "未登录"}
            </span>
          </button>

          {/* 用户下拉菜单 */}
          {showUserMenu && (
            <div className="absolute right-0 top-11 w-[200px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-[13px] font-semibold text-gray-900">{user?.realName}</div>
                <div className="text-[11px] text-gray-500">{user?.department || user?.username}</div>
              </div>
              <div className="py-1">
                <Link
                  href="/settings/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <User className="w-4 h-4 text-gray-400" />
                  个人设置
                </Link>
                <Link
                  href="/settings/profile?tab=change-password"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-gray-400" />
                  修改密码
                </Link>
                <Link
                  href="/settings/profile?tab=signature"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <PenLine className="w-4 h-4 text-gray-400" />
                  手写签名
                </Link>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
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
```

- [ ] **Step 2: 修改 Dashboard Layout，引入 Header**

修改 `src/app/(dashboard)/layout.tsx`：

```tsx
"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";  // 新增
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
      {/* 顶部 Header */}
      <Header />
      <div className="flex pt-14">
        <Sidebar />
        <main className="ml-[240px] flex-1 min-h-[calc(100vh-56px)] p-6">
          <div className="mb-6 -mt-2">
            <AISearchBar />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
```

关键改动：
- 添加 `<Header />` 在 Sidebar 上方
- 外层容器改为 `flex` 布局
- `pt-14` 给 Header 留出空间（14 = 56px）
- `min-h-[calc(100vh-56px)]` 确保内容区高度正确

---

### Task 5: 精简 Sidebar，移除底部用户区域

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: 移除底部用户菜单和修改密码弹窗**

删除 Sidebar.tsx 中的以下部分：

1. 删除 `showUserMenu`、`showChangePassword`、`passwordForm`、`passwordError`、`passwordLoading` 的 useState 声明
2. 删除 `menuRef` 的 useRef 声明
3. 删除 `handleClickOutside` 的 useEffect
4. 删除 `handleChangePassword` 函数
5. 删除 JSX 中从 `<!-- 底部用户菜单 -->` 开始的整个 `div.p-3.border-t` 部分（第274-317行）
6. 删除修改密码 Modal 部分（第320-393行）
7. 从 import 中移除 `KeyRound`, `LogOut`, `X`, `ChevronUp`（如果不再使用），以及 `useRef`

- [ ] **Step 2: 移除已删除函数对应的 import**

从 `import { ..., KeyRound, LogOut, X, ChevronUp }` 中移除未使用的图标导入。

---

### Task 6: 创建个人设置 API

**Files:**
- Create: `src/app/api/settings/profile/route.ts`

- [ ] **Step 1: 创建更新个人资料 API**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const { realName, phone, email, avatarUrl } = body;

    // 至少更新一个字段
    if (realName === undefined && phone === undefined && email === undefined && avatarUrl === undefined) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    // 更新当前用户信息
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(realName !== undefined && { realName: realName.trim() }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        username: updated.username,
        realName: updated.realName,
        phone: updated.phone,
        email: updated.email,
        department: updated.department,
        avatarUrl: updated.avatarUrl,
      },
    });
  } catch (error) {
    console.error("更新个人资料失败:", error);
    return NextResponse.json({ error: "更新个人资料失败" }, { status: 500 });
  }
}
```

---

### Task 7: 创建个人设置页面

**Files:**
- Create: `src/app/(dashboard)/settings/profile/page.tsx`
- Note: 需要先确认 `src/app/(dashboard)/settings/profile/` 目录是否存在

- [ ] **Step 1: 创建目录和页面文件**

```bash
mkdir -p "src/app/(dashboard)/settings/profile"
```

- [ ] **Step 2: 创建个人设置页面**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  User,
  KeyRound,
  PenLine,
  Save,
  Loader2,
  AlertCircle,
  Check,
  Upload,
  X,
  Camera,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type ActiveTab = "profile" | "change-password" | "signature";

export default function ProfileSettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    tabParam === "change-password" ? "change-password"
    : tabParam === "signature" ? "signature"
    : "profile"
  );

  // ====== 基本资料状态 ======
  const [realName, setRealName] = useState(user?.realName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ====== 修改密码状态 ======
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  // ====== 签名状态 ======
  const [signatureUrl, setSignatureUrl] = useState(user?.avatarUrl ? "" : ""); // 签名单独管理
  const [signaturePreview, setSignaturePreview] = useState("");
  const [signatureSaving, setSignatureSaving] = useState(false);
  const [signatureError, setSignatureError] = useState("");
  const [signatureUploading, setSignatureUploading] = useState(false);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  // 同步用户数据
  useEffect(() => {
    if (user) {
      setRealName(user.realName || "");
      setPhone(user.phone || "");
      setEmail(user.email || "");
      setAvatarUrl(user.avatarUrl || "");
      setAvatarPreview(user.avatarUrl || "");
    }
    // 获取签名
    fetch("/api/auth/current-user")
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.signatureUrl) {
          setSignaturePreview(json.data.signatureUrl);
        }
      })
      .catch(() => {});
  }, [user]);

  // Tab 切换时更新 URL 参数
  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setProfileSuccess(false);
    setPasswordSuccess(false);
    const params = new URLSearchParams();
    if (tab === "change-password") params.set("tab", "change-password");
    else if (tab === "signature") params.set("tab", "signature");
    const qs = params.toString();
    router.replace(`/settings/profile${qs ? `?${qs}` : ""}`);
  };

  // ====== 保存基本资料 ======
  const handleSaveProfile = async () => {
    setProfileError("");
    setProfileSuccess(false);
    if (!realName.trim()) {
      setProfileError("真实姓名不能为空");
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realName: realName.trim(), phone: phone.trim() || null, email: email.trim() || null, avatarUrl: avatarUrl || null }),
      });
      const json = await res.json();
      if (res.ok) {
        setProfileSuccess(true);
        await refresh();
      } else {
        setProfileError(json.error || "保存失败");
      }
    } catch {
      setProfileError("网络错误，请重试");
    } finally {
      setProfileSaving(false);
    }
  };

  // ====== 上传头像 ======
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/image\/(png|jpe?g)/)) {
      setProfileError("仅支持 png、jpg、jpeg 格式");
      return;
    }
    setProfileError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        setAvatarUrl(json.url);
        setAvatarPreview(json.url);
      } else {
        setProfileError(json.error || "上传失败");
      }
    } catch {
      setProfileError("上传失败");
    }
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  // ====== 修改密码 ======
  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess(false);
    if (!currentPassword) { setPasswordError("请输入当前密码"); return; }
    if (!newPassword) { setPasswordError("请输入新密码"); return; }
    if (newPassword !== confirmPassword) { setPasswordError("两次输入的密码不一致"); return; }
    if (newPassword.length < 6) { setPasswordError("新密码长度不能少于6位"); return; }
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (res.ok) {
        setPasswordSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordError(json.error || "修改失败");
      }
    } catch {
      setPasswordError("网络错误");
    } finally {
      setPasswordSaving(false);
    }
  };

  // ====== 上传签名 ======
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/image\/(png|jpe?g)/)) {
      setSignatureError("仅支持 png、jpg、jpeg 格式");
      return;
    }
    setSignatureError("");
    setSignatureUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        // 保存签名到用户资料
        const saveRes = await fetch("/api/settings/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signatureUrl: json.url }),
        });
        if (saveRes.ok) {
          setSignaturePreview(json.url);
        } else {
          setSignatureError("保存签名失败");
        }
      } else {
        setSignatureError(json.error || "上传失败");
      }
    } catch {
      setSignatureError("上传失败");
    } finally {
      setSignatureUploading(false);
      if (signatureInputRef.current) signatureInputRef.current.value = "";
    }
  };

  const handleRemoveSignature = async () => {
    try {
      await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureUrl: null }),
      });
      setSignaturePreview("");
    } catch {}
  };

  const tabs = [
    { key: "profile" as const, label: "基本资料", icon: User },
    { key: "change-password" as const, label: "修改密码", icon: KeyRound },
    { key: "signature" as const, label: "手写签名", icon: PenLine },
  ];

  return (
    <>
      <div className="page-header">
        <h1>个人设置</h1>
        <p>管理您的账户信息、密码和签名</p>
      </div>

      <div className="flex gap-6">
        {/* 左侧 Tab 导航 */}
        <div className="w-48 shrink-0">
          <div className="bento-card-static p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => switchTab(tab.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                    activeTab === tab.key
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 max-w-2xl">
          {/* ====== 基本资料 ====== */}
          {activeTab === "profile" && (
            <div className="bento-card-static">
              <h3 className="text-[15px] font-bold text-gray-900 mb-6">基本资料</h3>

              {/* 头像 */}
              <div className="flex items-center gap-6 mb-8 pb-6 border-b border-gray-100">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="头像" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm hover:bg-blue-600 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    className="hidden"
                    accept=".png,.jpg,.jpeg"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div>
                  <div className="text-[14px] font-medium text-gray-900">个人头像</div>
                  <div className="text-[12px] text-gray-500 mt-1">支持 JPG/PNG 格式，建议 200x200px</div>
                </div>
              </div>

              {/* 表单字段 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">登录账号</label>
                  <input
                    type="text"
                    className="ios-input bg-gray-50 text-gray-500 cursor-not-allowed"
                    value={user?.username || ""}
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                    真实姓名 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    className="ios-input"
                    value={realName}
                    onChange={(e) => setRealName(e.target.value)}
                    placeholder="请输入真实姓名"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">手机号</label>
                  <input
                    type="text"
                    className="ios-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="请输入手机号"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">邮箱</label>
                  <input
                    type="email"
                    className="ios-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="请输入邮箱"
                  />
                </div>
              </div>

              {profileError && (
                <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 rounded-xl px-4 py-2.5 mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="flex items-center gap-2 text-[13px] text-green-600 bg-green-50 rounded-xl px-4 py-2.5 mb-4">
                  <Check className="w-4 h-4 shrink-0" />
                  保存成功
                </div>
              )}
              <button
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="ios-btn ios-btn-primary gap-1.5"
              >
                {profileSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                保存修改
              </button>
            </div>
          )}

          {/* ====== 修改密码 ====== */}
          {activeTab === "change-password" && (
            <div className="bento-card-static">
              <h3 className="text-[15px] font-bold text-gray-900 mb-6">修改密码</h3>

              <div className="space-y-4 max-w-sm">
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">当前密码</label>
                  <div className="relative">
                    <input
                      type={showCurrentPwd ? "text" : "password"}
                      className="ios-input pr-10"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="请输入当前密码"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">新密码</label>
                  <div className="relative">
                    <input
                      type={showNewPwd ? "text" : "password"}
                      className="ios-input pr-10"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="请输入新密码（至少6位）"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd(!showNewPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">确认新密码</label>
                  <input
                    type="password"
                    className="ios-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入新密码"
                    onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
                  />
                </div>
              </div>

              {passwordError && (
                <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 rounded-xl px-4 py-2.5 mt-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="flex items-center gap-2 text-[13px] text-green-600 bg-green-50 rounded-xl px-4 py-2.5 mt-4">
                  <Check className="w-4 h-4 shrink-0" />
                  密码修改成功
                </div>
              )}
              <button
                onClick={handleChangePassword}
                disabled={passwordSaving}
                className="ios-btn ios-btn-primary gap-1.5 mt-4"
              >
                {passwordSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                确认修改
              </button>
            </div>
          )}

          {/* ====== 手写签名 ====== */}
          {activeTab === "signature" && (
            <div className="bento-card-static">
              <h3 className="text-[15px] font-bold text-gray-900 mb-6">手写签名</h3>
              <p className="text-[13px] text-gray-500 mb-6">上传您的电子签名，用于审批流程中的签字确认。建议使用透明背景的 PNG 图片。</p>

              <input
                ref={signatureInputRef}
                type="file"
                className="hidden"
                accept=".png,.jpg,.jpeg"
                onChange={handleSignatureUpload}
              />

              {signaturePreview ? (
                <div className="space-y-4">
                  <div className="p-6 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                    <img
                      src={signaturePreview}
                      alt="电子签名预览"
                      className="max-h-[100px] max-w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="ios-btn ios-btn-secondary ios-btn-sm"
                      onClick={() => signatureInputRef.current?.click()}
                      disabled={signatureUploading}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      重新上传
                    </button>
                    <button
                      type="button"
                      className="ios-btn ios-btn-ghost ios-btn-sm text-red-500!"
                      onClick={handleRemoveSignature}
                    >
                      <X className="w-3.5 h-3.5" />
                      移除签名
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full py-10 rounded-xl border-2 border-dashed border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all duration-150 flex flex-col items-center gap-2 cursor-pointer"
                  onClick={() => signatureInputRef.current?.click()}
                  disabled={signatureUploading}
                >
                  {signatureUploading ? (
                    <>
                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                      <span className="text-[13px] text-gray-500">上传中...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-gray-400" />
                      <span className="text-[13px] text-gray-500">点击上传电子签名</span>
                      <span className="text-[11px] text-gray-400">支持 PNG、JPG，建议透明背景</span>
                    </>
                  )}
                </button>
              )}

              {signatureError && (
                <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 rounded-xl px-4 py-2.5 mt-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {signatureError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

注意：签名保存时的 API 调用 `/api/settings/profile` 需要支持 `signatureUrl` 字段，因此需要在 Task 6 的 API 中也处理 `signatureUrl` 字段。修改 Task 6 的 API 中的 body 解构：

```typescript
const { realName, phone, email, avatarUrl, signatureUrl } = body;
// 并在 data 对象中添加：
...(signatureUrl !== undefined && { signatureUrl: signatureUrl || null }),
```

---

### Task 8: 个人设置页面添加到侧边栏导航

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: 在系统设置中增加"个人设置"入口**

在 Sidebar.tsx 的 `系统设置` section 的 `items` 数组最前面添加：

```typescript
{ label: "个人设置", href: "/settings/profile" },
```

---

### Task 9: 管理员用户编辑增加头像管理

**Files:**
- Modify: `src/app/(dashboard)/settings/users/page.tsx`
- Modify: `src/app/api/settings/users/[id]/route.ts`（查看是否需要更新）

- [ ] **Step 1: 读取管理员用户编辑 API**

读取 `src/app/api/settings/users/[id]/route.ts`，确认 PUT 方法是否已经处理了 avatarUrl 字段（查看到现有代码）。

- [ ] **Step 2: 在管理员编辑 Modal 中增加头像字段**

在 `src/app/(dashboard)/settings/users/page.tsx` 的用户编辑表单中，在"电子签名"之前添加头像上传区域，逻辑与签名上传类似：

- 在 `UserFormData` 接口中添加 `avatarUrl: string`
- 在 `emptyForm` 中添加 `avatarUrl: ""`
- 在 `handleOpenEdit` 中读取 `item.avatarUrl`（注意 UserItem 接口也需要加 avatarUrl 字段）
- 添加头像上传的 DOM 元素（类似电子签名的上传样式，但用于头像）
- 在 `handleSubmit` 的 payload 中添加 `avatarUrl`

- [ ] **Step 3: 在用户列表表格中显示头像**

在列表的"登录账号"列的头像位置，如果有 `avatarUrl` 则显示图片，否则显示首字母。

---

### Task 10: 创建通知 API

**Files:**
- Create: `src/app/api/notifications/route.ts`
- Create: `src/app/api/notifications/unread-count/route.ts`
- Create: `src/app/api/notifications/read-all/route.ts`
- Create: `src/app/api/notifications/[id]/read/route.ts`

- [ ] **Step 1: 创建通知列表 API**

`src/app/api/notifications/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 100),
        skip: offset,
      }),
      prisma.notification.count({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({ data: notifications, total });
  } catch (error) {
    console.error("获取通知列表失败:", error);
    return NextResponse.json({ error: "获取通知列表失败" }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建未读数 API**

`src/app/api/notifications/unread-count/route.ts`：

```typescript
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const count = await prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("获取未读数失败:", error);
    return NextResponse.json({ count: 0 });
  }
}
```

- [ ] **Step 3: 创建全部已读 API**

`src/app/api/notifications/read-all/route.ts`：

```typescript
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("标记全部已读失败:", error);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
```

- [ ] **Step 4: 创建单条已读 API**

`src/app/api/notifications/[id]/read/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: params.id },
    });

    if (!notification || notification.userId !== user.id) {
      return NextResponse.json({ error: "通知不存在" }, { status: 404 });
    }

    await prisma.notification.update({
      where: { id: params.id },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("标记已读失败:", error);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
```

---

### Task 11: 审批引擎集成通知

**Files:**
- Modify: `src/lib/approval-engine.ts`

- [ ] **Step 1: 在 processApprovalAction 中创建通知**

在 `processApprovalAction` 函数的适当位置添加通知生成逻辑。需要在审批引擎文件中顶部导入 prisma（如已导入则跳过）。

在以下位置添加通知生成：

**A. 审批通过且流转到下一节点时（在推进到下一节点代码之前）**：
```typescript
// 创建通知给下一节点审批人
if (nextApproverIds && nextApproverIds.length > 0) {
  await prisma.notification.createMany({
    data: nextApproverIds.map((approverId) => ({
      userId: approverId,
      title: `${getBusinessTypeLabel(instance.businessType)} 待审批`,
      description: `"${instance.businessType}" 流程已到达，请及时处理`,
      type: "approval_pending",
      relatedId: instanceId,
    })),
  });
}
```

**B. 审批驳回时**：
```typescript
// 获取申请人
const initiateAction = await prisma.approvalAction.findFirst({
  where: { instanceId, action: "initiate" },
  select: { approverId: true },
});
if (initiateAction) {
  await prisma.notification.create({
    data: {
      userId: initiateAction.approverId,
      title: `${getBusinessTypeLabel(instance.businessType)} 审批被驳回`,
      description: comment ? `原因：${comment}` : "您的审批申请已被驳回",
      type: "approval_rejected",
      relatedId: instanceId,
    },
  });
}
```

**C. 归档/完成时**：
```typescript
// 获取申请人
const initiateAction = await prisma.approvalAction.findFirst({
  where: { instanceId, action: "initiate" },
  select: { approverId: true },
});
if (initiateAction) {
  await prisma.notification.create({
    data: {
      userId: initiateAction.approverId,
      title: `${getBusinessTypeLabel(instance.businessType)} 审批已完成`,
      description: "您的审批申请已全部通过并归档",
      type: "approval_completed",
      relatedId: instanceId,
    },
  });
}
```

注意：需要定义 `getBusinessTypeLabel` 辅助函数，或在 `processApprovalAction` 中使用一个 label 映射。建议在文件顶部或函数内定义一个简单的映射：

```typescript
const BUSINESS_TYPE_LABELS: Record<string, string> = {
  quotation: "商务报价",
  supplier: "供应商审批",
  outsourcing: "外包任务",
  purchase_request: "采购需求",
  delivery_receipt: "到货验收",
  income_contract: "收入合同",
  expense_contract: "支出合同",
  non_contract_income: "非合同收入",
  non_contract_expense: "其他支付",
  payment_application: "合同支付",
  expense_report: "费用报销",
  other_borrowing: "其他借入款",
  lending_out: "借出款",
  salary_payment: "工资发放",
  borrowing_return_application: "借入资金归还",
};

function getBusinessTypeLabel(type: string): string {
  return BUSINESS_TYPE_LABELS[type] || type;
}
```

---

### Task 12: 待办页面三标签增强

**Files:**
- Modify: `src/app/api/approval-instances/route.ts`
- Modify: `src/app/(dashboard)/approvals/page.tsx`

- [ ] **Step 1: 扩展 API 支持 type=processed 和 type=initiated**

在 `src/app/api/approval-instances/route.ts` 的 GET 函数中，在 `type === "pending"` 分支之后，添加：

```typescript
    if (type === "processed") {
      const { prisma } = await import("@/lib/prisma");
      // 查询当前用户已操作过的审批实例（去重）
      const actionInstances = await prisma.approvalAction.findMany({
        where: {
          approverId: user.id,
          action: { in: ["approve", "reject", "archive", "payment"] },
        },
        select: { instanceId: true },
        distinct: ["instanceId"],
        orderBy: { actedAt: "desc" },
        take: 50,
      });
      const instanceIds = actionInstances.map((a) => a.instanceId);
      const instances = instanceIds.length > 0
        ? await prisma.approvalInstance.findMany({
            where: { id: { in: instanceIds } },
            orderBy: { createdAt: "desc" },
          })
        : [];
      return NextResponse.json({ data: instances });
    }

    if (type === "initiated") {
      const { prisma } = await import("@/lib/prisma");
      const instances = await prisma.approvalInstance.findMany({
        where: {
          actions: {
            some: {
              approverId: user.id,
              action: "initiate",
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return NextResponse.json({ data: instances });
    }
```

注意：目前已有 `type === "my-initiated"` 分支，如需保留兼容或合并，可调整逻辑。建议直接添加新的 type 值。

- [ ] **Step 2: 重构审批页面为三标签**

修改 `src/app/(dashboard)/approvals/page.tsx`：

`export default function ApprovalsPage()` 组件内：

1. 添加标签切换状态: `const [activeTab, setActiveTab] = useState<"pending" | "processed" | "initiated">("pending");`
2. 添加三个列表状态：`pendingList`, `processedList`, `initiatedList`
3. 添加各自的加载和错误状态
4. 添加三个 fetch 函数（或一个带参数的）
5. 根据 `activeTab` 切换列表显示
6. 原来的 pendingList 逻辑保持不变，直接扩展

页面顶部添加 Tab 导航栏：

```tsx
// 在 page-header 之后，bento-card-static 之前添加
<div className="flex items-center gap-1 mb-4 border-b border-gray-200">
  <button
    onClick={() => setActiveTab("pending")}
    className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
      activeTab === "pending"
        ? "border-blue-500 text-blue-600"
        : "border-transparent text-gray-500 hover:text-gray-700"
    }`}
  >
    <Clock className="w-4 h-4 inline mr-1.5 -mt-0.5" />
    待处理
    {pendingList.length > 0 && (
      <span className="ml-1.5 bg-blue-100 text-blue-600 text-[11px] px-1.5 py-0.5 rounded-full">
        {pendingList.length}
      </span>
    )}
  </button>
  <button
    onClick={() => setActiveTab("processed")}
    className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
      activeTab === "processed"
        ? "border-blue-500 text-blue-600"
        : "border-transparent text-gray-500 hover:text-gray-700"
    }`}
  >
    <CheckCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />
    已处理
  </button>
  <button
    onClick={() => setActiveTab("initiated")}
    className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
      activeTab === "initiated"
        ? "border-blue-500 text-blue-600"
        : "border-transparent text-gray-500 hover:text-gray-700"
    }`}
  >
    <Send className="w-4 h-4 inline mr-1.5 -mt-0.5" />
    已发起
  </button>
</div>
```

更新 `h1` 标题，根据 activeTab 动态显示。

更新各个列表的表格渲染，已处理和已发起列表用只读视图（不显示"处理审批"按钮，改为"查看详情"）。

已处理和已发起的 Modal 中不显示审批操作按钮（`ApprovalActionButton`），只显示流程时间线。

---

### Task 13: 构建验证

- [ ] **Step 1: 运行构建**

```bash
npx next build
```

修复所有 TypeScript 类型错误。

- [ ] **Step 2: 根据验证清单逐项检查**

对照本文档顶部的实现验证清单，逐项确认功能正常。

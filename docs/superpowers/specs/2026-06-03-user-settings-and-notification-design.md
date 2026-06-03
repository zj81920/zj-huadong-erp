# 用户个人设置、待办增强与通知系统设计

## 概述

本次优化涵盖四个主要方向：
1. 界面布局重构 — 顶部 Header 新增，整合用户菜单和通知入口
2. 用户个人设置 — 头像/密码/签名等自助管理
3. 待办页面增强 — 待处理/已处理/已发起三标签
4. 通知系统 — 流程审批通知

---

## 一、界面布局重构

### 现状
- 侧边栏包含 Logo + 导航 + 底部用户信息（用户名/部门/修改密码/退出）
- 无顶部 Header
- 无通知入口

### 变更方案

**顶部 Header（新增）**
```
┌─────────────────────────────────────────────────────────┐
│ 华东工程 ERP           [AI搜索栏]       🔔(3)  👤 张三 ▼ │
├─────────────────────────────────────────────────────────┤
│ 侧边栏(导航)   │            主内容区                     │
│                │                                        │
```

- 左上角：Logo "华东工程 ERP"
- 中间：现有 AISearchBar 保留
- 右上角：通知铃铛图标（带未读角标）→ 用户头像+姓名（带下拉菜单）

**侧边栏调整**
- 移除底部用户信息区域（用户名/部门/修改密码/退出）
- 仅保留导航菜单

**用户下拉菜单**
- 个人设置 → 跳转 `/settings/profile`
- 修改密码 → 跳转 `/settings/profile`（定位到密码 Tab）
- 手写签名 → 跳转 `/settings/profile`（定位到签名 Tab）
- ---分割线---
- 退出登录

**涉及的代码文件：**
- `src/app/(dashboard)/layout.tsx` — Dashboard 布局，新增 Header 组件
- `src/components/Sidebar.tsx` — 移除底部用户区域
- `src/components/Header.tsx` — **新建**顶部 Header 组件（含通知铃铛+用户菜单）

---

## 二、用户个人设置

### 数据库变更

**User 模型新增字段：**
```prisma
model User {
  // ... 现有字段
  avatarUrl   String?   @map("avatar_url")
}
```

**管理员用户编辑（`/settings/users`）也同步增加头像管理字段。**

### 个人设置页面

路径：`/settings/profile`（新建）

页面结构：
- 左侧 Tab 导航：基本资料 / 修改密码 / 手写签名
- 右侧对应内容

**基本资料 Tab：**
- 头像上传（支持 JPG/PNG，200x200px 建议）
- 真实姓名（可编辑）
- 手机号（可编辑）
- 邮箱（可编辑）
- 保存按钮

**修改密码 Tab：**
- 当前密码（必填）
- 新密码（必填）
- 确认新密码（必填）
- 保存按钮
- 调用的 API：`PUT /api/auth/change-password`（已有）

**手写签名 Tab：**
- 签名图片上传（同管理员设置的签名上传逻辑）
- 预览
- 移除

### API 变更

**新增 API：**
- `PUT /api/settings/profile` — 更新个人资料（realName, phone, email, avatarUrl）

**现有 API 复用：**
- `PUT /api/auth/change-password` — 修改密码（已有，无需变更）
- `POST /api/upload` — 文件上传（已有，头像和签名均复用）

### 涉及的代码文件：
- `src/app/(dashboard)/settings/profile/page.tsx` — **新建**个人设置页面
- `src/app/api/settings/profile/route.ts` — **新建**更新个人资料 API
- `prisma/schema.prisma` — 新增 avatarUrl 字段
- `src/app/(dashboard)/settings/users/page.tsx` — 管理员编辑增加头像字段

---

## 三、待办页面增强

### 现状
- `/approvals` 页面仅显示当前用户待审批列表（调用 `getPendingApprovals`）

### 变更方案

将当前审批列表页面改为三标签切换：

| 标签 | 数据来源 | 说明 |
|------|---------|------|
| ⏳ 待处理 | `getPendingApprovals()` | 当前用户待审批事项（现有逻辑） |
| ✅ 已处理 | 查询 `ApprovalAction` 表 where userId=当前用户 | 当前用户已操作过的审批记录 |
| 📝 已发起 | 查询 `ApprovalInstance` 表 where applicantId=当前用户 | 当前用户发起的审批流程 |

**已处理/已发起的列表项依旧可以使用现有详情 Modal 组件查看细节**，但操作按钮需根据状态禁用（已完成的不再显示"通过/驳回"）。

### API 变更

**新增 API：**
- `GET /api/approval-instances?type=processed` — 已处理列表
- `GET /api/approval-instances?type=initiated` — 已发起列表

或在现有 `GET /api/approval-instances` 路由中扩展 type 参数支持

### 涉及的代码文件：
- `src/app/(dashboard)/approvals/page.tsx` — 重构为三标签
- `src/app/api/approval-instances/route.ts` — 扩展 type 参数

---

## 四、通知系统

### 数据库变更

**新增 Notification 模型：**
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

### 通知生成

在审批引擎 `processApprovalAction()` 中，当审批动作执行后：

1. 如果流程流转到下一节点 → 为目标审批人创建 `approval_pending` 通知
2. 如果流程审批通过/归档 → 为发起人创建 `approval_completed` 通知
3. 如果流程被驳回 → 为发起人创建 `approval_rejected` 通知

### API 变更

**新增 API：**
- `GET /api/notifications` — 获取当前用户通知列表（支持分页）
- `GET /api/notifications/unread-count` — 获取未读通知数
- `PUT /api/notifications/read-all` — 全部标为已读
- `PUT /api/notifications/[id]/read` — 单条标为已读

### Header 中的通知交互

- 加载时调用 `GET /api/notifications/unread-count` 获取角标数字
- 点击铃铛 → 展开通知下拉列表（显示最近 10 条）
- 点击未读通知 → `PUT /api/notifications/[id]/read` 标已读 + 跳转到对应审批详情
- 点击"查看全部通知" → 跳转到通知列表页面（可选扩展）
- 支持轮询或页面切换时刷新未读数

### 涉及的代码文件：
- `prisma/schema.prisma` — 新增 Notification 模型
- `src/lib/approval-engine.ts` — 审批操作后生成通知
- `src/components/Header.tsx` — 通知铃铛+下拉面板
- `src/app/api/notifications/route.ts` — **新建**通知 API
- `src/app/api/notifications/unread-count/route.ts` — **新建**未读数 API
- `src/app/api/notifications/read-all/route.ts` — **新建**全部已读 API
- `src/app/api/notifications/[id]/read/route.ts` — **新建**单条已读 API

---

## 涉及文件总清单

### 新增文件
| 文件 | 说明 |
|------|------|
| `src/components/Header.tsx` | 顶部 Header 组件（通知铃铛+用户菜单） |
| `src/app/(dashboard)/settings/profile/page.tsx` | 个人设置页面 |
| `src/app/api/settings/profile/route.ts` | 更新个人资料 API |
| `src/app/api/notifications/route.ts` | 通知列表 API |
| `src/app/api/notifications/unread-count/route.ts` | 未读数 API |
| `src/app/api/notifications/read-all/route.ts` | 全部已读 API |
| `src/app/api/notifications/[id]/read/route.ts` | 单条已读 API |

### 修改文件
| 文件 | 说明 |
|------|------|
| `prisma/schema.prisma` | User 新增 avatarUrl、新增 Notification 模型 |
| `src/app/(dashboard)/layout.tsx` | 引入 Header 组件 |
| `src/components/Sidebar.tsx` | 移除底部用户信息区域 |
| `src/app/(dashboard)/approvals/page.tsx` | 重构为三标签 |
| `src/app/api/approval-instances/route.ts` | 扩展 type 参数 |
| `src/lib/approval-engine.ts` | 审批操作后生成通知 |
| `src/app/(dashboard)/settings/users/page.tsx` | 管理员编辑增加头像字段 |
| `src/lib/auth.ts` | 可选：`getCurrentUser` 返回 avatarUrl |

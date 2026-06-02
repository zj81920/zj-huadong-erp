# ERP UI 风格重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将华东工程 ERP 从 iOS 风格改造为 Notion 式极简风格

**Architecture:** 基于 Tailwind CSS v4 `@theme` 变量重写全局样式系统，替换所有组件类名和颜色引用，保持功能逻辑零变更

**Tech Stack:** Next.js 15 + React 19 + TypeScript + Tailwind CSS v4 + lucide-react

---

## 文件结构总览

| 文件 | 责任 | 变更类型 |
|------|------|---------|
| `src/app/globals.css` | 全局颜色变量、组件类定义 | 重写 |
| `src/components/Sidebar.tsx` | 侧边栏导航组件 | 修改样式 |
| `src/components/Modal.tsx` | 弹窗组件 | 修改样式 |
| `src/components/AISearchBar.tsx` | AI 搜索栏 | 修改样式 |
| `src/app/login/page.tsx` | 登录页 | 修改样式 |
| `src/app/(dashboard)/layout.tsx` | Dashboard 布局 | 修改样式 |
| `src/app/(dashboard)/page.tsx` | 总览仪表板 | 修改样式 |
| 各业务 `page.tsx` | 业务页面 | 批量替换颜色类名 |

---

## Task 1: 重写全局样式系统 (globals.css)

**Files:**
- Modify: `src/app/globals.css` (全文件重写)

**前置条件:** 已备份原文件（git 状态干净）

- [ ] **Step 1: 重写 @theme 颜色变量**

将原 iOS 颜色全部替换为极简灰度系：

```css
@import "tailwindcss";

@theme {
  /* 背景色 */
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F9FAFB;
  --color-bg-tertiary: #F3F4F6;

  /* 文字色 */
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-text-tertiary: #9CA3AF;

  /* 边框 */
  --color-border-primary: #E5E7EB;
  --color-border-light: #F3F4F6;

  /* 交互 */
  --color-accent: #111827;
  --color-accent-hover: #374151;
  --color-danger: #DC2626;
  --color-danger-bg: #FEF2F2;

  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}
```

- [ ] **Step 2: 重写 @layer base**

```css
@layer base {
  html {
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
  }
}
```

- [ ] **Step 3: 重写核心组件类（卡片、导航、按钮、输入框、表格、弹窗）**

完整替换原 `bento-card`、`nav-item`、`ios-btn`、`ios-input`、`ios-table`、`ios-modal` 等类。新类名前缀统一为 `erp-*`：

```css
@layer components {
  /* 卡片 */
  .erp-card {
    background: #FFFFFF;
    border: 1px solid #E5E7EB;
    border-radius: 4px;
    padding: 16px;
  }

  /* 导航项 */
  .erp-nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    color: #6B7280;
    transition: all 150ms ease-out;
    cursor: pointer;
  }

  .erp-nav-item:hover {
    background: #F3F4F6;
    color: #111827;
  }

  .erp-nav-item.active {
    background: #111827;
    color: #FFFFFF;
    font-weight: 500;
  }

  /* 按钮基础 */
  .erp-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease-out;
    border: none;
    outline: none;
  }

  .erp-btn-primary {
    background: #111827;
    color: #FFFFFF;
  }

  .erp-btn-primary:hover {
    background: #374151;
  }

  .erp-btn-primary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .erp-btn-secondary {
    background: #FFFFFF;
    color: #111827;
    border: 1px solid #E5E7EB;
  }

  .erp-btn-secondary:hover {
    background: #F9FAFB;
  }

  .erp-btn-danger {
    background: #DC2626;
    color: #FFFFFF;
  }

  .erp-btn-danger:hover {
    background: #B91C1C;
  }

  .erp-btn-ghost {
    background: transparent;
    color: #6B7280;
    padding: 4px 10px;
  }

  .erp-btn-ghost:hover {
    color: #111827;
    background: #F3F4F6;
  }

  .erp-btn-sm {
    padding: 4px 10px;
    font-size: 12px;
    border-radius: 3px;
  }

  /* 输入框 */
  .erp-input {
    width: 100%;
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid #E5E7EB;
    background: #FFFFFF;
    font-size: 13px;
    color: #111827;
    transition: all 150ms ease-out;
    outline: none;
  }

  .erp-input:focus {
    border-color: #111827;
    box-shadow: 0 0 0 2px rgba(17, 24, 39, 0.08);
  }

  .erp-input::placeholder {
    color: #9CA3AF;
  }

  /* 选择框 */
  .erp-select {
    width: 100%;
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid #E5E7EB;
    background: #FFFFFF;
    font-size: 13px;
    color: #111827;
    transition: all 150ms ease-out;
    outline: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 32px;
  }

  .erp-select:focus {
    border-color: #111827;
    box-shadow: 0 0 0 2px rgba(17, 24, 39, 0.08);
  }

  /* 文本域 */
  .erp-textarea {
    width: 100%;
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid #E5E7EB;
    background: #FFFFFF;
    font-size: 13px;
    color: #111827;
    transition: all 150ms ease-out;
    outline: none;
    resize: vertical;
    min-height: 80px;
  }

  .erp-textarea:focus {
    border-color: #111827;
    box-shadow: 0 0 0 2px rgba(17, 24, 39, 0.08);
  }

  /* 表格 */
  .erp-table {
    width: 100%;
    border-collapse: collapse;
  }

  .erp-table thead th {
    padding: 8px 12px;
    text-align: left;
    font-size: 12px;
    font-weight: 500;
    color: #6B7280;
    border-bottom: 1px solid #E5E7EB;
    white-space: nowrap;
  }

  .erp-table tbody tr {
    transition: background-color 100ms ease-out;
  }

  .erp-table tbody tr:hover {
    background-color: #F9FAFB;
  }

  .erp-table tbody td {
    padding: 10px 12px;
    font-size: 13px;
    color: #111827;
    border-bottom: 1px solid #F3F4F6;
  }

  /* 状态标签 */
  .erp-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1px 8px;
    border-radius: 3px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.5;
    background: #F3F4F6;
    color: #374151;
  }

  .erp-badge-active {
    background: #111827;
    color: #FFFFFF;
  }

  /* 弹窗遮罩 */
  .erp-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 150ms ease-out;
  }

  /* 弹窗容器 */
  .erp-modal {
    background: white;
    border-radius: 6px;
    width: 90%;
    max-width: 520px;
    max-height: 85vh;
    overflow-y: auto;
    animation: slideUp 200ms ease-out;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  /* 页面标题 */
  .erp-page-header {
    margin-bottom: 24px;
  }

  .erp-page-header h1 {
    font-size: 20px;
    font-weight: 600;
    color: #111827;
  }

  .erp-page-header p {
    font-size: 13px;
    color: #6B7280;
    margin-top: 4px;
  }

  /* 筛选栏 */
  .erp-filter-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  /* 空状态 */
  .erp-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 20px;
    text-align: center;
    color: #9CA3AF;
    font-size: 13px;
  }

  /* 侧边栏 */
  .erp-sidebar {
    background: #F9FAFB;
    border-right: 1px solid #E5E7EB;
  }

  /* 滚动条 */
  .erp-scrollbar::-webkit-scrollbar {
    width: 5px;
  }

  .erp-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .erp-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 3px;
  }

  .erp-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.25);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .erp-modal-overlay,
  .erp-modal {
    animation: none;
  }
}
```

- [ ] **Step 4: 保留旧类名作为兼容层（可选但建议）**

为确保不遗漏的页面不会完全崩坏，在文件末尾添加旧类名到新类名的映射：

```css
/* 兼容层：旧类名映射到新类名，便于逐步迁移 */
.bento-card, .bento-card-static { @apply erp-card; }
.nav-item { @apply erp-nav-item; }
.ios-btn { @apply erp-btn; }
.ios-btn-primary { @apply erp-btn erp-btn-primary; }
.ios-btn-secondary { @apply erp-btn erp-btn-secondary; }
.ios-btn-danger { @apply erp-btn erp-btn-danger; }
.ios-btn-ghost { @apply erp-btn erp-btn-ghost; }
.ios-btn-sm { @apply erp-btn-sm; }
.ios-input { @apply erp-input; }
.ios-select { @apply erp-select; }
.ios-textarea { @apply erp-textarea; }
.ios-table { @apply erp-table; }
.ios-badge { @apply erp-badge; }
.ios-modal-overlay { @apply erp-modal-overlay; }
.ios-modal { @apply erp-modal; }
.page-header { @apply erp-page-header; }
.filter-bar { @apply erp-filter-bar; }
.empty-state { @apply erp-empty; }
.glass-sidebar { @apply erp-sidebar; }
.custom-scrollbar { @apply erp-scrollbar; }
```

- [ ] **Step 5: 运行构建验证**

Run: `cd /Users/zj81920/应用开发/zj-huadong-erp && npx next build`
Expected: 无类型错误，无 CSS 语法错误

- [ ] **Step 6: Commit**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
git add src/app/globals.css
git commit -m "style: rewrite global design system to Notion minimal style"
```

---

## Task 2: 重构侧边栏组件 (Sidebar.tsx)

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: 修改侧边栏容器样式**

将 `glass-sidebar` 改为 `erp-sidebar`，调整宽度：

```tsx
// 原：w-[260px] glass-sidebar
// 新：w-[240px] erp-sidebar
<aside className="erp-sidebar fixed left-0 top-0 h-full w-[240px] z-50 flex flex-col">
```

- [ ] **Step 2: 修改 Logo 区**

去除彩色图标背景，改为纯文字或极简图标：

```tsx
<Link href="/" className="flex items-center gap-2.5 px-4 h-14 flex-shrink-0">
  <LayoutDashboard className="w-5 h-5 text-[#111827]" />
  <div className="flex flex-col">
    <span className="text-[14px] font-semibold text-[#111827] leading-tight">
      华东工程 ERP
    </span>
    <span className="text-[10px] text-[#9CA3AF] leading-tight">
      化工医药工程
    </span>
  </div>
</Link>
```

- [ ] **Step 3: 修改导航项样式**

将 `nav-item` 改为 `erp-nav-item`，调整图标颜色：

```tsx
<Link href="/" className={`erp-nav-item w-full ${isActive("/") ? "active" : ""}`}>
  <LayoutDashboard className={`w-4 h-4 ${isActive("/") ? "text-white" : "text-[#6B7280]"}`} />
  <span>总览仪表板</span>
</Link>
```

子导航同样调整：

```tsx
<Link
  key={item.href}
  href={item.href}
  className={`erp-nav-item w-full ${isActive(item.href) ? "active" : ""}`}
>
  <span className="ml-4">{item.label}</span>
</Link>
```

- [ ] **Step 4: 修改用户菜单区**

去除用户头像彩色背景：

```tsx
<div className="w-8 h-8 rounded-full bg-[#E5E7EB] flex items-center justify-center text-[#374151] text-xs font-medium">
  {user?.realName?.charAt(0) || "用"}
</div>
```

- [ ] **Step 5: 修改弹窗内样式**

将弹窗中的 `ios-modal-overlay`、`ios-modal`、`ios-input`、`ios-btn-primary` 替换为新的 `erp-*` 类名。

- [ ] **Step 6: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "style: refactor Sidebar to minimal design"
```

---

## Task 3: 重构 Dashboard 布局 (layout.tsx)

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: 调整主布局背景色和边距**

```tsx
return (
  <div className="min-h-screen bg-[#FFFFFF]">
    <Sidebar />
    <main className="ml-[240px] min-h-screen p-6">
      <div className="mb-5">
        <AISearchBar />
      </div>
      {children}
    </main>
  </div>
);
```

同时修改 loading 状态的背景色：

```tsx
<div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center">
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "style: update dashboard layout background and spacing"
```

---

## Task 4: 重构登录页 (login/page.tsx)

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: 调整整体背景**

```tsx
<div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
```

- [ ] **Step 2: 修改 Logo 区**

去除渐变背景块：

```tsx
<div className="text-center mb-10">
  <div className="inline-flex items-center justify-center w-16 h-16 border border-[#E5E7EB] rounded-lg mb-5 bg-white">
    <span className="text-2xl font-bold text-[#111827]">华东</span>
  </div>
  <h1 className="text-[24px] font-semibold text-[#111827]">
    华东工程 ERP 系统
  </h1>
  <p className="text-[13px] text-[#6B7280] mt-2">
    安徽华东化工医药工程有限责任公司
  </p>
</div>
```

- [ ] **Step 3: 修改登录卡片**

```tsx
<div className="bg-white rounded-md p-8 border border-[#E5E7EB]">
```

- [ ] **Step 4: 修改按钮样式**

```tsx
<button
  type="submit"
  disabled={loading}
  className="erp-btn erp-btn-primary w-full justify-center !py-3 font-medium"
>
  {loading ? "登录中..." : "登 录"}
</button>
```

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "style: refactor login page to minimal design"
```

---

## Task 5: 重构 Dashboard 首页 (page.tsx)

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: 替换 KPI 卡片样式**

将 `bento-card glow-soft` 替换为 `erp-card`，调整内部样式：

```tsx
<div className="erp-card cursor-pointer flex flex-col justify-between h-full">
  <div className="flex items-center justify-between mb-3">
    <span className="text-[12px] font-medium text-[#6B7280]">{card.title}</span>
    <div className="text-[#6B7280]">
      {card.icon}
    </div>
  </div>
  <div className="text-[24px] font-semibold text-[#111827] leading-none mb-2">
    {card.value}
  </div>
  <div className="mt-auto">
    <span className="text-[11px] text-[#9CA3AF]">{card.subtitle}</span>
  </div>
</div>
```

- [ ] **Step 2: 替换财务概览卡片**

去除彩色小卡片（绿/红/橙/紫背景），统一使用白底灰边：

```tsx
<div className="p-3 rounded border border-[#E5E7EB]">
  <p className="text-[11px] text-[#6B7280] mb-1">总收入</p>
  <p className="text-[16px] font-semibold text-[#111827]">{formatMoney(stats?.totalIncome || 0)}</p>
</div>
```

- [ ] **Step 3: 替换表格样式**

```tsx
<table className="erp-table">
```

同时调整表格内按钮：

```tsx
<button className="erp-btn erp-btn-ghost erp-btn-sm">
  <Eye className="w-3.5 h-3.5" />
  查看
</button>
```

- [ ] **Step 4: 调整页面标题**

```tsx
<div className="erp-page-header">
  <h1>总览仪表板</h1>
  <p>系统核心数据概览</p>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/page.tsx
git commit -m "style: refactor dashboard page to minimal design"
```

---

## Task 6: 重构 Modal 组件 (Modal.tsx)

**Files:**
- Modify: `src/components/Modal.tsx`

- [ ] **Step 1: 读取当前文件内容**

先读取文件：

```bash
cat src/components/Modal.tsx
```

- [ ] **Step 2: 替换弹窗类名**

将 `ios-modal-overlay` 替换为 `erp-modal-overlay`，`ios-modal` 替换为 `erp-modal`。调整内部按钮、标题区样式为新的极简风格。

- [ ] **Step 3: Commit**

```bash
git add src/components/Modal.tsx
git commit -m "style: refactor Modal to minimal design"
```

---

## Task 7: 重构 AISearchBar 组件 (AISearchBar.tsx)

**Files:**
- Modify: `src/components/AISearchBar.tsx`

- [ ] **Step 1: 读取并调整样式**

读取文件后，将输入
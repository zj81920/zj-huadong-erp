# ERP UI 风格重构实现计划

> **目标：** 将 iOS 风格全面替换为 Notion 式极简风格，所有变更纯视觉、不改动功能逻辑。

---

## Task 1：重写 globals.css 全局样式系统

**文件：** `src/app/globals.css`

- [ ] 重写 `@theme` 颜色变量（白底、深灰文字、深黑主按钮）
- [ ] 重写 `.bento-card` → `.card`（圆角 4px、边框线、无阴影）
- [ ] 重写 `.nav-item`（紧凑、灰色图标、黑色激活态）
- [ ] 重写 `.ios-btn-*` → `.btn-*`（黑色主按钮、直角 4px）
- [ ] 重写 `.ios-input` / `.ios-select` / `.ios-textarea` → `.input` 系列
- [ ] 重写 `.ios-table` → `.data-table`（紧凑 padding、细线分割）
- [ ] 重写 `.ios-badge-*` → `.badge`（统一灰色系）
- [ ] 重写 `.ios-modal-overlay` / `.ios-modal` → `.modal-overlay` / `.modal`
- [ ] 重写 `.page-header`（标题 20px、无负字距）
- [ ] 重写 `.filter-bar`、`.empty-state`
- [ ] 移除 `.glow-soft`、`.breathing-alert`、`.glass-sidebar` 等装饰类

**验证：** `npm run build` 不报错（CSS 语法检查通过）

---

## Task 2：重构 Sidebar 侧边栏

**文件：** `src/components/Sidebar.tsx`

- [ ] 去除 `glass-sidebar`，改用 `bg-secondary border-r` 实色
- [ ] 宽度从 `w-[260px]` 改为 `w-[240px]`
- [ ] Logo 区去除彩色圆角背景，改为纯文字
- [ ] 导航项紧凑化：`py-2 px-2.5`，子导航缩进 `ml-4`
- [ ] 图标统一灰色，active 态黑底白字
- [ ] 用户菜单区去除大圆角阴影，改为实色边框卡片

**验证：** 侧边栏渲染正常，无样式断裂

---

## Task 3：重构登录页

**文件：** `src/app/login/page.tsx`

- [ ] 背景从 `#F5F5F7` 改为 `#F9FAFB`
- [ ] 登录卡片圆角从 `20px` 改为 `6px`
- [ ] 去除渐变 Logo 背景块
- [ ] 按钮改为新的 Primary 样式（黑色）
- [ ] 输入框应用新的 `.input` 样式

**验证：** 登录页视觉正常

---

## Task 4：重构 Dashboard 首页

**文件：** `src/app/(dashboard)/page.tsx`

- [ ] KPI 卡片：数字 `36px` → `24px`，去除彩色图标背景
- [ ] 财务概览：去除彩色小卡片（绿/红/橙/紫），统一白底灰边
- [ ] 预警事项：去除彩色圆角图标区
- [ ] 项目表格：应用新的 `.data-table` 样式
- [ ] 状态 badge 改为统一灰色系

**验证：** 首页渲染正常

---

## Task 5：批量修改各业务页面硬编码颜色

**范围：** 所有 `src/app/(dashboard)/**/page.tsx`

- [ ] 将 `#F5F5F7` → `#F9FAFB`
- [ ] 将 `#007AFF` → `#111827`（交互色）
- [ ] 将 `#86868B` → `#6B7280`（次要文字）
- [ ] 将 `#1D1D1F` → `#111827`（主文字）
- [ ] 将 `#34C759` / `#FF3B30` / `#FF9500` 等状态色 → 灰色系
- [ ] 将 `rounded-[20px]` / `rounded-[24px]` → `rounded-md`（4px）
- [ ] 将 `rounded-xl` → `rounded`（4px）或 `rounded-md`
- [ ] 去除 `shadow-lg`、`shadow-sm` 等卡片阴影，改为 `border`

**验证：** 每个页面渲染正常，无遗漏的 iOS 蓝色

---

## Task 6：重构公共组件

**文件：**
- `src/components/Modal.tsx`
- `src/components/ApprovalComponents.tsx`
- `src/components/AISearchBar.tsx`
- `src/components/AdminStatusOverride.tsx`
- `src/components/BatchDeleteBar.tsx`
- `src/components/FileUpload.tsx`
- `src/components/MultiFileUpload.tsx`
- `src/components/ProjectPicker.tsx`

- [ ] 所有组件中的硬编码颜色替换为新色系
- [ ] 圆角、按钮、输入框应用新规范
- [ ] Modal 弹窗应用新的 `.modal` 样式

**验证：** 各组件在页面中渲染正常

---

## Task 7：主布局调整

**文件：** `src/app/(dashboard)/layout.tsx`

- [ ] 主背景从 `#F5F5F7` 改为 `#FFFFFF`
- [ ] 侧边栏间距适配新的 `w-[240px]`

---

## Task 8：构建验证

**命令：** `npm run build`

- [ ] 无 TypeScript 类型错误
- [ ] 无 CSS 语法错误
- [ ] 构建成功

---

## 回滚方式

如需回滚到 iOS 风格：
```bash
git revert 6fe5b9c..HEAD --no-edit
```
或：
```bash
git reset --hard 6fe5b9c
```

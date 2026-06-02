# 华东工程 ERP UI 风格重构设计文档

## 1. 项目概述

### 1.1 背景
华东工程 ERP 系统当前采用 iOS / Apple Design 风格（大圆角、毛玻璃、彩色图标、弥散阴影）。用户反馈该风格"太花里胡哨"，不适合 B 端企业级管理系统，希望改造成"大气且严肃"的视觉效果。

### 1.2 目标
将整体 UI 从 iOS 消费级风格改造为 Notion / Linear 式现代 SaaS 极简风格，提升专业感、信息密度和操作效率。

### 1.3 范围
- 全局颜色系统、字体系统、间距系统
- 侧边栏导航重构
- 卡片 / 面板 / KPI 组件
- 表格、表单、按钮、标签
- 登录页
- 不涉及功能逻辑变更，纯视觉重构

---

## 2. 设计原则

| 原则 | 说明 |
|------|------|
| **功能优先** | 视觉服务于信息传达，不喧宾夺主 |
| **极度克制** | 减少装饰元素，保留必要的视觉引导 |
| **高信息密度** | 在有限空间内展示更多有效信息 |
| **一致性** | 所有页面遵循统一的组件规范 |

---

## 3. 设计规范

### 3.1 颜色系统

```
背景色
  --bg-primary: #FFFFFF        (主背景纯白)
  --bg-secondary: #F9FAFB      (次级背景，如侧边栏)
  --bg-tertiary: #F3F4F6       (表头、hover 背景)

文字色
  --text-primary: #111827      (标题、主文字)
  --text-secondary: #6B7280    (次要文字、标签)
  --text-tertiary: #9CA3AF     (占位符、禁用状态)

边框与分割
  --border-primary: #E5E7EB    (主要边框、卡片边框)
  --border-light: #F3F4F6      (浅色分割线、表格行底线)

交互色
  --accent: #111827            (主按钮、激活状态、链接)
  --accent-hover: #374151      (hover 状态)
  --danger: #DC2626            (删除、警告)
  --danger-bg: #FEF2F2         (危险操作背景)
```

**关键变更**：
- 去除 iOS 蓝（#007AFF），主色调改为深灰黑（#111827）
- 去除所有毛玻璃效果，改用纯色
- 状态标签不再使用彩色 badge，统一灰色系（#F3F4F6 背景 + #374151 文字）

### 3.2 字体系统

```
字体栈：'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif

字号层级
  --text-xs: 11px   (辅助信息、时间戳)
  --text-sm: 12px   (表头、标签)
  --text-base: 13px (正文、表格内容)
  --text-md: 14px   (表单标签、按钮文字)
  --text-lg: 16px   (卡片标题、模块标题)
  --text-xl: 20px   (页面大标题)
  --text-2xl: 24px  (Dashboard 大数字)

字重
  --font-normal: 400
  --font-medium: 500  (正文、按钮)
  --font-semibold: 600 (标题、表头)
  --font-bold: 700    (大数字、页面标题)
```

### 3.3 圆角系统

```
  --radius-none: 0px    (表格、分割线)
  --radius-sm: 3px      (小标签、状态 badge)
  --radius-md: 4px      (输入框、按钮、卡片)
  --radius-lg: 6px      (弹窗、大面板)
  --radius-full: 9999px (头像、圆形元素)
```

**关键变更**：卡片圆角从 24px 降至 4px，彻底去除"圆滚滚"的感觉。

### 3.4 阴影系统

```
  --shadow-none: none
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04)   (极轻微，用于下拉菜单)
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08)  (弹窗、浮层)
```

**关键变更**：卡片不再使用阴影，改用 1px 实线边框（border: 1px solid #E5E7EB）区分层次。

### 3.5 间距系统

```
  --space-1: 4px
  --space-2: 8px
  --space-3: 12px
  --space-4: 16px
  --space-5: 20px
  --space-6: 24px
  --space-8: 32px
```

---

## 4. 组件规范

### 4.1 侧边栏

```
宽度：240px（从 260px 缩小）
背景：#F9FAFB
边框：右侧 1px solid #E5E7EB（去除毛玻璃）
Logo 区：高度 56px，文字 logo 改为纯文字"华东工程 ERP"，去除彩色图标背景

导航分组标题
  字号：11px
  颜色：#9CA3AF
  字重：600
  大写 + letter-spacing: 0.05em
  padding: 8px 12px

导航项
  padding: 6px 10px
  圆角：4px
  默认：color #6B7280
  hover：background #F3F4F6，color #111827
  active：background #111827，color #FFFFFF
  去除图标彩色背景，图标统一 #6B7280（active 时为白色）

子导航缩进：16px（从 24px 缩小）
```

### 4.2 卡片 / 面板

```
背景：#FFFFFF
边框：1px solid #E5E7EB
圆角：4px
padding：16px
无阴影、无 hover 缩放动画

卡片标题
  字号：15px
  字重：600
  颜色：#111827
  底部 margin：12px
```

### 4.3 KPI 统计卡片

```
布局：4 列网格（保持不变）
容器：同卡片规范
数字：24px / font-weight 600 / color #111827
标签：12px / color #6B7280
副标题：11px / color #9CA3AF
去除彩色图标背景，使用灰色图标（#6B7280）
```

### 4.4 表格

```
表头
  background：transparent
  字号：12px
  字重：500
  颜色：#6B7280
  padding：8px 12px
  边框：底部 1px solid #E5E7EB
  去除 uppercase 和 letter-spacing

数据行
  padding：10px 12px
  字号：13px
  颜色：#111827
  边框：底部 1px solid #F3F4F6
  hover：background #F9FAFB

去除斑马纹、去除行hover时的颜色变化幅度
```

### 4.5 按钮

```
基础
  padding：6px 12px
  圆角：4px
  字号：13px
  字重：500
  transition：all 150ms ease

主按钮（Primary）
  background：#111827
  color：#FFFFFF
  hover：background #374151

次按钮（Secondary）
  background：#FFFFFF
  color：#111827
  border：1px solid #E5E7EB
  hover：background #F9FAFB

危险按钮（Danger）
  background：#DC2626
  color：#FFFFFF
  hover：background #B91C1C

幽灵按钮（Ghost）
  background：transparent
  color：#6B7280
  hover：color #111827，background #F3F4F6
```

### 4.6 输入框 / 选择框 / 文本域

```
基础
  padding：8px 12px
  圆角：4px
  border：1px solid #E5E7EB
  background：#FFFFFF
  字号：13px
  color：#111827

focus
  border-color：#111827
  outline：none
  box-shadow：0 0 0 2px rgba(17,24,39,0.08)

placeholder
  color：#9CA3AF
```

### 4.7 状态标签（Badge）

```
统一使用灰色系，不再按状态分配不同颜色
  padding：1px 8px
  圆角：3px
  字号：12px
  字重：500
  background：#F3F4F6
  color：#374151

仅"进行中/活跃"状态使用深色变体：
  background：#111827
  color：#FFFFFF
```

### 4.8 弹窗 / Modal

```
遮罩：rgba(0,0,0,0.35)
容器
  background：#FFFFFF
  圆角：6px
  宽度：90%，max-width 520px
  box-shadow：0 4px 12px rgba(0,0,0,0.08)
标题区
  padding：16px 20px
  border-bottom：1px solid #E5E7EB
  字号：15px
  字重：600
内容区
  padding：20px
底部按钮区
  padding：12px 20px
  border-top：1px solid #E5E7EB
  按钮右对齐
```

### 4.9 登录页

```
背景：#F9FAFB（从 #F5F5F7 微调）
登录卡片
  background：#FFFFFF
  圆角：6px（从 20px 缩小）
  border：1px solid #E5E7EB
  去除阴影
Logo 区
  去除渐变蓝色背景块，改为纯文字或单色线条图标
主按钮
  使用新的 Primary 按钮样式（黑色）
```

---

## 5. 页面级变更清单

### 5.1 Dashboard（总览仪表板）
- [ ] KPI 卡片：圆角 4px，去除彩色图标背景，数字从 36px 降至 24px
- [ ] 财务概览卡片：去除彩色小卡片（绿/红/橙/紫），统一白底灰边
- [ ] 预警事项：去除彩色圆角图标区，改为灰色图标
- [ ] 项目概况表格：应用新表格规范

### 5.2 列表页（客户、供应商、项目等）
- [ ] 页面标题：28px 降至 20px，去除 letter-spacing: -0.02em
- [ ] 筛选栏：输入框应用新规范，按钮使用新规范
- [ ] 数据表格：应用新表格规范
- [ ] 空状态：去除大图标彩色背景

### 5.3 表单页（新建/编辑）
- [ ] 所有输入框应用新输入框规范
- [ ] 按钮组使用新按钮规范
- [ ] 卡片容器应用新卡片规范

### 5.4 侧边栏（全局）
- [ ] 去除毛玻璃效果，改为实色 #F9FAFB
- [ ] Logo 区去除彩色图标背景
- [ ] 导航项紧凑化
- [ ] 图标统一灰色

### 5.5 登录页
- [ ] 去除渐变 Logo 背景
- [ ] 登录卡片圆角缩小
- [ ] 登录按钮改为黑色

---

## 6. 技术实现要点

### 6.1 Tailwind CSS v4 适配
项目使用 Tailwind CSS v4，颜色通过 `@theme` 的 `--color-*` 变量定义。需要：

1. 重写 `globals.css` 中的 `@theme` 颜色定义
2. 重写所有 `@layer components` 中的类（`.bento-card`、`.nav-item`、`.ios-btn` 等）
3. 将 `.ios-*` 类前缀批量替换为更通用的命名

### 6.2 不需要引入的库
- 不引入 shadcn/ui：当前项目没有使用，引入反而增加复杂度
- 不引入新字体：继续沿用 Inter
- 不引入图标库：继续沿用 lucide-react

### 6.3 关键文件清单

| 文件 | 变更内容 |
|------|---------|
| `src/app/globals.css` | 重写全部颜色变量和组件类 |
| `src/components/Sidebar.tsx` | 重构样式、去除毛玻璃、紧凑化 |
| `src/app/login/page.tsx` | 登录页视觉调整 |
| `src/app/(dashboard)/layout.tsx` | 主布局背景色调整 |
| `src/app/(dashboard)/page.tsx` | Dashboard 组件样式调整 |
| 各 `*/page.tsx` | 按页面清单批量调整 |

---

## 7. 兼容性 & 风险

### 7.1 浏览器兼容性
- Tailwind CSS v4 现代特性在 Chrome 88+、Safari 14+、Firefox 78+ 正常支持
- 项目目标用户为企业内部，浏览器环境可控

### 7.2 风险与应对
| 风险 | 应对 |
|------|------|
| 批量替换导致某些页面遗漏 | 按路由清单逐页检查，配合视觉回归测试 |
| 用户不适应新风格 | 保持功能不变，仅改视觉，可随时回滚 CSS |
| 圆角缩小后触控体验下降 | 4px 在桌面端完全可接受，移动端保留最小 44px 触控区 |

---

## 8. 验收标准

- [ ] 所有页面无 24px 以上圆角（头像等固有圆形元素除外）
- [ ] 无彩色状态 badge（统一灰色系）
- [ ] 无弥散阴影卡片（统一边框线分割）
- [ ] 无毛玻璃效果
- [ ] 侧边栏宽度 ≤ 240px
- [ ] 登录页无渐变背景
- [ ] 所有按钮符合新规范
- [ ] 所有表格符合新规范
- [ ] `npm run build` 无类型错误

---

**文档版本**：v1.0  
**创建日期**：2026-06-02  
**设计者**：AI Assistant

# 审批流程与通知中心 Bug 修复设计文档

**日期**: 2026-06-06
**状态**: 设计中

---

## 概述

修复 5 个用户测试发现的缺陷：审批时间线节点显示、通知延迟、待处理界面信息展示、已审批详情缺失、所有模块附件不显示。

---

## 问题 1：审批时间线发起人显示

### 现状

`startApprovalFlow()` 将 nodeOrder=1 作为「发起节点」，记录 `"initiate"` 类型的 action，执行人为发起者自己。`ApprovalTimeline` 将此节点作为普通流程节点渲染，导致用户看到流程第一个"审批人"是自己，与预期不符。

### 方案

- **`ApprovalTimeline` 组件**：时间线顶部新增「流程发起人」行，显示 `{initiatorName}` + `{initiatedAt}`
- **`startApprovalFlow()`**：移除对 node 1 的 auto-skip 逻辑。所有节点从 nodeOrder=1 开始即为审批节点。`"initiate"` action 仅作记录，不在时间线节点列表中渲染
- **`ApprovalTimeline` 过滤**：渲染 `flowNodes` 时过滤掉 `action === "initiate"` 的条目

### 涉及文件

| 文件 | 改动 |
|------|------|
| `src/lib/approval-engine.ts` | `startApprovalFlow()` 移除 node 1 auto-skip 逻辑 |
| `src/components/ApprovalComponents.tsx` | `ApprovalTimeline` 顶部加发起人行，过滤 initiate 节点 |
| `src/app/api/approval-instances/[id]/route.ts` | 确保 API 返回 `initiatorName` 和 `initiatedAt` |

---

## 问题 2：通知中心延迟

### 现状

`Header.tsx` 中 `setInterval(fetchUnreadCount, 60000)`，轮询间隔 60 秒，延迟过大。

### 方案

- `Header.tsx`：将轮询间隔从 `60000` 改为 `10000`

### 涉及文件

| 文件 | 改动 |
|------|------|
| `src/components/Header.tsx` | `setInterval(fetchUnreadCount, 60000)` → `10000` |

---

## 问题 3：待处理界面右侧信息为空

### 现状

`ApprovalTimeline` 组件渲染流程节点时间线，但在弹窗打开时没有显眼展示发起人和当前节点摘要信息。

### 方案

- 与问题 1 联动：`ApprovalTimeline` 顶部新增发起人行后，Modal 打开时自动展示发起人
- 确保当前节点信息在时间线中有明确高亮标识（已有蓝色脉冲动画 `current` 状态）

### 涉及文件

| 文件 | 改动 |
|------|------|
| `src/components/ApprovalComponents.tsx` | 同问题 1 |

---

## 问题 4：已审批业务无法查看详情

### 现状

「已处理」标签页表格只有三列（业务类型、状态、提交时间），无「操作」列，无「查看」按钮，无法打开详情。

### 方案

- 在「已处理」标签页表格中新增「操作」列，添加「查看」按钮
- 点击「查看」复用与「待处理」相同的 Modal 逻辑：
  1. 并行拉取 `GET /api/approval-instances/${id}` + `GET ${BUSINESS_TYPE_API_MAP[businessType]}/${businessId}`
  2. 渲染 `BusinessDetailPanel` + `ApprovalTimeline`
  3. 不渲染 `ApprovalActionButton`（已处理无需操作）

### 涉及文件

| 文件 | 改动 |
|------|------|
| `src/app/(dashboard)/approvals/page.tsx` | 「已处理」标签页新增操作列 + 「查看」Modal |

---

## 问题 5：所有模块附件无法查看

### 现状

`SupplierDetailCard` 的 `fields` 数组中未包含 `attachmentUrl` 字段。更严重的是，整个 `src/components/detail-cards/` 目录下没有任何 DetailCard 渲染附件。

### 方案

#### 通用附件渲染能力

在 `DetailGrid` 中新增附件渲染逻辑：当 `value` 为 URL 字符串且匹配附件扩展名时，渲染为可点击的文件链接。或者在每个 DetailCard 的 `fields` 数组中手动添加附件字段时，将 `value` 渲染为带有下载/预览链接的 ReactNode。

**选择方案**：在各 DetailCard 的 `fields` 数组中直接构造附件链接的 ReactNode，更灵活且不影响 `DetailGrid` 的简洁性。

#### 逐个检查所有 DetailCard

需要检查所有 19 个 DetailCard，汇总哪些模块有附件字段需要补充。预计需要修改的 DetailCard 通过代码搜索确定。

### 涉及文件

| 文件 | 改动 |
|------|------|
| `src/components/detail-cards/suppliers/SupplierDetailCard.tsx` | fields 数组添加 attachmentUrl |
| 其他有附件字段的 DetailCard | 逐个补充附件展示 |

---

## 实施顺序

1. **问题 1 + 3**（审批时间线 → `ApprovalComponents.tsx` + `approval-engine.ts`）
2. **问题 2**（通知轮询 → `Header.tsx`，单行改动）
3. **问题 4**（已审批详情 → `approvals/page.tsx`）
4. **问题 5**（附件 → 各 DetailCard）
5. 运行 `bash scripts/verify.sh` 回归验证

---

## 注意事项

- `startApprovalFlow()` 移除 auto-skip 后，需确保现有流程数据不受影响（已有实例的 nodeOrder 不变）
- 附件 URL 需要处理空值情况（`value != null && value !== ''` 判断）
- 「已处理」详情 Modal 需隐藏操作按钮，只展示业务详情和审批时间线

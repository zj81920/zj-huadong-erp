# 审批流程优化设计文档

**日期**: 2026-06-06
**状态**: 待审批

---

## 概述

修复审批流程的 7 个问题，涵盖退回重提、实例关联、详情展示、防重复提交等。

---

## 问题 1：退回后发起人看不到退回任务

**根因**：驳回的审批实例不出现在任何可操作位置。

**方案**：
- "已发起"标签中，对"已驳回"状态的实例显示"重新提交"按钮
- 点击后跳转到对应业务页面（利用 `SUB_MODULE_TO_HREF` 映射 + `businessId`）
- 用户在业务页面编辑后重新提交审批

**涉及文件**：
- `src/app/(dashboard)/approvals/page.tsx` — 已发起标签表格中新增操作列

---

## 问题 2：重新发起后 timeline 不完整

**根因**：每次 `startApprovalFlow` 创建全新实例，新旧实例无关联。

**方案**：
- `ApprovalInstance` 新增 `parentInstanceId String?` 字段
- `startApprovalFlow(options)` 新增可选参数 `parentInstanceId`
- 前端重新提交时，POST body 中传 `parentInstanceId: 旧实例ID`
- 后端 `GET /api/approval-instances/:id` 返回实例详情时，递归加载 `parentInstanceId` 链的所有 actions
- `ApprovalTimeline` 组件按时间排序展示合并后的完整历史

**数据模型变更**：
```prisma
model ApprovalInstance {
  // ... 现有字段
  parentInstanceId String? @map("parent_instance_id")
}
```

**涉及文件**：
- `prisma/schema.prisma` — 新增字段
- `src/lib/approval-engine.ts` — `startApprovalFlow` 接受 `parentInstanceId`
- `src/app/api/approval-instances/route.ts` — POST 传递 `parentInstanceId`
- `src/app/api/approval-instances/[id]/route.ts` — GET 递归加载父链 actions
- `src/components/ApprovalComponents.tsx` — timeline 合并展示

---

## 问题 3：详情弹窗缺少字段

**根因**：详情弹窗只有 `BusinessDetailPanel` + `ApprovalTimeline`，没有「当前节点/提交人/优先级/节点类型/提交时间」信息栏。

**方案**：在 `ApprovalTimeline` 上方新增信息面板组件 `ApprovalInfoPanel`，展示：
- 当前节点名称
- 提交人
- 优先级（根据提交时间计算）
- 节点类型（审批/归档/支付）
- 提交时间

**涉及文件**：
- `src/components/ApprovalComponents.tsx` — 新增 `ApprovalInfoPanel` 组件
- `src/app/(dashboard)/approvals/page.tsx` — 在 Modal 中引入

---

## 问题 4：驳回后已处理显示多个实例

**根因**：同一 `businessId` 的驳回实例和重新提交实例是独立的记录。

**方案**：
- "已处理"标签页中，按 `businessType + businessId` 分组
- 每组只显示最新的实例（通过 `createdAt` 排序）
- timeline 中通过 `parentInstanceId` 链合并展示完整历史
- 后端 GET processed 接口返回时附带 `parentInstanceId`，前端做分组去重

**涉及文件**：
- `src/app/api/approval-instances/route.ts` — processed 查询返回 `parentInstanceId`
- `src/app/(dashboard)/approvals/page.tsx` — 前端分组去重逻辑

---

## 问题 5：供应商/合同变更可重复发起

**根因**：`startApprovalFlow` 无防重复检查。

**方案**：
- `startApprovalFlow` 开头检查：如果 `businessType + businessId` 已存在 `status: "审批中"` 的实例，抛出错误
- 前端在业务页面中，如果业务记录已有审批中的实例，禁用"提交审批"按钮

**涉及文件**：
- `src/lib/approval-engine.ts` — `startApprovalFlow` 加防重复检查
- `src/app/(dashboard)/business/suppliers/page.tsx` — 根据审批状态禁用按钮
- `src/app/(dashboard)/contracts/change-orders/page.tsx` — 同上

---

## 问题 6：已发起列表与待处理/已处理展示一致

**根因**：已发起标签的展示格式与待处理/已处理不同。

**方案**：
- 已发起标签采用统一表格：摘要（业务标签：标题）、状态、优先级、提交时间、操作
- 操作列根据状态显示不同按钮：
  - "审批中" → "查看详情"（打开详情弹窗）
  - "已驳回" → "重新提交"（跳转到业务页面）
  - "已批准"/"已归档" → "查看详情"
- 后端 GET initiated 接口返回 `nodeName`, `nodeType`, `businessTitle` 等字段

**涉及文件**：
- `src/app/api/approval-instances/route.ts` — initiated 查询返回更多字段
- `src/app/(dashboard)/approvals/page.tsx` — 已发起标签表格重构

---

## 问题 7：移除"我的草稿"标签

**根因**：用户在业务模块新建后直接提交审批，审批页面的草稿标签没有实际用途。

**方案**：
- 移除"我的草稿"标签页（`activeTab === "drafts"`）
- 待处理/已处理/已发起 三个标签保留

**涉及文件**：
- `src/app/(dashboard)/approvals/page.tsx` — 移除 drafts 标签及相关代码

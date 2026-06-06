# 审批流程优化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复审批流程的 7 个问题（退回重提、实例关联、详情展示、防重复提交、展示一致性）。

**Architecture:** Schema 新增 `parentInstanceId` 关联新旧审批实例；`startApprovalFlow` 加防重复检查；前端详情弹窗补字段；已发起/已处理标签统一展示；移除草稿标签。

**Tech Stack:** Next.js, Prisma, TypeScript, Vitest

---

## Task 1 (TDD): 审批引擎防重复 + parentInstanceId 测试

**Files:**
- Create: `test/unit/approval-engine-duplicate.test.ts`
- Reference: `src/lib/approval-engine.ts`

- [x] **Step 1: 写测试（红灯）**

- [x] **Step 2: 跑测试确认红灯**

```bash
npx vitest run test/unit/approval-engine-duplicate.test.ts
```

Result: 6/6 tests passed

---

## Task 2: Schema 新增 parentInstanceId + 防重复检查实现

**Files:**
- Modify: `prisma/schema.prisma` — ApprovalInstance 新增 parentInstanceId
- Modify: `src/lib/approval-engine.ts` — startApprovalFlow 加防重复 + parentInstanceId

- [x] **Step 1: Schema 新增字段**

在 `prisma/schema.prisma` 的 `ApprovalInstance` model 中，`businessTitle` 之后添加：

```prisma
  parentInstanceId String? @map("parent_instance_id")
```

- [x] **Step 2: prisma validate + db push**

```bash
npx prisma validate && npx prisma db push
```

Result: Schema valid, db push successful

- [x] **Step 3: 修改 startApprovalFlow 接口**

- [x] **Step 4: 在 startApprovalFlow 函数开头加防重复检查**

- [x] **Step 5: 在 prisma.approvalInstance.create 的 data 中加 parentInstanceId**

- [x] **Step 6: 跑 TDD 测试确认绿灯**

---

## Task 3: 后端 API 传 parentInstanceId + 递归加载父链

**Files:**
- Modify: `src/app/api/approval-instances/route.ts` — POST 传递 parentInstanceId
- Modify: `src/app/api/approval-instances/[id]/route.ts` — GET 递归加载父链

- [x] **Step 1: POST handler 传 parentInstanceId**

- [x] **Step 2: GET 详情递归加载父链 actions**

---

## Task 4: 前端详情弹窗补字段（问题 3）

**Files:**
- Modify: `src/components/ApprovalComponents.tsx` — 新增 ApprovalInfoPanel
- Modify: `src/app/(dashboard)/approvals/page.tsx` — 引入 ApprovalInfoPanel

- [x] **Step 1: 在 ApprovalComponents.tsx 中新增 ApprovalInfoPanel 组件**

- [x] **Step 2: 在 approvals/page.tsx 的 Modal 中引入**

---

## Task 5: 已发起标签统一展示（问题 1 + 6）

**Files:**
- Modify: `src/app/api/approval-instances/route.ts` — initiated 查询返回更多字段
- Modify: `src/app/(dashboard)/approvals/page.tsx` — 已发起标签重构

- [x] **Step 1: 后端 initiated 查询返回 businessTitle（已由 Prisma 自动返回）**

- [x] **Step 2: 前端已发起标签表格重构 — 统一摘要/状态/优先级/时间/操作列**

- [x] **Step 3: 重新提交按钮 — 跳转到业务页面**

---

## Task 6: 已处理标签分组去重（问题 4）

**Files:**
- Modify: `src/app/(dashboard)/approvals/page.tsx`

- [x] **Step 1: 前端 processed 列表分组去重 — groupedProcessedList**

---

## Task 7: 防重复提交前端禁用（问题 5）

**Files:**
- Modify: `src/app/api/supplier-changes/route.ts`
- Modify: `src/app/api/change-orders/route.ts`

- [x] **Step 1: 供应商变更 — 后端 API 防重复检查（检查已有审批中的变更）**

- [x] **Step 2: 合同变更 — 后端 API 防重复检查（检查已有审批中的变更）**

---

## Task 8: 移除"我的草稿"标签（问题 7）

**Files:**
- Modify: `src/app/(dashboard)/approvals/page.tsx`

- [x] **Step 1: 移除 drafts 相关代码（类型、标签按钮、渲染块、标题）**

---

## Task 9: 构建验证 + 测试

- [x] **Step 1: 跑 TDD 测试**

```bash
npx vitest run test/unit/approval-engine-duplicate.test.ts
```

Result: 6/6 passed

- [x] **Step 2: 跑全量单元测试**

```bash
npx vitest run test/unit/
```

Result: 15 files, 111 tests, all passed

- [x] **Step 3: 构建验证**

```bash
npx next build
```

Result: Compiled successfully

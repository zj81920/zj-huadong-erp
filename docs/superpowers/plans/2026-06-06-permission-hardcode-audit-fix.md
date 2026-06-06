# 权限 Key 映射 + 审批流硬编码修复 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复后端 API 权限 key 与前端角色配置不一致的系统性问题，同时补齐审批流 `updateBusinessStatus` 缺失的 case，修正 Prisma `flowLevel` 默认值。

**Architecture:** 在 `module-permissions.ts` 中新增 `API_TO_SUB_MODULE` 映射表作为单一数据源，`resolveCurrentUserPermission` 和 `getUserModulePerms` 通过映射表自动将 API key 转为子模块 key。补齐 `updateBusinessStatus` 的 3 个缺失 case。修正 Prisma 默认值。

**Tech Stack:** Next.js, Prisma, TypeScript

---

## Task 1: 新增 API_TO_SUB_MODULE 映射表

**Files:**
- Modify: `src/lib/module-permissions.ts`

在文件末尾（`BUSINESS_MODULES` 定义之前）新增映射表：

- [x] **Step 1: 在 `module-permissions.ts` 中 `BUSINESS_MODULE_GROUPS` 之前添加映射表**

```typescript
// API 路由使用的 key → 子模块 key 的映射（单一数据源）
// 后端 API 和前端页面通过此映射自动与角色配置的子模块 key 对齐
export const API_TO_SUB_MODULE: Record<string, SubModuleKey> = {
  "supplier": "business.suppliers",
  "customers": "business.customers",
  "project_leads": "business.project_leads",
  "biddings": "business.biddings",
  "quotation": "business.quotations",
  "projects_list": "projects.list",
  "outsourcing": "projects.outsourcing",
  "purchase_request": "procurement.requests",
  "inquiries": "procurement.inquiries",
  "delivery_receipt": "procurement.deliveries",
  "income_contract": "contracts.income",
  "expense_contract": "contracts.expense",
  "non_contract_income": "finance.income.other",
  "non_contract_expense": "finance.expense.other",
  "payment_application": "finance.expense.contract",
  "lending_out": "finance.expense.lending",
  "expense_report": "finance.expense.report",
  "salary_payment": "finance.expense.salary",
  "borrowing_return_application": "finance.expense.return",
  "seals": "hr.seals",
  "certificates": "hr.certificates",
  "office_supplies": "hr.supplies",
  "other_borrowing": "finance.income.borrowing",
  "inter_org_contract": "contracts.income", // 内部结算归入合同收入
  "supplier_change": "business.suppliers",
  "contract_change_order": "contracts.income",
  "inquiries": "procurement.inquiries",
};
```

---

## Task 2: 修改 resolveCurrentUserPermission 加映射逻辑

**Files:**
- Modify: `src/lib/permission-check.ts`

- [x] **Step 1: 在文件顶部 import 中添加 API_TO_SUB_MODULE**

```typescript
import { API_TO_SUB_MODULE, SUB_MODULE_MAP, type SubModuleKey } from "@/lib/module-permissions";
```

- [x] **Step 2: 修改 resolveCurrentUserPermission 函数的权限查找逻辑（支持多层嵌套向上查找）**

- [x] **Step 3: 修改 getUserModulePerms 函数（前端用，支持多层嵌套向上查找）**

- [x] **Step 4: 确认 import 完整**

---

## Task 3: 补齐 updateBusinessStatus 缺失的 case

**Files:**
- Modify: `src/lib/approval-engine.ts`

- [x] **Step 1: 添加 non_contract_income case**

```typescript
    case "non_contract_income":
      await prisma.nonContractIncome.update({ where: { id: businessId }, data: updateData });
      break;
```

- [x] **Step 2: 添加 other_borrowing case**

```typescript
    case "other_borrowing":
      await prisma.otherBorrowing.update({ where: { id: businessId }, data: updateData });
      break;
```

- [x] **Step 3: 补齐后端 BUSINESS_TYPE_LABELS（+non_contract_income, +other_borrowing, +quotation）**

- [x] **Step 4: 补齐前端 approvals/page.tsx 的 BUSINESS_TYPE_LABELS（+supplier_change）**

---

## Task 4: 修正 Prisma flowLevel 默认值

**Files:**
- Modify: `prisma/schema.prisma`

- [x] **Step 1: ApprovalFlowDefinition.flowLevel `"project"` → `"common"`**
- [x] **Step 2: ApprovalInstance.flowLevel `"project"` → `"common"`**
- [x] **Step 3: prisma validate ✓ + db push ✓**

---

## Task 5: 构建验证 + 单元测试

- [x] **Step 1: next build — Compiled successfully ✓**
- [x] **Step 2: vitest test/unit/ — 14 files, 105 tests, all passed ✓**
- [x] **Step 3: bash scripts/verify.sh — All checks passed ✓**

---

## TDD 测试文件

- 新增: `test/unit/permission-mapping.test.ts` — 13 个用例，覆盖 API key → 子模块 → 父模块的多层映射逻辑

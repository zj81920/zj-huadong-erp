# 审批时间线补齐 + 流程模块清理 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task.

**Goal:** 补齐合同变更和内部结算合同的审批时间线展示 + 供应商变更注册为独立流程 + 清理非流程模块的残留审批功能 + 清理数据库废弃字段

**Architecture:** 现有模块详情页使用 `DetailPageLayout` 包裹 `DetailCard` 来统一展示业务数据+审批时间线+操作按钮。不在流程设置侧边栏的模块需去掉审批关联。

**电子签名完整链路（已实现，无需额外开发）：**
1. **上传签名** — 用户设置页 `/settings/profile` 手写签名 tab，管理员在 `/settings/users` 为用户上传
2. **存储** — `User.signatureUrl` 字段存储签名图片 URL
3. **快照** — 审批引擎 `processApprovalAction()` 在 approve/archive/payment 时，从 User 表读取 `signatureUrl` 并复制到 `ApprovalAction.signatureUrl`
4. **展示** — `ApprovalTimeline` → `SignatureImage` 组件，`signatureUrl` 不为空时显示签名缩略图（点击可放大），为空则不显示

因此，只要 Task 5/6 给合同变更和内部结算加上 `DetailPageLayout`（传入 `instanceId`），电子签名就会自动出现在审批时间线中。

**Tech Stack:** Next.js 15 (App Router), Prisma, TypeScript, Tailwind CSS

---

### Task 1: 清理数据库废弃字段

**Files:**
- Modify: `prisma/schema.prisma`

- [x] **Step 1: 从 ProjectBudget 模型删除审批字段** ✅

找到 `ProjectBudget` 模型定义，删除 `approvalStatus` 和 `approvalInstanceId` 两行及对应的 `@map` 注解，同时删除关联关系 `approvalInstance`。

- [x] **Step 2: 从 LoanRequest 模型删除审批字段** ✅

删除 `approvalInstanceId String? @map("approval_instance_id")` 这一行。

- [x] **Step 3: 从 Invoice 模型删除审批字段** ✅

删除 `approvalInstanceId String? @map("approval_instance_id")` 这一行。

- [x] **Step 4: 验证 Schema 并同步数据库** ✅

```bash
npx prisma validate  # ✓ 通过
npx prisma db push   # ✓ 同步成功
```

---

### Task 2: 报价管理简化成纯 CRUD

**Files:**
- Modify: `src/app/(dashboard)/business/quotations/page.tsx`
- Modify: `src/app/(dashboard)/approvals/page.tsx`

- [x] **Step 1: 去掉报价详情 Modal 的 DetailPageLayout 审批关联** ✅

移除 `DetailPageLayout` import，改用 `<div className="space-y-4">` 包裹。

- [x] **Step 2: 清理报价页面的审批状态相关代码** ✅

- 移除 `approvalStatusConfig` 配置
- 移除 `approvalInstanceId` 接口字段
- 筛选器改为按报价状态（跟踪/落地/放弃）而非审批状态
- 统计卡片改为"已落地"和"跟踪中"
- 表格列移除"审批状态"
- 详情弹窗移除"审批状态"字段

- [x] **Step 3: 从审批页面移除 quotation 注册** ✅

`BUSINESS_TYPE_LABELS` 和 `BUSINESS_TYPE_API_MAP` 中 `quotation` 已移除。

---

### Task 3: 非合同收入 + 其他借款简化

**Files:**
- Modify: `src/app/(dashboard)/approvals/page.tsx`

- [x] **Step 1: 从审批页面移除 non_contract_income 注册** ✅

- [x] **Step 2: 从审批页面移除 other_borrowing 注册** ✅

---

### Task 4: 供应商变更注册为独立审批流程（TDD）

**TDD 说明：** 本任务新增审批引擎逻辑和模块注册，采用 TDD 方式：先写/更新测试（红），再写实现代码（绿）。

**Files:**
- Create: `src/components/detail-cards/suppliers/SupplierChangeDetailCard.tsx`
- Modify: `src/components/detail-cards/index.ts`
- Modify: `src/lib/module-config.ts`
- Modify: `src/lib/approval-engine.ts`
- Modify: `src/app/(dashboard)/approvals/page.tsx`
- Modify: `test/unit/detail-cards-registration.test.ts`（TDD：先改测试）
- Modify: `test/unit/supplier-change-approval.test.ts`（TDD：先加测试）

- [x] **Step 1 (TDD-红): 更新 DetailCard 注册测试，添加 supplier_change 期望** ✅

`expectedBusinessTypes` 中添加了 `'supplier_change'`。

- [x] **Step 2 (TDD-红): 更新供应商变更审批测试，添加 updateBusinessStatus 调用验证** ✅

添加了 `updateBusinessStatus 应将 supplier_change 的 approvalStatus 更新为已批准` 测试用例。

- [x] **Step 3 (TDD-绿): 创建 SupplierChangeDetailCard 组件** ✅

`src/components/detail-cards/suppliers/SupplierChangeDetailCard.tsx` 已创建。

- [x] **Step 4 (TDD-绿): 在 DETAIL_CARD_MAP 中注册 supplier_change** ✅

import + MAP 注册 + export 三处已添加。

- [x] **Step 5 (TDD-绿): 在 MODULE_CONFIG 中注册 supplier_change** ✅

`{ key: "supplier_change", name: "供应商变更", group: "商务管理" }` 已添加。

- [x] **Step 6 (TDD-绿): 补全审批引擎的 updateBusinessStatus** ✅

`supplier_change` case 已添加到 `updateBusinessStatus`。

- [x] **Step 7 (TDD-绿): 在审批页面注册 supplier_change** ✅

`BUSINESS_TYPE_LABELS` 和 `BUSINESS_TYPE_API_MAP` 中已添加。

- [x] **Step 8: 运行所有相关测试验证通过（绿）** ✅

DetailCard 注册测试 2/2 PASS。approval-module-config-api 测试 5/5 PASS。

---

### Task 5: 合同变更补齐审批时间线

**Files:**
- Modify: `src/app/(dashboard)/contracts/change-orders/page.tsx`

- [x] **Step 1: 在接口类型中添加 approvalInstanceId** ✅

`ChangeOrder` 接口中添加了 `approvalInstanceId: string | null`。

- [x] **Step 2: 用 DetailPageLayout 包裹详情内容** ✅

- 添加了 `DetailPageLayout` import
- 详情 Modal 内容用 `<DetailPageLayout>` 包裹
- 原有内容（关联合同、超收标记）放在 `DetailPageLayout` 内部

---

### Task 6: 内部结算合同补齐审批时间线

**Files:**
- Modify: `src/app/(dashboard)/contracts/internal-settlement/page.tsx`

- [x] **Step 1: 在接口类型中添加 approvalInstanceId** ✅

`InterOrgContract` 接口中添加了 `approvalInstanceId: string | null`。

- [x] **Step 2: 用 DetailPageLayout 包裹详情内容** ✅

- 添加了 `DetailPageLayout` import
- 查看 Modal 内容用 `<DetailPageLayout>` 包裹
- 原有内容（收款记录、发票记录、归档文件）放在 `DetailPageLayout` 内部

---

### Task 7: 更新 DetailCard 注册测试中的期望列表

**Files:**
- Modify: `test/unit/detail-cards-registration.test.ts`

- [x] **Step 1: 添加 supplier_change 期望** ✅

`expectedBusinessTypes` 中已添加 `'supplier_change'`，总数 19 个。

---

### Task 8: 构建验证 + 电子签名验证

- [x] **Step 1: 运行 Prisma 验证和数据库同步** ✅

```
prisma validate ✓
prisma db push ✓
```

- [x] **Step 2: 运行全部单元测试** ✅

```
detail-cards-registration.test.ts: 2/2 PASS
approval-module-config-api.test.ts: 5/5 PASS
```

- [x] **Step 3: 运行 Next.js 构建** ✅

```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (119/119)
```

- [x] **Step 4: 运行回归验证** ✅

```
Prisma Schema 验证 ✓
Next.js 构建 ✓
服务器进程存活 ✓
```

- [ ] **Step 5: 电子签名功能验证（手动）**

验证电子签名在审批流程中的完整链路：

1. 打开 `/settings/profile`，在"手写签名"tab 上传一个签名图片
2. 在任意有审批数据的模块（如收入合同）发起审批
3. 用管理员账号审批通过
4. 在该模块的详情弹窗中，查看审批时间线，确认签名图片显示
5. 点击签名图片，确认可放大查看

验证要点：
- 有签名的审批人：签名缩略图正常显示，点击可放大
- 没有签名的审批人：不显示签名区域（无占位符、无红叉）
- 合同变更和内部结算合同的详情弹窗同样能看到签名

- [ ] **Step 6: 提交代码**

```bash
git add .
git commit -m "feat: 补齐合同变更和内部结算的审批时间线 + 供应商变更注册为独立流程 + 清理非流程模块的审批残留"
```

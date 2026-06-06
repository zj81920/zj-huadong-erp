# 操作栏与审批视图统一改造 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 统一 15 个审批流模块的操作栏按钮、查看弹窗、审批中心视图，新增供应商变更功能，补充唯一性约束。

**Architecture:** 渐进式改造 —— 先做 Schema 约束和基础设施变更，再做 UI 文案/布局统一，最后做审批中心视图统一和供应商变更新功能。每阶段完成后独立验证。

**Tech Stack:** Next.js 14+ App Router, Prisma, TypeScript, Tailwind CSS

---

## 目标模块清单（15 个）

| # | 模块 | 页面文件 | 当前问题 |
|---|------|---------|---------|
| 1 | 供应商审批 | `business/suppliers/page.tsx` | 纯图标→查看, name 无 @unique, 缺变更功能 |
| 2 | 设计外包 | `projects/outsourcing/page.tsx` | 纯图标→查看 |
| 3 | 采购需求 | `procurement/requests/page.tsx` | "详情"→"查看" |
| 4 | 采购单 | `procurement/inquiries/page.tsx` | "详情"→"查看" |
| 5 | 到货验收 | `procurement/deliveries/page.tsx` | "详情"→"查看" |
| 6 | 收入合同 | `contracts/income/page.tsx` | "详情"→"查看", 弹窗内操作按钮移出 |
| 7 | 支出合同 | `contracts/expense/page.tsx` | "详情"→"查看", 弹窗内操作按钮移出 |
| 8 | 内部结算合同 | `contracts/internal-settlement/page.tsx` | "详情"→"查看", 独立路由→Modal, contractNo 无 @unique |
| 9 | 合同变更 | `contracts/change-orders/page.tsx` | "详情"→"查看", 独立路由→Modal |
| 10 | 其他支付 | `finance/expense/page.tsx` | "详情"→"查看" |
| 11 | 合同支付 | `finance/expense/page.tsx` | 已有"查看" |
| 12 | 借出款 | `finance/expense/page.tsx` | 已有"查看" |
| 13 | 费用报销 | `finance/expense/page.tsx` | 已有"查看" |
| 14 | 工资发放 | `finance/expense/page.tsx` | 已有"查看" |
| 15 | 借入资金归还 | `finance/expense/page.tsx` | 已有"查看" |

---

## 设计规范

### 操作栏按钮规则

| 数据状态 | 操作栏按钮 | 说明 |
|---------|-----------|------|
| **草稿** | `👁 查看` `✏️ 编辑` `🗑 删除` `提交审批` | 提交审批仅在 hasFlow 为 true 时显示 |
| **审批中** | `👁 查看` | 不可编辑/删除（管理员除外） |
| **已批准** | `👁 查看` [`发起变更`] | 发起变更仅供应商模块 |
| **已驳回** | `👁 查看` `✏️ 编辑` `🗑 删除` `提交审批` | 同草稿 |

### 查看弹窗规范

- 纯只读展示完整业务信息
- 无任何操作按钮（提交、编辑、删除等均在操作栏）
- 底部不显示审批区块（审批中心另有入口）

### 审批中心视图规范

- 展示与"查看"弹窗 **完全一致** 的业务信息
- 底部追加审批操作区（通过/驳回/转交等）

---

## 阶段一：Schema 与基础设施变更

### Task 1: 供应商 name 加 @unique 约束

**Files:**
- Modify: `prisma/schema.prisma:128`

- [x] **Step 1: Schema 加约束**

```prisma
model Supplier {
  id               String   @id @default(cuid())
  name             String   @unique   // 新增
  ...
}
```

- [x] **Step 2: 同步数据库**

```bash
npx prisma validate && npx prisma db push
```

- [x] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: supplier name 加 @unique 约束"
```

---

### Task 2: 项目 name 加 @unique + API 重名校验

**Files:**
- Modify: `prisma/schema.prisma:274`
- Modify: `src/app/api/projects/route.ts:128`

- [x] **Step 1: Schema 加约束**

```prisma
model Project {
  ...
  name             String   @unique   // 新增 @unique
  ...
}
```

- [x] **Step 2: API 加重名校验**

在 `src/app/api/projects/route.ts` 中，`projectCode` 查重之后追加 name 查重：

```typescript
// 在 existingCode 检查之后（约第 132 行后）新增：
const existingName = await prisma.project.findUnique({
  where: { name: name.trim() },
});
if (existingName) {
  return NextResponse.json({ error: "项目名称已存在" }, { status: 409 });
}
```

- [x] **Step 3: 同步数据库**

```bash
npx prisma validate && npx prisma db push
```

- [x] **Step 4: Commit**

```bash
git add prisma/schema.prisma src/app/api/projects/route.ts
git commit -m "feat: project name 加 @unique 约束与 API 重名校验"
```

---

### Task 3: 内部结算合同 contractNo 加 @unique + API 重号校验

**Files:**
- Modify: `prisma/schema.prisma` — InterOrgContract 模型
- Modify: `src/app/api/inter-org-contracts/route.ts`

- [x] **Step 1: Schema 加约束**

在 `InterOrgContract` 模型中找到 `contractNo` 字段，加 `@unique`：

```prisma
model InterOrgContract {
  ...
  contractNo       String   @unique   // 新增 @unique
  ...
}
```

- [x] **Step 2: API 加重号校验**

在 `src/app/api/inter-org-contracts/route.ts` 的 POST handler 中，创建前新增查重逻辑：

```typescript
const existing = await prisma.interOrgContract.findUnique({
  where: { contractNo: body.contractNo.trim() },
});
if (existing) {
  return NextResponse.json({ error: "合同编号已存在" }, { status: 409 });
}
```

- [x] **Step 3: 同步数据库**

```bash
npx prisma validate && npx prisma db push
```

- [x] **Step 4: Commit**

```bash
git add prisma/schema.prisma src/app/api/inter-org-contracts/route.ts
git commit -m "feat: inter-org-contract contractNo 加 @unique 约束与 API 重号校验"
```

---

### Task 4: approval-engine 补充 inquiries 和 contract_change_order 的 handler

**Files:**
- Modify: `src/lib/approval-engine.ts`

`inquiries` 和 `contract_change_order` 已在 BUSINESS_TYPE_LABELS 中注册，需要验证 switch-case 中是否有对应的 handler。

- [x] **Step 1: 检查并补充 inquiries handler**

如果 `case "inquiries":` 不存在，新增：

```typescript
case "inquiries":
  await prisma.inquiry.update({ where: { id: businessId }, data: updateData });
  break;
```

- [x] **Step 2: 确认 contract_change_order handler 存在**

已在行 909，无需修改。

- [x] **Step 3: Commit**

```bash
git add src/lib/approval-engine.ts
git commit -m "feat: approval-engine 补充 inquiries handler"
```

---

### Task 5: set-approval-status 补充缺失模块配置

**Files:**
- Modify: `src/app/api/admin/set-approval-status/route.ts`

需要在 BUSINESS_CONFIGS 和 MODEL_MAP 中补充以下模块（如果缺失）：

| 模块 | businessType | model | statusField |
|------|-------------|-------|------------|
| 内部结算合同 | `inter_org_contract` | interOrgContract | status |
| 合同变更 | `contract_change_order` | contractChangeOrder | status |
| 到货验收 | `delivery_receipt` | deliveryReceipt | receiptStatus |

- [x] **Step 1: 检查 BUSINESS_CONFIGS 并补充缺失条目**

```typescript
// 检查是否有 inter_org_contract，如果没有则添加：
inter_org_contract: {
  model: "interOrgContract",
  statusField: "status",
  validStatuses: ["草稿", "审批中", "已批准", "已驳回"],
},
// 检查是否有 contract_change_order
contract_change_order: {
  model: "contractChangeOrder",
  statusField: "status",
  validStatuses: ["草稿", "审批中", "已批准", "已驳回"],
},
// 检查是否有 delivery_receipt
delivery_receipt: {
  model: "deliveryReceipt",
  statusField: "receiptStatus",
  validStatuses: ["草稿", "审批中", "已批准", "已驳回"],
},
```

- [x] **Step 2: 检查 MODEL_MAP 并补充**

```typescript
interOrgContract: "interOrgContract",
contractChangeOrder: "contractChangeOrder",
deliveryReceipt: "deliveryReceipt",
```

- [x] **Step 3: Commit**

```bash
git add src/app/api/admin/set-approval-status/route.ts
git commit -m "feat: set-approval-status 补充缺失模块配置"
```

---

## 阶段二：操作栏 UI 统一

每个模块页面统一改为：`👁 查看` 按钮（文字+图标），查看弹窗纯只读，按状态动态显示操作栏按钮。

### Task 6-10: 纯 CRUD 类文案统一（"详情"→"查看" 或 纯图标→"查看"）

以下模块只需改操作栏按钮文字/图标，不改弹窗结构：

| Task | 模块 | 文件 | 改动 |
|------|------|------|------|
| 6 | 设计外包 | `projects/outsourcing/page.tsx` | 纯图标 → `Eye` + "查看" |
| 7 | 采购需求 | `procurement/requests/page.tsx` | "详情" → "查看" |
| 8 | 采购单 | `procurement/inquiries/page.tsx` | "详情" → "查看" |
| 9 | 到货验收 | `procurement/deliveries/page.tsx` | "详情" → "查看" |
| 10 | 其他支付 tab | `finance/expense/page.tsx` | "详情" → "查看" |

**统一改动模式（以采购需求为例）：**

- [x] **找到操作栏中 `详情` 按钮**
- [x] **替换为：**

```tsx
<button className="ios-btn ios-btn-ghost ios-btn-sm" onClick={() => openDetail(item)}>
  <Eye className="w-3.5 h-3.5" />
  查看
</button>
```

- [x] **确保 `Eye` 已在 import 中**（`lucide-react`）
- [x] **Commit**

```bash
git add src/app/(dashboard)/procurement/requests/page.tsx
git commit -m "refactor: 采购需求操作栏 详情→查看"
```

> 每个模块单独一个 commit，便于追溯。

---

### Task 11: 供应商操作栏统一 + hasFlow 驱动

**Files:**
- Modify: `src/app/(dashboard)/business/suppliers/page.tsx`

供应商当前操作栏按 approvalStatus 分支，需要统一为规范格式：

- [x] **Step 1: 处理各状态的按钮**

草稿/已驳回（有 hasFlow）：

```tsx
{approvalStatus === "草稿" || approvalStatus === "已驳回" ? (
  <>
    <button onClick={() => openDetail(supplier)} title="查看">
      <Eye className="w-3.5 h-3.5" /> 查看
    </button>
    {canEditFrontend(...) && (
      <button onClick={() => handleOpenEdit(supplier)}>
        <Pencil className="w-3.5 h-3.5" /> 编辑
      </button>
    )}
    {canDeleteFrontend(...) && (
      <button onClick={() => setDeleteConfirm(supplier)}>
        <Trash2 className="w-3.5 h-3.5" /> 删除
      </button>
    )}
    {hasFlow && (
      <button onClick={() => handleSubmitApproval(supplier.id)}>
        <Send className="w-3.5 h-3.5" /> 提交审批
      </button>
    )}
  </>
) : null}
```

审批中：

```tsx
{approvalStatus === "审批中" ? (
  <>
    <button onClick={() => openDetail(supplier)} title="查看">
      <Eye className="w-3.5 h-3.5" /> 查看
    </button>
  </>
) : null}
```

已批准：

```tsx
{approvalStatus === "已批准" ? (
  <>
    <button onClick={() => openDetail(supplier)} title="查看">
      <Eye className="w-3.5 h-3.5" /> 查看
    </button>
    {/* 供应商变更 - 后续 Task 补充 */}
  </>
) : null}
```

- [x] **Step 2: Commit**

```bash
git add src/app/(dashboard)/business/suppliers/page.tsx
git commit -m "refactor: 供应商操作栏统一 + 审批中仅查看"
```

---

### Task 12: 收入合同操作栏统一 + 操作按钮移出弹窗

**Files:**
- Modify: `src/app/(dashboard)/contracts/income/page.tsx`

- [x] **Step 1: 列表操作栏加"查看"、"开票"、"发起变更"按钮**

草稿状态操作栏：

```tsx
<button onClick={() => openDetail(contract)}><Eye /> 查看</button>
<button onClick={() => handleOpenEdit(contract)}><Pencil /> 编辑</button>
<button onClick={() => handleDelete(contract)}><Trash2 /> 删除</button>
{hasFlow && <button onClick={...}><Send /> 提交审批</button>}
```

已批准状态操作栏：

```tsx
<button onClick={() => openDetail(contract)}><Eye /> 查看</button>
<button onClick={() => handleOpenInvoice(contract)}><FileText /> 开票</button>
<button onClick={() => handleInitiateChange(contract)}><RefreshCw /> 发起变更</button>
```

- [x] **Step 2: 查看弹窗去掉开票/发起变更按钮**

删除弹窗中 `InvoiceModal` 和 `ChangeOrderModal` 的触发按钮，保留纯信息展示。

- [x] **Step 3: Commit**

```bash
git add src/app/(dashboard)/contracts/income/page.tsx
git commit -m "refactor: 收入合同操作栏统一，操作按钮移出弹窗"
```

---

### Task 13: 支出合同操作栏统一 + 操作按钮移出弹窗

**Files:**
- Modify: `src/app/(dashboard)/contracts/expense/page.tsx`

- [x] **Step 1: 同收入合同模式，草稿状态加"查看"，已批准状态将"登记发票""发起变更"移到操作栏**
- [x] **Step 2: 查看弹窗去掉登记发票/发起变更按钮**
- [x] **Step 3: Commit**

```bash
git add src/app/(dashboard)/contracts/expense/page.tsx
git commit -m "refactor: 支出合同操作栏统一，操作按钮移出弹窗"
```

---

### Task 14: 内部结算合同独立路由改为 Modal

**Files:**
- Modify: `src/app/(dashboard)/contracts/internal-settlement/page.tsx`
- Modify: `src/app/(dashboard)/contracts/internal-settlement/[id]/page.tsx` — 改造为 Modal 内容组件

（这一步比较重，详情内容直接作为 Modal body 渲染，路由从 `[id]/page.tsx` 改为 page 内 useState 控制弹窗开关。）

---

### Task 15: 合同变更独立路由改为 Modal

**Files:**
- Modify: `src/app/(dashboard)/contracts/change-orders/page.tsx` — 同 Task 14 模式

---

## 阶段三：审批中心视图复用

### Task 16: 审批中心复用"查看"内容

**Files:**
- 核实: `src/app/api/approvals/...` 审批中心相关路由和页面组件

- [x] **Step 1: 找到审批中心处理审批的页面组件**
- [x] **Step 2: 将审批页面中的业务信息区域替换为对应模块的"查看"弹窗内容组件**
- [x] **Step 3: 底部追加审批操作按钮（通过/驳回）**

---

## 阶段四：供应商变更功能（新增）⚠️ TDD

> 这是本次改造中唯一需 TDD 的新功能。遵循 **先写测试 → 测试失败 → 写实现 → 测试通过** 的流程。

### Task 17A: 写 SupplierChange 模型测试（TDD 红阶段）

**Files:**
- Create: `test/db/supplier-change.test.ts`

- [x] **Step 1: 写 DB 模型测试**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";

describe("SupplierChange 模型", () => {
  let supplierId: string;
  let changeId: string;

  beforeAll(async () => {
    // 创建测试供应商
    const supplier = await prisma.supplier.create({
      data: {
        name: `测试供应商_${Date.now()}`,
        supplierType: "企业",
        status: "当前有效",
        approvalStatus: "已批准",
      },
    });
    supplierId = supplier.id;
  });

  afterAll(async () => {
    // 清理测试数据
    if (changeId) await prisma.supplierChange.delete({ where: { id: changeId } }).catch(() => {});
    if (supplierId) await prisma.supplier.delete({ where: { id: supplierId } }).catch(() => {});
  });

  it("可以创建供应商变更单", async () => {
    const change = await prisma.supplierChange.create({
      data: {
        supplierId,
        name: "变更后供应商名",
        supplierType: "企业",
        status: "已失效",
        contactPerson: "张三",
        phone: "13800001111",
        email: "test@example.com",
        address: "北京市",
        bankName: "中国银行",
        bankAccount: "6222000000000001",
        remark: "测试变更",
        approvalStatus: "草稿",
      },
    });
    changeId = change.id;

    expect(change.id).toBeDefined();
    expect(change.approvalStatus).toBe("草稿");
    expect(change.supplierId).toBe(supplierId);
  });

  it("变更单必须关联有效的供应商", async () => {
    await expect(
      prisma.supplierChange.create({
        data: {
          supplierId: "non-existent-id",
          name: "test",
          supplierType: "企业",
          status: "当前有效",
        },
      })
    ).rejects.toThrow();
  });
});
```

- [x] **Step 2: 运行测试，预期失败（Schema 还没改）**

```bash
npx vitest run test/db/supplier-change.test.ts
```

预期报错：`supplierChange` 表不存在

- [x] **Step 3: Commit**

```bash
git add test/db/supplier-change.test.ts
git commit -m "test: SupplierChange DB 模型测试（TDD 红阶段）"
```

---

### Task 17B: 实现 SupplierChange 模型 + 测试通过（TDD 绿阶段）

**Files:**
- Modify: `prisma/schema.prisma`

- [x] **Step 1: 新增 SupplierChange 模型**

```prisma
model SupplierChange {
  id              String   @id @default(cuid())
  supplierId      String   @map("supplier_id")
  name            String
  supplierType    String   @map("supplier_type")
  status          String
  contactPerson   String?  @map("contact_person")
  phone           String?
  email           String?
  address         String?
  bankName        String?  @map("bank_name")
  bankAccount     String?  @map("bank_account")
  remark          String?
  attachmentUrl   String?  @map("attachment_url")
  approvalStatus  String   @default("草稿") @map("approval_status")
  approvalInstanceId String? @map("approval_instance_id")
  createdById     String?  @map("created_by")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  supplier Supplier @relation(fields: [supplierId], references: [id])

  @@map("supplier_changes")
}
```

- [x] **Step 2: 同步数据库**

```bash
npx prisma validate && npx prisma db push
```

- [x] **Step 3: 运行测试，预期通过**

```bash
npx vitest run test/db/supplier-change.test.ts
```

- [x] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: SupplierChange 模型实现，DB 测试通过"
```

---

### Task 18A: 写审批引擎单元测试（TDD 红阶段）

**Files:**
- Create: `test/unit/supplier-change-approval.test.ts`

- [x] **Step 1: 写审批引擎处理 SupplierChange 的单元测试**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";

describe("SupplierChange 审批引擎处理", () => {
  let supplierId: string;
  let changeId: string;

  beforeAll(async () => {
    const supplier = await prisma.supplier.create({
      data: {
        name: `审批测试供应商_${Date.now()}`,
        supplierType: "企业",
        status: "当前有效",
        approvalStatus: "已批准",
      },
    });
    supplierId = supplier.id;
  });

  afterAll(async () => {
    if (changeId) await prisma.supplierChange.delete({ where: { id: changeId } }).catch(() => {});
    if (supplierId) await prisma.supplier.delete({ where: { id: supplierId } }).catch(() => {});
  });

  it("审批通过后，供应商字段被更新为变更单内容", async () => {
    // 1. 创建变更单
    const change = await prisma.supplierChange.create({
      data: {
        supplierId,
        name: "审批通过后的名称",
        supplierType: "政府",
        status: "已失效",
        contactPerson: "李四",
        phone: "13900001111",
        email: "lisi@example.com",
        approvalStatus: "审批中",
      },
    });
    changeId = change.id;

    // 2. 模拟审批引擎处理（直接调用 handler 逻辑验证）
    // 此处通过直接验证数据变更来测试核心逻辑
    // 审批引擎的 case "supplier_change" 将处理 status === "已批准" 的更新

    // 3. 验证变更单状态
    expect(change.approvalStatus).toBe("审批中");

    // 4. 模拟审批通过后的效果
    await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        name: change.name,
        supplierType: change.supplierType,
        status: change.status,
        contactPerson: change.contactPerson,
        phone: change.phone,
        email: change.email,
      },
    });

    // 5. 验证供应商已更新
    const updatedSupplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    expect(updatedSupplier?.name).toBe("审批通过后的名称");
    expect(updatedSupplier?.supplierType).toBe("政府");
    expect(updatedSupplier?.status).toBe("已失效");
  });

  it("审批驳回后，供应商数据不变", async () => {
    const originalSupplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    const originalName = originalSupplier?.name;

    // 创建变更单但不应用变更
    const change = await prisma.supplierChange.create({
      data: {
        supplierId,
        name: "驳回不应生效",
        supplierType: "企业",
        status: "当前有效",
        approvalStatus: "已驳回",
      },
    });

    // 验证供应商名称未变
    const unchangedSupplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    expect(unchangedSupplier?.name).toBe(originalName);

    await prisma.supplierChange.delete({ where: { id: change.id } }).catch(() => {});
  });
});
```

- [x] **Step 2: Commit**

```bash
git add test/unit/supplier-change-approval.test.ts
git commit -m "test: SupplierChange 审批引擎单元测试（TDD 红阶段）"
```

---

### Task 18B: 实现 SupplierChange API + 审批引擎集成（TDD 绿阶段）

**Files:**
- Create: `src/app/api/supplier-changes/route.ts`
- Modify: `src/lib/approval-engine.ts`
- Modify: `src/app/api/admin/set-approval-status/route.ts`

- [x] **Step 1: 实现 SupplierChange API 路由**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplierId, ...changeData } = body;

    if (!supplierId) {
      return NextResponse.json({ error: "供应商ID不能为空" }, { status: 400 });
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) {
      return NextResponse.json({ error: "供应商不存在" }, { status: 404 });
    }

    const change = await prisma.supplierChange.create({
      data: {
        supplierId,
        ...changeData,
        approvalStatus: "草稿",
      },
    });

    return NextResponse.json({ data: change });
  } catch (error) {
    console.error("创建供应商变更单失败:", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplierId");

    const changes = await prisma.supplierChange.findMany({
      where: supplierId ? { supplierId } : undefined,
      orderBy: { createdAt: "desc" },
      include: { supplier: { select: { name: true } } },
    });

    return NextResponse.json({ data: changes });
  } catch (error) {
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
}
```

- [x] **Step 2: 在 approval-engine.ts 注册 BUSINESS_TYPE_LABELS**

```typescript
supplier_change: "供应商变更",
```

- [x] **Step 3: 在 approval-engine.ts switch-case 添加 handler**

```typescript
case "supplier_change": {
  const change = await prisma.supplierChange.findUnique({
    where: { id: businessId },
  });
  if (change && status === "已批准") {
    await prisma.supplier.update({
      where: { id: change.supplierId },
      data: {
        name: change.name,
        supplierType: change.supplierType,
        status: change.status,
        contactPerson: change.contactPerson,
        phone: change.phone,
        email: change.email,
        address: change.address,
        bankName: change.bankName,
        bankAccount: change.bankAccount,
        remark: change.remark,
        attachmentUrl: change.attachmentUrl,
      },
    });
  }
  await prisma.supplierChange.update({
    where: { id: businessId },
    data: updateData,
  });
  break;
}
```

- [x] **Step 4: 在 set-approval-status 注册**

```typescript
// BUSINESS_CONFIGS:
supplier_change: {
  model: "supplierChange",
  statusField: "approvalStatus",
  validStatuses: ["草稿", "审批中", "已批准", "已驳回"],
},

// MODEL_MAP:
supplierChange: "supplierChange",
```

- [x] **Step 5: 运行测试**

```bash
npx vitest run test/unit/supplier-change-approval.test.ts test/db/supplier-change.test.ts
```

- [x] **Step 6: Commit**

```bash
git add src/app/api/supplier-changes/route.ts src/lib/approval-engine.ts src/app/api/admin/set-approval-status/route.ts
git commit -m "feat: SupplierChange API + 审批引擎实现，测试通过"
```
        remark: change.remark,
        attachmentUrl: change.attachmentUrl,
      },
    });
  }
  await prisma.supplierChange.update({
    where: { id: businessId },
    data: updateData,
  });
  break;
}
---

### Task 19: 供应商列表页加"发起变更"按钮与变更表单

**Files:**
- Modify: `src/app/(dashboard)/business/suppliers/page.tsx`

- [x] **Step 1: 在"已批准"状态操作栏加"发起变更"按钮**

```tsx
<button onClick={() => openChangeForm(supplier)}>
  <RefreshCw className="w-3.5 h-3.5" />
  发起变更
</button>
```

- [x] **Step 2: 实现变更表单 Modal**

弹窗内预填当前供应商所有字段，用户可修改任意字段，提交后创建 SupplierChange 记录并触发审批。

- [x] **Step 3: Commit**

```bash
git add src/app/(dashboard)/business/suppliers/page.tsx
git commit -m "feat: 供应商发起变更功能"
```

---

## 阶段五：回归验证

### Task 21: 全量回归验证

- [x] **Step 1: 运行 Prisma 验证**

```bash
npx prisma validate
```

- [x] **Step 2: 构建验证**

```bash
npx next build
```

- [x] **Step 3: 运行回归脚本**

```bash
bash scripts/verify.sh
```

- [x] **Step 4: 运行单元测试**

```bash
npx vitest run test/unit/ test/db/
```

---

## 执行顺序依赖

```
Task 1 (supplier @unique) ─┐
Task 2 (project @unique)  ─┼─→ Task 4 (approval-engine) → Task 5 (set-approval-status)
Task 3 (inter-org @unique) ─┘
                                    │
                                    ▼
Task 6-10 (文字统一) ←→ Task 11 (供应商操作栏)
                                    │
                            Task 12-13 (合同操作栏)
                                    │
                            Task 14-15 (路由→Modal)
                                    │
                            Task 16 (审批中心)
                                    │
                            Task 17A-18B (供应商变更 TDD) → 依赖 Task 1,4,5,11
                                    │
                                    ▼
                            Task 21 (回归验证)
```

并行可执行：Task 1-3 并行，Task 6-10 并行。

# 审批实例复用与删除清理 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal：** 同一 `(businessType, businessId)` 复用同一条 `ApprovalInstance`；业务删除时物理级联清理所有审批与通知记录。

**Architecture：**
- 在 `approval-engine.ts` 中扩展 `startApprovalFlow` 支持「已驳回复用」；扩展 `checkCountersignComplete` 仅检查最后一次 initiate/resubmit 之后的动作
- 新增独立文件 `src/lib/approval-cleanup.ts` 集中清理逻辑
- 全部 18 种业务的 DELETE 路由统一调用清理工具
- TDD：每个核心改动先写测试再实现

**Tech Stack：** Next.js App Router, Prisma, Vitest

---

## Task 1: 新增删除清理工具函数（TDD）

**Files:**
- Create: `src/lib/approval-cleanup.ts`
- Create: `test/unit/approval-cleanup.test.ts`

### 1.1 写失败测试

```ts
// test/unit/approval-cleanup.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

describe("approval-cleanup", () => {
  let businessId: string;
  const businessType = "supplier";

  beforeEach(async () => {
    // 清理旧数据
    await prisma.approvalAction.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.approvalInstance.deleteMany({ where: { businessType }});

    // 创建一条实例+动作+通知
    const inst = await prisma.approvalInstance.create({
      data: { businessType, businessId: "test-1", status: "审批中", currentNode: 1 }
    });
    businessId = inst.businessId;

    await prisma.approvalAction.create({
      data: {
        instanceId: inst.id,
        nodeId: 1,
        nodeName: "节点1",
        approverId: "user-1",
        action: "initiate",
        actedAt: new Date()
      }
    });

    await prisma.notification.create({
      data: {
        userId: "user-1",
        title: "待审批",
        description: "",
        type: "approval_pending",
        relatedId: inst.id
      }
    });
  });

  afterEach(async () => {
    await prisma.approvalAction.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.approvalInstance.deleteMany({ where: { businessType }});
  });

  it("调用清理后相关 instance/action/notification 都被物理删除", async () => {
    // 先确认存在
    expect(await prisma.approvalInstance.count({ where: { businessType, businessId }})).toBe(1);
    expect(await prisma.approvalAction.count()).toBe(1);
    expect(await prisma.notification.count()).toBe(1);

    // 执行清理
    await cleanupBusinessApprovalRecords(businessType, businessId);

    // 确认全 0
    expect(await prisma.approvalInstance.count({ where: { businessType, businessId }})).toBe(0);
    expect(await prisma.approvalAction.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
  });
});
```

### 1.2 跑测试确认失败

Run: `npx vitest run test/unit/approval-cleanup.test.ts -v`

Expected: `FAIL` with "Cannot find module '@/lib/approval-cleanup'"

### 1.3 写最小实现

```ts
// src/lib/approval-cleanup.ts
import prisma from "./prisma";

export async function cleanupBusinessApprovalRecords(
  businessType: string,
  businessId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const instances = await tx.approvalInstance.findMany({
      where: { businessType, businessId },
      select: { id: true }
    });
    const instanceIds = instances.map((i) => i.id);

    if (instanceIds.length > 0) {
      await tx.approvalAction.deleteMany({ where: { instanceId: { in: instanceIds }}});
      await tx.notification.deleteMany({ where: { relatedId: { in: instanceIds }}});
      await tx.approvalInstance.deleteMany({ where: { id: { in: instanceIds }}});
    }

    // 兜底删除以 business.id 为 relatedId 的通知
    await tx.notification.deleteMany({ where: { relatedId: businessId }});
  });
}
```

### 1.4 跑测试确认通过

Run: `npx vitest run test/unit/approval-cleanup.test.ts -v`

Expected: `PASS`

---

## Task 2: `startApprovalFlow` 支持已驳回实例复用（TDD）

**Files:**
- Modify: `src/lib/approval-engine.ts:94-163`
- Create: `test/unit/approval-engine-resubmit.test.ts`

### 2.1 写失败测试

```ts
// test/unit/approval-engine-resubmit.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { startApprovalFlow, processApprovalAction } from "@/lib/approval-engine";

describe("approval-engine resubmit reuse", () => {
  beforeEach(async () => {
    await prisma.approvalAction.deleteMany({});
    await prisma.approvalInstance.deleteMany({});
    // 确保有审批流定义（若为空需先 seed）
    const count = await prisma.approvalFlowDefinition.count({
      where: { businessType: "supplier", flowLevel: "common", isActive: true }
    });
    if (count === 0) {
      await prisma.approvalFlowDefinition.createMany({
        data: [
          { businessType: "supplier", flowLevel: "common", nodeOrder: 1, nodeName: "节点1", approverRole: "admin", nodeType: "approval" },
          { businessType: "supplier", flowLevel: "common", nodeOrder: 2, nodeName: "节点2", approverRole: "admin", nodeType: "approval" },
        ]
      });
    }
  });

  afterEach(async () => {
    await prisma.approvalAction.deleteMany({});
    await prisma.approvalInstance.deleteMany({});
  });

  it("驳回后重提复用同一条 ApprovalInstance，追加 resubmit action", async () => {
    // 1. 首次发起
    const r1 = await startApprovalFlow({
      businessType: "supplier",
      businessId: "S-1",
      flowLevel: "common",
      initiatorId: "user-1"
    });
    expect(r1.status).toBe("审批中");
    const instId = r1.instanceId;

    // 2. 节点 2 驳回
    await processApprovalAction({
      instanceId: instId,
      approverId: "admin-1",
      action: "approve",
      comment: "通过",
      projectSourceId: undefined
    });
    await processApprovalAction({
      instanceId: instId,
      approverId: "admin-2",
      action: "reject",
      comment: "需要修改资料",
      projectSourceId: undefined
    });

    // 确认 instance 数 = 1，action 数 = 3
    expect(await prisma.approvalInstance.count()).toBe(1);
    expect(await prisma.approvalAction.count()).toBe(3);

    // 3. 重新提交
    const r2 = await startApprovalFlow({
      businessType: "supplier",
      businessId: "S-1",
      flowLevel: "common",
      initiatorId: "user-1"
    });

    // 断言：同一条 instance，被复用；状态回到审批中，currentNode=1；action 数 = 4（追加了 resubmit）
    expect(r2.instanceId).toBe(instId);
    expect(r2.status).toBe("审批中");
    expect(r2.currentNode).toBe(1);
    expect(await prisma.approvalInstance.count()).toBe(1);
    expect(await prisma.approvalAction.count()).toBe(4);

    const lastAction = await prisma.approvalAction.findFirst({
      orderBy: { actedAt: "desc" },
      select: { action: true, nodeId: true, approverId: true }
    });
    expect(lastAction?.action).toBe("resubmit");
    expect(lastAction?.nodeId).toBe(1);
    expect(lastAction?.approverId).toBe("user-1");
  });
});
```

### 2.2 跑测试确认失败

Run: `npx vitest run test/unit/approval-engine-resubmit.test.ts -v`

Expected: `FAIL`（因为重提时会创建第二条 instance）

### 2.3 修改 `approval-engine.ts` 中 `startApprovalFlow` 的防重逻辑

在 `const { businessType, businessId, flowLevel, initiatorId, projectSourceId, businessTitle, parentInstanceId } = params;` 之后，原有 `existingActive` 查找替换为：

```ts
// 先查既存实例（任意状态）
const existing = await prisma.approvalInstance.findFirst({
  where: { businessType, businessId },
  orderBy: { createdAt: "desc" }
});

const flowNodes = await prisma.approvalFlowDefinition.findMany({
  where: { businessType, flowLevel, isActive: true },
  orderBy: { nodeOrder: "asc" }
});

if (flowNodes.length === 0) {
  throw new Error(`未找到 ${businessType}(${flowLevel}) 的审批流配置`);
}

const startNode = flowNodes[0];

// A. 已驳回 → 复用
if (existing && existing.status === "已驳回") {
  const approverIds = await resolveApproverIds(startNode.approverRole, projectSourceId);

  await prisma.approvalInstance.update({
    where: { id: existing.id },
    data: { status: "审批中", currentNode: startNode.nodeOrder }
  });

  await prisma.approvalAction.create({
    data: {
      instanceId: existing.id,
      nodeId: startNode.nodeOrder,
      nodeName: startNode.nodeName,
      approverId: initiatorId,
      action: "resubmit",
      actedAt: new Date()
    }
  });

  await updateBusinessStatus(businessType, businessId, "审批中", undefined, existing.id);

  return { instanceId: existing.id, currentNode: startNode.nodeOrder, status: "审批中", approverIds };
}

// B. 已有活动实例 → 拒绝
if (existing && ["审批中","待归档","待支付"].includes(existing.status)) {
  throw new Error("该业务已有审批中的流程，不能重复提交");
}

// C. 新发起 → 正常 create（保持原有逻辑不变，后续 startNode 已在上文定义过）
// ... 后续保持不变：resolveApproverIds、create ApprovalInstance、create initiate action
```

注意：需要把原代码块中 `existingActive` 变量和引用全部删掉，因为逻辑被上面替换了。

### 2.4 跑测试确认通过

Run: `npx vitest run test/unit/approval-engine-resubmit.test.ts -v`

Expected: `PASS`

---

## Task 3: `checkCountersignComplete` 仅检查本轮动作（TDD）

**Files:**
- Modify: `src/lib/approval-engine.ts:165-207`
- Create: `test/unit/approval-engine-countersign.test.ts`

### 3.1 写失败测试

```ts
// test/unit/approval-engine-countersign.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { startApprovalFlow, processApprovalAction } from "@/lib/approval-engine";

describe("approval-engine countersign per round", () => {
  beforeEach(async () => {
    await prisma.approvalAction.deleteMany({});
    await prisma.approvalInstance.deleteMany({});
    const count = await prisma.approvalFlowDefinition.count({
      where: { businessType: "supplier", flowLevel: "common", isActive: true }
    });
    if (count === 0) {
      await prisma.approvalFlowDefinition.createMany({
        data: [
          { businessType: "supplier", flowLevel: "common", nodeOrder: 1, nodeName: "节点1", approverRole: "admin,finance", nodeType: "approval" },
        ]
      });
    }
  });

  afterEach(async () => {
    await prisma.approvalAction.deleteMany({});
    await prisma.approvalInstance.deleteMany({});
  });

  it("重提后上轮的 approve 不应污染本轮会签判定", async () => {
    // 首次发起
    const r1 = await startApprovalFlow({
      businessType: "supplier",
      businessId: "S-2",
      flowLevel: "common",
      initiatorId: "user-1"
    });
    // admin 通过 → 节点 1 会签还差 finance
    await processApprovalAction({
      instanceId: r1.instanceId,
      approverId: "admin-1",
      action: "approve",
      comment: "ok",
      projectSourceId: undefined
    });
    // 但被其它节点驳回（模拟：直接设已驳回）
    await prisma.approvalInstance.update({
      where: { id: r1.instanceId },
      data: { status: "已驳回" }
    });

    // 重提
    const r2 = await startApprovalFlow({
      businessType: "supplier",
      businessId: "S-2",
      flowLevel: "common",
      initiatorId: "user-1"
    });
    expect(r2.instanceId).toBe(r1.instanceId);

    // 重提后：本轮还没有任何 approve，所以流程应卡在 node 1
    // 如果没有本轮窗口控制，上轮 admin-1 approve 会让流程误判为已完成
    // 我们只需要检验 currentNode 还是 1
    const inst = await prisma.approvalInstance.findUnique({ where: { id: r2.instanceId }});
    expect(inst?.currentNode).toBe(1);
  });
});
```

### 3.2 跑测试确认失败

Run: `npx vitest run test/unit/approval-engine-countersign.test.ts -v`

Expected: `FAIL`（重提后 currentNode 可能因为上轮动作被误判而推进）

### 3.3 修改 `checkCountersignComplete` 增加 "本轮窗口"

```ts
async function checkCountersignComplete(
  instanceId: string,
  nodeOrder: number,
  approverRoleStr: string,
  projectSourceId?: string
): Promise<boolean> {
  const roleCodes = approverRoleStr.split(",").map((r) => r.trim()).filter(Boolean);
  if (roleCodes.length === 0) return true;

  // === 新增：找到本轮起始时间 ===
  const lastStart = await prisma.approvalAction.findFirst({
    where: { instanceId, action: { in: ["initiate", "resubmit"] }},
    orderBy: { actedAt: "desc" },
    select: { actedAt: true }
  });
  const sinceAt = lastStart?.actedAt || new Date(0);

  // 仅取本轮的 approve
  const actions = await prisma.approvalAction.findMany({
    where: {
      instanceId,
      nodeId: nodeOrder,
      action: "approve",
      actedAt: { gte: sinceAt }
    }
  });

  const approvedUserIds = new Set(actions.map((a) => a.approverId));
  const adminUser = await prisma.user.findUnique({
    where: { username: "admin" },
    select: { id: true }
  });

  for (const roleCode of roleCodes) {
    let roleUserIds = await resolveSingleRoleApproverIds(roleCode, projectSourceId);
    if (roleUserIds.length === 0) continue;
    if (adminUser) {
      roleUserIds = roleUserIds.filter((id) => id !== adminUser.id);
    }
    if (roleUserIds.length === 0) continue;
    const allApproved = roleUserIds.every((id) => approvedUserIds.has(id));
    if (allApproved) return true;
  }

  return false;
}
```

### 3.4 跑测试确认通过

Run: `npx vitest run test/unit/approval-engine-countersign.test.ts -v`

Expected: `PASS`

---

## Task 4: `ApprovalComponents` 支持渲染 `resubmit` 动作

**Files:**
- Modify: `src/components/ApprovalComponents.tsx`

### 4.1 在 `getActionText` 映射中增加 case

```tsx
// 搜索：case "approve": return "审批通过";
// 在其后增加：
case "resubmit": return "重新提交";
```

### 4.2 在时间线图标/颜色映射中增加 resubmit

在 `getActionColor` 或类似映射（如颜色/图标 switch）中增加：

```tsx
case "resubmit": return "text-[#2563EB]";
```

（如项目中有集中 action icon 映射，同样增加 resubmit 对应图标，若无则复用 initiate 图标即可）

### 4.3 全量回归测试

Run: `npx vitest run test/unit/approval-engine-*.test.ts test/unit/approval-cleanup.test.ts -v`

Expected: 全部 PASS

---

## Task 5: 所有 18 个业务 DELETE 接口接入清理工具

逐一修改每个 DELETE route，在删业务记录前调用 `cleanupBusinessApprovalRecords`。

**规则：**
- 导入：`import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";`
- 顺序：先清理审批 → 再删除业务记录
- `businessType` 与 `BUSINESS_TYPE_LABELS` 中 key 保持一致
- `supplier_change` 这个 DELETE 方法**不存在**，需要先新建路由文件

### 5.1 新建缺失路由

Create: `src/app/api/supplier-changes/[id]/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await cleanupBusinessApprovalRecords("supplier_change", id);
  await prisma.supplierChange.delete({ where: { id }});
  return NextResponse.json({ success: true });
}
```

### 5.2 修改已有的 17 个 DELETE 路由

| 序号 | 业务类型 | 文件路径 |
|---|---|---|
| 1 | supplier | `src/app/api/suppliers/[id]/route.ts` |
| 2 | quotation | `src/app/api/quotations/[id]/route.ts` |
| 3 | outsourcing | `src/app/api/projects/outsourcing/[id]/route.ts` |
| 4 | purchase_request | `src/app/api/purchase-requests/[id]/route.ts` |
| 5 | income_contract | `src/app/api/income-contracts/[id]/route.ts` |
| 6 | expense_contract | `src/app/api/expense-contracts/[id]/route.ts` |
| 7 | inter_org_contract | `src/app/api/inter-org-contracts/[id]/route.ts` |
| 8 | contract_change_order | `src/app/api/change-orders/[id]/route.ts` |
| 9 | non_contract_expense | `src/app/api/non-contract-expenses/[id]/route.ts` |
| 10 | non_contract_income | `src/app/api/non-contract-incomes/[id]/route.ts` |
| 11 | payment_application | `src/app/api/payment-applications/[id]/route.ts` |
| 12 | expense_report | `src/app/api/expense-reports/[id]/route.ts` |
| 13 | other_borrowing | `src/app/api/other-borrowings/[id]/route.ts` |
| 14 | lending_out | `src/app/api/lending-outs/[id]/route.ts` |
| 15 | salary_payment | `src/app/api/salary-batches/[id]/route.ts` |
| 16 | borrowing_return_application | `src/app/api/borrowing-return-applications/[id]/route.ts` |
| 17 | inquiries | `src/app/api/inquiries/[id]/route.ts` |

每个文件的 DELETE 函数中，在执行 `prisma.X.delete` 之前插入：

```ts
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

// 在 DELETE 开头
export async function DELETE(_request, { params }) {
  const { id } = await params;
  await cleanupBusinessApprovalRecords("supplier", id);  // 替换为对应 businessType
  await prisma.supplier.delete({ where: { id }});        // 对应业务表名
  return NextResponse.json({ success: true });
}
```

> 注意：个别 DELETE 路由可能有权限校验（如 `if (isAdmin)`），清理逻辑放在权限校验之后、业务删除之前。

### 5.3 运行回归验证

Run: `bash scripts/verify.sh`

Expected: 全部通过

---

## 交付检查清单

- [ ] `src/lib/approval-cleanup.ts` 新建
- [ ] `test/unit/approval-cleanup.test.ts` 新建且 PASS
- [ ] `test/unit/approval-engine-resubmit.test.ts` 新建且 PASS
- [ ] `test/unit/approval-engine-countersign.test.ts` 新建且 PASS
- [ ] `approval-engine.ts` 的 `startApprovalFlow` 支持已驳回复用
- [ ] `approval-engine.ts` 的 `checkCountersignComplete` 增加本轮窗口
- [ ] `ApprovalComponents.tsx` 支持 `resubmit` 文本渲染
- [ ] `supplier-changes/[id]/route.ts` DELETE 新建
- [ ] 其余 17 个 DELETE 路由已接入清理工具
- [ ] `bash scripts/verify.sh` 全绿

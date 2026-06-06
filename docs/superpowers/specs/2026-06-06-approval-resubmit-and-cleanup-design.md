# 审批实例复用与业务删除级联清理 设计

**日期：** 2026-06-06
**模块：** 审批引擎（`src/lib/approval-engine.ts`）+ 全业务模块 DELETE 接口
**类型：** 行为修复 + 数据生命周期管理

---

## 一、背景与问题

### 现状

`startApprovalFlow` 中的防重复仅拦截「审批中/待归档」状态：

```ts
const existingActive = await prisma.approvalInstance.findFirst({
  where: { businessType, businessId, status: { in: ["审批中","待归档"] }}
});
if (existingActive) throw new Error("已有审批中的流程");
```

「已驳回」状态不在拦截范围内，业务方重新提交时会**新建一条 ApprovalInstance**。

### 表现

- 同一业务（如供应商变更）在审批页"已发起" tab 中会出现 2 条记录
- 历史审批轨迹被人为切分，无法在同一时间线上看到「提交 → 驳回 → 重新提交 → 通过」的完整链路

### 业务诉求

1. 同一业务始终对应**唯一一条** `ApprovalInstance`
2. 所有节点状态变化、所有会签人的审批意见，全部累计在同一条 instance 的 `ApprovalAction` 时间线上
3. 业务被删除时，相关的审批实例、审批动作、通知应当**全部物理删除**（含历史）

---

## 二、设计目标

1. 同一 `(businessType, businessId)` 在任意时刻**仅存在一条** `ApprovalInstance`
2. 「已驳回 → 重新提交」复用同一条 instance，状态回到「审批中」，currentNode 重置到首节点
3. 所有节点（含多角色会签）的每一次审批动作都按时间序记入 `ApprovalAction`，时间线完整可见
4. 业务 DELETE 接口自动级联清理审批实例、动作、通知
5. 全部 18 种业务类型统一受益，无需逐个修改业务逻辑

---

## 三、数据模型（无 Schema 变更）

| 表 | 字段 | 说明 |
|---|---|---|
| `ApprovalInstance` | `id, businessType, businessId, status, currentNode, ...` | 唯一性由代码层保证 |
| `ApprovalAction` | `id, instanceId, nodeId, nodeName, approverId, action, comment, actedAt, signatureUrl` | 所有动作按时间累计 |
| `Notification` | `id, userId, relatedId, type, ...` | `relatedId` 可能指向 instance.id 或 business.id |

### action 取值扩展

| action | 含义 |
|---|---|
| `initiate` | 首次发起（不渲染为审批节点，仅记录） |
| `approve` | 通过 |
| `reject` | 驳回 |
| `archive` | 归档 |
| `payment` | 支付 |
| **`resubmit`**（新增） | 驳回后重新提交，currentNode 重置为首节点 |

---

## 四、核心改动

### 4.1 `src/lib/approval-engine.ts` — `startApprovalFlow`

新逻辑：

```ts
// 查询既存实例（任意状态）
const existing = await prisma.approvalInstance.findFirst({
  where: { businessType, businessId },
  orderBy: { createdAt: "desc" }
});

const flowNodes = await prisma.approvalFlowDefinition.findMany({
  where: { businessType, flowLevel, isActive: true },
  orderBy: { nodeOrder: "asc" }
});
const startNode = flowNodes[0];

// 场景 A：存在已驳回实例 → 复用
if (existing && existing.status === "已驳回") {
  const approverIds = await resolveApproverIds(startNode.approverRole, projectSourceId);

  await prisma.approvalInstance.update({
    where: { id: existing.id },
    data: { status: "审批中", currentNode: startNode.nodeOrder }
  });

  // 追加 resubmit action，不删除任何历史 action
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

// 场景 B：存在活动实例 → 拒绝重复提交
if (existing && ["审批中","待归档","待支付"].includes(existing.status)) {
  throw new Error("该业务已有审批中的流程，不能重复提交");
}

// 场景 C：首次提交（existing 为 null 或 已批准/已生效/已归档） → 正常 create
// ... 现有逻辑保持不变
```

### 4.2 `checkCountersignComplete` 仅检查本轮

会签判定需要排除上一轮（resubmit 之前）的 approve 动作，否则上一轮的会签状态会污染本轮。

```ts
async function checkCountersignComplete(instanceId, nodeOrder, approverRoleStr, projectSourceId) {
  // 找到该实例最后一个 initiate 或 resubmit 动作的时间
  const lastStart = await prisma.approvalAction.findFirst({
    where: { instanceId, action: { in: ["initiate", "resubmit"] }},
    orderBy: { actedAt: "desc" },
    select: { actedAt: true }
  });
  const sinceAt = lastStart?.actedAt || new Date(0);

  // 仅取本轮（lastStart 之后）的 approve 动作
  const actions = await prisma.approvalAction.findMany({
    where: {
      instanceId,
      nodeId: nodeOrder,
      action: "approve",
      actedAt: { gte: sinceAt }
    }
  });
  // ... 后续会签判定逻辑保持不变
}
```

### 4.3 业务删除级联清理 — 新建 `src/lib/approval-cleanup.ts`

```ts
import prisma from "./prisma";

/**
 * 清理某个业务相关的全部审批与通知记录（物理删除，含历史）
 * @param businessType 业务类型，如 "supplier_change"
 * @param businessId 业务 ID
 */
export async function cleanupBusinessApprovalRecords(
  businessType: string,
  businessId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. 查出全部相关 instance
    const instances = await tx.approvalInstance.findMany({
      where: { businessType, businessId },
      select: { id: true }
    });
    const instanceIds = instances.map((i) => i.id);

    if (instanceIds.length > 0) {
      // 2. 删除全部 action（如未配置级联）
      await tx.approvalAction.deleteMany({
        where: { instanceId: { in: instanceIds }}
      });

      // 3. 删除以 instance.id 为 relatedId 的通知
      await tx.notification.deleteMany({
        where: { relatedId: { in: instanceIds }}
      });

      // 4. 删除 instance
      await tx.approvalInstance.deleteMany({
        where: { id: { in: instanceIds }}
      });
    }

    // 5. 删除以 business.id 为 relatedId 的通知（兜底）
    await tx.notification.deleteMany({
      where: { relatedId: businessId }
    });
  });
}
```

### 4.4 业务 DELETE 接口接入清理

涉及接口（按业务模块盘点）：

| 业务类型 | 接口 | 备注 |
|---|---|---|
| supplier | `/api/suppliers/[id]` | DELETE |
| supplier_change | `/api/supplier-changes/[id]` | **新增 DELETE 方法** |
| quotation | `/api/quotations/[id]` | DELETE |
| outsourcing | `/api/projects/outsourcing/[id]` | DELETE |
| purchase_request | `/api/purchase-requests/[id]` | DELETE |
| delivery_receipt | `/api/delivery-receipts/[id]` | DELETE |
| income_contract | `/api/income-contracts/[id]` | DELETE |
| expense_contract | `/api/expense-contracts/[id]` | DELETE |
| inter_org_contract | `/api/inter-org-contracts/[id]` | DELETE |
| contract_change_order | `/api/change-orders/[id]` | DELETE |
| non_contract_expense | `/api/non-contract-expenses/[id]` | DELETE |
| non_contract_income | `/api/non-contract-incomes/[id]` | DELETE |
| payment_application | `/api/payment-applications/[id]` | DELETE |
| expense_report | `/api/expense-reports/[id]` | DELETE |
| other_borrowing | `/api/other-borrowings/[id]` | DELETE |
| lending_out | `/api/lending-outs/[id]` | DELETE |
| salary_payment | `/api/salary-batches/[id]` | DELETE |
| borrowing_return_application | `/api/borrowing-return-applications/[id]` | DELETE |
| inquiries | `/api/inquiries/[id]` | DELETE |

每个 DELETE handler 在删除业务记录之前调用一次：

```ts
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

export async function DELETE(_req, { params }) {
  const { id } = await params;
  await cleanupBusinessApprovalRecords("supplier_change", id);
  await prisma.supplierChange.delete({ where: { id }});
  return NextResponse.json({ success: true });
}
```

### 4.5 时间线展示 — `src/components/ApprovalComponents.tsx`

`ApprovalTimeline` 已按 actedAt 升序展示全部 action。本设计新增 `resubmit` 动作类型，需在 `getActionText` 等处增加：

```ts
case "resubmit": return "重新提交";
case "resubmit": return "text-[#2563EB]";
```

时间线已支持同节点多条 action 堆叠展示，无需额外结构改动。

---

## 五、影响面

- **正向：** 全部 18 种业务类型自动受益；前端列表无需去重；同一业务的审批历史完整可查
- **风险：** 旧版本前端若依赖"已驳回新建实例"行为可能出错——但盘点后未发现此类依赖
- **会签语义：** 修改 `checkCountersignComplete` 后，同节点同审批人在不同轮次的判定独立；同一轮中的判定逻辑不变

---

## 六、测试

### 6.1 单元测试

`test/unit/approval-engine-resubmit.test.ts`：

1. 首次发起 → instance 数 = 1，action 数 = 1（initiate）
2. 节点 2 驳回 → instance 数 = 1（status=已驳回），action 数 = 3（initiate + approve + reject）
3. 重新提交 → instance 数 = 1（status=审批中，currentNode=1），action 数 = 4（追加 resubmit）
4. 重走全流程通过 → instance 数 = 1（status=已批准），action 数 = 6（追加 2 个 approve）

`test/unit/approval-engine-multi-role-countersign.test.ts`：

1. 一节点配置两个角色，每角色 2 人，全部 approve 后流程推进
2. 重提后，本轮会签判定不受上轮 approve 影响

### 6.2 删除清理测试

`test/unit/approval-cleanup.test.ts`：

1. 创建业务 + 发起审批 + 通过若干节点
2. 调用 `cleanupBusinessApprovalRecords` 后：相关 instance/action/notification 全部为 0

### 6.3 回归

- `bash scripts/verify.sh`
- `npx vitest run test/unit/`

---

## 七、不在本次范围

- 历史数据迁移（测试期不需要）
- "审批人选择回退到哪个节点"（领导驳回时只能整体回到首节点）
- 审批流程定义本身的可视化编辑器

---

## 八、验收清单

- [ ] 供应商变更：发起 → 驳回 → 重提，审批页"已发起" tab 只有 1 条记录
- [ ] 合同变更：同上
- [ ] 任一业务的审批详情时间线包含完整 `initiate → approve → reject → resubmit → approve...` 序列
- [ ] 多角色会签节点：所有会签人的 approve 都在时间线
- [ ] 删除任一业务后：该业务相关的待办、通知、审批实例与动作全部消失

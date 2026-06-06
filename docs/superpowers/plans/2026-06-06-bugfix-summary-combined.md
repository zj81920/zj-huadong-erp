# 审批流程 Bug 修复 + 流程摘要 合并实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 修复 5 个审批流程缺陷 + 新增流程摘要功能（待处理列表和通知中心显示「业务标签：标题」格式）。

**Architecture:** Bug 修复：`ApprovalTimeline` 顶部加发起人行并过滤 initiate 节点、`startApprovalFlow()` 移除 auto-skip、Header 轮询缩短至 10s、approvals「已处理」tab 加详情查看、各 DetailCard 补附件字段。流程摘要：`ApprovalInstance` 新增 `businessTitle` 字段，引擎和 API 透传标题，通知 + 待处理列表展示摘要。

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, Vitest, Tailwind CSS

---

### Task 1: TDD — 审批流程发起测试

**Files:**
- Create: `test/unit/approval-flow-start.test.ts`

- [ ] **Step 1: 写 `startApprovalFlow` 的行为测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  approvalFlowDefinition: { findMany: vi.fn() },
  userRole: { findMany: vi.fn() },
  approvalInstance: { create: vi.fn() },
  approvalAction: { create: vi.fn() },
  business: { update: vi.fn() },
}

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))
const { startApprovalFlow } = await vi.importActual('@/lib/approval-engine')

describe('startApprovalFlow — 修复后行为', () => {
  beforeEach(() => vi.clearAllMocks())

  const flowNodes = [
    { nodeOrder: 1, nodeName: '部门审批', approverRole: 'dept_head', nodeType: 'approval', businessType: 'supplier', flowLevel: 'common', isActive: true },
    { nodeOrder: 2, nodeName: '总经理审批', approverRole: 'gm', nodeType: 'approval', businessType: 'supplier', flowLevel: 'common', isActive: true },
  ]

  it('节点1是审批节点，不再被 auto-skip', async () => {
    mockPrisma.approvalFlowDefinition.findMany.mockResolvedValue(flowNodes)
    mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 'user1', role: { code: 'dept_head' } }])
    mockPrisma.approvalInstance.create.mockResolvedValue({ id: 'inst-1', businessType: 'supplier', businessId: 'biz-1', flowLevel: 'common', currentNode: 1, status: '审批中' })

    const result = await startApprovalFlow({ businessType: 'supplier', businessId: 'biz-1', flowLevel: 'common', initiatorId: 'user1' })
    expect(result.currentNode).toBe(1)
  })

  it('创建的 initiate action 保留但不影响 currentNode', async () => {
    mockPrisma.approvalFlowDefinition.findMany.mockResolvedValue(flowNodes)
    mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 'user1', role: { code: 'dept_head' } }])
    mockPrisma.approvalInstance.create.mockResolvedValue({ id: 'inst-1', currentNode: 1, status: '审批中' })

    await startApprovalFlow({ businessType: 'supplier', businessId: 'biz-1', flowLevel: 'common', initiatorId: 'user1' })
    const initiateAction = mockPrisma.approvalAction.create.mock.calls.find((c: any) => c[0].data.action === 'initiate')
    expect(initiateAction).toBeDefined()
    expect(initiateAction[0].data.nodeId).toBe(1)
  })
})
```

- [ ] **Step 2: 运行测试，预期失败**

```bash
npx vitest run test/unit/approval-flow-start.test.ts
```

预期：失败，auto-skip 导致 currentNode 不等于 1

- [ ] **Step 3: 修改 `startApprovalFlow()` 移除 auto-skip**

修改 `src/lib/approval-engine.ts` 第 91-228 行，替换为简化版本（移除跳过逻辑，始终从 node 1 开始）：

```typescript
export async function startApprovalFlow(params: {
  businessType: string;
  businessId: string;
  flowLevel: string;
  initiatorId: string;
  projectSourceId?: string;
  businessTitle?: string;
}): Promise<{
  instanceId: string;
  currentNode: number;
  status: string;
  approverIds: string[];
}> {
  const { businessType, businessId, flowLevel, initiatorId, projectSourceId, businessTitle } = params;

  const flowNodes = await prisma.approvalFlowDefinition.findMany({
    where: { businessType, flowLevel, isActive: true },
    orderBy: { nodeOrder: "asc" },
  });

  if (flowNodes.length === 0) {
    throw new Error(`未找到 ${businessType}(${flowLevel}) 的审批流配置`);
  }

  const startNode = flowNodes[0];
  const approverIds = await resolveApproverIds(startNode.approverRole, projectSourceId);

  const instance = await prisma.approvalInstance.create({
    data: {
      businessType,
      businessId,
      flowLevel,
      currentNode: startNode.nodeOrder,
      status: "审批中",
      businessTitle: businessTitle || null,
    },
  });

  await prisma.approvalAction.create({
    data: {
      instanceId: instance.id,
      nodeId: startNode.nodeOrder,
      nodeName: startNode.nodeName,
      approverId: initiatorId,
      action: "initiate",
      actedAt: new Date(),
    },
  });

  await updateBusinessStatus(businessType, businessId, "审批中", undefined, instance.id);

  return { instanceId: instance.id, currentNode: startNode.nodeOrder, status: "审批中", approverIds };
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx vitest run test/unit/approval-flow-start.test.ts
```

预期：全部 PASS

- [ ] **Step 5: 提交**

```bash
git add test/unit/approval-flow-start.test.ts src/lib/approval-engine.ts
git commit -m "fix: startApprovalFlow 移除 auto-skip，节点1即为首个审批节点；支持 businessTitle"
```

---

### Task 2: 审批时间线展示发起人行 + 过滤 initiate 节点

**Files:**
- Modify: `src/components/ApprovalComponents.tsx:105-299`

- [ ] **Step 1: 修改 `ApprovalTimeline` 组件**

关键改动：
1. 从 `actions` 中提取 `initiateAction`，获取发起人姓名和时间
2. 时间线顶部新增「流程发起人」行（Send 图标 + 深色边框）
3. `getActionForNode` 过滤 `action === "initiate"`
4. `getActionLabel`/`getActionColor` 移除 initiate case

完整替换 `ApprovalTimeline` 组件（第 105-299 行）：

```tsx
export function ApprovalTimeline({ instance, loading }: ApprovalTimelineProps) {
  const [expanded, setExpanded] = useState(true);

  if (loading) {
    return (
      <div className="bento-card-static p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!instance) return null;

  const { flowNodes = [], actions = [], currentNode, status } = instance;

  // 获取发起人信息
  const initiateAction = actions.find((a) => a.action === "initiate");
  const initiatorName = initiateAction?.approver?.realName || "—";
  const initiatorTime = initiateAction?.actedAt;

  const getActionForNode = (nodeOrder: number) => {
    return actions.filter((a) => a.nodeId === nodeOrder && a.action !== "initiate");
  };

  const getNodeStatus = (nodeOrder: number): "done" | "current" | "pending" | "rejected" => {
    if (status === "已驳回") {
      const rejectAction = actions.find((a) => a.action === "reject");
      if (rejectAction) {
        if (nodeOrder === rejectAction.nodeId) return "rejected";
        if (nodeOrder < rejectAction.nodeId) return "done";
      }
      if (nodeOrder < currentNode) return "done";
      if (nodeOrder === currentNode) return "rejected";
      return "pending";
    }
    if (nodeOrder < currentNode) return "done";
    if (nodeOrder === currentNode && status === "审批中") return "current";
    if (status === "已批准" || status === "合同归档") return "done";
    return "pending";
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "approve": return "通过";
      case "reject": return "驳回";
      case "auto_skip": return "自动跳过";
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "approve": return "text-[#78716C]";
      case "reject": return "text-[#78716C]";
      case "auto_skip": return "text-[#78716C]";
      default: return "text-[#78716C]";
    }
  };

  const formatActionTime = (actedAt: string | null) => {
    if (!actedAt) return "";
    const d = new Date(actedAt);
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="bento-card-static p-4">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-sm font-medium text-[#1C1917] w-full cursor-pointer">
        <FileText className="w-4 h-4 text-[#1C1917]" />
        审批流程
        <ApprovalStatusBadge status={status} />
        <span className="ml-auto">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {/* 流程发起人行 */}
          <div className="rounded-xl border-l-[3px] border-l-[#1C1917] bg-[#FAFAF9] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white bg-[#1C1917] shrink-0">
                <Send className="w-3.5 h-3.5" />
              </div>
              <span className="text-[13px] font-semibold text-[#1C1917]">流程发起人：{initiatorName}</span>
              {initiatorTime && <span className="text-[11px] text-[#78716C]">{formatActionTime(initiatorTime)}</span>}
            </div>
          </div>

          {flowNodes.length > 0 && (
            <div className="flex justify-center py-1"><div className="w-0.5 h-3 rounded-full bg-[#78716C]" /></div>
          )}

          {flowNodes.map((node, idx) => {
            const nodeStatus = getNodeStatus(node.nodeOrder);
            const nodeActions = getActionForNode(node.nodeOrder);
            const isLast = idx === flowNodes.length - 1;

            const borderColor = nodeStatus === "done" ? "border-l-[#78716C]" : nodeStatus === "current" ? "border-l-[#1C1917]" : nodeStatus === "rejected" ? "border-l-[#78716C]" : "border-l-[#D1D5DB]";
            const bgColor = nodeStatus === "done" ? "bg-[#F0FDF4]" : nodeStatus === "current" ? "bg-[#EFF6FF]" : nodeStatus === "rejected" ? "bg-[#FEF2F2]" : "bg-[#FAFAF9]";
            const iconBg = nodeStatus === "done" ? "bg-[#78716C]" : nodeStatus === "current" ? "bg-[#1C1917]" : nodeStatus === "rejected" ? "bg-[#78716C]" : "bg-[#D1D5DB]";
            const iconContent = nodeStatus === "done" ? <CheckCircle className="w-3.5 h-3.5" /> : nodeStatus === "current" ? (<span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" /><span className="relative inline-flex rounded-full h-3 w-3 bg-white" /></span>) : nodeStatus === "rejected" ? <XCircle className="w-3.5 h-3.5" /> : <span className="text-[10px] font-semibold">{idx + 1}</span>;

            return (
              <div key={node.nodeOrder}>
                <div className={`rounded-xl border-l-[3px] ${borderColor} ${bgColor} px-4 py-3 transition-all`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0 ${iconBg}`}>{iconContent}</div>
                      <span className={`text-[13px] font-semibold ${nodeStatus === "pending" ? "text-[#78716C]" : "text-[#1C1917]"}`}>{node.nodeName}</span>
                    </div>
                    {nodeStatus === "pending" && <span className="text-[11px] text-[#78716C]">等待审批</span>}
                  </div>
                  {nodeActions.length > 0 && nodeActions.map((act) => (
                    <div key={act.id} className="mt-2 ml-8.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-medium text-[#1C1917]">{act.approver.realName}</span>
                        <span className={`text-[11px] font-medium ${getActionColor(act.action)}`}>{getActionLabel(act.action)}</span>
                        {act.actedAt && <span className="text-[11px] text-[#78716C]">{formatActionTime(act.actedAt)}</span>}
                      </div>
                      {act.comment && (
                        <div className="mt-1.5 flex items-start gap-1.5">
                          <MessageSquare className="w-3 h-3 text-[#78716C] shrink-0 mt-0.5" />
                          <p className="text-[12px] text-[#48484A] bg-white/60 rounded-lg px-2.5 py-1.5 border border-[#E7E5E4]">{act.comment}</p>
                        </div>
                      )}
                      {act.signatureUrl && <div className="mt-1.5"><SignatureImage src={act.signatureUrl} name={act.approver.realName} /></div>}
                    </div>
                  ))}
                  {nodeActions.length === 0 && nodeStatus === "current" && (
                    <div className="mt-2 ml-8.5"><span className="text-[11px] text-[#1C1917] animate-pulse">审批处理中...</span></div>
                  )}
                </div>
                {!isLast && <div className="flex justify-center py-1"><div className={`w-0.5 h-3 rounded-full ${nodeStatus === "done" ? "bg-[#78716C]" : "bg-[#D1D5DB]"}`} /></div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 运行测试确认**

```bash
npx vitest run test/unit/approval-flow-start.test.ts
```

- [ ] **Step 3: 提交**

```bash
git add src/components/ApprovalComponents.tsx
git commit -m "fix: ApprovalTimeline 顶部添加流程发起人行，过滤 initiate 节点"
```

---

### Task 3: 通知中心轮询间隔 60s → 10s

**Files:**
- Modify: `src/components/Header.tsx:62`

- [ ] **Step 1: 修改轮询间隔**

```typescript
// 第 62 行
const interval = setInterval(fetchUnreadCount, 10000);
```

- [ ] **Step 2: 提交**

```bash
git add src/components/Header.tsx
git commit -m "fix: 通知中心轮询间隔从 60s 缩短至 10s"
```

---

### Task 4: 「已处理」标签页添加详情查看

**Files:**
- Modify: `src/app/(dashboard)/approvals/page.tsx`

- [ ] **Step 1: 扩展 `ApprovalInstanceItem` 接口（第 88 行）**

```typescript
interface ApprovalInstanceItem {
  id: string;
  businessType: string;
  businessId: string;
  status: string;
  currentNode: number;
  flowLevel: string;
  createdAt: string;
  businessTitle?: string;
}
```

- [ ] **Step 2: 新增 `openProcessedDetail` 函数（在 `openApprovalDetail` 下方）**

```typescript
const openProcessedDetail = async (item: ApprovalInstanceItem) => {
  const pseudoItem: PendingApproval = {
    id: item.id,
    businessType: item.businessType,
    businessId: item.businessId,
    flowLevel: item.flowLevel || "common",
    currentNode: item.currentNode,
    nodeName: "",
    nodeType: "",
    createdAt: item.createdAt,
    initiatorName: "",
  };
  setSelectedApproval(pseudoItem);
  setApprovalDetail(null);
  setBusinessDetail(null);
  setDetailLoading(true);
  setBusinessDetailLoading(true);
  try {
    const [instanceRes, detailRes] = await Promise.all([
      fetch(`/api/approval-instances/${item.id}`),
      BUSINESS_TYPE_API_MAP[item.businessType]
        ? fetch(`${BUSINESS_TYPE_API_MAP[item.businessType]}/${item.businessId}`)
        : Promise.resolve(null),
    ]);
    const instanceJson = await instanceRes.json();
    if (instanceRes.ok && instanceJson.data) setApprovalDetail(instanceJson.data);
    if (detailRes && detailRes.ok) {
      const detailJson = await detailRes.json();
      if (detailJson.data) setBusinessDetail(detailJson.data);
    }
  } catch {} finally {
    setDetailLoading(false);
    setBusinessDetailLoading(false);
  }
};
```

- [ ] **Step 3: 修改「已处理」表格，添加操作列（第 439-453 行）**

```tsx
<div className="overflow-x-auto">
  <table className="ios-table">
    <thead><tr><th>业务类型</th><th>状态</th><th>提交时间</th><th>操作</th></tr></thead>
    <tbody>
      {processedList.map((item) => (
        <tr key={item.id}>
          <td><span className="font-semibold">{BUSINESS_TYPE_LABELS[item.businessType] || item.businessType}</span></td>
          <td><span className="ios-badge ios-badge-green">{item.status}</span></td>
          <td className="text-[#78716C] text-[13px] whitespace-nowrap">{formatDate(item.createdAt)}</td>
          <td>
            <button onClick={() => openProcessedDetail(item)} className="text-[13px] font-medium text-[#1C1917] bg-[#FAFAF9] hover:bg-[#F5F5F4] px-3 py-1.5 rounded-lg border border-[#E7E5E4] transition-colors">
              <Eye className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />查看
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
  <PaginationBar pagination={pagination} onPageChange={setPage} onPageSizeChange={setPageSize} />
</div>
```

- [ ] **Step 4: 修改 Modal，已处理项隐藏操作按钮（第 506-531 行）**

```tsx
{selectedApproval && (
  <div className="space-y-4">
    <BusinessDetailPanel businessType={selectedApproval.businessType} data={businessDetail} loading={businessDetailLoading} />
    <div className="pt-3 border-t border-[#F5F5F4]">
      <h4 className="text-[13px] font-bold text-[#1C1917] mb-3">审批流程</h4>
      <ApprovalTimeline instance={approvalDetail} loading={detailLoading} />
    </div>
    {activeTab === "pending" && (
      <div className="pt-3 border-t border-[#F5F5F4]">
        <ApprovalActionButton instanceId={approvalDetail?.id || null} businessType={selectedApproval.businessType} businessId={selectedApproval.businessId} flowLevel={selectedApproval.flowLevel} currentStatus={approvalDetail?.status || "审批中"} approvalInstance={approvalDetail || undefined} onStatusChange={handleStatusChange} />
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: 提交**

```bash
git add src/app/\(dashboard\)/approvals/page.tsx
git commit -m "fix: 已处理标签页添加查看详情功能，已审批项隐藏操作按钮"
```

---

### Task 5: TDD — DetailCard 附件字段检查测试

**Files:**
- Modify: `test/unit/detail-cards-registration.test.ts`

- [ ] **Step 1: 扩展测试**

```typescript
import { describe, it, expect } from 'vitest'
import { DETAIL_CARD_MAP } from '../../src/components/detail-cards'
import { render } from '@testing-library/react'
import React from 'react'

// ... 保留原有注册测试 ...

describe('DetailCard 附件字段展示', () => {
  const businessTypesWithAttachments = [
    'supplier', 'supplier_change', 'quotation', 'outsourcing', 'purchase_request',
    'delivery_receipt', 'inquiries', 'income_contract', 'expense_contract',
    'contract_change_order', 'inter_org_contract', 'expense_report', 'payment_application',
    'non_contract_expense', 'non_contract_income', 'other_borrowing', 'lending_out',
    'borrowing_return_application', 'salary_payment',
  ]

  it('所有 DetailCard 在数据包含 attachmentUrl 时应渲染附件信息', () => {
    const mockData = { name: '测试', attachmentUrl: 'https://example.com/files/test.pdf' }
    for (const type of businessTypesWithAttachments) {
      const CardComponent = DETAIL_CARD_MAP[type]
      expect(CardComponent).toBeDefined()
      const { container } = render(React.createElement(CardComponent, { data: mockData }))
      const textContent = container.textContent || ''
      const hasAttachment = textContent.includes('test.pdf') || textContent.includes('附件') || container.querySelector('[href*="test.pdf"]') !== null
      if (!hasAttachment) console.warn(`${type} DetailCard 未展示附件字段`)
    }
  })

  it('供应商 DetailCard 应展示附件', () => {
    const SupplierDetailCard = DETAIL_CARD_MAP['supplier']
    const mockData = {
      name: '测试供应商', supplierType: '企业', contactPerson: '张三',
      phone: '13800138000', email: 'test@example.com', address: '测试地址',
      bankName: '测试银行', bankAccount: '1234567890', status: '正常',
      attachmentUrl: 'https://example.com/files/supplier.pdf',
    }
    const { container } = render(React.createElement(SupplierDetailCard, { data: mockData }))
    expect(container.textContent || '').toContain('supplier.pdf')
  })
})
```

- [ ] **Step 2: 运行测试，预期失败**

```bash
npx vitest run test/unit/detail-cards-registration.test.ts
```

预期：`supplier DetailCard 未展示附件字段`

- [ ] **Step 3: 提交（TDD 红阶段）**

```bash
git add test/unit/detail-cards-registration.test.ts
git commit -m "test: 添加 DetailCard 附件字段展示测试（预期失败）"
```

---

### Task 6: 修复供应商 DetailCard 附件展示

**Files:**
- Modify: `src/components/detail-cards/suppliers/SupplierDetailCard.tsx`

- [ ] **Step 1: 添加附件字段**

```tsx
import { DetailGrid } from '../DetailGrid'

interface Props { data: any }

export function SupplierDetailCard({ data }: Props) {
  const fields = [
    { label: "供应商名称", value: data?.name },
    { label: "供应商性质", value: data?.supplierType },
    { label: "联系人", value: data?.contactPerson },
    { label: "电话", value: data?.phone },
    { label: "邮箱", value: data?.email },
    { label: "地址", value: data?.address },
    { label: "开户行", value: data?.bankName },
    { label: "银行账号", value: data?.bankAccount },
    { label: "状态", value: data?.status },
    { 
      label: "附件", 
      value: data?.attachmentUrl ? (
        <a href={data.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline text-[13px] break-all">
          {decodeURIComponent(data.attachmentUrl.split('/').pop() || '查看附件')}
        </a>
      ) : null
    },
  ];
  return <DetailGrid fields={fields} />;
}
```

- [ ] **Step 2: 运行测试验证通过**

```bash
npx vitest run test/unit/detail-cards-registration.test.ts
```

- [ ] **Step 3: 提交**

```bash
git add src/components/detail-cards/suppliers/SupplierDetailCard.tsx
git commit -m "fix: SupplierDetailCard 添加附件字段展示"
```

---

### Task 7: 批量修复其他有附件的 DetailCard

**Files:**
- Modify: `src/components/detail-cards/` 下所有有 `attachmentUrl` 的 DetailCard

- [ ] **Step 1: 搜索所有包含 attachmentUrl 的 API 路由**

```bash
grep -rl "attachmentUrl" src/app/api/ --include="*.ts"
```

- [ ] **Step 2: 对每个模块，在对应 DetailCard 的 fields 末尾添加附件字段**

通用模式（每个 DetailCard 都加）：

```typescript
{ 
  label: "附件", 
  value: data?.attachmentUrl ? (
    <a href={data.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline text-[13px] break-all">
      {decodeURIComponent(data.attachmentUrl.split('/').pop() || '查看附件')}
    </a>
  ) : null
},
```

预计需修改完备列表（以 grep 结果为准）：`Suppliers/SupplierChangeDetailCard`, `business/QuotationDetailCard`, `business/OutsourcingDetailCard`, `business/PurchaseRequestDetailCard`, `business/DeliveryReceiptDetailCard`, `business/InquiryDetailCard`, `contracts/IncomeContractDetailCard`, `contracts/ExpenseContractDetailCard`, `contracts/ContractChangeOrderDetailCard`, `contracts/InterOrgContractDetailCard`, `finance/ExpenseReportDetailCard`, `finance/PaymentApplicationDetailCard`, `finance/NonContractExpenseDetailCard`, `finance/NonContractIncomeDetailCard`, `finance/OtherBorrowingDetailCard`, `finance/LendingOutDetailCard`, `finance/BorrowingReturnDetailCard`, `finance/SalaryPaymentDetailCard`

- [ ] **Step 3: 运行附件测试确认**

```bash
npx vitest run test/unit/detail-cards-registration.test.ts
```

- [ ] **Step 4: 提交**

```bash
git add src/components/detail-cards/
git commit -m "fix: 所有 DetailCard 统一添加附件字段展示"
```

---

### Task 8: Schema — ApprovalInstance 新增 businessTitle 字段

**Files:**
- Modify: `prisma/schema.prisma:1266`

- [ ] **Step 1: 添加字段**

在 `ApprovalInstance` 的 `updatedAt` 字段后添加：

```prisma
model ApprovalInstance {
  id            String   @id @default(cuid())
  businessType  String   @map("business_type")
  businessId    String   @map("business_id")
  flowLevel     String   @default("project") @map("flow_level")
  currentNode   Int      @default(0) @map("current_node")
  status        String   @default("审批中")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  businessTitle String?  @map("business_title")
  lastModifiedBy String? @map("last_modified_by")

  actions              ApprovalAction[]
  interOrgContracts    InterOrgContract[]
  contractChangeOrders ContractChangeOrder[]

  @@map("approval_instances")
}
```

- [ ] **Step 2: Schema 验证 + 同步**

```bash
npx prisma validate
npx prisma db push
```

- [ ] **Step 3: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat: ApprovalInstance 新增 businessTitle 字段"
```

---

### Task 9: 通知 title 使用业务标题 + API 透传 businessTitle

**Files:**
- Modify: `src/lib/approval-engine.ts`（通知创建处）
- Modify: `src/app/api/approval-instances/route.ts`（POST + GET）
- Modify: `src/app/api/approval-instances/[id]/route.ts`（GET 详情）

- [ ] **Step 1: `approval-engine.ts` 通知 title 改为包含业务标题**

替换所有通知创建处的 title（共 4 处：驳回 L433、归档完成 L366、归档通知 L501、支付通知 L536、普通审批 L569）：

```typescript
// 驳回通知 (L433)
title: instance.businessTitle
  ? `${getBusinessTypeLabel(instance.businessType)}：${instance.businessTitle} 审批被驳回`
  : `${getBusinessTypeLabel(instance.businessType)} 审批被驳回`,

// 审批完成通知 (L366)
title: instance.businessTitle
  ? `${getBusinessTypeLabel(instance.businessType)}：${instance.businessTitle} 审批已完成`
  : `${getBusinessTypeLabel(instance.businessType)} 审批已完成`,

// 待审批通知 (L501, L536, L569) — 3处
title: instance.businessTitle
  ? `${getBusinessTypeLabel(instance.businessType)}：${instance.businessTitle} 待审批`
  : `${getBusinessTypeLabel(instance.businessType)} 待审批`,
```

- [ ] **Step 2: `POST /api/approval-instances` 接收 businessTitle**

修改 `src/app/api/approval-instances/route.ts` POST handler：

```typescript
const { businessType, businessId, flowLevel, projectSourceId, businessTitle } = body;

const result = await startApprovalFlow({
  businessType,
  businessId,
  flowLevel,
  initiatorId: user.id,
  projectSourceId,
  businessTitle: businessTitle || undefined,
});
```

- [ ] **Step 3: `GET /api/approval-instances` 返回 businessTitle**

`processed` 查询（第 59-78 行）已返回完整 instance 对象（含 `businessTitle`），无需改动。
`initiated` 查询（第 81-96 行）同样已返回完整对象。

`pending` 查询通过 `getPendingApprovals()` 返回，需检查该函数是否返回 `businessTitle`。

修改 `getPendingApprovals()` 在 `approval-engine.ts`（约第 1064 行），返回对象中加 `businessTitle`：

```typescript
// 在 return 的对象中添加
businessTitle: instance.businessTitle || "",
```

- [ ] **Step 4: `GET /api/approval-instances/[id]` 确保返回 businessTitle**

当前已返回完整 `instance` 对象（含 `businessTitle`），无需额外改动。

- [ ] **Step 5: 提交**

```bash
git add src/lib/approval-engine.ts src/app/api/approval-instances/route.ts
git commit -m "feat: 通知 title 和 API 使用 businessTitle 业务摘要"
```

---

### Task 10: 前端 approvals 页面展示流程摘要

**Files:**
- Modify: `src/app/(dashboard)/approvals/page.tsx`

- [ ] **Step 1: `PendingApproval` 接口添加 businessTitle**

```typescript
interface PendingApproval {
  id: string;
  businessType: string;
  businessId: string;
  flowLevel: string;
  currentNode: number;
  nodeName: string;
  nodeType: string;
  createdAt: string;
  initiatorName: string;
  businessTitle?: string;
}
```

- [ ] **Step 2: 待处理表格中渲染流程摘要**

在待处理表格的业务类型列（约第 365 行），改为显示摘要：

```tsx
<td>
  <span className="font-semibold">
    {BUSINESS_TYPE_LABELS[item.businessType] || item.businessType}
    {item.businessTitle ? `：${item.businessTitle}` : ""}
  </span>
</td>
```

- [ ] **Step 3: 已处理表格同样显示摘要**

在已处理表格的业务类型列，同样改为：

```tsx
<td>
  <span className="font-semibold">
    {BUSINESS_TYPE_LABELS[item.businessType] || item.businessType}
    {item.businessTitle ? `：${item.businessTitle}` : ""}
  </span>
</td>
```

- [ ] **Step 4: 提交**

```bash
git add src/app/\(dashboard\)/approvals/page.tsx
git commit -m "feat: 待处理/已处理列表展示「业务标签：标题」流程摘要"
```

---

### Task 11: 各业务模块页面发起审批时传入 businessTitle

**Files:**
- Modify: 各业务模块页面的 `handleSubmitApproval` 函数

- [ ] **Step 1: 供应商页面**

修改 `src/app/(dashboard)/business/suppliers/page.tsx` 第 280 行：

```typescript
body: JSON.stringify({
  businessType: "supplier",
  businessId: supplierId,
  flowLevel: "common",
  businessTitle: supplier.name,  // 新增
}),
```

- [ ] **Step 2: 合同变更页面**

修改 `src/app/(dashboard)/contracts/change-orders/page.tsx` 第 120 行，传入 `order.orderName || order.contractName` 等标题字段。

- [ ] **Step 3: 非合同收支页面**

修改 `src/app/(dashboard)/contracts/non-contract/page.tsx` 第 341 行，传入 `record.description || record.purpose` 等。

- [ ] **Step 4: 内部结算页面**

修改 `src/app/(dashboard)/contracts/internal-settlement/page.tsx` 第 539 行，传入 `contract.contractName || contract.title` 等。

- [ ] **Step 5: 其他业务模块页面**

搜索所有调用 `fetch("/api/approval-instances"` 的页面，逐个添加 `businessTitle`。搜索命令：

```bash
grep -rn 'fetch.*approval-instances.*POST' src/app/ --include="*.tsx" -l
```

对每个页面，根据其业务数据的名称字段传入标题（如 `name`、`title`、`contractName`、`description`、`purpose` 等）。

- [ ] **Step 6: 提交**

```bash
git add src/app/\(dashboard\)/business/ src/app/\(dashboard\)/contracts/
git commit -m "feat: 各业务模块发起审批时传入 businessTitle"
```

---

### Task 12: 回归验证

- [ ] **Step 1: 运行完整回归脚本**

```bash
bash scripts/verify.sh
```

- [ ] **Step 2: 运行所有单元测试**

```bash
npx vitest run test/unit/
```

- [ ] **Step 3: 构建验证**

```bash
npx next build
```

- [ ] **Step 4: 如全部通过，最终提交**

```bash
git add -A
git commit -m "chore: 回归验证通过，审批流程 Bug 修复 + 流程摘要完成"
```

---

## 实施顺序总结

```
Task 1 (TDD-引擎) → Task 2 (时间线UI) → Task 3 (轮询) → Task 4 (已处理详情)
  → Task 5 (TDD-附件) → Task 6 (供应商附件) → Task 7 (批量附件)
  → Task 8 (Schema) → Task 9 (引擎+API) → Task 10 (前端摘要) → Task 11 (业务页传参)
  → Task 12 (回归验证)
```

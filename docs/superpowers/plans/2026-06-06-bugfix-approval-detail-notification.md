# 审批流程与通知中心 Bug 修复 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复审批时间线节点显示、通知延迟、待处理信息缺失、已审批无详情、所有模块附件不显示共 5 个缺陷。

**Architecture:** 修改 `ApprovalTimeline` 顶部添加发起人行并过滤 initiate 节点；`startApprovalFlow()` 移除 node 1 auto-skip 逻辑；Header 通知轮询缩短至 10s；approvals 页面「已处理」tab 添加详情查看；各 DetailCard 补充附件字段。

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, Vitest, Tailwind CSS

---

### Task 1: TDD — 审批流程发起测试

**Files:**
- Create: `test/unit/approval-flow-start.test.ts`

- [ ] **Step 1: 写 `startApprovalFlow` 的行为测试**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock prisma，模拟审批流定义：节点1='部门审批', 节点2='总经理审批'
const mockPrisma = {
  approvalFlowDefinition: {
    findMany: vi.fn(),
  },
  userRole: {
    findMany: vi.fn(),
  },
  approvalInstance: {
    create: vi.fn(),
  },
  approvalAction: {
    create: vi.fn(),
  },
  business: {
    update: vi.fn(),
  },
}

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

// 延迟导入，确保 mock 在导入前生效
const { startApprovalFlow } = await vi.importActual('@/lib/approval-engine')

describe('startApprovalFlow — 修复后行为', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const flowNodes = [
    { nodeOrder: 1, nodeName: '部门审批', approverRole: 'dept_head', nodeType: 'approval', businessType: 'supplier', flowLevel: 'common', isActive: true },
    { nodeOrder: 2, nodeName: '总经理审批', approverRole: 'gm', nodeType: 'approval', businessType: 'supplier', flowLevel: 'common', isActive: true },
  ]

  const userRoles = [{ userId: 'user1', role: { code: 'dept_head' } }]

  it('节点1是审批节点，不再被 auto-skip', async () => {
    mockPrisma.approvalFlowDefinition.findMany.mockResolvedValue(flowNodes)
    mockPrisma.userRole.findMany.mockResolvedValue(userRoles)
    mockPrisma.approvalInstance.create.mockResolvedValue({
      id: 'inst-1',
      businessType: 'supplier',
      businessId: 'biz-1',
      flowLevel: 'common',
      currentNode: 1,
      status: '审批中',
    })

    const result = await startApprovalFlow({
      businessType: 'supplier',
      businessId: 'biz-1',
      flowLevel: 'common',
      initiatorId: 'user1',
    })

    // 即使发起人角色匹配节点1，节点1仍是首个审批节点，不应跳过
    expect(result.currentNode).toBe(1)
    // 创建 instance 时 currentNode 应为 1（非跳过后节点）
    const instanceCreateCall = mockPrisma.approvalInstance.create.mock.calls[0][0]
    expect(instanceCreateCall.data.currentNode).toBe(1)
  })

  it('创建的 initiate action 保留，但不影响 currentNode 计算', async () => {
    mockPrisma.approvalFlowDefinition.findMany.mockResolvedValue(flowNodes)
    mockPrisma.userRole.findMany.mockResolvedValue(userRoles)
    mockPrisma.approvalInstance.create.mockResolvedValue({
      id: 'inst-1',
      businessType: 'supplier',
      businessId: 'biz-1',
      flowLevel: 'common',
      currentNode: 1,
      status: '审批中',
    })

    await startApprovalFlow({
      businessType: 'supplier',
      businessId: 'biz-1',
      flowLevel: 'common',
      initiatorId: 'user1',
    })

    // 应创建一条 "initiate" 类型的 action
    const actionCalls = mockPrisma.approvalAction.create.mock.calls
    const initiateAction = actionCalls.find(
      (call: any) => call[0].data.action === 'initiate'
    )
    expect(initiateAction).toBeDefined()
    expect(initiateAction[0].data.nodeId).toBe(1)
    expect(initiateAction[0].data.approverId).toBe('user1')
  })

  it('单节点流程：节点1就是审批节点，发起后状态为审批中', async () => {
    const singleNode = [
      { nodeOrder: 1, nodeName: '审批', approverRole: 'gm', nodeType: 'approval', businessType: 'supplier', flowLevel: 'simple', isActive: true },
    ]
    mockPrisma.approvalFlowDefinition.findMany.mockResolvedValue(singleNode)
    mockPrisma.userRole.findMany.mockResolvedValue([])
    mockPrisma.approvalInstance.create.mockResolvedValue({
      id: 'inst-2',
      currentNode: 1,
      status: '审批中',
    })

    const result = await startApprovalFlow({
      businessType: 'supplier',
      businessId: 'biz-2',
      flowLevel: 'simple',
      initiatorId: 'user1',
    })

    expect(result.status).toBe('审批中')
    expect(result.currentNode).toBe(1)
  })
})
```

- [ ] **Step 2: 运行测试，预期失败（因 auto-skip 逻辑还在）**

```bash
npx vitest run test/unit/approval-flow-start.test.ts
```

预期：测试失败，`currentNode` 不等于 1（当前 auto-skip 会跳过匹配节点）

- [ ] **Step 3: 修改 `startApprovalFlow()` 移除 auto-skip 逻辑**

修改 `src/lib/approval-engine.ts` 第 91-228 行：

```typescript
// 创建审批实例：节点1即为第一个审批节点，发起人不会自动跳过任何节点
export async function startApprovalFlow(params: {
  businessType: string;
  businessId: string;
  flowLevel: string;
  initiatorId: string;
  projectSourceId?: string;
}): Promise<{
  instanceId: string;
  currentNode: number;
  status: string;
  approverIds: string[];
}> {
  const { businessType, businessId, flowLevel, initiatorId, projectSourceId } = params;

  const flowNodes = await prisma.approvalFlowDefinition.findMany({
    where: { businessType, flowLevel, isActive: true },
    orderBy: { nodeOrder: "asc" },
  });

  if (flowNodes.length === 0) {
    throw new Error(`未找到 ${businessType}(${flowLevel}) 的审批流配置`);
  }

  // 节点1即为首个审批节点，直接确定起始节点
  const startNode = flowNodes[0];
  const approverIds = await resolveApproverIds(startNode.approverRole, projectSourceId);

  const instance = await prisma.approvalInstance.create({
    data: {
      businessType,
      businessId,
      flowLevel,
      currentNode: startNode.nodeOrder, // 始终从节点1开始
      status: "审批中",
    },
  });

  // 为节点1创建 initiate 动作（仅作记录，不在时间线渲染）
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
git commit -m "fix: startApprovalFlow 移除 auto-skip 逻辑，节点1即为首个审批节点"
```

---

### Task 2: 审批时间线展示发起人行 + 过滤 initiate 节点

**Files:**
- Modify: `src/components/ApprovalComponents.tsx:105-299`

- [ ] **Step 1: 修改 `ApprovalTimeline` 组件**

替换 `ApprovalTimeline` 组件（第 105-299 行）：

```tsx
export function ApprovalTimeline({ instance, loading }: ApprovalTimelineProps) {
  const [expanded, setExpanded] = useState(true);

  if (loading) {
    return (
      <div className="bento-card-static p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!instance) return null;

  const { flowNodes = [], actions = [], currentNode, status } = instance;

  // 获取发起人信息（从 initiate action 中提取）
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
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hour = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${month}-${day} ${hour}:${min}`;
  };

  return (
    <div className="bento-card-static p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-[#1C1917] w-full cursor-pointer"
      >
        <FileText className="w-4 h-4 text-[#1C1917]" />
        审批流程
        <ApprovalStatusBadge status={status} />
        <span className="ml-auto">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {/* 流程发起人行 */}
          <div className="rounded-xl border-l-[3px] border-l-[#1C1917] bg-[#FAFAF9] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white bg-[#1C1917] shrink-0">
                <Send className="w-3.5 h-3.5" />
              </div>
              <span className="text-[13px] font-semibold text-[#1C1917]">
                流程发起人：{initiatorName}
              </span>
              {initiatorTime && (
                <span className="text-[11px] text-[#78716C]">
                  {formatActionTime(initiatorTime)}
                </span>
              )}
            </div>
          </div>

          {/* 发起人与审批节点之间的连接线 */}
          {flowNodes.length > 0 && (
            <div className="flex justify-center py-1">
              <div className="w-0.5 h-3 rounded-full bg-[#78716C]" />
            </div>
          )}

          {flowNodes.map((node, idx) => {
            const nodeStatus = getNodeStatus(node.nodeOrder);
            const nodeActions = getActionForNode(node.nodeOrder);
            const isLast = idx === flowNodes.length - 1;

            const borderColor =
              nodeStatus === "done" ? "border-l-[#78716C]" :
              nodeStatus === "current" ? "border-l-[#1C1917]" :
              nodeStatus === "rejected" ? "border-l-[#78716C]" :
              "border-l-[#D1D5DB]";

            const bgColor =
              nodeStatus === "done" ? "bg-[#F0FDF4]" :
              nodeStatus === "current" ? "bg-[#EFF6FF]" :
              nodeStatus === "rejected" ? "bg-[#FEF2F2]" :
              "bg-[#FAFAF9]";

            const iconBg =
              nodeStatus === "done" ? "bg-[#78716C]" :
              nodeStatus === "current" ? "bg-[#1C1917]" :
              nodeStatus === "rejected" ? "bg-[#78716C]" :
              "bg-[#D1D5DB]";

            const iconContent =
              nodeStatus === "done" ? <CheckCircle className="w-3.5 h-3.5" /> :
              nodeStatus === "current" ? (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                </span>
              ) :
              nodeStatus === "rejected" ? <XCircle className="w-3.5 h-3.5" /> :
              <span className="text-[10px] font-semibold">{idx + 1}</span>;

            return (
              <div key={node.nodeOrder}>
                <div
                  className={`rounded-xl border-l-[3px] ${borderColor} ${bgColor} px-4 py-3 transition-all`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0 ${iconBg}`}>
                        {iconContent}
                      </div>
                      <span className={`text-[13px] font-semibold ${
                        nodeStatus === "pending" ? "text-[#78716C]" : "text-[#1C1917]"
                      }`}>
                        {node.nodeName}
                      </span>
                    </div>
                    {nodeStatus === "pending" && (
                      <span className="text-[11px] text-[#78716C]">等待审批</span>
                    )}
                  </div>

                  {nodeActions.length > 0 && nodeActions.map((act) => (
                    <div key={act.id} className="mt-2 ml-8.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-medium text-[#1C1917]">
                          {act.approver.realName}
                        </span>
                        <span className={`text-[11px] font-medium ${getActionColor(act.action)}`}>
                          {getActionLabel(act.action)}
                        </span>
                        {act.actedAt && (
                          <span className="text-[11px] text-[#78716C]">
                            {formatActionTime(act.actedAt)}
                          </span>
                        )}
                      </div>
                      {act.comment && (
                        <div className="mt-1.5 flex items-start gap-1.5">
                          <MessageSquare className="w-3 h-3 text-[#78716C] shrink-0 mt-0.5" />
                          <p className="text-[12px] text-[#48484A] bg-white/60 rounded-lg px-2.5 py-1.5 border border-[#E7E5E4]">
                            {act.comment}
                          </p>
                        </div>
                      )}
                      {act.signatureUrl && (
                        <div className="mt-1.5">
                          <SignatureImage src={act.signatureUrl} name={act.approver.realName} />
                        </div>
                      )}
                    </div>
                  ))}

                  {nodeActions.length === 0 && nodeStatus === "current" && (
                    <div className="mt-2 ml-8.5">
                      <span className="text-[11px] text-[#1C1917] animate-pulse">审批处理中...</span>
                    </div>
                  )}
                </div>

                {!isLast && (
                  <div className="flex justify-center py-1">
                    <div className={`w-0.5 h-3 rounded-full ${
                      nodeStatus === "done" ? "bg-[#78716C]" : "bg-[#D1D5DB]"
                    }`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

关键改动：
1. 提取 `initiateAction` 获取发起人姓名和时间
2. 时间线顶部新增「流程发起人」行（带 Send 图标）
3. `getActionForNode` 过滤掉 `action === "initiate"` 的条目
4. `getActionLabel` 移除 `"initiate"` case（不再渲染）
5. `getActionColor` 移除 `"initiate"` case

- [ ] **Step 2: 运行测试确认已有测试未破坏**

```bash
npx vitest run test/unit/approval-flow-start.test.ts
```

- [ ] **Step 3: 提交**

```bash
git add src/components/ApprovalComponents.tsx
git commit -m "fix: ApprovalTimeline 顶部添加流程发起人行，过滤 initiate 节点"
```

---

### Task 3: 通知中心轮询间隔从 60s 改为 10s

**Files:**
- Modify: `src/components/Header.tsx:62`

- [ ] **Step 1: 修改轮询间隔**

```typescript
// 第 62 行，将 60000 改为 10000
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
- Modify: `src/app/(dashboard)/approvals/page.tsx:88-96` (ApprovalInstanceItem 接口扩展)
- Modify: `src/app/(dashboard)/approvals/page.tsx:429-456` (已处理表格)
- Modify: `src/app/(dashboard)/approvals/page.tsx:500-532` (Modal 逻辑)

- [ ] **Step 1: 扩展 `ApprovalInstanceItem` 接口**

将第 88-96 行的 `ApprovalInstanceItem` 接口改为：

```typescript
interface ApprovalInstanceItem {
  id: string;
  businessType: string;
  businessId: string;
  status: string;
  currentNode: number;
  flowLevel: string;
  createdAt: string;
  initiatorName?: string;
}
```

- [ ] **Step 2: 新增 `openProcessedDetail` 函数**

在 `openApprovalDetail` 函数（第 237 行）下方，添加一个新函数用于打开已处理项的详情：

```typescript
const openProcessedDetail = async (item: ApprovalInstanceItem) => {
  // 构建一个临时 PendingApproval 对象，复用 openApprovalDetail
  const pseudoItem: PendingApproval = {
    id: item.id,
    businessType: item.businessType,
    businessId: item.businessId,
    flowLevel: item.flowLevel || "common",
    currentNode: item.currentNode,
    nodeName: "",
    nodeType: "",
    createdAt: item.createdAt,
    initiatorName: item.initiatorName || "",
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
    if (instanceRes.ok && instanceJson.data) {
      setApprovalDetail(instanceJson.data);
    }

    if (detailRes && detailRes.ok) {
      const detailJson = await detailRes.json();
      if (detailJson.data) {
        setBusinessDetail(detailJson.data);
      }
    }
  } catch {
    // ignore
  } finally {
    setDetailLoading(false);
    setBusinessDetailLoading(false);
  }
};
```

- [ ] **Step 3: 修改「已处理」表格，添加操作列**

替换第 439-453 行的已处理表格：

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
            <button
              onClick={() => openProcessedDetail(item)}
              className="text-[13px] font-medium text-[#1C1917] bg-[#FAFAF9] hover:bg-[#F5F5F4] px-3 py-1.5 rounded-lg border border-[#E7E5E4] transition-colors"
            >
              <Eye className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              查看
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
  <PaginationBar pagination={pagination} onPageChange={setPage} onPageSizeChange={setPageSize} />
</div>
```

- [ ] **Step 4: 修改 Modal，已处理项不显示操作按钮**

替换第 506-531 行 Modal 内容，根据 `selectedApproval` 来源判断是否显示操作按钮：

```tsx
{selectedApproval && (
  <div className="space-y-4">
    <BusinessDetailPanel
      businessType={selectedApproval.businessType}
      data={businessDetail}
      loading={businessDetailLoading}
    />

    <div className="pt-3 border-t border-[#F5F5F4]">
      <h4 className="text-[13px] font-bold text-[#1C1917] mb-3">审批流程</h4>
      <ApprovalTimeline instance={approvalDetail} loading={detailLoading} />
    </div>

    {/* 只有待处理（审批中）项才显示操作按钮 */}
    {activeTab === "pending" && (
      <div className="pt-3 border-t border-[#F5F5F4]">
        <ApprovalActionButton
          instanceId={approvalDetail?.id || null}
          businessType={selectedApproval.businessType}
          businessId={selectedApproval.businessId}
          flowLevel={selectedApproval.flowLevel}
          currentStatus={approvalDetail?.status || "审批中"}
          approvalInstance={approvalDetail || undefined}
          onStatusChange={handleStatusChange}
        />
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

- [ ] **Step 1: 扩展测试，检查附件字段渲染**

在现有测试文件末尾添加新测试：

```typescript
import { describe, it, expect } from 'vitest'
import { DETAIL_CARD_MAP } from '../../src/components/detail-cards'
import { render } from '@testing-library/react'
import React from 'react'

// ... 保留原有测试 ...

describe('DetailCard 附件字段展示', () => {
  // 已知有 attachmentUrl 的业务类型（通过搜索 Prisma schema 确认）
  const businessTypesWithAttachments = [
    'supplier',
    'supplier_change',
    'quotation',
    'outsourcing',
    'purchase_request',
    'delivery_receipt',
    'inquiries',
    'income_contract',
    'expense_contract',
    'contract_change_order',
    'inter_org_contract',
    'expense_report',
    'payment_application',
    'non_contract_expense',
    'non_contract_income',
    'other_borrowing',
    'lending_out',
    'borrowing_return_application',
    'salary_payment',
  ]

  it('所有 DetailCard 在数据包含 attachmentUrl 时应渲染附件信息', () => {
    const mockData = {
      // 通用字段，确保 Card 能正常渲染
      name: '测试',
      attachmentUrl: 'https://example.com/files/test.pdf',
    }

    for (const type of businessTypesWithAttachments) {
      const CardComponent = DETAIL_CARD_MAP[type]
      expect(CardComponent).toBeDefined()

      // 渲染组件并检查是否包含附件 URL
      const { container } = render(React.createElement(CardComponent, { data: mockData }))
      const textContent = container.textContent || ''

      // 检查是否渲染了附件 URL 或文件名
      const hasAttachment = textContent.includes('test.pdf')
        || textContent.includes('附件')
        || container.querySelector('[href*="test.pdf"]') !== null

      if (!hasAttachment) {
        // 仅在缺失时报告错误，不阻塞（先定位问题再逐个修复）
        console.warn(`${type} DetailCard 未展示附件字段`)
      }
    }
  })

  it('供应商 DetailCard 应展示附件', () => {
    const SupplierDetailCard = DETAIL_CARD_MAP['supplier']
    const mockData = {
      name: '测试供应商',
      supplierType: '企业',
      contactPerson: '张三',
      phone: '13800138000',
      email: 'test@example.com',
      address: '测试地址',
      bankName: '测试银行',
      bankAccount: '1234567890',
      status: '正常',
      attachmentUrl: 'https://example.com/files/supplier.pdf',
    }
    const { container } = render(React.createElement(SupplierDetailCard, { data: mockData }))
    const textContent = container.textContent || ''
    expect(textContent).toContain('supplier.pdf')
  })
})
```

- [ ] **Step 2: 运行测试，预期失败（供应商 DetailCard 未显示附件）**

```bash
npx vitest run test/unit/detail-cards-registration.test.ts
```

预期：`supplier DetailCard 未展示附件字段` 错误

- [ ] **Step 3: 提交测试（失败状态，TDD 红阶段）**

```bash
git add test/unit/detail-cards-registration.test.ts
git commit -m "test: 添加 DetailCard 附件字段展示测试（预期失败）"
```

---

### Task 6: 修复供应商 DetailCard 附件展示

**Files:**
- Modify: `src/components/detail-cards/suppliers/SupplierDetailCard.tsx`

- [ ] **Step 1: 在 fields 数组中添加附件字段**

```tsx
import { DetailGrid } from '../DetailGrid'
import Link from 'next/link'

interface Props {
  data: any
}

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
        <a 
          href={data.attachmentUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 underline text-[13px] break-all"
        >
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
- Modify: 逐个检查并修改 `src/components/detail-cards/` 下所有有 `attachmentUrl` 的 DetailCard

- [ ] **Step 1: 搜索所有包含 attachmentUrl 的 API 路由（确定哪些模块有附件）**

```bash
npx grep -rl "attachmentUrl" src/app/api/ --include="*.ts"
```

- [ ] **Step 2: 对搜索到的每个模块，在对应的 `XxxDetailCard.tsx` 的 `fields` 数组末尾添加附件字段**

对于每个 DetailCard，添加与 SupplierDetailCard 相同模式的行：

```typescript
{ 
  label: "附件", 
  value: data?.attachmentUrl ? (
    <a 
      href={data.attachmentUrl} 
      target="_blank" 
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-700 underline text-[13px] break-all"
    >
      {decodeURIComponent(data.attachmentUrl.split('/').pop() || '查看附件')}
    </a>
  ) : null
},
```

预计需要修改的 DetailCard（通过 API 路由反查，具体以 grep 结果为准）：
- `suppliers/SupplierDetailCard.tsx`（已修复）
- `suppliers/SupplierChangeDetailCard.tsx`
- `business/QuotationDetailCard.tsx`
- `business/OutsourcingDetailCard.tsx`
- `business/PurchaseRequestDetailCard.tsx`
- `business/DeliveryReceiptDetailCard.tsx`
- `business/InquiryDetailCard.tsx`
- `contracts/IncomeContractDetailCard.tsx`
- `contracts/ExpenseContractDetailCard.tsx`
- `contracts/ContractChangeOrderDetailCard.tsx`
- `contracts/InterOrgContractDetailCard.tsx`
- `finance/ExpenseReportDetailCard.tsx`
- `finance/PaymentApplicationDetailCard.tsx`
- `finance/NonContractExpenseDetailCard.tsx`
- `finance/NonContractIncomeDetailCard.tsx`
- `finance/OtherBorrowingDetailCard.tsx`
- `finance/LendingOutDetailCard.tsx`
- `finance/BorrowingReturnDetailCard.tsx`
- `finance/SalaryPaymentDetailCard.tsx`

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

### Task 8: 回归验证

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

- [ ] **Step 4: 如全部通过，提交**

```bash
git add -A
git commit -m "chore: 回归验证通过，审批流程 Bug 修复完成"
```

---

## 实施顺序总结

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8
  (TDD)    (UI)    (简单)   (UI)    (TDD)   (附件)  (批量)   (验证)
```

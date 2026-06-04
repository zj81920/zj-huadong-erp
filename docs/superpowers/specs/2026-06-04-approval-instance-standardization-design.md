# 审批实例展示标准化设计方案

## 1. 背景与目标

### 1.1 现状

当前系统中，模块和审批流的关系如下：

- **模块定义**：所有业务模块集中定义在 `module-config.ts` 中
- **流程设置侧边栏**：从数据库 `ApprovalModuleConfig` 表读取模块列表，加上从 `ApprovalFlowDefinition` 动态计算的 `hasFlow` 字段
- **审批实例展示**：`ApprovalTimeline` 等组件已在 `ApprovalComponents.tsx` 中统一，但各详情页独立调用 API、各自管理状态，集成方式不统一
- **覆盖面不全**：部分有流程的模块详情页未展示审批实例（如项目线索、商务报价）

### 1.2 目标

1. **新模块自动出现**：在 `module-config.ts` 中新增模块后，自动出现在流程设置左侧列表，无需 seed 数据库
2. **审批展示标准化**：所有有流程的模块，详情页自动展示审批实例，新模块无需额外开发
3. **消除重复代码**：统一各详情页的审批数据获取和状态管理逻辑

## 2. 改动方案

### 2.1 API 改造：`/api/approval-module-config`

**变更**：数据源从 `ApprovalModuleConfig` 表切换为 `MODULE_CONFIG` 静态配置。

```typescript
// 改造后逻辑
import { MODULE_CONFIG } from "@/lib/module-config"

// 对每个模块动态 hasFlow
const data = MODULE_CONFIG.map((m) => {
  const flowCount = await prisma.approvalFlowDefinition.count({
    where: { businessType: m.key, isActive: true },
  })
  return {
    moduleKey: m.key,
    moduleName: m.name,
    groupName: m.group,
    hasFlow: flowCount > 0,
  }
})
```

**效果**：新增模块只需在 `module-config.ts` 加 1 行，不需要跑 seed、不需要动数据库。

**后续清理**：`ApprovalModuleConfig` 表中已有数据保留，API 不再读取。该表未来可删除或用作管理员 UI 启停模块。

### 2.2 新建 hook：`useApprovalInstance`

**文件**：`src/hooks/useApprovalInstance.ts`

```typescript
interface UseApprovalInstanceResult {
  instance: InstanceDetail | null
  loading: boolean
  error: string | null
  refresh: () => void
}

function useApprovalInstance(instanceId: string | null): UseApprovalInstanceResult
```

**行为**：
- `instanceId` 为 `null` → 返回 `{ instance: null, loading: false }`，不请求
- `instanceId` 有值 → 调用 `/api/approval-instances/{id}`，统一 loading/error 处理
- `refresh()` 支持手动刷新

### 2.3 新建组件：`ApprovalSection`

**文件**：`src/components/ApprovalSection.tsx`

```typescript
interface ApprovalSectionProps {
  instanceId: string | null | undefined
  businessType: string
  businessId: string
}

// 组件内部
function ApprovalSection({ instanceId, businessType, businessId }: ApprovalSectionProps) {
  const { instance, loading, error, refresh } = useApprovalInstance(instanceId)

  if (!instanceId) return null       // 没流程 → 不显示
  if (loading) return <Skeleton />   // 加载中
  if (error) return <ErrorView />    // 加载失败
  if (!instance) return null

  return (
    <div>
      <ApprovalStatusBadge status={instance.status} />
      <ApprovalTimeline instance={instance} />
      <ApprovalActionButton instance={instance} onAction={refresh} />
    </div>
  )
}
```

**职责**：完全自治。详情页只需要传入必要数据，不需要关心内部状态。

### 2.4 新建布局组件：`DetailPageLayout`

**文件**：`src/components/DetailPageLayout.tsx`

```typescript
interface DetailPageLayoutProps {
  title: string
  instanceId?: string | null
  businessType?: string
  businessId?: string
  children: React.ReactNode
  footer?: React.ReactNode
  onBack?: () => void
}
```

**布局结构**：
```
┌─ DetailPageLayout ──────────────────────────┐
│  ┌─ Header ──────────────────────────────┐  │
│  │  ← 返回   标题                         │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  ┌─ Children（业务内容） ────────────────┐  │
│  │  (由各模块传入)                       │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  ┌─ ApprovalSection ────────────────────┐  │
│  │  (instanceId 有值时才显示)           │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  ┌─ Footer ─────────────────────────────┐  │
│  │  (操作按钮等，可选)                   │  │
│  └───────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**设计原则**：
- `ApprovalSection` 是 `DetailPageLayout` 的子组件，不同模块共用同一套审批展示
- 业务内容和审批展示通过 `children` 和 `ApprovalSection` 天然分离
- 没有流程的模块传入 `instanceId={null}`，审批区块自动不渲染

### 2.5 改造现有详情页

改造范围（10 个页面）：

| 模块 | 当前形态 | 改造方式 |
|------|---------|---------|
| 收入合同 | Modal | 内容包裹 `DetailPageLayout` |
| 支出合同 | Modal | 同上 |
| 采购需求 | Modal | 同上 |
| 询价单 | Modal | 同上 |
| 到货验收 | Modal | 同上 |
| 供应商审批 | Modal | 同上 |
| 商务报价 | Modal | 同上 |
| 非合同收支 | Modal | 同上 |
| 外包任务 | Modal | 同上 |
| 项目线索 | 独立 `[id]` 页面 | 同上 |

**改造模式**（以收入合同为例）：

```tsx
// 改造前
<Modal>
  <div className="space-y-4">
    {/* 业务内容 */}
    <Fields />
    {/* 审批时间线（自己 fetch 数据） */}
    <ApprovalTimeline instance={instance} loading={loading} />
  </div>
</Modal>

// 改造后
<Modal>
  <DetailPageLayout
    title={record.name}
    instanceId={record?.approvalInstanceId}
    businessType="income_contract"
    businessId={record?.id}
  >
    <Fields />
  </DetailPageLayout>
</Modal>
```

所有页面统一模式后，新增模块自然遵循即可。

## 3. TDD 测试方案

严格按照 TDD 流程：先写测试，再写实现代码。

### 3.1 测试文件结构

| 测试文件 | 类型 | 测试内容 |
|---------|------|---------|
| `test/unit/approval-module-config-api.test.ts` | 单元测试 | API 改造后返回的模块列表正确性 |
| `test/unit/use-approval-instance.test.ts` | 单元测试 | hook 行为（有/无 instanceId、loading、error） |
| `test/unit/approval-section.test.ts` | 单元测试 | ApprovalSection 条件渲染逻辑 |
| `test/unit/detail-page-layout.test.ts` | 单元测试 | DetailPageLayout 布局与集成 |
| `test/api/approval-module-config-api.test.ts` | API 集成测试 | 实际 HTTP 请求验证 API 响应 |

### 3.2 测试用例明细

#### 3.2.1 `approval-module-config-api.test.ts`

目标：验证 API 改造后返回正确的模块结构。

| # | 用例名称 | 前置条件 | 预期结果 |
|---|---------|---------|---------|
| 1 | 返回所有模块 | `MODULE_CONFIG` 有 N 条 | 返回数组长度 = N |
| 2 | 每个模块有 moduleKey | - | 所有元素均有 `moduleKey` 字段 |
| 3 | 每个模块有 moduleName | - | 所有元素均有 `moduleName` 字段 |
| 4 | 每个模块有 groupName | - | 所有元素均有 `groupName` 字段 |
| 5 | 每个模块有 hasFlow | - | 所有元素均有 `hasFlow`（boolean）|
| 6 | hasFlow=true 当有活跃审批流 | 该模块有 isActive 的 flow | `hasFlow` 为 `true` |
| 7 | hasFlow=false 当无活跃审批流 | 该模块无 flow 或 flow 不活跃 | `hasFlow` 为 `false` |
| 8 | 按 groupName 分组排序 | - | 同组模块连续排列 |

#### 3.2.2 `use-approval-instance.test.ts`

目标：验证 hook 在不同输入下的行为。

| # | 用例名称 | 输入 | 预期结果 |
|---|---------|------|---------|
| 1 | instanceId 为 null 时不请求 | `instanceId = null` | `loading=false`, `instance=null`，不发起 fetch |
| 2 | instanceId 为 undefined 时不请求 | `instanceId = undefined` | `loading=false`, `instance=null`，不发起 fetch |
| 3 | 有 instanceId 时发起请求 | `instanceId = "abc"` | 调用 `/api/approval-instances/abc` |
| 4 | 请求成功返回数据 | Mock 返回 200 + data | `loading=false`, `instance=data` |
| 5 | 请求失败处理错误 | Mock 返回 500 | `error` 不为 null，`instance=null` |
| 6 | refresh 重新请求 | 先成功，调用 refresh | 再次发起 fetch，数据更新 |
| 7 | instanceId 变化重新请求 | 从 "abc" 变为 "def" | 发起新请求 `/api/approval-instances/def` |

#### 3.2.3 `approval-section.test.ts`

目标：验证 ApprovalSection 的条件渲染。

| # | 用例名称 | 输入 | 预期结果 |
|---|---------|------|---------|
| 1 | instanceId 为 null 不渲染 | `instanceId={null}` | 返回 null，无 DOM |
| 2 | instanceId 为 undefined 不渲染 | `instanceId={undefined}` | 返回 null，无 DOM |
| 3 | loading 时显示骨架屏 | Hook 返回 loading=true | 渲染加载占位 UI |
| 4 | 有数据时渲染时间线 | Hook 返回完整数据 | 渲染 `ApprovalTimeline` |
| 5 | 有数据时渲染状态标签 | Hook 返回完整数据 | 渲染 `ApprovalStatusBadge` |
| 6 | 有数据时渲染操作按钮 | Hook 返回完整数据 | 渲染 `ApprovalActionButton` |

#### 3.2.4 `detail-page-layout.test.ts`

目标：验证 DetailPageLayout 的布局与集成。

| # | 用例名称 | 输入 | 预期结果 |
|---|---------|------|---------|
| 1 | 渲染标题 | `title="测试合同"` | 页面显示 "测试合同" |
| 2 | 渲染 children | `<div>业务内容</div>` | children 被渲染 |
| 3 | 渲染 footer | `footer={<button>保存</button>}` | footer 区域渲染 |
| 4 | onBack 回调 | `onBack={fn}` | 点击返回按钮调用 fn |
| 5 | 有 instanceId 时包含 ApprovalSection | `instanceId="abc"` | 页面包含审批区块 |
| 6 | 无 instanceId 时不包含 ApprovalSection | `instanceId={null}` | 页面不包含审批区块 |

#### 3.2.5 API 集成测试：`approval-module-config-api.test.ts`

目标：真实 HTTP 请求验证。

| # | 用例名称 | 预期结果 |
|---|---------|---------|
| 1 | GET /api/approval-module-config 返回 200 | 状态码 200 |
| 2 | 响应包含 data 数组 | `response.data` 为数组 |
| 3 | 数组元素包含 moduleKey/moduleName/groupName/hasFlow | 字段完整 |
| 4 | hasFlow 值类型为 boolean | `typeof item.hasFlow === "boolean"` |

### 3.3 测试工具

- 单元测试：Vitest（已有配置）
- API 集成测试：Vitest + Fetch API
- Mock 策略：
  - `useApprovalInstance` 测试：mock `fetch`
  - `ApprovalSection` 测试：mock `useApprovalInstance` hook
  - API 测试：真实请求（需要 dev server 运行中执行）

### 3.4 测试执行时机

| 阶段 | 命令 | 说明 |
|------|------|------|
| TDD 红绿循环 | `npx vitest run test/unit/approval-module-config-api.test.ts` | 先跑单元测试 |
| 集成验证 | `npx vitest run test/api/approval-module-config-api.test.ts` | dev server 运行中 |
| 回归 | `npx vitest run test/unit/` | 全部单元测试 |
| 构建 | `npx next build` | 确保无类型错误 |

## 4. 实施步骤

按依赖关系排列，依次实施：

### Step 1：API 改造（左侧列表自动化）

**文件**：`src/app/api/approval-module-config/route.ts`
**TDD**：先写 `test/unit/approval-module-config-api.test.ts` + `test/api/approval-module-config-api.test.ts`

- [ ] 写测试（TDD 红阶段）
- [ ] 改 API 从 `MODULE_CONFIG` 读取
- [ ] 跑测试（TDD 绿阶段）

### Step 2：新建 hook

**文件**：`src/hooks/useApprovalInstance.ts`
**TDD**：先写 `test/unit/use-approval-instance.test.ts`

- [ ] 写测试
- [ ] 实现 hook
- [ ] 跑测试

### Step 3：新建组件

**文件**：`src/components/DetailPageLayout.tsx` + `src/components/ApprovalSection.tsx`
**TDD**：先写 `test/unit/detail-page-layout.test.ts` + `test/unit/approval-section.test.ts`

- [ ] 写测试
- [ ] 实现组件
- [ ] 跑测试

### Step 4：改造现有详情页

**涉及**：10 个页面（收入合同、支出合同、采购需求、询价单、到货验收、供应商审批、商务报价、非合同收支、外包任务、项目线索）

- [ ] 逐一改造，每个改完跑对应测试
- [ ] 全局回归验证

### Step 5：验收

- [ ] `npx vitest run test/unit/`
- [ ] `npx next build`
- [ ] 手动验证流程设置左侧列表
- [ ] 手动验证 2-3 个详情页审批实例展示

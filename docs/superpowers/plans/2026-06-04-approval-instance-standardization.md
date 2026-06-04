# 审批实例展示标准化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新模块自动出现在流程设置侧边栏 + 有流程的模块详情页自动展示审批实例

**Architecture:** 将 API 数据源从 DB 表切换为静态配置 `MODULE_CONFIG`，提取纯函数便于测试。新建 `useApprovalInstance` hook 统一数据获取，`ApprovalSection` + `DetailPageLayout` 组件实现审批展示的自动注入。所有组件和 hook 采用 TDD 开发。

**Tech Stack:** Next.js 14 (App Router), TypeScript, Vitest, Tailwind CSS

---

## 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `src/app/api/approval-module-config/route.ts` | 改为从 `MODULE_CONFIG` 读取 |
| 修改 | `src/lib/module-config.ts` | 新增 `ModuleWithFlowStatus` 类型 + `getModulesWithFlowStatus()` 纯函数 |
| 新建 | `test/unit/approval-module-config-api.test.ts` | 纯函数单元测试 |
| 新建 | `src/hooks/useApprovalInstance.ts` | 统一审批数据获取 hook |
| 新建 | `test/unit/use-approval-instance.test.ts` | hook 测试 |
| 新建 | `src/components/ApprovalSection.tsx` | 审批区块组件 |
| 新建 | `test/unit/approval-section.test.ts` | 组件测试 |
| 新建 | `src/components/DetailPageLayout.tsx` | 详情页布局组件 |
| 新建 | `test/unit/detail-page-layout.test.ts` | 布局测试 |
| 修改 | `test/api/approval-module-config-api.test.ts` | API 集成测试 |
| 修改 | 10个详情页文件 | 改用 `DetailPageLayout` |

---

### Task 1: API 改造 — 提取纯函数并测试

**文件：**
- 修改: `src/lib/module-config.ts` — 新增类型和纯函数
- 新建: `test/unit/approval-module-config-api.test.ts` — 单元测试
- 修改: `src/app/api/approval-module-config/route.ts` — 使用纯函数

- [x] **Step 1: 在 module-config.ts 末尾添加类型和纯函数**

将以下代码追加到 `src/lib/module-config.ts` 末尾：

```typescript
/** 包含流程状态的模块信息 */
export interface ModuleWithFlowStatus {
  moduleKey: string
  moduleName: string
  groupName: string
  hasFlow: boolean
}

/**
 * 根据 flowCounts 映射，给 MODULE_CONFIG 中的每个模块注入 hasFlow 状态。
 * 纯函数，无副作用，便于测试。
 *
 * @param flowCounts 各业务类型的活跃审批流数量，key 为 businessType
 * @returns 带 hasFlow 状态的模块列表，按 groupName 分组排序
 */
export function getModulesWithFlowStatus(
  flowCounts: Record<string, number>
): ModuleWithFlowStatus[] {
  return MODULE_CONFIG.map((m) => ({
    moduleKey: m.key,
    moduleName: m.name,
    groupName: m.group,
    hasFlow: (flowCounts[m.key] || 0) > 0,
  }))
}
```

- [x] **Step 2: 写单元测试**

新建 `test/unit/approval-module-config-api.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import {
  getModulesWithFlowStatus,
  MODULE_CONFIG,
} from '../../src/lib/module-config'

describe('getModulesWithFlowStatus', () => {
  it('无任何审批流时，所有模块 hasFlow = false', () => {
    const result = getModulesWithFlowStatus({})
    expect(result).toHaveLength(MODULE_CONFIG.length)
    for (const m of result) {
      expect(m.hasFlow).toBe(false)
    }
  })

  it('部分模块有审批流时，对应模块 hasFlow = true', () => {
    const result = getModulesWithFlowStatus({
      supplier: 3,
      expense_contract: 1,
    })
    const supplier = result.find((m) => m.moduleKey === 'supplier')
    const expense = result.find((m) => m.moduleKey === 'expense_contract')
    const income = result.find((m) => m.moduleKey === 'income_contract')

    expect(supplier?.hasFlow).toBe(true)
    expect(expense?.hasFlow).toBe(true)
    expect(income?.hasFlow).toBe(false)
  })

  it('返回所有 MODULE_CONFIG 中的模块（不缺不漏）', () => {
    const result = getModulesWithFlowStatus({})
    const keys = result.map((m) => m.moduleKey).sort()
    const configKeys = MODULE_CONFIG.map((m) => m.key).sort()
    expect(keys).toEqual(configKeys)
  })

  it('每个元素包含完整的字段集合', () => {
    const result = getModulesWithFlowStatus({})
    for (const m of result) {
      expect(m).toHaveProperty('moduleKey')
      expect(m).toHaveProperty('moduleName')
      expect(m).toHaveProperty('groupName')
      expect(m).toHaveProperty('hasFlow')
      expect(typeof m.hasFlow).toBe('boolean')
    }
  })

  it('按 groupName 分组排序（同组连续排列）', () => {
    const result = getModulesWithFlowStatus({})
    for (let i = 1; i < result.length; i++) {
      // 不要求跨组排序，但同组必须连续
      const prev = result[i - 1].groupName
      const curr = result[i].groupName
      // 如果组名变了，后面不能再出现前一个组
      if (prev !== curr) {
        const remaining = result.slice(i + 1)
        const prevGroupAppearsLater = remaining.some(
          (m) => m.groupName === prev
        )
        expect(prevGroupAppearsLater).toBe(false)
      }
    }
  })
})
```

- [x] **Step 3: 运行测试，预期失败**

运行：`npx vitest run test/unit/approval-module-config-api.test.ts`

预期：`TypeError: getModulesWithFlowStatus is not a function`（因为还没导出）

- [x] **Step 4: 修改 API 路由文件使用纯函数**

将 `src/app/api/approval-module-config/route.ts` 全部替换为：

```typescript
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getModulesWithFlowStatus } from "@/lib/module-config"

export async function GET() {
  try {
    // 从 DB 统计每个模块的活跃审批流数量
    const flows = await prisma.approvalFlowDefinition.findMany({
      where: { isActive: true },
      select: { businessType: true },
    })

    const flowCounts: Record<string, number> = {}
    for (const f of flows) {
      flowCounts[f.businessType] = (flowCounts[f.businessType] || 0) + 1
    }

    const data = getModulesWithFlowStatus(flowCounts)

    return NextResponse.json({ data })
  } catch (error) {
    console.error("获取模块配置失败:", error)
    return NextResponse.json({ error: "获取模块配置失败" }, { status: 500 })
  }
}
```

- [x] **Step 5: 运行测试，预期通过**

运行：`npx vitest run test/unit/approval-module-config-api.test.ts`

预期：所有 5 个用例通过

- [x] **Step 6: 提交**

```bash
git add src/lib/module-config.ts \
  test/unit/approval-module-config-api.test.ts \
  src/app/api/approval-module-config/route.ts
git commit -m "feat: API 改用 MODULE_CONFIG 静态配置，新增 getModulesWithFlowStatus 纯函数"
```

---

### Task 2: API 集成测试

**文件：**
- 新建: `test/api/approval-module-config-api.test.ts`

- [x] **Step 1: 写 API 集成测试**

新建 `test/api/approval-module-config-api.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'

const BASE_URL = 'http://localhost:3000'

describe('GET /api/approval-module-config', () => {
  it('返回 200', async () => {
    const res = await fetch(`${BASE_URL}/api/approval-module-config`)
    expect(res.status).toBe(200)
  })

  it('响应包含 data 数组', async () => {
    const res = await fetch(`${BASE_URL}/api/approval-module-config`)
    const json = await res.json()
    expect(Array.isArray(json.data)).toBe(true)
  })

  it('数组元素包含完整字段', async () => {
    const res = await fetch(`${BASE_URL}/api/approval-module-config`)
    const json = await res.json()
    for (const item of json.data) {
      expect(item).toHaveProperty('moduleKey')
      expect(item).toHaveProperty('moduleName')
      expect(item).toHaveProperty('groupName')
      expect(item).toHaveProperty('hasFlow')
    }
  })

  it('hasFlow 为 boolean 类型', async () => {
    const res = await fetch(`${BASE_URL}/api/approval-module-config`)
    const json = await res.json()
    for (const item of json.data) {
      expect(typeof item.hasFlow).toBe('boolean')
    }
  })
})
```

- [x] **Step 2: 运行集成测试**

先启动 dev server：`npm run dev`

然后在新终端运行：`npx vitest run test/api/approval-module-config-api.test.ts`

预期：所有 4 个用例通过

- [x] **Step 3: 提交**

```bash
git add test/api/approval-module-config-api.test.ts
git commit -m "test: 新增 approval-module-config API 集成测试"
```

---

### Task 3: 新建 useApprovalInstance hook

**文件：**
- 新建: `src/hooks/useApprovalInstance.ts`
- 新建: `test/unit/use-approval-instance.test.ts`

- [x] **Step 1: 写 hook 测试**

新建 `test/unit/use-approval-instance.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useApprovalInstance } from '../../src/hooks/useApprovalInstance'

const mockInstance = {
  id: 'inst-1',
  businessType: 'expense_contract',
  businessId: 'biz-1',
  status: '审批中',
  currentNode: 1,
  createdAt: '2026-06-01T00:00:00Z',
  actions: [],
  flowNodes: [
    { nodeOrder: 1, nodeName: '财务审批', approverRole: 'finance', nodeType: 'approval' },
  ],
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('useApprovalInstance', () => {
  it('instanceId 为 null 时不发起请求', () => {
    const { result } = renderHook(() => useApprovalInstance(null))
    expect(result.current.instance).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('instanceId 为 undefined 时不发起请求', () => {
    const { result } = renderHook(() => useApprovalInstance(undefined))
    expect(result.current.instance).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('有 instanceId 时发起请求', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockInstance }),
    })

    const { result } = renderHook(() => useApprovalInstance('inst-1'))

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.instance).toEqual(mockInstance)
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/approval-instances/inst-1')
  })

  it('请求失败时 error 不为 null', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('网络错误'))

    const { result } = renderHook(() => useApprovalInstance('inst-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.instance).toBeNull()
    expect(result.current.error).toBe('网络错误')
  })

  it('instanceId 变化后重新请求', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockInstance }),
    })

    const { result, rerender } = renderHook(
      ({ id }) => useApprovalInstance(id),
      { initialProps: { id: 'inst-1' as string | null } }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender({ id: 'inst-2' })

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/approval-instances/inst-2')
    })
  })

  it('refresh 可重新发起请求', async () => {
    let callCount = 0
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { ...mockInstance, id: `inst-${callCount}` } }),
      })
    })

    const { result } = renderHook(() => useApprovalInstance('inst-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.instance?.id).toBe('inst-1')

    await act(async () => {
      result.current.refresh()
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.instance?.id).toBe('inst-2')
  })
})
```

- [x] **Step 2: 运行测试，预期失败**

运行：`npx vitest run test/unit/use-approval-instance.test.ts`

预期：测试失败（hook 未实现）

- [x] **Step 3: 实现 hook**

新建 `src/hooks/useApprovalInstance.ts`：

```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface FlowNode {
  nodeOrder: number
  nodeName: string
  approverRole: string
  nodeType?: string
}

interface ActionRecord {
  id: string
  nodeId: number
  nodeName: string
  action: string
  comment: string | null
  actedAt: string | null
  signatureUrl: string | null
  approver: { id: string; realName: string; username: string }
}

interface InstanceDetail {
  id: string
  businessType: string
  businessId: string
  status: string
  currentNode: number
  createdAt: string
  actions: ActionRecord[]
  flowNodes: FlowNode[]
}

interface UseApprovalInstanceResult {
  instance: InstanceDetail | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useApprovalInstance(
  instanceId: string | null | undefined
): UseApprovalInstanceResult {
  const [instance, setInstance] = useState<InstanceDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchIdRef = useRef(0)

  const fetchInstance = useCallback(async (id: string) => {
    const thisFetchId = ++fetchIdRef.current
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/approval-instances/${id}`)
      if (!res.ok) throw new Error(`请求失败: ${res.status}`)
      const json = await res.json()
      // 防止竞态：只使用最新一次 fetch 的结果
      if (thisFetchId === fetchIdRef.current) {
        setInstance(json.data)
        setLoading(false)
      }
    } catch (e: unknown) {
      if (thisFetchId === fetchIdRef.current) {
        setError(e instanceof Error ? e.message : '未知错误')
        setInstance(null)
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!instanceId) {
      setInstance(null)
      setLoading(false)
      setError(null)
      return
    }
    fetchInstance(instanceId)
  }, [instanceId, fetchInstance])

  const refresh = useCallback(() => {
    if (instanceId) fetchInstance(instanceId)
  }, [instanceId, fetchInstance])

  return { instance, loading, error, refresh }
}
```

- [x] **Step 4: 运行测试，预期通过**

运行：`npx vitest run test/unit/use-approval-instance.test.ts`

预期：所有 6 个用例通过

- [x] **Step 5: 提交**

```bash
git add src/hooks/useApprovalInstance.ts test/unit/use-approval-instance.test.ts
git commit -m "feat: 新增 useApprovalInstance hook，统一审批实例数据获取"
```

---

### Task 4: 新建 ApprovalSection 组件

**文件：**
- 新建: `src/components/ApprovalSection.tsx`
- 新建: `test/unit/approval-section.test.ts`

- [x] **Step 1: 写组件测试**

新建 `test/unit/approval-section.test.ts`：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ApprovalSection } from '../../src/components/ApprovalSection'

// mock useApprovalInstance hook
vi.mock('../../src/hooks/useApprovalInstance', () => ({
  useApprovalInstance: vi.fn(),
}))

import { useApprovalInstance } from '../../src/hooks/useApprovalInstance'

const mockInstance = {
  id: 'inst-1',
  businessType: 'expense_contract',
  businessId: 'biz-1',
  status: '审批中',
  currentNode: 1,
  createdAt: '2026-06-01T00:00:00Z',
  actions: [],
  flowNodes: [
    { nodeOrder: 1, nodeName: '财务审批', approverRole: 'finance', nodeType: 'approval' },
  ],
}

describe('ApprovalSection', () => {
  it('instanceId 为 null 时不渲染', () => {
    vi.mocked(useApprovalInstance).mockReturnValue({
      instance: null,
      loading: false,
      error: null,
      refresh: () => {},
    })

    const { container } = render(
      <ApprovalSection instanceId={null} businessType="expense_contract" businessId="biz-1" />
    )

    expect(container.innerHTML).toBe('')
  })

  it('instanceId 为 undefined 时不渲染', () => {
    vi.mocked(useApprovalInstance).mockReturnValue({
      instance: null,
      loading: false,
      error: null,
      refresh: () => {},
    })

    const { container } = render(
      <ApprovalSection instanceId={undefined} businessType="expense_contract" businessId="biz-1" />
    )

    expect(container.innerHTML).toBe('')
  })

  it('loading 时显示加载占位', () => {
    vi.mocked(useApprovalInstance).mockReturnValue({
      instance: null,
      loading: true,
      error: null,
      refresh: () => {},
    })

    const { container } = render(
      <ApprovalSection instanceId="inst-1" businessType="expense_contract" businessId="biz-1" />
    )

    // 应该渲染一个骨架屏容器
    const skeleton = container.querySelector('.animate-pulse')
    expect(skeleton).not.toBeNull()
  })

  it('有数据时渲染审批相关组件', () => {
    vi.mocked(useApprovalInstance).mockReturnValue({
      instance: mockInstance,
      loading: false,
      error: null,
      refresh: () => {},
    })

    render(
      <ApprovalSection instanceId="inst-1" businessType="expense_contract" businessId="biz-1" />
    )

    // 应显示审批中标签
    expect(screen.getByText('审批中')).toBeDefined()
  })
})
```

- [x] **Step 2: 运行测试，预期失败**

运行：`npx vitest run test/unit/approval-section.test.ts`

预期：测试失败（组件未实现）

- [x] **Step 3: 实现 ApprovalSection 组件**

新建 `src/components/ApprovalSection.tsx`：

```typescript
'use client'

import React from 'react'
import { useApprovalInstance } from '@/hooks/useApprovalInstance'
import {
  ApprovalStatusBadge,
  ApprovalTimeline,
  ApprovalActionButton,
} from '@/components/ApprovalComponents'

interface ApprovalSectionProps {
  instanceId: string | null | undefined
  businessType: string
  businessId: string
}

export function ApprovalSection({
  instanceId,
  businessType,
  businessId,
}: ApprovalSectionProps) {
  const { instance, loading, error, refresh } = useApprovalInstance(instanceId)

  // 没有审批实例 → 不渲染
  if (!instanceId) return null

  // 加载中 → 骨架屏
  if (loading) {
    return (
      <div className="bento-card-static p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
        <div className="h-16 bg-gray-200 rounded" />
      </div>
    )
  }

  // 加载失败 → 错误提示
  if (error) {
    return (
      <div className="bento-card-static p-4">
        <p className="text-sm text-red-500">审批信息加载失败: {error}</p>
      </div>
    )
  }

  // 没有数据（instanceId 存在但数据为空）→ 不渲染
  if (!instance) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-[#1C1917]">审批信息</span>
        <ApprovalStatusBadge status={instance.status} />
      </div>
      <ApprovalTimeline instance={instance} />
      <ApprovalActionButton instance={instance} onAction={refresh} />
    </div>
  )
}
```

- [x] **Step 4: 运行测试，预期通过**

运行：`npx vitest run test/unit/approval-section.test.ts`

预期：所有 4 个用例通过

- [x] **Step 5: 提交**

```bash
git add src/components/ApprovalSection.tsx test/unit/approval-section.test.ts
git commit -m "feat: 新增 ApprovalSection 组件，统一审批实例展示"
```

---

### Task 5: 新建 DetailPageLayout 组件

**文件：**
- 新建: `src/components/DetailPageLayout.tsx`
- 新建: `test/unit/detail-page-layout.test.ts`

- [x] **Step 1: 写组件测试**

新建 `test/unit/detail-page-layout.test.ts`：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DetailPageLayout } from '../../src/components/DetailPageLayout'

// mock ApprovalSection
vi.mock('../../src/components/ApprovalSection', () => ({
  ApprovalSection: ({ instanceId }: { instanceId?: string | null }) =>
    instanceId ? <div data-testid="approval-section">审批区块</div> : null,
}))

describe('DetailPageLayout', () => {
  it('渲染标题', () => {
    render(
      <DetailPageLayout title="测试合同">
        <div>内容</div>
      </DetailPageLayout>
    )
    expect(screen.getByText('测试合同')).toBeDefined()
  })

  it('渲染 children', () => {
    render(
      <DetailPageLayout title="测试">
        <div data-testid="child-content">业务内容</div>
      </DetailPageLayout>
    )
    expect(screen.getByTestId('child-content')).toBeDefined()
  })

  it('渲染 footer', () => {
    render(
      <DetailPageLayout title="测试" footer={<button>保存</button>}>
        <div>内容</div>
      </DetailPageLayout>
    )
    expect(screen.getByText('保存')).toBeDefined()
  })

  it('点击返回按钮调用 onBack', () => {
    const onBack = vi.fn()
    render(
      <DetailPageLayout title="测试" onBack={onBack}>
        <div>内容</div>
      </DetailPageLayout>
    )
    const backBtn = screen.getByRole('button')
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('有 instanceId 时包含审批区块', () => {
    render(
      <DetailPageLayout title="测试" instanceId="inst-1">
        <div>内容</div>
      </DetailPageLayout>
    )
    expect(screen.getByTestId('approval-section')).toBeDefined()
  })

  it('无 instanceId 时不包含审批区块', () => {
    const { queryByTestId } = render(
      <DetailPageLayout title="测试">
        <div>内容</div>
      </DetailPageLayout>
    )
    expect(queryByTestId('approval-section')).toBeNull()
  })
})
```

- [x] **Step 2: 运行测试，预期失败**

运行：`npx vitest run test/unit/detail-page-layout.test.ts`

预期：测试失败（组件未实现）

- [x] **Step 3: 实现 DetailPageLayout 组件**

新建 `src/components/DetailPageLayout.tsx`：

```typescript
'use client'

import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { ApprovalSection } from '@/components/ApprovalSection'

interface DetailPageLayoutProps {
  title: string
  instanceId?: string | null
  businessType?: string
  businessId?: string
  children: React.ReactNode
  footer?: React.ReactNode
  onBack?: () => void
}

export function DetailPageLayout({
  title,
  instanceId,
  businessType = '',
  businessId = '',
  children,
  footer,
  onBack,
}: DetailPageLayoutProps) {
  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 hover:bg-[#1C1917]/5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#78716C]" />
          </button>
        )}
        <h2 className="text-[16px] font-bold text-[#1C1917]">{title}</h2>
      </div>

      {/* 业务内容 */}
      <div>{children}</div>

      {/* 审批区块（有实例 ID 时自动显示） */}
      {instanceId && (
        <ApprovalSection
          instanceId={instanceId}
          businessType={businessType}
          businessId={businessId}
        />
      )}

      {/* 底部操作区 */}
      {footer && <div className="pt-2">{footer}</div>}
    </div>
  )
}
```

- [x] **Step 4: 运行测试，预期通过**

运行：`npx vitest run test/unit/detail-page-layout.test.ts`

预期：所有 6 个用例通过

- [x] **Step 5: 提交**

```bash
git add src/components/DetailPageLayout.tsx test/unit/detail-page-layout.test.ts
git commit -m "feat: 新增 DetailPageLayout 组件，统一详情页布局与审批注入"
```

---

### Task 6: 改造现有详情页

**说明：** 逐一改造 10 个详情页，将原内联的 `fetchApprovalInstance` + `ApprovalTimeline` 替换为 `DetailPageLayout` 包裹。

改造模式对所有页面一致：

```tsx
// 改造前
<Modal>
  <div className="...">
    {/* ... 业务内容 ... */}
    <ApprovalTimeline instance={instance} loading={loading} />
  </div>
</Modal>

// 改造后
<Modal>
  <DetailPageLayout
    title={record?.name || '详情'}
    instanceId={record?.approvalInstanceId}
    businessType="expense_contract"
    businessId={record?.id}
  >
    {/* ... 业务内容（去掉 approvalTimeline 部分） ... */}
  </DetailPageLayout>
</Modal>
```

每个页面改造后需移除的冗余代码：
- `const [approvalInstance, setApprovalInstance] = useState(null)`
- `const [approvalLoading, setApprovalLoading] = useState(false)`
- `const fetchApprovalInstance = useCallback(...)`
- `useEffect(() => { fetchApprovalInstance(...) }, [record])`
- 原有的 `<ApprovalTimeline instance={...} loading={...} />` 渲染

**涉及页面清单与改造要点：**

| # | 页面文件 | 原审批集成位置 | 注意点 |
|---|---------|-------------|--------|
| 1 | `contracts/income/page.tsx` | 详情 Modal 内 | `approvalInstanceId` 字段名确认 |
| 2 | `contracts/expense/page.tsx` | 详情 Modal 内 | 同上 |
| 3 | `procurement/requests/page.tsx` | 详情 Modal 内 | 同上 |
| 4 | `procurement/inquiries/page.tsx` | 详情 Modal 内 | 同上 |
| 5 | `procurement/deliveries/page.tsx` | 详情 Modal 内 | 同上 |
| 6 | `business/suppliers/page.tsx` | 详情 Modal 内 | 同上 |
| 7 | `business/quotations/page.tsx` | 详情 Modal 内 | 原已有审批状态但未显示 Timeline，新增 `ApprovalSection` |
| 8 | `contracts/non-contract/page.tsx` | 详情 Modal 内 | 同上 |
| 9 | `projects/outsourcing/page.tsx` | 详情 Modal 内 | 同上 |
| 10 | `business/project-leads/[id]/page.tsx` | 独立详情页 | 原无审批展示，新增 `ApprovalSection` |

- [x] **Step 1~10: 逐一改造并验证**

每个页面改造步骤：
1. 读取页面文件，定位详情 Modal 或独立页面区域
2. 替换为 `DetailPageLayout` 包裹
3. 移除上述 4 段冗余代码
4. `npx next build` 检查无类型错误

- [x] **Step 11: 提交所有页面改造**

```bash
git add src/app/\(dashboard\)/contracts/income/page.tsx \
  src/app/\(dashboard\)/contracts/expense/page.tsx \
  src/app/\(dashboard\)/procurement/requests/page.tsx \
  src/app/\(dashboard\)/procurement/inquiries/page.tsx \
  src/app/\(dashboard\)/procurement/deliveries/page.tsx \
  src/app/\(dashboard\)/business/suppliers/page.tsx \
  src/app/\(dashboard\)/business/quotations/page.tsx \
  src/app/\(dashboard\)/contracts/non-contract/page.tsx \
  src/app/\(dashboard\)/projects/outsourcing/page.tsx \
  src/app/\(dashboard\)/business/project-leads/\[id\]/page.tsx
git commit -m "refactor: 统一10个模块详情页使用 DetailPageLayout"
```

---

### Task 7: 回归验证

- [x] **Step 1: 运行全部单元测试**

运行：`npx vitest run test/unit/`

预期：所有测试通过

- [x] **Step 2: 运行路由完整性检查**

运行：`npx vitest run test/unit/route-integrity.test.ts`

预期：所有路由完整性用例通过（确认没有因详情页改造误删路由结构）

- [x] **Step 3: 运行构建验证**

运行：`npx next build`

预期：构建成功，无类型错误

- [x] **Step 4: 手动验证流程设置左侧列表**

1. 启动 dev server
2. 访问 `/settings/approval-flow`
3. 确认左侧列出所有模块，分组正确

- [x] **Step 5: 手动验证详情页审批实例**

1. 找一个有审批流的模块（如支出合同），打开一条已提交流程的记录
2. 确认详情 Modal 底部显示审批时间线
3. 确认无流程的模块（如客户管理）不显示审批区块

- [x] **Step 6: 最终提交**

```bash
git add .
git commit -m "chore: 回归验证通过，审批实例展示标准化完成"
```

---

## 回滚方案

如果改造后的组件出现问题时，可逐步回退：

1. **API 回滚**：将 `src/app/api/approval-module-config/route.ts` 恢复为从 `ApprovalModuleConfig` 表读取
2. **详情页回滚**：将对应页面的 `DetailPageLayout` 替换回原有的内联代码
3. **组件回滚**：删除 `ApprovalSection` 和 `DetailPageLayout`，恢复原有 `ApprovalTimeline` 直接使用

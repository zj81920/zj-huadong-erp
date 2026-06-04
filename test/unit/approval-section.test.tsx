// @vitest-environment jsdom
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

    // ApprovalStatusBadge 和 ApprovalTimeline 都会出现"审批中"，用 getAllByText
    expect(screen.getAllByText('审批中').length).toBeGreaterThanOrEqual(1)
  })
})

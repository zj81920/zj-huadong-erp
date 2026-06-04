// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DetailPageLayout } from '../../src/components/DetailPageLayout'

// mock ApprovalSection
vi.mock('../../src/components/ApprovalSection', () => ({
  ApprovalSection: ({ instanceId }: { instanceId?: string | null }) =>
    instanceId ? <div data-testid="approval-section">审批区块</div> : null,
}))

afterEach(() => {
  cleanup()
})

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
    // 用 aria-label 定位返回按钮
    const backBtn = screen.getByLabelText('返回')
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

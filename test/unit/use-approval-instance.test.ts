// @vitest-environment jsdom
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

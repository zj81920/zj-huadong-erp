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

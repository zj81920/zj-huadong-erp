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
  wbsItems?: { wbsNodeId: string; workload?: number | null; unit?: string | null; unitPrice?: number | null }[]
}

export function ApprovalSection({
  instanceId,
  businessType,
  businessId,
  wbsItems,
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
      <ApprovalActionButton
        instanceId={instanceId || null}
        businessType={businessType}
        businessId={businessId}
        flowLevel=""
        currentStatus={instance.status}
        approvalInstance={instance}
        onStatusChange={() => { refresh(); }}
        wbsItems={wbsItems}
      />
    </div>
  )
}

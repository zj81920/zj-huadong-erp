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
            aria-label="返回"
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

// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { DETAIL_CARD_MAP } from '../../src/components/detail-cards'
import { render } from '@testing-library/react'
import React from 'react'

describe('DETAIL_CARD_MAP 注册完整性', () => {
  const expectedBusinessTypes = [
    'supplier',
    'quotation',
    'outsourcing',
    'purchase_request',
    'delivery_receipt',
    'income_contract',
    'expense_contract',
    'non_contract_income',
    'non_contract_expense',
    'payment_application',
    'expense_report',
    'lending_out',
    'salary_payment',
    'borrowing_return_application',
    'other_borrowing',
    'inquiries',
    'inter_org_contract',
    'contract_change_order',
    'supplier_change',
  ]

  it('所有业务类型都已注册', () => {
    for (const type of expectedBusinessTypes) {
      expect(DETAIL_CARD_MAP).toHaveProperty(type)
      expect(typeof DETAIL_CARD_MAP[type]).toBe('function')
    }
  })

  it('已注册的组件数量等于期望数量', () => {
    const registeredCount = Object.keys(DETAIL_CARD_MAP).length
    expect(registeredCount).toBe(expectedBusinessTypes.length)
  })
})

describe('DetailCard 附件字段展示', () => {
  // 有 attachmentUrl 的业务类型及其测试数据
  const attachmentTestCases = [
    {
      type: 'supplier',
      data: {
        name: '测试供应商', supplierType: '企业', contactPerson: '张三',
        phone: '13800138000', email: 'test@example.com', address: '测试地址',
        bankName: '测试银行', bankAccount: '1234567890', status: '正常',
        attachmentUrls: ['https://example.com/files/supplier.pdf'],
      },
    },
    {
      type: 'supplier_change',
      data: {
        name: '测试供应商变更', supplierType: '企业', status: '正常',
        contactPerson: '李四', phone: '13900139000', email: 'lisi@example.com',
        address: '新地址', bankName: '新银行', bankAccount: '9876543210',
        approvalStatus: '审批中', remark: '测试备注',
        attachmentUrl: 'https://example.com/files/change.pdf',
      },
    },
    {
      type: 'expense_report',
      data: {
        applicant: { realName: '王五' }, expenseType: '差旅费',
        amount: 1000, loanOffsetAmount: 0, createdAt: '2026-01-01',
        items: [],
        attachmentUrl: 'https://example.com/files/report.pdf',
      },
    },
  ]

  it('有附件字段的 DetailCard 应渲染附件链接', () => {
    for (const { type, data } of attachmentTestCases) {
      const CardComponent = DETAIL_CARD_MAP[type]
      expect(CardComponent).toBeDefined()
      const { container } = render(React.createElement(CardComponent, { data }))
      const html = container.innerHTML
      expect(html).toContain('附件')  // 标签文字
      expect(html).toContain('example.com')  // 链接 URL
    }
  })

  it('无附件时不应渲染附件链接', () => {
    const SupplierDetailCard = DETAIL_CARD_MAP['supplier']
    const { container } = render(React.createElement(SupplierDetailCard, {
      data: { name: '无附件供应商', supplierType: '企业', status: '正常' },
    }))
    expect(container.innerHTML).not.toContain('href=')
  })
})

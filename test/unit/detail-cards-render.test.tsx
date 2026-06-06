// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SupplierDetailCard } from '../../src/components/detail-cards/suppliers/SupplierDetailCard'
import { IncomeContractDetailCard } from '../../src/components/detail-cards/contracts/IncomeContractDetailCard'
import { SalaryPaymentDetailCard } from '../../src/components/detail-cards/finance/SalaryPaymentDetailCard'

afterEach(() => { cleanup() })

describe('SupplierDetailCard', () => {
  const mockData = {
    name: '测试供应商',
    supplierType: '一般纳税人',
    contactPerson: '李四',
    phone: '13900139000',
    email: 'lisi@test.com',
    address: '北京市朝阳区',
    bankName: '中国银行',
    bankAccount: '6222021234567890',
    status: 'ACTIVE',
  }

  it('渲染所有字段的 label', () => {
    render(<SupplierDetailCard data={mockData} />)
    expect(screen.getByText('供应商名称')).toBeDefined()
    expect(screen.getByText('供应商性质')).toBeDefined()
    expect(screen.getByText('联系人')).toBeDefined()
    expect(screen.getByText('电话')).toBeDefined()
    expect(screen.getByText('邮箱')).toBeDefined()
    expect(screen.getByText('地址')).toBeDefined()
    expect(screen.getByText('开户行')).toBeDefined()
    expect(screen.getByText('银行账号')).toBeDefined()
    expect(screen.getByText('状态')).toBeDefined()
  })

  it('渲染所有字段的 value', () => {
    render(<SupplierDetailCard data={mockData} />)
    expect(screen.getByText('测试供应商')).toBeDefined()
    expect(screen.getByText('一般纳税人')).toBeDefined()
    expect(screen.getByText('李四')).toBeDefined()
    expect(screen.getByText('13900139000')).toBeDefined()
    expect(screen.getByText('lisi@test.com')).toBeDefined()
    expect(screen.getByText('北京市朝阳区')).toBeDefined()
    expect(screen.getByText('中国银行')).toBeDefined()
    expect(screen.getByText('6222021234567890')).toBeDefined()
    expect(screen.getByText('ACTIVE')).toBeDefined()
  })

  it('null 字段渲染为占位符', () => {
    render(<SupplierDetailCard data={{ ...mockData, contactPerson: null, phone: null }} />)
    const placeholders = screen.getAllByText('-')
    expect(placeholders.length).toBeGreaterThanOrEqual(2)
  })
})

describe('IncomeContractDetailCard', () => {
  const mockData = {
    contractNo: 'HT-2024-001',
    customer: { name: '测试客户', contactPerson: '王五', phone: '13800001111' },
    totalAmount: 100000,
    taxRate: '6%',
    pricingMethod: '固定单价',
    projectSourceId: 'PRJ-001',
    signedDate: '2024-01-15T10:00:00Z',
    createdAt: '2024-01-10T08:00:00Z',
    splitStages: [
      { name: '预付款', amount: 30000 },
      { name: '进度款', amount: 50000 },
      { name: '尾款', amount: 20000 },
    ],
  }

  it('渲染合同基本信息', () => {
    render(<IncomeContractDetailCard data={mockData} />)
    expect(screen.getByText('合同编号')).toBeDefined()
    expect(screen.getByText('HT-2024-001')).toBeDefined()
    expect(screen.getByText('测试客户')).toBeDefined()
  })

  it('渲染分期付款子表', () => {
    render(<IncomeContractDetailCard data={mockData} />)
    expect(screen.getByText(/分期付款/)).toBeDefined()
    expect(screen.getByText('预付款')).toBeDefined()
    expect(screen.getByText('进度款')).toBeDefined()
    expect(screen.getByText('尾款')).toBeDefined()
  })

  it('无分期时不渲染子表', () => {
    render(<IncomeContractDetailCard data={{ ...mockData, splitStages: [] }} />)
    expect(screen.queryByText(/分期付款/)).toBeNull()
  })
})

describe('SalaryPaymentDetailCard', () => {
  const mockData = {
    batchNo: 'SAL-2024-001',
    period: '2024-01',
    employeeCount: 10,
    status: '已审批',
    totalGrossSalary: 200000,
    totalNetSalary: 160000,
    totalBankOutflow: 160000,
    totalSocialInsurancePersonal: 15000,
    totalHousingFundPersonal: 10000,
    totalIncomeTax: 15000,
    items: [
      { id: '1', employee: { realName: '张三' }, grossSalary: 20000, totalDeduction: 4000, netSalary: 16000 },
      { id: '2', employee: { realName: '李四' }, grossSalary: 18000, totalDeduction: 3600, netSalary: 14400 },
    ],
  }

  it('渲染批次基本信息', () => {
    render(<SalaryPaymentDetailCard data={mockData} />)
    expect(screen.getByText('SAL-2024-001')).toBeDefined()
    expect(screen.getByText('2024-01')).toBeDefined()
    expect(screen.getByText('10 人')).toBeDefined()
  })

  it('渲染工资汇总', () => {
    render(<SalaryPaymentDetailCard data={mockData} />)
    expect(screen.getByText('工资汇总')).toBeDefined()
    expect(screen.getByText('应发总额')).toBeDefined()
    expect(screen.getByText('实发总额')).toBeDefined()
  })

  it('渲染员工明细', () => {
    render(<SalaryPaymentDetailCard data={mockData} />)
    expect(screen.getByText(/发放明细/)).toBeDefined()
    expect(screen.getByText('张三')).toBeDefined()
    expect(screen.getByText('李四')).toBeDefined()
  })

  it('data 为 null 时渲染无数据提示', () => {
    render(<SalaryPaymentDetailCard data={null} />)
    expect(screen.getByText('无数据')).toBeDefined()
  })
})

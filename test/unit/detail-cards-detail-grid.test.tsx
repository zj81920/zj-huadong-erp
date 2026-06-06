// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DetailGrid } from '../../src/components/detail-cards/DetailGrid'

afterEach(() => { cleanup() })

describe('DetailGrid', () => {
  it('渲染指定数量的字段行（默认2列）', () => {
    render(
      <DetailGrid
        fields={[
          { label: '名称', value: '供应商A' },
          { label: '联系人', value: '张三' },
          { label: '电话', value: '13800138000' },
        ]}
      />
    )
    expect(screen.getByText('名称')).toBeDefined()
    expect(screen.getByText('供应商A')).toBeDefined()
    expect(screen.getByText('联系人')).toBeDefined()
    expect(screen.getByText('张三')).toBeDefined()
    expect(screen.getByText('电话')).toBeDefined()
    expect(screen.getByText('13800138000')).toBeDefined()
  })

  it('支持单列模式', () => {
    render(
      <DetailGrid
        fields={[
          { label: '名称', value: '供应商A' },
          { label: '描述', value: '这是一个很长的描述文本' },
        ]}
        columns={1}
      />
    )
    expect(screen.getByText('名称')).toBeDefined()
    expect(screen.getByText('供应商A')).toBeDefined()
  })

  it('值为空时渲染占位符', () => {
    render(
      <DetailGrid
        fields={[
          { label: '名称', value: '' },
          { label: '电话', value: null },
          { label: '金额', value: undefined },
        ]}
      />
    )
    const values = screen.getAllByText('-')
    expect(values.length).toBeGreaterThanOrEqual(3)
  })

  it('fields 为空数组时不渲染任何内容', () => {
    const { container } = render(<DetailGrid fields={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('数字 0 应正常显示而非占位符', () => {
    render(
      <DetailGrid
        fields={[
          { label: '金额', value: 0 },
        ]}
      />
    )
    expect(screen.getByText('0')).toBeDefined()
  })
})

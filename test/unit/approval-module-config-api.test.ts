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
      const prev = result[i - 1].groupName
      const curr = result[i].groupName
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

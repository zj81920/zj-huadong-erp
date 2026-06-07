import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import prisma from '../../src/lib/prisma'

const BASE_URL = 'http://localhost:3000'
let sessionCookie = ''

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  if (!res.ok) throw new Error(`登录失败: ${res.status}`)
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) {
    const match = setCookie.match(/erp_session=[^;]+/)
    if (match) sessionCookie = match[0]
  }
}

function authFetch(url: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      Cookie: sessionCookie,
    },
  })
}

// 辅助：确保源模块有流程节点
async function ensureSourceFlow(businessType: string, flowLevel: string) {
  await authFetch(`${BASE_URL}/api/approval-flows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessType,
      flowLevel,
      nodes: [
        { nodeOrder: 1, nodeName: '部门主管审批', approverRole: 'department_manager' },
        { nodeOrder: 2, nodeName: '总经理审批', approverRole: 'general_manager' },
      ],
    }),
  })
}

// 使用 supplier_change 作为 apply 目标（避免与真实业务数据冲突导致 409）
const TARGET_MODULE = 'supplier_change'

describe('POST /api/approval-flows/apply - 批量应用审批流程', () => {
  beforeAll(async () => {
    await login()
    // 清理目标模块的活跃审批实例和流程定义，避免 409 冲突
    await prisma.approvalInstance.deleteMany({
      where: { businessType: TARGET_MODULE, flowLevel: 'common' },
    })
    await prisma.approvalFlowDefinition.deleteMany({
      where: { businessType: TARGET_MODULE, flowLevel: 'common' },
    })
  })

  afterAll(async () => {
    // 清理测试数据
    await prisma.approvalFlowDefinition.deleteMany({
      where: { businessType: TARGET_MODULE, flowLevel: 'common' },
    })
    await prisma.$disconnect()
  })

  it('缺少必要参数时返回 400', async () => {
    const res = await authFetch(`${BASE_URL}/api/approval-flows/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('源模块不存在时返回 404', async () => {
    const res = await authFetch(`${BASE_URL}/api/approval-flows/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceBusinessType: 'nonexistent_module',
        sourceFlowLevel: 'common',
        targets: [{ businessType: 'supplier', flowLevel: 'common' }],
      }),
    })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toContain('不存在')
  })

  it('正确格式请求：源模块有流程时成功复制到目标模块', async () => {
    // 准备：确保 supplier 模块有流程节点
    await ensureSourceFlow('supplier', 'common')

    const res = await authFetch(`${BASE_URL}/api/approval-flows/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceBusinessType: 'supplier',
        sourceFlowLevel: 'common',
        targets: [{ businessType: TARGET_MODULE, flowLevel: 'common' }],
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.appliedCount).toBe(1)

    // 验证目标模块确实有流程节点了
    const checkRes = await authFetch(`${BASE_URL}/api/approval-flows?businessType=${TARGET_MODULE}&flowLevel=common`)
    const checkJson = await checkRes.json()
    expect(checkJson.data.length).toBe(2) // 2个节点被复制过来
    expect(checkJson.data[0].nodeName).toBe('部门主管审批')
    expect(checkJson.data[1].nodeName).toBe('总经理审批')
  })

  it('空 targets 数组时返回 200 且 appliedCount 为 0', async () => {
    await ensureSourceFlow('supplier', 'common')

    const res = await authFetch(`${BASE_URL}/api/approval-flows/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceBusinessType: 'supplier',
        sourceFlowLevel: 'common',
        targets: [],
      }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.appliedCount).toBe(0)
  })
})

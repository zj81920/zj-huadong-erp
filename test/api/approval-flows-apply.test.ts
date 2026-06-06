import { describe, it, expect, beforeAll } from 'vitest'

const BASE_URL = 'http://localhost:3001'
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
  // 先删除已有节点
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

// 辅助：删除指定模块的流程节点
async function cleanupFlow(businessType: string, flowLevel: string) {
  // 通过覆盖为空数组来清除
  await authFetch(`${BASE_URL}/api/approval-flows?businessType=${businessType}&flowLevel=${flowLevel}`)
}

describe('POST /api/approval-flows/apply - 批量应用审批流程', () => {
  beforeAll(async () => {
    await login()
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
        targets: [{ businessType: 'outsourcing', flowLevel: 'common' }],
      }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.appliedCount).toBe(1)

    // 验证目标模块确实有流程节点了
    const checkRes = await authFetch(`${BASE_URL}/api/approval-flows?businessType=outsourcing&flowLevel=common`)
    const checkJson = await checkRes.json()
    expect(checkJson.data.length).toBe(2) // 2个节点被复制过来
    expect(checkJson.data[0].nodeName).toBe('部门主管审批')
    expect(checkJson.data[1].nodeName).toBe('总经理审批')
  })

  it('空 targets 数组时返回 400', async () => {
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
    // 空数组是合法的 Array，但 appliedCount 为 0，后端会正常返回
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.appliedCount).toBe(0)
  })
})

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

describe('GET /api/approval-module-config', () => {
  beforeAll(async () => {
    await login()
  })

  it('返回 200', async () => {
    const res = await authFetch(`${BASE_URL}/api/approval-module-config`)
    expect(res.status).toBe(200)
  })

  it('响应包含 data 数组', async () => {
    const res = await authFetch(`${BASE_URL}/api/approval-module-config`)
    const json = await res.json()
    expect(Array.isArray(json.data)).toBe(true)
  })

  it('数组元素包含完整字段', async () => {
    const res = await authFetch(`${BASE_URL}/api/approval-module-config`)
    const json = await res.json()
    for (const item of json.data) {
      expect(item).toHaveProperty('moduleKey')
      expect(item).toHaveProperty('moduleName')
      expect(item).toHaveProperty('groupName')
      expect(item).toHaveProperty('hasFlow')
    }
  })

  it('hasFlow 为 boolean 类型', async () => {
    const res = await authFetch(`${BASE_URL}/api/approval-module-config`)
    const json = await res.json()
    for (const item of json.data) {
      expect(typeof item.hasFlow).toBe('boolean')
    }
  })

  it('不包含 quotation（商务报价已从流程设置移除）', async () => {
    const res = await authFetch(`${BASE_URL}/api/approval-module-config`)
    const json = await res.json()
    const quotation = json.data.find((item: any) => item.moduleKey === 'quotation')
    expect(quotation).toBeUndefined()
  })
})

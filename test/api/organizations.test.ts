import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = 'http://localhost:3000';
let sessionCookie = '';

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  if (!res.ok) {
    throw new Error(`登录失败: ${res.status}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/erp_session=[^;]+/);
    if (match) sessionCookie = match[0];
  }
}

function authFetch(url: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      Cookie: sessionCookie,
    },
  });
}

describe('Organizations API', () => {
  beforeAll(async () => {
    await login();
  });

  it('GET /api/organizations 返回所有活跃主体', async () => {
    const res = await authFetch(`${BASE_URL}/api/organizations`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThanOrEqual(4);
    const branch = body.data.find((o: any) => o.code === 'BRANCH');
    expect(branch).toBeDefined();
    expect(branch.type).toBe('BRANCH');
  });

  it('GET /api/organizations?type=PARENT 只返回总公司', async () => {
    const res = await authFetch(`${BASE_URL}/api/organizations?type=PARENT`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].code).toBe('HQ');
  });
});

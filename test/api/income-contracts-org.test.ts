import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../../src/lib/prisma';

const BASE_URL = 'http://localhost:3000';
let sessionCookie = '';

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  if (!res.ok) throw new Error(`登录失败: ${res.status}`);
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

describe('收入合同 - 经营主体', () => {
  let branchOrgId: string;
  let testCustomerId: string;

  beforeAll(async () => {
    await login();
    const branch = await prisma.organization.findUnique({ where: { code: 'BRANCH' } });
    branchOrgId = branch!.id;

    // 确保有客户数据
    let customer = await prisma.customer.findFirst({ where: { isActive: true } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: '测试客户-TDD',
          contactPerson: '测试',
          phone: '13800000000',
        },
      });
    }
    testCustomerId = customer.id;
  });

  it('创建收入合同时可以指定 organizationId', async () => {
    const res = await authFetch(`${BASE_URL}/api/income-contracts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: branchOrgId,
        customerId: testCustomerId,
        totalAmount: '100000',
        contractNo: `TEST-ORG-${Date.now()}`,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.organizationId).toBe(branchOrgId);

    // 清理测试数据
    if (body.data?.id) {
      await prisma.incomeContract.delete({ where: { id: body.data.id } }).catch(() => {});
    }
  });

  it('筛选 organizationId 只返回对应主体的合同', async () => {
    const res = await authFetch(
      `${BASE_URL}/api/income-contracts?organizationId=${branchOrgId}`
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    if (body.data && body.data.length > 0) {
      body.data.forEach((c: any) => {
        expect(c.organizationId).toBe(branchOrgId);
      });
    }
  });
});

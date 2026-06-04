import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

describe('内部结算合同 API', () => {
  let hqOrgId: string;
  let branchOrgId: string;
  let createdId: string | null = null;

  beforeAll(async () => {
    await login();
    const hq = await prisma.organization.findUnique({ where: { code: 'HQ' } });
    const branch = await prisma.organization.findUnique({ where: { code: 'BRANCH' } });
    hqOrgId = hq!.id;
    branchOrgId = branch!.id;
  });

  afterAll(async () => {
    // 清理测试数据
    if (createdId) {
      await prisma.interOrgContract.delete({ where: { id: createdId } }).catch(() => {});
    }
  });

  it('POST 创建内部结算合同（管理费结算）', async () => {
    const res = await authFetch(`${BASE_URL}/api/inter-org-contracts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractNo: `INT-TEST-${Date.now()}`,
        contractName: '测试-管理费结算',
        fromOrgId: hqOrgId,
        toOrgId: branchOrgId,
        type: 'MANAGEMENT_FEE',
        mainContractAmount: 100000,
        managementFee: 10000,
        taxBurden: 0,
        otherFee: 0,
        settlementAmount: 90000,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.fromOrgId).toBe(hqOrgId);
    expect(body.data.toOrgId).toBe(branchOrgId);
    expect(Number(body.data.settlementAmount)).toBe(90000);
    expect(Number(body.data.managementFee)).toBe(10000);
    createdId = body.data.id;
  });

  it('GET 返回内部结算合同列表', async () => {
    const res = await authFetch(`${BASE_URL}/api/inter-org-contracts`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeInstanceOf(Array);
  });

  it('GET 单条详情', async () => {
    if (!createdId) throw new Error('前置测试未创建合同');
    const res = await authFetch(`${BASE_URL}/api/inter-org-contracts/${createdId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.id).toBe(createdId);
    expect(body.data.fromOrg).toBeDefined();
    expect(body.data.toOrg).toBeDefined();
  });
});

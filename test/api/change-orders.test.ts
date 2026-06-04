import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../../src/lib/prisma';

const BASE_URL = 'http://localhost:3000';
let sessionCookie = '';
let testContractId: string;
let createdOrderId: string | null = null;

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

describe('合同变更单 API', () => {
  beforeAll(async () => {
    await login();
    // 找一个已批准的收入合同作为测试数据
    const contract = await prisma.incomeContract.findFirst({
      where: { status: '已批准' },
    });
    if (contract) {
      testContractId = contract.id;
    } else {
      // 如果没有已批准的，找任意一个
      const anyContract = await prisma.incomeContract.findFirst();
      testContractId = anyContract!.id;
    }
  });

  afterAll(async () => {
    if (createdOrderId) {
      await prisma.contractChangeOrder.delete({ where: { id: createdOrderId } }).catch(() => {});
    }
  });

  it('POST 创建变更单', async () => {
    const res = await authFetch(`${BASE_URL}/api/change-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractType: 'income_contract',
        contractId: testContractId,
        changeReason: '测试变更原因',
        previousAmount: 100000,
        previousData: { paymentTerms: '一次性付清' },
        newAmount: 120000,
        newData: { paymentTerms: '分期付款' },
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.changeReason).toBe('测试变更原因');
    expect(Number(body.data.amountDifference)).toBe(20000);
    expect(body.data.status).toBe('草稿');
    expect(body.data.contractType).toBe('income_contract');
    createdOrderId = body.data.id;
  });

  it('GET 返回变更单列表', async () => {
    const res = await authFetch(`${BASE_URL}/api/change-orders`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('GET 单条变更单详情', async () => {
    if (!createdOrderId) throw new Error('前置测试未创建变更单');
    const res = await authFetch(`${BASE_URL}/api/change-orders/${createdOrderId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(createdOrderId);
    expect(body.data.relatedContract).toBeDefined();
  });

  it('PUT 更新变更单', async () => {
    if (!createdOrderId) throw new Error('前置测试未创建变更单');
    const res = await authFetch(`${BASE_URL}/api/change-orders/${createdOrderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changeReason: '更新后的变更原因',
        newAmount: 130000,
        previousAmount: 100000,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.changeReason).toBe('更新后的变更原因');
  });

  it('POST 变更原因为空时返回400', async () => {
    const res = await authFetch(`${BASE_URL}/api/change-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractType: 'income_contract',
        contractId: testContractId,
        changeReason: '',
        previousAmount: 100000,
        newAmount: 120000,
      }),
    });
    expect(res.status).toBe(400);
  });
});

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

describe('工资批次创建 API', () => {
  let createdBatchId: string | null = null;
  let activeEmployees: { id: string; realName: string }[] = [];

  beforeAll(async () => {
    await login();
    activeEmployees = await prisma.user.findMany({
      where: { isActive: true, employmentStatus: { in: ['active', 'probation'] } },
      select: { id: true, realName: true },
    });
  });

  afterAll(async () => {
    if (createdBatchId) {
      await prisma.salaryBatch.delete({ where: { id: createdBatchId } }).catch(() => {});
    }
  });

  it('POST 不带 employeeIds 时，应自动纳入所有在职员工', async () => {
    const testPeriod = '2121-01';
    const res = await authFetch(`${BASE_URL}/api/salary-batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period: testPeriod,
        title: `${testPeriod}月测试工资批次`,
        remark: 'TDD 测试：自动获取在职员工',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.batchNo).toBeDefined();
    expect(body.data.period).toBe(testPeriod);
    expect(body.data.employeeCount).toBe(activeEmployees.length);
    expect(body.data.items).toHaveLength(activeEmployees.length);

    const itemEmpIds = body.data.items.map((i: any) => i.employeeId);
    const activeEmpIds = activeEmployees.map(e => e.id);
    itemEmpIds.forEach((id: string) => {
      expect(activeEmpIds).toContain(id);
    });

    const totalGross = body.data.items.reduce(
      (s: number, i: any) => s + Number(i.grossSalary),
      0
    );
    expect(Number(body.data.totalGrossSalary)).toBe(totalGross);

    createdBatchId = body.data.id;
  });

  it('POST 带 employeeIds 时，应仅包含指定员工（兼容）', async () => {
    const testPeriod = '2121-02';
    const subsetIds = activeEmployees.slice(0, 2).map(e => e.id);

    const res = await authFetch(`${BASE_URL}/api/salary-batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period: testPeriod,
        title: `${testPeriod}月指定员工批次`,
        employeeIds: subsetIds,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.employeeCount).toBe(subsetIds.length);

    await prisma.salaryBatch.delete({ where: { id: body.data.id } }).catch(() => {});
  });

  it('POST 每个明细项的实发 = 应发 - 扣款合计', async () => {
    const testPeriod = '2121-03';
    const res = await authFetch(`${BASE_URL}/api/salary-batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: testPeriod, title: `${testPeriod}月全部在职` }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    const firstItem = body.data.items[0];
    if (firstItem) {
      expect(firstItem.grossSalary).toBeDefined();
      expect(firstItem.netSalary).toBeDefined();
      expect(Number(firstItem.netSalary)).toBe(
        Number(firstItem.grossSalary) - Number(firstItem.totalDeduction)
      );
    }

    await prisma.salaryBatch.delete({ where: { id: body.data.id } }).catch(() => {});
  });

  it('GET /api/salary-batches/preview 返回在职员工薪酬预览', async () => {
    const testPeriod = '2121-12';
    const res = await authFetch(
      `${BASE_URL}/api/salary-batches/preview?period=${testPeriod}`
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.items).toBeDefined();
    expect(body.data.items.length).toBe(activeEmployees.length);
    expect(body.data.batchNo).toBeDefined(); // 预览也生成批次号

    // 预览不应保存到数据库
    const existingInDb = await prisma.salaryBatch.findFirst({
      where: { period: testPeriod },
    });
    expect(existingInDb).toBeNull();
  });

  it('POST 带 items 参数时，应以传入的明细为准', async () => {
    const testPeriod = '2121-04';
    const customItem = {
      employeeId: activeEmployees[0].id,
      baseSalary: 50000,
      bonus: 500,
      allowance: 200,
      grossSalary: 50700,
      socialInsurancePersonal: 1050,
      socialInsuranceCompany: 2100,
      housingFundPersonal: 600,
      housingFundCompany: 600,
      incomeTax: 100,
      otherDeduction: 0,
      totalDeduction: 1750,
      netSalary: 48950,
    };

    const res = await authFetch(`${BASE_URL}/api/salary-batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period: testPeriod,
        title: `${testPeriod}月自定义明细`,
        items: [customItem],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.employeeCount).toBe(1);
    expect(body.data.items[0].employeeId).toBe(activeEmployees[0].id);
    expect(Number(body.data.items[0].baseSalary)).toBe(50000);
    expect(Number(body.data.items[0].bonus)).toBe(500);
    expect(Number(body.data.totalGrossSalary)).toBe(50700);
    expect(Number(body.data.totalNetSalary)).toBe(48950);

    await prisma.salaryBatch.delete({ where: { id: body.data.id } }).catch(() => {});
  });
});

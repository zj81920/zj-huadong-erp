import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("人事行政模块 API", () => {
  test.describe.configure({ mode: "serial" });

  const ids: Record<string, string> = {};
  const ts = Date.now();

  async function loginViaApi(request: any) {
    const r = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.ok()).toBeTruthy();
  }

  async function apiPost(ctx: any, url: string, body: unknown) {
    const r = await ctx.post(`${BASE_URL}${url}`, { data: body, headers: { "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok()) throw new Error(`POST ${url} ${r.status()}: ${JSON.stringify(j)}`);
    return j;
  }

  async function apiPut(ctx: any, url: string, body: unknown) {
    const r = await ctx.put(`${BASE_URL}${url}`, { data: body, headers: { "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok()) throw new Error(`PUT ${url} ${r.status()}: ${JSON.stringify(j)}`);
    return j;
  }

  async function apiDelete(ctx: any, url: string) {
    const r = await ctx.delete(`${BASE_URL}${url}`);
    const j = await r.json();
    if (!r.ok()) throw new Error(`DELETE ${url} ${r.status()}: ${JSON.stringify(j)}`);
    return j;
  }

  test("Step 1: 登录", async ({ request }) => {
    await loginViaApi(request);
  });

  test("Step 2: 员工管理 CRUD", async ({ request }) => {
    await loginViaApi(request);
    const username = `test-hr-${ts}`;
    const realName = `测试员工-${ts}`;

    const createRes = await apiPost(request, "/api/hr/employees", {
      username,
      realName,
      phone: "13800138000",
      email: `${ts}@test.com`,
      role: "staff",
      department: "技术部",
      position: "工程师",
      employmentStatus: "在职",
      hireDate: "2026-01-01",
    });
    expect(createRes.data).toBeDefined();
    expect(createRes.data.username).toBe(username);
    ids.employeeId = createRes.data.id;

    const getRes = await request.get(`${BASE_URL}/api/hr/employees?pageSize=50`);
    expect(getRes.ok()).toBeTruthy();
    const getJson = await getRes.json();
    expect(getJson.data.length).toBeGreaterThan(0);

    const updatedName = `测试员工-更新-${ts}`;
    const putRes = await apiPut(request, `/api/hr/employees/${ids.employeeId}`, {
      realName: updatedName,
      position: "高级工程师",
    });
    expect(putRes.data.realName).toBe(updatedName);

    const delRes = await apiDelete(request, `/api/hr/employees/${ids.employeeId}`);
    expect(delRes.message).toBe("员工已禁用");
  });

  test("Step 3: 办公用品 CRUD", async ({ request }) => {
    await loginViaApi(request);
    const name = `测试办公用品-${ts}`;

    const createRes = await apiPost(request, "/api/office-supplies", {
      name,
      category: "办公耗材",
      spec: "A4",
      unit: "包",
      quantity: 100,
      unitPrice: 25,
      totalPrice: 2500,
      storeLocation: "A柜-01层",
    });
    expect(createRes.data).toBeDefined();
    expect(createRes.data.name).toBe(name);
    ids.officeSupplyId = createRes.data.id;

    const updatedName = `测试办公用品-更新-${ts}`;
    const putRes = await apiPut(request, `/api/office-supplies/${ids.officeSupplyId}`, {
      name: updatedName,
      quantity: 200,
    });
    expect(putRes.data.name).toBe(updatedName);

    const delRes = await apiDelete(request, `/api/office-supplies/${ids.officeSupplyId}`);
    expect(delRes.message).toBe("删除成功");
  });

  test("Step 4: 证照管理 CRUD", async ({ request }) => {
    await loginViaApi(request);
    const name = `测试证照-${ts}`;

    const createRes = await apiPost(request, "/api/certificates", {
      name,
      certNo: `CERT-${ts}`,
      certType: "营业执照",
      issuer: "市场监督管理局",
      issueDate: "2026-01-01",
      expireDate: "2030-12-31",
      holder: "华东工程",
      status: "有效",
    });
    expect(createRes.data).toBeDefined();
    expect(createRes.data.name).toBe(name);
    ids.certificateId = createRes.data.id;

    const updatedName = `测试证照-更新-${ts}`;
    const putRes = await apiPut(request, `/api/certificates/${ids.certificateId}`, {
      name: updatedName,
      status: "过期",
    });
    expect(putRes.data.name).toBe(updatedName);

    const delRes = await apiDelete(request, `/api/certificates/${ids.certificateId}`);
    expect(delRes.message).toBe("删除成功");
  });

  test("Step 5: 印章管理 CRUD", async ({ request }) => {
    await loginViaApi(request);
    const name = `测试印章-${ts}`;

    const createRes = await apiPost(request, "/api/seals", {
      name,
      sealType: "公章",
      custodian: "张三",
      location: "档案室B区",
      status: "在库",
    });
    expect(createRes.data).toBeDefined();
    expect(createRes.data.name).toBe(name);
    ids.sealId = createRes.data.id;

    const updatedName = `测试印章-更新-${ts}`;
    const putRes = await apiPut(request, `/api/seals/${ids.sealId}`, {
      name: updatedName,
      custodian: "李四",
    });
    expect(putRes.data.name).toBe(updatedName);

    const delRes = await apiDelete(request, `/api/seals/${ids.sealId}`);
    expect(delRes.message).toBe("删除成功");
  });
});

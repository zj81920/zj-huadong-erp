import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("系统设置模块 API", () => {
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

  test("Step 2: 部门管理 CRUD", async ({ request }) => {
    await loginViaApi(request);
    const name = `测试部门-${ts}`;

    const createRes = await apiPost(request, "/api/departments", {
      name,
      sort: 0,
    });
    expect(createRes.data).toBeDefined();
    expect(createRes.data.name).toBe(name);
    ids.departmentId = createRes.data.id;

    const updatedName = `测试部门-更新-${ts}`;
    const putRes = await apiPut(request, `/api/departments/${ids.departmentId}`, {
      name: updatedName,
      sort: 1,
    });
    expect(putRes.data.name).toBe(updatedName);

    const getRes = await request.get(`${BASE_URL}/api/departments`);
    expect(getRes.ok()).toBeTruthy();
    const getJson = await getRes.json();
    expect(getJson.data.length).toBeGreaterThan(0);

    const delRes = await apiDelete(request, `/api/departments/${ids.departmentId}`);
    expect(delRes.data.id).toBe(ids.departmentId);
  });

  test("Step 3: 角色管理 CRUD", async ({ request }) => {
    await loginViaApi(request);
    const deptName = `测试部门-角色-${ts}`;
    const deptRes = await apiPost(request, "/api/departments", {
      name: deptName,
      sort: 0,
    });
    ids.roleDeptId = deptRes.data.id;

    const name = `测试角色-${ts}`;

    const createRes = await apiPost(request, "/api/roles", {
      name,
      code: `role_${ts}`,
      departmentId: ids.roleDeptId,
      description: `测试角色描述-${ts}`,
    });
    expect(createRes.data).toBeDefined();
    expect(createRes.data.name).toBe(name);
    ids.roleId = createRes.data.id;

    const updatedName = `测试角色-更新-${ts}`;
    const putRes = await apiPut(request, `/api/roles/${ids.roleId}`, {
      name: updatedName,
      description: `更新描述-${ts}`,
    });
    expect(putRes.data.name).toBe(updatedName);

    const getRes = await request.get(`${BASE_URL}/api/roles`);
    expect(getRes.ok()).toBeTruthy();
    const getJson = await getRes.json();
    expect(getJson.data.length).toBeGreaterThan(0);

    await apiDelete(request, `/api/roles/${ids.roleId}`);

    const delRes = await apiDelete(request, `/api/departments/${ids.roleDeptId}`);
    expect(delRes.data.id).toBe(ids.roleDeptId);
  });

  test("Step 4: 系统用户列表 GET", async ({ request }) => {
    await loginViaApi(request);
    const getRes = await request.get(`${BASE_URL}/api/settings/users?pageSize=50`);
    expect(getRes.ok()).toBeTruthy();
    const getJson = await getRes.json();
    expect(Array.isArray(getJson.data)).toBeTruthy();
  });

  test("Step 5: 审批流配置 POST", async ({ request }) => {
    await loginViaApi(request);
    const businessType = `test_e2e_hr_${ts}`;
    const flowLevel = "common";

    const createRes = await apiPost(request, "/api/approval-flows", {
      businessType,
      flowLevel,
      nodes: [
        { nodeOrder: 1, nodeName: "管理员审批", approverRole: "admin" },
      ],
    });
    expect(createRes.data).toBeDefined();
    expect(createRes.data.count).toBe(1);

    const getRes = await request.get(`${BASE_URL}/api/approval-flows?businessType=${businessType}&flowLevel=${flowLevel}`);
    expect(getRes.ok()).toBeTruthy();
    const getJson = await getRes.json();
    expect(getJson.data.length).toBeGreaterThan(0);
  });
});

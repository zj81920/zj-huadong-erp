import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

test.describe("DS 同步开关", () => {
  test.describe.configure({ mode: "serial" });

  const ts = Date.now();
  const ids: Record<string, string> = {};

  async function login(ctx: any) {
    const r = await ctx.post(`${BASE_URL}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.ok()).toBeTruthy();
  }

  async function apiPost(ctx: any, url: string, body: unknown) {
    const r = await ctx.post(`${BASE_URL}${url}`, {
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    const j = await r.json();
    if (!r.ok()) throw new Error(`POST ${url} ${r.status()}: ${JSON.stringify(j)}`);
    return j;
  }

  async function apiPut(ctx: any, url: string, body: unknown) {
    const r = await ctx.put(`${BASE_URL}${url}`, {
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    const j = await r.json();
    if (!r.ok()) throw new Error(`PUT ${url} ${r.status()}: ${JSON.stringify(j)}`);
    return j;
  }

  test("Step 1: 登录并创建前置数据", async ({ request }) => {
    await login(request);

    // 创建测试客户
    const cust = await apiPost(request, "/api/customers", {
      name: `DS开关测试客户-${ts}`,
      ownershipType: "民营",
    });
    ids.customerId = cust.data.id;

    // 创建测试项目线索（已中标）
    const lead = await apiPost(request, "/api/project-leads", {
      customerId: ids.customerId,
      projectName: `DS开关测试项目-${ts}`,
      projectNature: "EP",
      currentStatus: "已中标",
      implementationEntity: "华东工程",
    });
    ids.projectSourceId = lead.data.projectSourceId;
  });

  test("Step 2: 关闭同步开关 → 创建项目 → 不应同步到 DS", async ({ request }) => {
    await login(request);

    // 关闭 DS 同步
    await apiPut(request, "/api/system-settings", {
      settings: { ds_sync_disabled: "true" },
    });

    // 创建项目
    const project1 = await apiPost(request, "/api/projects", {
      projectSourceId: ids.projectSourceId,
      projectCode: `DS-OFF-${ts}`,
      name: `DS关闭测试-${ts}`,
      customerId: ids.customerId,
      startDate: "2025-01-01",
      plannedEndDate: "2025-12-31",
      source: "项目线索",
    });

    // 验证：dsProjectCode 应为 null（未同步）
    expect(project1.data.dsProjectCode).toBeNull();
    ids.project1Id = project1.data.id;
  });

  test("Step 3: 开启同步开关 → 创建项目 → 应同步到 DS", async ({ request }) => {
    await login(request);

    // 开启 DS 同步
    await apiPut(request, "/api/system-settings", {
      settings: { ds_sync_disabled: "false" },
    });

    // 创建另一个项目线索
    const lead2 = await apiPost(request, "/api/project-leads", {
      customerId: ids.customerId,
      projectName: `DS开关测试项目2-${ts}`,
      projectNature: "EP",
      currentStatus: "已中标",
      implementationEntity: "华东工程",
    });
    ids.projectSourceId2 = lead2.data.projectSourceId;

    // 创建项目
    const project2 = await apiPost(request, "/api/projects", {
      projectSourceId: ids.projectSourceId2,
      projectCode: `DS-ON-${ts}`,
      name: `DS开启测试-${ts}`,
      customerId: ids.customerId,
      startDate: "2025-01-01",
      plannedEndDate: "2025-12-31",
      source: "项目线索",
    });

    // 验证：dsProjectCode 应有值（已同步到 DS）
    expect(project2.data.dsProjectCode).toBeTruthy();
    ids.project2Id = project2.data.id;
  });

  test("Step 4: 清理测试数据", async ({ request }) => {
    await login(request);
    // 开启同步（恢复默认）
    await apiPut(request, "/api/system-settings", {
      settings: { ds_sync_disabled: "false" },
    });
    // 删除测试项目
    if (ids.project1Id) {
      await request.delete(`${BASE_URL}/api/projects/${ids.project1Id}`);
    }
    if (ids.project2Id) {
      await request.delete(`${BASE_URL}/api/projects/${ids.project2Id}`);
    }
    // 删除测试客户
    if (ids.customerId) {
      await request.delete(`${BASE_URL}/api/customers/${ids.customerId}`);
    }
  });
});

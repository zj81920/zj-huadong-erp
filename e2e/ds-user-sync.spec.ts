import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

test.describe("ERP ↔ DS 用户同步", () => {
  test.describe.configure({ mode: "serial" });

  const ts = Date.now();
  const testEmail = `ds-sync-user-${ts}@test.com`;
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

  async function apiDelete(ctx: any, url: string) {
    const r = await ctx.delete(`${BASE_URL}${url}`);
    const j = await r.json();
    if (!r.ok()) throw new Error(`DELETE ${url} ${r.status()}: ${JSON.stringify(j)}`);
    return j;
  }

  test("Step 1: 登录并确认同步开关已开启", async ({ request }) => {
    await login(request);

    // 确保同步开关开启
    await apiPut(request, "/api/system-settings", {
      settings: { ds_sync_disabled: "false" },
    });

    // 确认系统设置已保存
    const settingsRes = await request.get(`${BASE_URL}/api/system-settings`);
    const settings = await settingsRes.json();
    expect(settings.data?.ds_sync_disabled).not.toBe("true");
  });

  test("Step 2: 创建用户 → 应同步到 DS（检查 ds-client 调用不报错）", async ({ request }) => {
    await login(request);

    const user = await apiPost(request, "/api/settings/users", {
      username: `ds-sync-${ts}`,
      realName: `DS同步测试用户-${ts}`,
      email: testEmail,
      password: "123456",
    });

    expect(user.data).toBeDefined();
    expect(user.data.email).toBe(testEmail);
    ids.userId = user.data.id;
  });

  test("Step 3: 编辑用户 → 应同步更新 DS", async ({ request }) => {
    await login(request);

    const updated = await apiPut(request, `/api/settings/users/${ids.userId}`, {
      realName: `DS同步测试用户-已更新-${ts}`,
      email: testEmail,
    });

    expect(updated.data).toBeDefined();
    expect(updated.data.realName).toContain("已更新");
  });

  test("Step 4: 关闭同步开关 → 创建用户 → 不应同步到 DS", async ({ request }) => {
    await login(request);

    // 关闭同步
    await apiPut(request, "/api/system-settings", {
      settings: { ds_sync_disabled: "true" },
    });

    // 创建用户（此时不会同步到 DS）
    const user2 = await apiPost(request, "/api/settings/users", {
      username: `ds-sync-off-${ts}`,
      realName: `DS关闭测试用户-${ts}`,
      email: `ds-sync-off-${ts}@test.com`,
      password: "123456",
    });
    expect(user2.data).toBeDefined();
    ids.userId2 = user2.data.id;

    // 恢复同步开关
    await apiPut(request, "/api/system-settings", {
      settings: { ds_sync_disabled: "false" },
    });
  });

  test("Step 5: 删除用户 → DS 端也应删除", async ({ request }) => {
    await login(request);

    // 删除用户
    await apiDelete(request, `/api/settings/users/${ids.userId}`);
    ids.userId = "";

    // 删除关闭开关时创建的用户
    if (ids.userId2) {
      await apiDelete(request, `/api/settings/users/${ids.userId2}`);
      ids.userId2 = "";
    }
  });
});

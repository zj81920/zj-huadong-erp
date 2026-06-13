import { describe, it, expect, beforeAll } from "vitest";

/**
 * API 集成测试：已立项线索的编辑权限保护
 *
 * 测试场景：
 * 1. 普通用户不能编辑已立项线索 → 403
 * 2. 管理员可以编辑已立项线索的基本信息 → 200
 * 3. 管理员编辑已立项线索时无法修改状态 → 状态不变
 * 4. 管理员编辑已立项线索时无法修改项目名称 → 项目名不变
 *
 * 运行前提：dev server 已启动 (npm run dev)，SSH 隧道已连接
 */

const BASE_URL = "http://localhost:3000/api";

/** 登录并获取 cookie */
async function loginAs(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`登录失败: ${username} (${res.status})`);
  const setCookie = res.headers.getSetCookie();
  return setCookie[0] || "";
}

describe("PUT /api/project-leads/:id — 已立项状态保护", () => {
  let adminCookie: string;
  let userCookie: string;
  let establishedLeadId: string;

  beforeAll(async () => {
    adminCookie = await loginAs("admin", "admin123");
    userCookie = await loginAs("testuser", "test123").catch(() => "");

    // 找一个已立项的线索
    const res = await fetch(`${BASE_URL}/project-leads?status=已立项&pageSize=1`, {
      headers: { Cookie: adminCookie },
    });
    const json = await res.json();
    establishedLeadId = json.data?.list?.[0]?.id;
    if (!establishedLeadId) throw new Error("需要至少一条已立项线索才能运行测试");
  });

  it("普通用户不能编辑已立项线索", async () => {
    if (!userCookie) return; // 没有测试用户则跳过
    const res = await fetch(`${BASE_URL}/project-leads/${establishedLeadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ location: "测试地点-TDD" }),
    });
    expect(res.status).toBe(403);
  });

  it("管理员可以编辑已立项线索的基本信息", async () => {
    const res = await fetch(`${BASE_URL}/project-leads/${establishedLeadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ location: "管理员编辑测试地点", contactPerson: "测试联系人" }),
    });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.location).toBe("管理员编辑测试地点");
    expect(data.contactPerson).toBe("测试联系人");
  });

  it("管理员编辑已立项线索时无法修改状态", async () => {
    const res = await fetch(`${BASE_URL}/project-leads/${establishedLeadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ currentStatus: "放弃" }),
    });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.currentStatus).toBe("已立项"); // 状态不变
  });

  it("管理员编辑已立项线索时无法修改项目名称", async () => {
    const res = await fetch(`${BASE_URL}/project-leads/${establishedLeadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ projectName: "不应该被修改的名称" }),
    });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.projectName).not.toBe("不应该被修改的名称");
  });
});

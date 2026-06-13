import { describe, it, expect, beforeAll } from "vitest";

/**
 * API 集成测试：项目编辑时同步项目名称回线索
 *
 * 测试场景：修改项目名称后，关联线索的 projectName 同步更新
 *
 * 运行前提：dev server 已启动 (npm run dev)，SSH 隧道已连接
 */

const BASE_URL = "http://localhost:3000/api";

async function loginAs(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`登录失败: ${username} (${res.status})`);
  return res.headers.getSetCookie()[0] || "";
}

describe("PUT /api/projects/:id — 项目名称同步回线索", () => {
  let adminCookie: string;
  let projectId: string;
  let projectSourceId: string;
  let originalName: string;

  beforeAll(async () => {
    adminCookie = await loginAs("admin", "admin123");

    // 找一个关联了线索的项目
    const res = await fetch(`${BASE_URL}/projects?pageSize=50`, {
      headers: { Cookie: adminCookie },
    });
    const json = await res.json();
    const project = json.data?.list?.find((p: any) => p.projectLead || p.projectSourceId);
    if (!project) throw new Error("需要至少一个关联了线索的项目");
    projectId = project.id;
    projectSourceId = project.projectSourceId;
    originalName = project.name;
  });

  it("修改项目名称后，关联线索的项目名称同步更新", async () => {
    const newName = `测试同步项目名-${Date.now()}`;

    // 修改项目名称
    const res = await fetch(`${BASE_URL}/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ name: newName }),
    });
    expect(res.status).toBe(200);

    // 通过 projectSourceId 查询关联的线索
    const leadRes = await fetch(`${BASE_URL}/project-leads?pageSize=200`, {
      headers: { Cookie: adminCookie },
    });
    const leadJson = await leadRes.json();
    const lead = leadJson.data?.list?.find((l: any) => l.projectSourceId === projectSourceId);

    if (lead) {
      expect(lead.projectName).toBe(newName);
    }

    // 恢复原始名称
    await fetch(`${BASE_URL}/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ name: originalName }),
    });
  });
});

import { describe, it, expect } from "vitest";

const BASE = "http://localhost:3000";

async function apiGet(url: string) {
  const r = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
  });
  return r.json();
}

describe("GET /api/projects/plans/[projectSourceId]/available-tasks", () => {
  it("返回可外包的 WBS 任务列表", async () => {
    const projects = await apiGet("/api/projects?pageSize=50");
    const project = projects.data?.[0] || projects[0];
    if (!project) { console.log("跳过: 无项目"); return; }
    const psId = project.projectSourceId;

    const res = await apiGet(`/api/projects/plans/${psId}/available-tasks`);
    expect(res).toHaveProperty("tasks");
    expect(Array.isArray(res.tasks)).toBe(true);

    // 验证每个任务都是 Level 4
    for (const task of res.tasks) {
      expect(task.level).toBe(4);
      expect(task.isAvailable !== undefined).toBe(true);
    }
  });

  it("无效项目 ID 返回空数组", async () => {
    const res = await apiGet("/api/projects/plans/nonexistent-id/available-tasks");
    expect(res.tasks).toEqual([]);
  });
});

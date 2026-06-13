import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("外包-WBS 关联全链路测试", () => {
  test.describe.configure({ mode: "serial" });

  async function login(ctx: any) {
    const r = await ctx.post(`${BASE_URL}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.ok()).toBeTruthy();
  }

  test("1. 获取可外包的 WBS 任务列表", async ({ request }) => {
    await login(request);

    const projects = await request.get(`${BASE_URL}/api/projects?pageSize=50`);
    const pj = await projects.json();
    const project = pj.data?.[0] || pj[0];
    if (!project) { test.skip(true, "无项目数据"); return; }
    const psId = project.projectSourceId;

    const res = await request.get(`${BASE_URL}/api/projects/plans/${psId}/available-tasks`);
    const data = await res.json();
    expect(data).toHaveProperty("tasks");
    expect(Array.isArray(data.tasks)).toBe(true);

    for (const task of data.tasks) {
      expect(task.level).toBe(4);
      expect(task.isAvailable).toBeDefined();
    }
  });

  test("2. 创建带 WBS 关联的外包任务（草稿）", async ({ request }) => {
    await login(request);

    const projects = await request.get(`${BASE_URL}/api/projects?pageSize=50`);
    const pj = await projects.json();
    const project = pj.data?.[0] || pj[0];
    if (!project) { test.skip(true, "无项目数据"); return; }
    const psId = project.projectSourceId;

    // 获取可用任务
    const available = await request.get(`${BASE_URL}/api/projects/plans/${psId}/available-tasks`);
    const avData = await available.json();
    const availableTasks = avData.tasks?.filter((t: any) => t.isAvailable) || [];
    if (availableTasks.length === 0) { test.skip(true, "无可外包的 WBS 任务"); return; }

    // 创建外包（草稿）
    const wbsItem = {
      wbsNodeId: availableTasks[0].id,
      workload: 10,
      unit: "张",
      unitPrice: 2000,
      subtotal: 20000,
    };

    const created = await request.post(`${BASE_URL}/api/projects/outsourcing`, {
      data: {
        projectSourceId: psId,
        type: "to_company",
        targetName: "测试外包公司-E2E",
        taskDescription: availableTasks[0].name,
        amount: 20000,
        deliveryDeadline: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        approvalStatus: "草稿",
        wbsItems: [wbsItem],
      },
    });
    const createdData = await created.json();
    expect(createdData.data.id).toBeDefined();
    expect(createdData.data.approvalStatus).toBe("草稿");

    // 草稿状态应无 OutsourcingWbsItem 记录
    const detail = await request.get(`${BASE_URL}/api/projects/outsourcing/${createdData.data.id}`);
    const detailData = await detail.json();
    expect(detailData.data.wbsItems || []).toHaveLength(0);

    // 清理
    await request.delete(`${BASE_URL}/api/projects/outsourcing/${createdData.data.id}`);
  });

  test("3. 无效项目 ID 返回空数组或错误", async ({ request }) => {
    // 不需要登录，验证公开错误响应
    const res = await request.get(`${BASE_URL}/api/projects/plans/nonexistent-id/available-tasks`);
    const data = await res.json();
    // 可能返回 { tasks: [] } 或 { error: "..." }
    expect(data.tasks !== undefined ? data.tasks : []).toEqual([]);
  });

  test("4. WBS 任务选择器过滤 — 仅设计阶段 + Level 4", async ({ request }) => {
    await login(request);

    const projects = await request.get(`${BASE_URL}/api/projects?pageSize=50`);
    const pj = await projects.json();
    const project = pj.data?.[0] || pj[0];
    if (!project) { test.skip(true, "无项目数据"); return; }

    const res = await request.get(`${BASE_URL}/api/projects/plans/${project.projectSourceId}/available-tasks`);
    const data = await res.json();

    for (const task of data.tasks) {
      expect(task.level).toBe(4);
    }
  });

  test("5. 获取外包详情包含 wbsItems 字段", async ({ request }) => {
    await login(request);

    const tasks = await request.get(`${BASE_URL}/api/projects/outsourcing?pageSize=10`);
    const tasksData = await tasks.json();
    const task = tasksData.data?.[0];
    if (!task) { test.skip(true, "无外包数据"); return; }

    const detail = await request.get(`${BASE_URL}/api/projects/outsourcing/${task.id}`);
    const detailData = await detail.json();
    expect(detailData.data).toHaveProperty("wbsItems");
    expect(Array.isArray(detailData.data.wbsItems)).toBe(true);
  });
});

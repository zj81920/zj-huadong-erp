import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("项目管理模块 API", () => {
  test.describe.configure({ mode: "serial" });

  const ids: Record<string, string> = {};
  const ts = Date.now();
  const today = new Date().toISOString().split("T")[0];

  async function apiPost(ctx: any, url: string, body: unknown) {
    const r = await ctx.post(`${BASE_URL}${url}`, { data: body, headers: { "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok()) throw new Error(`POST ${url} ${r.status()}: ${JSON.stringify(j)}`);
    return j;
  }

  async function apiGet(ctx: any, url: string) {
    const r = await ctx.get(`${BASE_URL}${url}`);
    const j = await r.json();
    if (!r.ok()) throw new Error(`GET ${url} ${r.status()}: ${JSON.stringify(j)}`);
    return j;
  }

  async function login(ctx: any) {
    const r = await ctx.post(`${BASE_URL}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.ok()).toBeTruthy();
  }

  test("Step 1: 登录并创建前置数据（客户+项目线索+项目）", async ({ request }) => {
    await login(request);
    console.log("✅ API 登录成功");

    const cust = await apiPost(request, "/api/customers", {
      name: `测试客户-PROJ-${ts}`,
      industryType: "化工",
      contactPerson: "张三",
      phone: "13800138000",
      address: "测试路100号",
    });
    ids.customerId = cust.data.id;
    console.log(`✅ 客户: ${cust.data.name}`);

    const lead = await apiPost(request, "/api/project-leads", {
      customerId: ids.customerId,
      projectName: `PROJ测试项目-${ts}`,
      location: "安徽省合肥市",
      contactPerson: "王工",
      contactPhone: "13900139000",
      projectNature: ["EP"],
      implementationEntity: "华东工程",
      currentStatus: "已中标",
    });
    ids.projectSourceId = lead.data.projectSourceId;
    console.log(`✅ 项目线索: ${ids.projectSourceId}`);

    const proj = await apiPost(request, "/api/projects", {
      projectSourceId: ids.projectSourceId,
      projectCode: `PROJ-${ts}`,
      name: `PROJ测试项目-${ts}`,
      customerId: ids.customerId,
      projectCategory: "EP",
      source: "项目线索",
      status: "执行",
    });
    ids.projectId = proj.data.id;
    console.log(`✅ 项目: ${proj.data.projectCode}`);
    console.log("✅ Step 1 完成");
  });

  test("Step 2: GET /api/projects 列表查询", async ({ request }) => {
    await login(request);

    const res = await apiGet(request, "/api/projects?pageSize=10");
    expect(Array.isArray(res.data)).toBeTruthy();
    expect(res.pagination).toBeDefined();
    console.log(`✅ 项目列表: ${res.data.length} 条`);
    console.log("✅ Step 2 完成");
  });

  test("Step 3: POST /api/projects/plans 创建项目计划", async ({ request }) => {
    await login(request);

    const usersRes = await apiGet(request, "/api/users?pageSize=200");
    const adminUser = usersRes.data.find((u: any) => u.username === "admin");
    if (adminUser) ids.responsibleId = adminUser.id;

    const plan = await apiPost(request, "/api/projects/plans", {
      projectSourceId: ids.projectSourceId,
      planType: "总体计划",
      planContent: `项目总体实施计划-${ts}`,
      startDate: today,
      endDate: today,
      responsibleId: ids.responsibleId || null,
      actualProgress: 0,
      status: "未开始",
    });
    ids.planId = plan.data.id;
    expect(plan.data.projectSourceId).toBe(ids.projectSourceId);
    console.log(`✅ 项目计划: ${plan.data.id}`);

    const plansList = await apiGet(request, `/api/projects/plans?projectSourceId=${ids.projectSourceId}`);
    expect(plansList.data.length).toBeGreaterThanOrEqual(1);
    console.log(`✅ 项目计划列表: ${plansList.data.length} 条`);
    console.log("✅ Step 3 完成");
  });

  test("Step 4: POST /api/projects/progress 创建项目进度", async ({ request }) => {
    await login(request);

    const progress = await apiPost(request, "/api/projects/progress", {
      projectSourceId: ids.projectSourceId,
      taskNode: `设计阶段-${ts}`,
      plannedPercentage: 50,
      actualPercentage: 30,
      delayDays: 2,
    });
    ids.progressId = progress.data.id;
    expect(progress.data.projectSourceId).toBe(ids.projectSourceId);
    expect(progress.data.alertStatus).toBe("滞后");
    console.log(`✅ 项目进度: ${progress.data.id}`);

    const progressList = await apiGet(request, `/api/projects/progress?projectSourceId=${ids.projectSourceId}`);
    expect(progressList.data.length).toBeGreaterThanOrEqual(1);
    console.log(`✅ 项目进度列表: ${progressList.data.length} 条`);
    console.log("✅ Step 4 完成");
  });

  test("Step 5: POST /api/projects/outsourcing 创建设计外包任务", async ({ request }) => {
    await login(request);

    const supp = await apiPost(request, "/api/suppliers", {
      name: `测试供应商-PROJ-${ts}`,
      supplierType: "企业",
      status: "当前有效",
      contactPerson: "赵六",
      phone: "13700137000",
      address: "测试路200号",
    });
    ids.supplierId = supp.data.id;
    console.log(`✅ 供应商: ${supp.data.name}`);

    const outsourcing = await apiPost(request, "/api/projects/outsourcing", {
      projectSourceId: ids.projectSourceId,
      type: "to_company",
      supplierId: ids.supplierId,
      taskDescription: `工艺设计外包-${ts}`,
      workload: "50人天",
      deliveryDeadline: today,
      amount: "50000",
    });
    ids.outsourcingId = outsourcing.data.id;
    expect(outsourcing.data.projectSourceId).toBe(ids.projectSourceId);
    console.log(`✅ 外包任务: ${outsourcing.data.id}`);

    const outsourcingList = await apiGet(request, `/api/projects/outsourcing?projectSourceId=${ids.projectSourceId}`);
    expect(outsourcingList.data.length).toBeGreaterThanOrEqual(1);
    console.log(`✅ 外包任务列表: ${outsourcingList.data.length} 条`);
    console.log("✅ Step 5 完成");
  });

  test("Step 6: 清理数据", async ({ request }) => {
    await login(request);

    if (ids.outsourcingId) {
      await request.delete(`${BASE_URL}/api/projects/outsourcing/${ids.outsourcingId}`);
      console.log("✅ 外包任务已清理");
    }
    console.log("✅ Step 6 完成");
    console.log("🎉 项目管理模块 API 测试完成！");
  });
});

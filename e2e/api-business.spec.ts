import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("商务管理模块 API 测试", () => {
  test.describe.configure({ mode: "serial" });

  const ids: Record<string, string> = {};
  const ts = Date.now();

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

  async function loginViaApi(request: any) {
    const r = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.ok()).toBeTruthy();
  }

  test("登录并创建基础依赖数据", async ({ request }) => {
    await loginViaApi(request);

    const custRes = await apiPost(request, "/api/customers", {
      name: `测试客户-BASE-${ts}`,
      contactPerson: "张三",
      phone: "13800138000",
      industryType: "化工",
      customerGrade: "B",
    });
    ids.customerId = custRes.data.id;

    const suppRes = await apiPost(request, "/api/suppliers", {
      name: `测试供应商-BASE-${ts}`,
      supplierType: "企业",
      status: "当前有效",
      contactPerson: "李四",
      phone: "13900139000",
    });
    ids.supplierId = suppRes.data.id;

    const leadForBidding = await apiPost(request, "/api/project-leads", {
      customerId: ids.customerId,
      projectName: `投标测试项目-${ts}`,
      location: "安徽省合肥市",
      contactPerson: "王工",
      contactPhone: "13700137000",
      projectNature: ["EP"],
      implementationEntity: "华东工程",
      currentStatus: "跟踪中",
    });
    ids.projectSourceIdForBidding = leadForBidding.data.projectSourceId;

    const leadForQuotation = await apiPost(request, "/api/project-leads", {
      customerId: ids.customerId,
      projectName: `报价测试项目-${ts}`,
      location: "安徽省合肥市",
      contactPerson: "赵工",
      contactPhone: "13600136000",
      projectNature: ["EPC"],
      implementationEntity: "华东工程",
      currentStatus: "跟踪中",
    });
    ids.projectSourceIdForQuotation = leadForQuotation.data.projectSourceId;
  });

  test("客户管理 - CRUD", async ({ request }) => {
    await loginViaApi(request);

    const createRes = await apiPost(request, "/api/customers", {
      name: `测试客户-CRUD-${ts}`,
      contactPerson: "张三丰",
      phone: "13800138001",
      industryType: "电子",
      customerGrade: "A",
    });
    const customerId = createRes.data.id;
    expect(createRes.data.name).toBe(`测试客户-CRUD-${ts}`);
    expect(createRes.data.phone).toBe("13800138001");

    const listRes = await request.get(`${BASE_URL}/api/customers?pageSize=50`);
    const listJson = await listRes.json();
    expect(listRes.ok()).toBeTruthy();
    expect(Array.isArray(listJson.data)).toBeTruthy();
    expect(listJson.pagination).toBeDefined();
    expect(typeof listJson.pagination.total).toBe("number");

    const detailRes = await request.get(`${BASE_URL}/api/customers/${customerId}`);
    const detailJson = await detailRes.json();
    expect(detailRes.ok()).toBeTruthy();
    expect(detailJson.data.id).toBe(customerId);
    expect(detailJson.data.name).toBe(`测试客户-CRUD-${ts}`);

    const updateRes = await apiPut(request, `/api/customers/${customerId}`, {
      customerGrade: "A+",
      contactPerson: "张三丰（更新）",
    });
    expect(updateRes.data.customerGrade).toBe("A+");
    expect(updateRes.data.contactPerson).toBe("张三丰（更新）");
  });

  test("供应商管理 - CRUD", async ({ request }) => {
    await loginViaApi(request);

    const createRes = await apiPost(request, "/api/suppliers", {
      name: `测试供应商-CRUD-${ts}`,
      supplierType: "企业",
      status: "当前有效",
      contactPerson: "李四光",
      phone: "13900139001",
    });
    const supplierId = createRes.data.id;
    expect(createRes.data.name).toBe(`测试供应商-CRUD-${ts}`);
    expect(createRes.data.supplierType).toBe("企业");

    const listRes = await request.get(`${BASE_URL}/api/suppliers?pageSize=50`);
    const listJson = await listRes.json();
    expect(listRes.ok()).toBeTruthy();
    expect(Array.isArray(listJson.data)).toBeTruthy();
    expect(listJson.pagination).toBeDefined();
    expect(typeof listJson.pagination.total).toBe("number");

    const detailRes = await request.get(`${BASE_URL}/api/suppliers/${supplierId}`);
    const detailJson = await detailRes.json();
    expect(detailRes.ok()).toBeTruthy();
    expect(detailJson.data.id).toBe(supplierId);
    expect(detailJson.data.name).toBe(`测试供应商-CRUD-${ts}`);

    const updateRes = await apiPut(request, `/api/suppliers/${supplierId}`, {
      contactPerson: "李四光（更新）",
      phone: "13900139099",
    });
    expect(updateRes.data.contactPerson).toBe("李四光（更新）");
    expect(updateRes.data.phone).toBe("13900139099");
  });

  test("项目线索 - CRUD", async ({ request }) => {
    await loginViaApi(request);

    const createRes = await apiPost(request, "/api/project-leads", {
      customerId: ids.customerId,
      projectName: `项目线索-CRUD-${ts}`,
      location: "江苏省南京市",
      contactPerson: "王工",
      contactPhone: "13700137001",
      projectNature: ["EP"],
      implementationEntity: "华东工程",
      currentStatus: "跟踪中",
    });
    const leadId = createRes.data.id;
    expect(createRes.data.projectName).toBe(`项目线索-CRUD-${ts}`);
    expect(createRes.data.currentStatus).toBe("跟踪中");
    expect(createRes.data.projectSourceId).toBeDefined();

    const listRes = await request.get(`${BASE_URL}/api/project-leads?pageSize=50`);
    const listJson = await listRes.json();
    expect(listRes.ok()).toBeTruthy();
    expect(Array.isArray(listJson.data)).toBeTruthy();
    expect(listJson.pagination).toBeDefined();
    expect(typeof listJson.pagination.total).toBe("number");

    const detailRes = await request.get(`${BASE_URL}/api/project-leads/${leadId}`);
    const detailJson = await detailRes.json();
    expect(detailRes.ok()).toBeTruthy();
    expect(detailJson.data.id).toBe(leadId);
    expect(detailJson.data.projectName).toBe(`项目线索-CRUD-${ts}`);

    const updateRes = await apiPut(request, `/api/project-leads/${leadId}`, {
      currentStatus: "已中标",
      location: "江苏省南京市（更新）",
    });
    expect(updateRes.data.currentStatus).toBe("已中标");
    expect(updateRes.data.location).toBe("江苏省南京市（更新）");
  });

  test("投标管理 - CRUD", async ({ request }) => {
    await loginViaApi(request);

    const createRes = await apiPost(request, "/api/biddings", {
      projectSourceId: ids.projectSourceIdForBidding,
      bidDeadline: "2026-12-31",
      bondAmount: "50000",
      bondPaymentStatus: "未付",
      bidAmount: "5000000",
    });
    const biddingId = createRes.data.id;
    expect(createRes.data.projectSourceId).toBe(ids.projectSourceIdForBidding);
    expect(createRes.data.bondPaymentStatus).toBe("未付");

    const listRes = await request.get(`${BASE_URL}/api/biddings?pageSize=50`);
    const listJson = await listRes.json();
    expect(listRes.ok()).toBeTruthy();
    expect(Array.isArray(listJson.data)).toBeTruthy();
    expect(listJson.pagination).toBeDefined();
    expect(typeof listJson.pagination.total).toBe("number");

    const detailRes = await request.get(`${BASE_URL}/api/biddings/${biddingId}`);
    const detailJson = await detailRes.json();
    expect(detailRes.ok()).toBeTruthy();
    expect(detailJson.data.id).toBe(biddingId);
    expect(detailJson.data.projectSourceId).toBe(ids.projectSourceIdForBidding);

    const updateRes = await apiPut(request, `/api/biddings/${biddingId}`, {
      bidResult: "已中标",
      score: "95",
    });
    expect(updateRes.data.bidResult).toBe("已中标");
    expect(String(updateRes.data.score)).toBe("95");
  });

  test("报价管理 - CRUD", async ({ request }) => {
    await loginViaApi(request);

    const createRes = await apiPost(request, "/api/quotations", {
      projectSourceId: ids.projectSourceIdForQuotation,
      customerId: ids.customerId,
      totalAmount: "1000000",
      estimatedCost: { cost: 800000 },
      profitMargin: "20",
    });
    const quotationId = createRes.data.id;
    expect(Number(createRes.data.totalAmount)).toBe(1000000);
    expect(createRes.data.customerId).toBe(ids.customerId);

    const listRes = await request.get(`${BASE_URL}/api/quotations?pageSize=50`);
    const listJson = await listRes.json();
    expect(listRes.ok()).toBeTruthy();
    expect(Array.isArray(listJson.data)).toBeTruthy();
    expect(listJson.pagination).toBeDefined();
    expect(typeof listJson.pagination.total).toBe("number");

    const detailRes = await request.get(`${BASE_URL}/api/quotations/${quotationId}`);
    const detailJson = await detailRes.json();
    expect(detailRes.ok()).toBeTruthy();
    expect(detailJson.data.id).toBe(quotationId);
    expect(Number(detailJson.data.totalAmount)).toBe(1000000);

    const updateRes = await apiPut(request, `/api/quotations/${quotationId}`, {
      totalAmount: "1200000",
      profitMargin: "25",
    });
    expect(Number(updateRes.data.totalAmount)).toBe(1200000);
    expect(Number(updateRes.data.profitMargin)).toBe(25);
  });
});

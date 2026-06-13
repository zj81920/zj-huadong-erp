import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("合同管理模块 API", () => {
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

  async function apiPut(ctx: any, url: string, body: unknown) {
    const r = await ctx.put(`${BASE_URL}${url}`, { data: body, headers: { "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok()) throw new Error(`PUT ${url} ${r.status()}: ${j.error || JSON.stringify(j)}`);
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

  test("Step 1: 登录并创建前置数据（客户+供应商+项目线索+项目）", async ({ request }) => {
    await login(request);

    const cust = await apiPost(request, "/api/customers", {
      name: `测试客户-CT-${ts}`,
      ownershipType: "民营",
      contactPerson: "张三",
      phone: "13800138000",
      address: "测试路100号",
    });
    ids.customerId = cust.data.id;

    const supp = await apiPost(request, "/api/suppliers", {
      name: `测试供应商-CT-${ts}`,
      supplierType: "企业",
      status: "当前有效",
      contactPerson: "李四",
      phone: "13900139000",
      address: "测试路200号",
    });
    ids.supplierId = supp.data.id;

    const lead = await apiPost(request, "/api/project-leads", {
      customerId: ids.customerId,
      projectName: `测试项目-CT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      location: "安徽省合肥市",
      contactPerson: "王工",
      contactPhone: "13700137000",
      projectNature: "EPcm",
      implementationEntity: "华东工程",
      currentStatus: "已中标",
    });
    ids.projectSourceId = lead.data.projectSourceId;

    const proj = await apiPost(request, "/api/projects", {
      projectSourceId: ids.projectSourceId,
      projectCode: `CT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `CT测试项目-${Date.now()}`,
      customerId: ids.customerId,
      projectCategory: "EPC",
      source: "项目线索",
      status: "执行",
    });
    ids.projectId = proj.data.id;
    console.log("✅ Step 1 完成");
  });

  test("Step 2: POST /api/expense-contracts 创建支出合同", async ({ request }) => {
    await login(request);

    const contractNo = `ZC-${today.replace(/-/g, "")}-${ts.toString().slice(-4)}`;

    const contract = await apiPost(request, "/api/expense-contracts", {
      contractNo,
      projectSourceId: ids.projectSourceId,
      supplierId: ids.supplierId,
      totalAmount: "200000",
      contractType: "项目采购",
      signedDate: today,
      paymentTerms: "预付30%，到货付70%",
    });
    ids.expenseContractId = contract.data.id;
    expect(contract.data.contractNo).toBe(contractNo);
    expect(contract.data.status).toBe("草稿");
    console.log(`✅ 支出合同: ${contract.data.contractNo}`);

    const listRes = await apiGet(request, "/api/expense-contracts?pageSize=10");
    expect(Array.isArray(listRes.data)).toBeTruthy();
    console.log(`✅ 支出合同列表: ${listRes.data.length} 条`);
    console.log("✅ Step 2 完成");
  });

  test("Step 3: GET /api/expense-contracts/[id] 获取支出合同详情 & PUT 更新", async ({ request }) => {
    await login(request);

    const detail = await apiGet(request, `/api/expense-contracts/${ids.expenseContractId}`);
    expect(detail.data.id).toBe(ids.expenseContractId);
    console.log(`✅ 支出合同详情: ${detail.data.contractNo}`);

    const updated = await apiPut(request, `/api/expense-contracts/${ids.expenseContractId}`, {
      paymentTerms: "预付50%，到货付50%",
    });
    expect(updated.data.paymentTerms).toBe("预付50%，到货付50%");
    console.log("✅ 支出合同已更新");

    console.log("✅ Step 3 完成");
  });

  test("Step 4: POST /api/income-contracts 创建收入合同", async ({ request }) => {
    await login(request);

    const contractNo = `SR-${today.replace(/-/g, "")}-${ts.toString().slice(-4)}`;

    const contract = await apiPost(request, "/api/income-contracts", {
      contractNo,
      projectSourceId: ids.projectSourceId,
      customerId: ids.customerId,
      totalAmount: "500000",
      paymentTerms: "按进度付款",
      contractSummary: `EPC总承包合同-${ts}`,
    });
    ids.incomeContractId = contract.data.id;
    expect(contract.data.contractNo).toBe(contractNo);
    expect(contract.data.status).toBe("草稿");
    console.log(`✅ 收入合同: ${contract.data.contractNo}`);

    const listRes = await apiGet(request, "/api/income-contracts?pageSize=10");
    expect(Array.isArray(listRes.data)).toBeTruthy();
    console.log(`✅ 收入合同列表: ${listRes.data.length} 条`);
    console.log("✅ Step 4 完成");
  });

  test("Step 5: GET /api/income-contracts/[id] 获取收入合同详情 & PUT 更新", async ({ request }) => {
    await login(request);

    const detail = await apiGet(request, `/api/income-contracts/${ids.incomeContractId}`);
    expect(detail.data.id).toBe(ids.incomeContractId);
    console.log(`✅ 收入合同详情: ${detail.data.contractNo}`);

    const updated = await apiPut(request, `/api/income-contracts/${ids.incomeContractId}`, {
      paymentTerms: "按季度付款",
    });
    expect(updated.data.paymentTerms).toBe("按季度付款");
    console.log("✅ 收入合同已更新");

    console.log("✅ Step 5 完成");
  });

  test("Step 6: 清理数据", async ({ request }) => {
    await login(request);

    if (ids.incomeContractId) {
      const delRes = await request.delete(`${BASE_URL}/api/income-contracts/${ids.incomeContractId}`);
      expect(delRes.ok()).toBeTruthy();
      console.log("✅ 收入合同已清理");
    }
    if (ids.expenseContractId) {
      const delRes = await request.delete(`${BASE_URL}/api/expense-contracts/${ids.expenseContractId}`);
      expect(delRes.ok()).toBeTruthy();
      console.log("✅ 支出合同已清理");
    }
    console.log("✅ Step 6 完成");
    console.log("🎉 合同管理模块 API 测试完成！");
  });
});

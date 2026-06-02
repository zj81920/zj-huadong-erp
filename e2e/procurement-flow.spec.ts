import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("采购到付款全流程", () => {
  test.describe.configure({ mode: "serial" });

  const ids: Record<string, string> = {};
  const ts = Date.now();
  const today = new Date().toISOString().split("T")[0];

  async function apiPost(ctx: any, url: string, body: unknown) {
    const r = await ctx.post(`${BASE_URL}${url}`, { data: body, headers: { "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok) throw new Error(`POST ${url} ${r.status}: ${JSON.stringify(j)}`);
    return j;
  }

  async function apiPut(ctx: any, url: string, body: unknown) {
    const r = await ctx.put(`${BASE_URL}${url}`, { data: body, headers: { "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok) throw new Error(`PUT ${url} ${r.status}: ${j.error || JSON.stringify(j)}`);
    return j;
  }

  async function loginViaApi(request: any) {
    const r = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.ok()).toBeTruthy();
  }

  async function loginViaPage(page: any) {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector('input[placeholder="请输入用户名"]');
    await page.fill('input[placeholder="请输入用户名"]', "admin");
    await page.fill('input[placeholder="请输入密码"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/");
  }

  test("Step 1: 登录并创建前置数据", async ({ request }) => {
    await loginViaApi(request);
    console.log("✅ API 登录成功");

    const cust = await apiPost(request, "/api/customers", {
      name: `测试客户-PW-${ts}`, shortName: "测试客户", industryType: "化工", customerType: "企业",
      contactPerson: "张三", contactPhone: "13800138000", province: "安徽省", city: "合肥市",
      district: "蜀山区", address: "测试路100号", unifiedSocialCode: `91340100MA8${ts}`,
      legalRepresentative: "李四", registeredCapital: "1000", status: "当前有效", isActive: true,
    });
    ids.customerId = cust.data.id;
    console.log(`✅ 客户: ${cust.data.name}`);

    const lead = await apiPost(request, "/api/project-leads", {
      customerId: ids.customerId, projectName: "PW流程测试项目", location: "安徽省合肥市",
      contactPerson: "王工", contactPhone: "13900139000", projectNature: ["EP"],
      implementationEntity: "华东工程", currentStatus: "已中标",
    });
    ids.projectSourceId = lead.data.projectSourceId;
    console.log(`✅ 项目线索: ${lead.data.projectSourceId}`);

    const proj = await apiPost(request, "/api/projects", {
      projectSourceId: ids.projectSourceId, projectCode: `PW-${ts}`, name: "PW流程测试项目",
      customerId: ids.customerId, projectCategory: "EP", source: "项目线索", status: "执行",
    });
    console.log(`✅ 项目: ${proj.data.projectCode}`);

    const supp = await apiPost(request, "/api/suppliers", {
      name: `测试供应商-PW-${ts}`, supplierType: "企业", status: "当前有效",
      contactPerson: "赵六", phone: "13700137000", address: "测试路200号",
    });
    ids.supplierId = supp.data.id;
    console.log(`✅ 供应商: ${supp.data.name}`);

    for (const bt of ["purchase_request", "quotation", "expense_contract", "payment_application"]) {
      await apiPost(request, "/api/approval-flows", {
        businessType: bt, flowLevel: "common",
        nodes: [{ nodeOrder: 1, nodeName: "管理员审批", approverRole: "admin" }],
      });
    }
    console.log("✅ 审批流配置完毕");
    console.log("✅ Step 1 完成");
  });

  test("Step 2: 创建并审批采购需求", async ({ page }) => {
    await loginViaPage(page);
    console.log("✅ 页面登录成功");

    const prRes = await page.request.post(`${BASE_URL}/api/purchase-requests`, {
      data: {
        projectSourceId: ids.projectSourceId,
        items: [{
          materialName: "测试钢管", spec: "DN100", material: "碳钢",
          brand: "宝钢", unit: "米", quantity: 100,
        }],
      },
      headers: { "Content-Type": "application/json" },
    });
    const prJson = await prRes.json();
    expect(prRes.ok()).toBeTruthy();
    ids.prId = prJson.data.id;
    console.log(`✅ 采购需求已创建: ${prJson.data.requestNo}`);

    await apiPost(page.request, "/api/admin/set-approval-status", {
      businessType: "purchase_request", businessId: ids.prId, newStatus: "已批准",
    });
    console.log("✅ 采购需求已审批");
    console.log("✅ Step 2 完成");
  });

  test("Step 3: 创建采购单→确认供应商→审批", async ({ page }) => {
    await loginViaPage(page);

    const inquiryRes = await page.request.post(`${BASE_URL}/api/inquiries`, {
      data: {
        purchaseRequestId: ids.prId,
        supplierIds: [ids.supplierId],
        recommendedSupplierId: ids.supplierId,
      },
      headers: { "Content-Type": "application/json" },
    });
    const inquiryJson = await inquiryRes.json();
    expect(inquiryRes.ok()).toBeTruthy();
    ids.inquiryId = inquiryJson.data.id;
    console.log(`✅ 采购单已创建: ${inquiryJson.data.id}`);

    await apiPut(page.request, `/api/inquiries/${ids.inquiryId}`, {
      confirmedSupplierId: ids.supplierId,
      confirmedRound: 1,
      status: "已批准",
    });
    console.log("✅ 采购单已确认供应商并审批");
    console.log("✅ Step 3 完成");
  });

  test("Step 4: 创建采购合同并审批", async ({ request }) => {
    await loginViaApi(request);

    const contractNo = `ZC-${today.replace(/-/g, "")}-${ts.toString().slice(-4)}`;

    const contractRes = await request.post(`${BASE_URL}/api/expense-contracts`, {
      data: {
        contractNo,
        projectSourceId: ids.projectSourceId,
        supplierId: ids.supplierId,
        inquiryId: ids.inquiryId,
        totalAmount: "10000",
        contractType: "项目采购",
        signedDate: today,
        paymentTerms: "货到付款",
      },
      headers: { "Content-Type": "application/json" },
    });
    const contractJson = await contractRes.json();
    expect(contractRes.ok()).toBeTruthy();
    ids.contractId = contractJson.data.id;
    console.log(`✅ 采购合同已创建: ${contractJson.data.contractNo}`);

    await apiPost(request, "/api/admin/set-approval-status", {
      businessType: "expense_contract", businessId: ids.contractId, newStatus: "已批准",
    });
    console.log("✅ 合同已审批（应付记录已自动创建）");
    console.log("✅ Step 4 完成");
  });

  test("Step 5: 提交付款申请并审批", async ({ page }) => {
    await loginViaPage(page);

    await page.goto(`${BASE_URL}/finance/expense`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const tab = page.locator('button:has-text("合同支出")');
    if (await tab.isVisible({ timeout: 3000 })) {
      await tab.click();
      await page.waitForTimeout(1000);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
    }

    const payBtn = page.locator('button:has-text("付款")').first();
    await expect(payBtn).toBeVisible({ timeout: 15000 });
    await payBtn.click();
    await page.waitForTimeout(1000);

    const dialog = page.locator(".ios-modal:visible");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const select = dialog.locator("select").last();
    const opts = await select.locator("option").all();
    if (opts.length > 1) {
      const val = await opts[1].getAttribute("value");
      if (val) await select.selectOption(val);
    }

    const reasonInput = dialog.locator('input[placeholder*="付款事由"]');
    if (await reasonInput.isVisible({ timeout: 2000 })) {
      await reasonInput.fill("钢管采购付款");
    }

    await dialog.locator('button:has-text("提交申请")').click();
    await page.waitForTimeout(3000);

    const appsRes = await page.request.get(`${BASE_URL}/api/payment-applications?pageSize=50`);
    const apps = await appsRes.json();
    const app = apps.data?.[0];
    expect(app).toBeDefined();
    ids.paymentId = app!.id;

    await apiPost(page.request, "/api/admin/set-approval-status", {
      businessType: "payment_application", businessId: ids.paymentId, newStatus: "已批准",
    });
    console.log("✅ 付款申请已审批完成！");
    console.log("🎉 采购到付款全流程测试完成！");
  });
});

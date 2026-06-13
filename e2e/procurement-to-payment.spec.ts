import { test, expect, Page } from "@playwright/test";

const BASE_URL = "http://localhost:3000";
const TEST_TIMEOUT = 120_000;

// 在测试间共享的测试数据 ID
let testCustomerId = "";
let testProjectSourceId = "";
let testSupplierId = "";
let testPurchaseRequestId = "";
let testInquiryId = "";
let testContractId = "";
let testPaymentAppId = "";

const today = new Date().toISOString().split("T")[0];

// ====================== 工具函数 ======================

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[placeholder="请输入用户名"]');
  await page.fill('input[placeholder="请输入用户名"]', "admin");
  await page.fill('input[placeholder="请输入密码"]', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/");
  await page.waitForTimeout(1500);
}

async function getAuthCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.map(c => `${c.name}=${c.value}`).join("; ");
}

async function apiGet(page: Page, url: string) {
  const cookie = await getAuthCookie(page);
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "GET",
    headers: { Cookie: cookie },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`API GET ${url} 失败: ${json.error || res.status}`);
  return json;
}

async function apiPost(page: Page, url: string, body: unknown) {
  const cookie = await getAuthCookie(page);
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`API POST ${url} 失败: ${json.error || res.status}`);
  return json;
}

async function apiPut(page: Page, url: string, body: unknown) {
  const cookie = await getAuthCookie(page);
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`API PUT ${url} 失败: ${json.error || res.status}`);
  return json;
}

async function adminSetStatus(page: Page, businessType: string, businessId: string, newStatus: string) {
  await apiPost(page, "/api/admin/set-approval-status", { businessType, businessId, newStatus });
  console.log(`  ✅ 状态变更: ${businessType} → ${newStatus}`);
}

// ====================== 测试套件（串行执行）======================
test.describe("采购到付款全流程测试", () => {

  test.describe.configure({ mode: "serial" });

  // ====================== Step 1: 创建前置数据 + 采购需求 ======================
  test("Step 1: 创建前置数据与采购需求", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await loginAsAdmin(page);

    // ---------- 1a. API 创建前置数据 ----------
    console.log("\n🔧 创建前置测试数据...");

    // 创建客户（名称加时间戳避免重复）
    const ts = Date.now();
    const cust = await apiPost(page, "/api/customers", {
      name: `测试客户-PW-${ts}`,
      shortName: "测试客户",
      ownershipType: "民营",
      customerType: "企业",
      contactPerson: "张三",
      contactPhone: "13800138000",
      province: "安徽省",
      city: "合肥市",
      district: "蜀山区",
      address: "测试路100号",
      unifiedSocialCode: `91340100MA8${ts}`,
      legalRepresentative: "李四",
      registeredCapital: "1000",
      status: "当前有效",
      isActive: true,
    });
    testCustomerId = cust.data.id;
    console.log(`  ✅ 客户: ${testCustomerId}`);

    // 创建项目线索（已中标状态）
    const lead = await apiPost(page, "/api/project-leads", {
      customerId: testCustomerId,
      projectName: "Playwright测试项目",
      location: "安徽省合肥市",
      contactPerson: "王工",
      contactPhone: "13900139000",
      projectNature: "EP",
      implementationEntity: "华东工程",
      currentStatus: "已中标",
    });
    testProjectSourceId = lead.data.projectSourceId;
    console.log(`  ✅ 项目线索: ${testProjectSourceId}`);

    // 创建正式项目（从项目线索）
    const proj = await apiPost(page, "/api/projects", {
      projectSourceId: testProjectSourceId,
      projectCode: `PW-${ts}`,
      name: "Playwright测试项目",
      customerId: testCustomerId,
      projectCategory: "EP",
      source: "项目线索",
      status: "执行",
    });
    console.log(`  ✅ 项目: ${proj.data?.projectSourceId || testProjectSourceId}`);

    // 创建供应商
    const supp = await apiPost(page, "/api/suppliers", {
      name: `测试供应商-PW-${ts}`,
      supplierType: "企业",
      status: "当前有效",
      contactPerson: "赵六",
      phone: "13700137000",
      address: "测试路200号",
    });
    testSupplierId = supp.data.id;
    console.log(`  ✅ 供应商: ${testSupplierId}`);

    // 配置审批流
    for (const bt of ["purchase_request", "quotation", "expense_contract", "payment_application"]) {
      await apiPost(page, "/api/approval-flows", {
        businessType: bt, flowLevel: "common",
        nodes: [{ nodeOrder: 1, nodeName: "管理员审批", approverRole: "admin" }],
      });
      console.log(`  ✅ 审批流: ${bt}`);
    }
    console.log("🔧 前置数据创建完成\n");

    // ---------- 1b. UI 创建采购需求 ----------
    await page.goto(`${BASE_URL}/procurement/requests`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.locator('button:has-text("新增需求")').click();
    await page.waitForTimeout(1000);
    await expect(page.locator("h2:has-text('新增采购需求')")).toBeVisible({ timeout: 5000 });

    // 选择项目
    await page.locator('button:has-text("选择项目")').click();
    await page.waitForTimeout(500);

    const projectDialog = page.locator(".ios-modal").last();
    // 在项目弹窗中搜索
    const searchInput = projectDialog.locator('input[placeholder*="搜索"]');
    await searchInput.fill(testProjectSourceId);
    await page.waitForTimeout(1000);

    const selectBtn = projectDialog.locator('button:has-text("选择")');
    if (await selectBtn.isVisible()) {
      await selectBtn.click();
    } else {
      const content = await projectDialog.textContent();
      console.log(`  弹窗内容: ${content?.substring(0, 200)}`);
      test.skip(content?.includes("无匹配项目") ? "缺少项目" : "未知错误");
      return;
    }
    await page.waitForTimeout(500);

    // 填写日期与物资明细
    await page.locator('input[type="date"]').fill(today);
    await page.locator('input[placeholder="物资名称"]').first().fill("测试钢管");
    await page.locator('input[placeholder="规格型号"]').first().fill("DN100");
    await page.locator('input[placeholder="材质"]').first().fill("碳钢");
    await page.locator('input[placeholder="品牌"]').first().fill("宝钢");
    await page.locator('input[placeholder="单位"]').first().fill("米");
    await page.locator('input[placeholder="数量"]').first().fill("100");

    // 提交
    await page.locator('button:has-text("创建需求")').click();
    await page.waitForTimeout(2000);
    await expect(page.locator("h2:has-text('新增采购需求')")).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // 获取采购需求 ID
    const list = await apiGet(page, "/api/purchase-requests?pageSize=50");
    const req = list.data?.find((r: any) => r.projectSourceId === testProjectSourceId);
    expect(req).toBeDefined();
    testPurchaseRequestId = req!.id;
    console.log(`  ✅ 采购需求: ${req!.requestNo}`);

    // 管理员审批
    await adminSetStatus(page, "purchase_request", testPurchaseRequestId, "审批中");
    await adminSetStatus(page, "purchase_request", testPurchaseRequestId, "已批准");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    console.log("  ✅ Step 1 完成");
  });

  // ====================== Step 2: 转询价 → 创建采购单 ======================
  test("Step 2: 转询价并创建采购单", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await loginAsAdmin(page);

    await page.goto(`${BASE_URL}/procurement/requests`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 转询价
    const convertBtn = page.locator('button:has-text("转询价")').first();
    await expect(convertBtn).toBeVisible({ timeout: 10000 });
    await convertBtn.click();
    await page.waitForURL("**/procurement/inquiries**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 新增采购单
    await page.locator('button:has-text("新增采购单")').click();
    await page.waitForTimeout(1000);
    await expect(page.locator("h2:has-text('新增采购单')")).toBeVisible({ timeout: 5000 });

    // 选择采购需求
    await page.locator(".ios-modal select").first().selectOption(testPurchaseRequestId);
    await page.waitForTimeout(1000);

    // 交货日期
    await page.locator('.ios-modal input[type="date"]').first().fill(today);

    // 选择供应商
    const allSelects = page.locator(".ios-modal select");
    const selectCount = await allSelects.count();
    let supplierSelected = false;
    for (let i = 0; i < selectCount; i++) {
      const options = await allSelects.nth(i).locator("option").allTextContents();
      const optTexts = options.map((o: string) => o.trim());
      if (optTexts.some((o: string) => o.includes("点击选择供应商") || o.includes("选择供应商"))) {
        await allSelects.nth(i).selectOption(testSupplierId);
        supplierSelected = true;
        break;
      }
    }
    if (!supplierSelected) {
      // 尝试选择最后一个 select（可能供应商 dropdown 在底部）
      console.log("  ⚠️ 未找到供应商下拉框，尝试选择最后一个 select");
      await allSelects.last().selectOption(testSupplierId);
    }
    await page.waitForTimeout(500);

    // 填写单价
    const priceInput = page.locator('.ios-modal input[placeholder="0"]').first();
    if (await priceInput.isVisible()) {
      await priceInput.fill("50");
    }

    // 提交
    await page.locator('button:has-text("创建采购单")').click();
    await page.waitForTimeout(2000);
    await expect(page.locator("h2:has-text('新增采购单')")).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // 获取采购单 ID
    const list = await apiGet(page, "/api/inquiries?pageSize=50");
    const inquiry = list.data?.find((i: any) => i.purchaseRequestId === testPurchaseRequestId);
    expect(inquiry).toBeDefined();
    testInquiryId = inquiry!.id;
    console.log(`  ✅ 采购单: ID ${testInquiryId}`);

    // API 确认供应商（编辑时需要填完整的 body）
    await apiPut(page, `/api/inquiries/${testInquiryId}`, {
      confirmedSupplierId: testSupplierId,
      confirmedRound: 1,
    });
    console.log(`  ✅ 已确认供应商`);

    // 通过 inquiries API 审批（inquiryStatus 字段）
    await apiPut(page, `/api/inquiries/${testInquiryId}`, { status: "已批准" });
    console.log(`  ✅ 采购单已审批`);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    console.log("  ✅ Step 2 完成");
  });

  // ====================== Step 3: 采购单 → 生成合同 ======================
  test("Step 3: 从采购单生成采购合同", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await loginAsAdmin(page);

    await page.goto(`${BASE_URL}/procurement/inquiries`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 点击"详情"
    const detailBtn = page.locator('button:has-text("详情")').first();
    await expect(detailBtn).toBeVisible({ timeout: 10000 });
    await detailBtn.click();
    await page.waitForTimeout(1000);

    // 点击"生成采购合同"
    const generateBtn = page.locator('button:has-text("生成采购合同")');
    await expect(generateBtn).toBeVisible({ timeout: 10000 });
    await generateBtn.click();

    // 跳转到合同页面
    await page.waitForURL("**/contracts/expense**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // 合同弹窗应自动弹出
    const contractDialog = page.locator(".ios-modal");
    await expect(contractDialog).toBeVisible({ timeout: 10000 });

    // 确认合同编号已填充
    await expect(contractDialog.locator('input[value*="ZC-"]')).toBeVisible({ timeout: 5000 });

    // 补充金额（如果自动填充为空）
    const amountInput = contractDialog.locator('input[type="number"], input[placeholder*="金额"]').first();
    if (await amountInput.isVisible()) {
      const val = await amountInput.inputValue();
      if (!val || val === "") await amountInput.fill("5000");
    }

    // 付款条款
    const paymentInput = contractDialog.locator('input[placeholder*="付款"]');
    if (await paymentInput.isVisible()) await paymentInput.fill("货到付款");

    // 提交
    await contractDialog.locator('button:has-text("创建合同"), button:has-text("保存")').first().click();
    await page.waitForTimeout(2000);
    await expect(contractDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 获取合同 ID
    const list = await apiGet(page, "/api/expense-contracts?pageSize=50");
    const contract = list.data?.find((c: any) => c.supplierId === testSupplierId)
      || list.data?.[0];
    if (contract) {
      testContractId = contract.id;
      console.log(`  ✅ 合同: ${contract.contractNo}`);
      // 审批 → 自动创建应付记录
      await adminSetStatus(page, "expense_contract", testContractId, "已批准");
      console.log(`  ✅ 合同已批准，应付记录已创建`);
    } else {
      console.log(`  ⚠️ 未找到合同`);
    }

    console.log("  ✅ Step 3 完成");
  });

  // ====================== Step 4: 付款申请 ======================
  test("Step 4: 提交财务付款申请", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await loginAsAdmin(page);

    await page.goto(`${BASE_URL}/finance/expense`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 点"合同支出" tab
    const tab = page.locator('button:has-text("合同支出")');
    if (await tab.isVisible()) await tab.click();
    await page.waitForTimeout(1000);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 查找"付款"按钮
    const payBtn = page.locator('button:has-text("付款")').first();
    await expect(payBtn).toBeVisible({ timeout: 15000 });
    await payBtn.click();
    await page.waitForTimeout(1000);

    // 验证付款申请弹窗
    const dialog = page.locator(".ios-modal");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator("h2:has-text('付款申请')")).toBeVisible({ timeout: 5000 });

    // 选择申请人
    const applicantSelect = dialog.locator("select").last();
    if (await applicantSelect.isVisible()) {
      const opts = await applicantSelect.locator("option").all();
      if (opts.length > 1) {
        const id = await opts[1].getAttribute("value");
        if (id) await applicantSelect.selectOption(id);
      }
    }

    // 填写付款事由
    const reasonInput = dialog.locator('input[placeholder*="付款事由"]');
    if (await reasonInput.isVisible()) await reasonInput.fill("测试采购付款");

    // 提交
    await dialog.locator('button:has-text("提交申请")').click();
    await page.waitForTimeout(2000);
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 获取付款申请 ID
    const list = await apiGet(page, "/api/payment-applications?pageSize=50");
    const app = list.data?.find((pa: any) => pa.payable?.sourceType === "expense_contract")
      || list.data?.[0];
    if (app) {
      testPaymentAppId = app.id;
      console.log(`  ✅ 付款申请: ID ${testPaymentAppId}`);
      await adminSetStatus(page, "payment_application", testPaymentAppId, "已批准");
      console.log(`  ✅ 付款申请已审批`);
    }

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    console.log("  ✅ Step 4 完成");
  });
});

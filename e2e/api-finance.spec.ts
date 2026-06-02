import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("财务管理模块 API 测试", () => {
  test.describe.configure({ mode: "serial" });

  const ids: Record<string, string> = {};
  const ts = Date.now();
  const today = new Date().toISOString().split("T")[0];

  async function loginViaApi(request: any) {
    const r = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.ok()).toBeTruthy();
  }

  async function apiPost(request: any, url: string, body: unknown) {
    const r = await request.post(`${BASE_URL}${url}`, {
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    const j = await r.json();
    if (!r.ok()) throw new Error(`POST ${url} ${r.status()}: ${JSON.stringify(j)}`);
    return j;
  }

  async function apiPut(request: any, url: string, body: unknown) {
    const r = await request.put(`${BASE_URL}${url}`, {
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    const j = await r.json();
    if (!r.ok()) throw new Error(`PUT ${url} ${r.status()}: ${j.error || JSON.stringify(j)}`);
    return j;
  }

  async function apiDelete(request: any, url: string) {
    const r = await request.delete(`${BASE_URL}${url}`);
    const j = await r.json();
    if (!r.ok()) throw new Error(`DELETE ${url} ${r.status()}: ${j.error || JSON.stringify(j)}`);
    return j;
  }

  test("Step 1: 登录并获取当前用户", async ({ request }) => {
    await loginViaApi(request);
    console.log("API 登录成功");

    const usersRes = await request.get(`${BASE_URL}/api/users`);
    const users = await usersRes.json();
    expect(users.data.length).toBeGreaterThan(0);
    ids.applicantId = users.data[0].id;
    console.log(`当前用户: ${users.data[0].realName} (${ids.applicantId})`);

    console.log("Step 1 完成");
  });

  test("Step 2: 银行账户 CRUD", async ({ request }) => {
    await loginViaApi(request);

    const bankName = `测试银行-${ts}`;
    const accountName = `测试账户-${ts}`;
    const accountNo = `622202${String(ts).slice(0, 12)}`;

    const created = await apiPost(request, "/api/bank-accounts", {
      bankName,
      accountName,
      accountNo,
      accountType: "公司账户",
    });
    ids.bankAccountId = created.data.id;
    expect(created.data.accountName).toBe(accountName);
    expect(created.data.accountType).toBe("公司账户");
    console.log(`银行账户已创建: ${created.data.id}`);

    const listRes = await request.get(`${BASE_URL}/api/bank-accounts?pageSize=50`);
    const list = await listRes.json();
    expect(list.data.length).toBeGreaterThan(0);
    const found = list.data.find((b: any) => b.id === ids.bankAccountId);
    expect(found).toBeDefined();
    console.log(`银行账户列表查询成功，共 ${list.data.length} 条`);

    const detailRes = await request.get(`${BASE_URL}/api/bank-accounts/${ids.bankAccountId}`);
    const detail = await detailRes.json();
    expect(detail.data.id).toBe(ids.bankAccountId);
    console.log(`银行账户详情查询成功`);

    const updatedName = `更新银行-${ts}`;
    const updated = await apiPut(request, `/api/bank-accounts/${ids.bankAccountId}`, {
      bankName: updatedName,
    });
    expect(updated.data.bankName).toBe(updatedName);
    console.log(`银行账户已更新`);

    await apiDelete(request, `/api/bank-accounts/${ids.bankAccountId}`);
    const checkRes = await request.get(`${BASE_URL}/api/bank-accounts/${ids.bankAccountId}`);
    expect(checkRes.status()).toBe(404);
    console.log(`银行账户已删除`);

    console.log("Step 2 完成");
  });

  test("Step 3: 应付账款列表 GET", async ({ request }) => {
    await loginViaApi(request);

    const payableRes = await request.get(`${BASE_URL}/api/payables?pageSize=50`);
    const list = await payableRes.json();
    expect(list).toHaveProperty("data");
    expect(list).toHaveProperty("pagination");
    console.log(`应付账款列表查询成功，共 ${list.data.length} 条`);

    const created = await apiPost(request, "/api/payables", {
      sourceType: "manual",
      sourceId: `test-${ts}`,
      dueDate: today,
      amount: 5000,
    });
    ids.payableId = created.data.id;
    expect(created.data.status).toBe("未付");
    console.log(`应付记录已创建: ${ids.payableId}`);

    const list2Res = await request.get(`${BASE_URL}/api/payables?pageSize=50`);
    const list2 = await list2Res.json();
    const found = list2.data.find((p: any) => p.id === ids.payableId);
    expect(found).toBeDefined();
    expect(Number(found.amount)).toBe(5000);
    console.log(`应付记录已在列表中确认`);

    const detailRes = await request.get(`${BASE_URL}/api/payables/${ids.payableId}`);
    const detail = await detailRes.json();
    expect(detail.data.id).toBe(ids.payableId);
    console.log(`应付详情查询成功`);

    console.log("Step 3 完成");
  });

  test("Step 4: 应收账款列表 GET", async ({ request }) => {
    await loginViaApi(request);

    const recvRes = await request.get(`${BASE_URL}/api/receivables?pageSize=50`);
    const list = await recvRes.json();
    expect(list).toHaveProperty("data");
    expect(list).toHaveProperty("pagination");
    console.log(`应收账款列表查询成功，共 ${list.data.length} 条`);

    const created = await apiPost(request, "/api/receivables", {
      sourceType: "manual",
      sourceId: `test-recv-${ts}`,
      dueDate: today,
      amount: 10000,
    });
    ids.receivableId = created.data.id;
    expect(created.data.status).toBe("未收");
    console.log(`应收记录已创建: ${ids.receivableId}`);

    const list2Res = await request.get(`${BASE_URL}/api/receivables?pageSize=50`);
    const list2 = await list2Res.json();
    const found = list2.data.find((r: any) => r.id === ids.receivableId);
    expect(found).toBeDefined();
    expect(Number(found.amount)).toBe(10000);
    console.log(`应收记录已在列表中确认`);

    const detailRes = await request.get(`${BASE_URL}/api/receivables/${ids.receivableId}`);
    const detail = await detailRes.json();
    expect(detail.data.id).toBe(ids.receivableId);
    console.log(`应收详情查询成功`);

    console.log("Step 4 完成");
  });

  test("Step 5: 发票 CRUD", async ({ request }) => {
    await loginViaApi(request);

    const invoiceNo = `INV-${ts}`;

    const created = await apiPost(request, "/api/invoices", {
      invoiceNo,
      invoiceType: "增值税专用发票",
      invoiceCategory: "进项发票",
      invoiceDate: today,
      totalAmount: 13000,
      amount: 11504.42,
      taxRate: 0.13,
      taxAmount: 1495.58,
      sellerName: `测试供应商-${ts}`,
      sellerTaxNo: `91310115MA${String(ts).slice(0, 10)}`,
      buyerName: "华东工程有限公司",
      buyerTaxNo: "91310000MA7J0ABC2D",
    });
    ids.invoiceId = created.data.id;
    expect(created.data.invoiceNo).toBe(invoiceNo);
    expect(Number(created.data.totalAmount)).toBe(13000);
    console.log(`发票已创建: ${ids.invoiceId}`);

    const listRes = await request.get(`${BASE_URL}/api/invoices?pageSize=50`);
    const list = await listRes.json();
    expect(list.data.length).toBeGreaterThan(0);
    const found = list.data.find((i: any) => i.id === ids.invoiceId);
    expect(found).toBeDefined();
    console.log(`发票列表查询成功，共 ${list.data.length} 条`);

    const detailRes = await request.get(`${BASE_URL}/api/invoices/${ids.invoiceId}`);
    const detail = await detailRes.json();
    expect(detail.data.id).toBe(ids.invoiceId);
    console.log(`发票详情查询成功`);

    const updated = await apiPut(request, `/api/invoices/${ids.invoiceId}`, {
      remark: "测试发票备注",
    });
    expect(updated.data.remark).toBe("测试发票备注");
    console.log(`发票已更新`);

    await apiDelete(request, `/api/invoices/${ids.invoiceId}`);
    const checkRes = await request.get(`${BASE_URL}/api/invoices/${ids.invoiceId}`);
    expect(checkRes.status()).toBe(404);
    console.log(`发票已删除`);

    console.log("Step 5 完成");
  });

  test("Step 6: 付款申请列表 GET", async ({ request }) => {
    await loginViaApi(request);

    let payableId = ids.payableId;
    if (!payableId) {
      const created = await apiPost(request, "/api/payables", {
        sourceType: "manual",
        sourceId: `test-pa-${ts}`,
        dueDate: today,
        amount: 8000,
      });
      payableId = created.data.id;
      ids.payableId = payableId;
      console.log(`应付记录已创建(补): ${payableId}`);
    }

    const appRes = await request.get(`${BASE_URL}/api/payment-applications?pageSize=50`);
    const list = await appRes.json();
    expect(list).toHaveProperty("data");
    expect(list).toHaveProperty("pagination");
    console.log(`付款申请列表查询成功，共 ${list.data.length} 条`);

    const created = await apiPost(request, "/api/payment-applications", {
      payableId,
      applicantId: ids.applicantId,
      amount: 8000,
      paymentReason: `测试付款-${ts}`,
      paymentMethod: "银行转账",
    });
    ids.paymentAppId = created.data.id;
    expect(created.data.approvalStatus).toBe("草稿");
    console.log(`付款申请已创建: ${ids.paymentAppId}`);

    const list2Res = await request.get(`${BASE_URL}/api/payment-applications?pageSize=50`);
    const list2 = await list2Res.json();
    const found = list2.data.find((pa: any) => pa.id === ids.paymentAppId);
    expect(found).toBeDefined();
    expect(Number(found.amount)).toBe(8000);
    console.log(`付款申请已在列表中确认`);

    const detailRes = await request.get(`${BASE_URL}/api/payment-applications/${ids.paymentAppId}`);
    const detail = await detailRes.json();
    expect(detail.data.id).toBe(ids.paymentAppId);
    console.log(`付款申请详情查询成功`);

    console.log("Step 6 完成");
  });

  test("Step 7: 费用报销 CRUD", async ({ request }) => {
    await loginViaApi(request);

    const created = await apiPost(request, "/api/expense-reports", {
      applicantId: ids.applicantId,
      expenseType: "差旅费",
      amount: 3500,
      description: `测试报销-${ts}`,
      items: [
        {
          expenseType: "交通费",
          amount: 1500,
          description: "北京出差高铁票",
        },
        {
          expenseType: "住宿费",
          amount: 2000,
          description: "北京出差住宿",
        },
      ],
    });
    ids.expenseReportId = created.data.id;
    expect(created.data.expenseType).toBe("差旅费");
    expect(Number(created.data.amount)).toBe(3500);
    console.log(`费用报销已创建: ${ids.expenseReportId}`);

    const listRes = await request.get(`${BASE_URL}/api/expense-reports?pageSize=50`);
    const list = await listRes.json();
    expect(list.data.length).toBeGreaterThan(0);
    const found = list.data.find((er: any) => er.id === ids.expenseReportId);
    expect(found).toBeDefined();
    console.log(`费用报销列表查询成功，共 ${list.data.length} 条`);

    const detailRes = await request.get(`${BASE_URL}/api/expense-reports/${ids.expenseReportId}`);
    const detail = await detailRes.json();
    expect(detail.data.id).toBe(ids.expenseReportId);
    console.log(`费用报销详情查询成功`);

    const updated = await apiPut(request, `/api/expense-reports/${ids.expenseReportId}`, {
      description: `更新报销说明-${ts}`,
    });
    expect(updated.data.description).toBe(`更新报销说明-${ts}`);
    console.log(`费用报销已更新`);

    await apiDelete(request, `/api/expense-reports/${ids.expenseReportId}`);
    const checkRes = await request.get(`${BASE_URL}/api/expense-reports/${ids.expenseReportId}`);
    expect(checkRes.status()).toBe(404);
    console.log(`费用报销已删除`);

    console.log("Step 7 完成");
  });
});

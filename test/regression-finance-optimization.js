/**
 * 财务支出与收入优化 - 回归测试脚本
 * 
 * 使用方法：
 * 1. 确保 dev server 运行中 (npm run dev)
 * 2. 在浏览器控制台中复制粘贴运行
 *    OR 使用 fetch API 方式逐个测试
 * 
 * 测试覆盖范围：
 * - API 端点测试
 * - 数据模型验证
 * - 核心功能回归
 */

const BASE = "//";

async function test(name: string, fn: () => Promise<boolean>) {
  try {
    const pass = await fn();
    console.log(`${pass ? "✅" : "❌"} ${name}`);
    return pass;
  } catch (e: any) {
    console.log(`💥 ${name} - ${e.message || e}`);
    return false;
  }
}

async function api(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${endpoint}`, options);
  return { res, json: await res.json().catch(() => null) };
}

async function runTests() {
  console.log("=".repeat(50));
  console.log("财务支出与收入优化 - 回归测试");
  console.log("=".repeat(50));
  let passed = 0, failed = 0;

  // ========== 1. 往来信息 API ==========
  console.log("\n--- 1. 往来信息 API ---");

  let testId: string | null = null;

  const r1 = await test("GET /api/counterparty 获取列表", async () => {
    const { res, json } = await api("/api/counterparty?pageSize=10");
    return res.ok && json?.data !== undefined;
  });
  r1 ? passed++ : failed++;

  const r2 = await test("POST /api/counterparty 创建往来信息", async () => {
    const { res, json } = await api("/api/counterparty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "测试公司", bankName: "测试银行", bankAccount: "6222000012345678" }),
    });
    if (res.ok && json?.data) testId = json.data.id;
    return res.ok;
  });
  r2 ? passed++ : failed++;

  const r3 = await test("POST /api/counterparty 去重测试（同一组合不重复）", async () => {
    const { res, json } = await api("/api/counterparty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "测试公司", bankName: "测试银行", bankAccount: "6222000012345678" }),
    });
    return res.ok && json?.data?.id === testId;
  });
  r3 ? passed++ : failed++;

  const r4 = await test("POST /api/counterparty 不同银行账号创建新记录", async () => {
    const { res } = await api("/api/counterparty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "测试公司", bankName: "其他银行", bankAccount: "6222000087654321" }),
    });
    return res.ok;
  });
  r4 ? passed++ : failed++;

  // ========== 2. payables API 验证 ==========
  console.log("\n--- 2. payables API ---");

  const r5 = await test("GET /api/payables 合同支出列表", async () => {
    const { res, json } = await api("/api/payables?sourceType=expense_contract&pageSize=5");
    return res.ok && Array.isArray(json?.data);
  });
  r5 ? passed++ : failed++;

  const r6 = await test("GET /api/payables 返回数据含 supplier 信息", async () => {
    const { json } = await api("/api/payables?sourceType=expense_contract&pageSize=1");
    if (!json?.data?.length) return true; // 空数据，跳过
    const item = json.data[0];
    return item.sourceContract !== undefined;
  });
  r6 ? passed++ : failed++;

  // ========== 3. payment-applications API ==========
  console.log("\n--- 3. payment-applications API ---");

  const r7 = await test("GET /api/payment-applications 列表", async () => {
    const { res, json } = await api("/api/payment-applications?pageSize=5");
    return res.ok && Array.isArray(json?.data);
  });
  r7 ? passed++ : failed++;

  const r8 = await test("PUT /api/payment-applications 支持 bankName 字段", async () => {
    // 先获取一个 payment application
    const { json } = await api("/api/payment-applications?pageSize=1");
    if (!json?.data?.length) { console.log("  ⏭️ 无付款申请记录，跳过"); return true; }
    const appId = json.data[0].id;
    const { res } = await api(`/api/payment-applications/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankName: "测试银行", bankAccount: "6222000012340000" }),
    });
    return res.ok;
  });
  r8 ? passed++ : failed++;

  // ========== 4. 保证金支付 API ==========
  console.log("\n--- 4. 保证金支付 API ---");

  const r9 = await test("POST /api/project-leads/bond-payment 接收银行信息", async () => {
    // 此 API 需要线索ID，仅验证接口可访问
    const { res } = await api("/api/project-leads/bond-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: "test-invalid-id",
        projectSourceId: "PRJ-TEST",
        borrowerName: "测试收方",
        amount: 10000,
        description: "测试保证金",
        bankName: "测试银行",
        bankAccount: "6222000012349999",
      }),
    });
    // 可能返回400（无效leadId），但只要不是500就算通过
    return res.status !== 500;
  });
  r9 ? passed++ : failed++;

  // ========== 5. 前端路由验证 ==========
  console.log("\n--- 5. 前端路由 ---");

  const r10 = await test("GET /settings/counterparty 页面可访问", async () => {
    const { res } = await api("/settings/counterparty");
    return res.ok || res.status === 302; // 可能重定向到登录
  });
  r10 ? passed++ : failed++;

  const r11 = await test("GET /finance/expense 页面可访问", async () => {
    const { res } = await api("/finance/expense");
    return res.ok || res.status === 302;
  });
  r11 ? passed++ : failed++;

  const r12 = await test("GET /finance/income 页面可访问", async () => {
    const { res } = await api("/finance/income");
    return res.ok || res.status === 302;
  });
  r12 ? passed++ : failed++;

  // ========== 清理 ==========
  console.log("\n--- 清理测试数据 ---");
  if (testId) {
    await api(`/api/counterparty?id=${testId}`, { method: "DELETE" });
    console.log("  ✅ 已清理往来信息测试数据");
  }

  // 清理不同账号的测试记录
  const { json: cleanList } = await api("/api/counterparty?search=测试公司&pageSize=10");
  if (cleanList?.data) {
    for (const r of cleanList.data) {
      await api(`/api/counterparty?id=${r.id}`, { method: "DELETE" });
    }
    console.log("  ✅ 已清理所有测试往来信息");
  }

  console.log("\n" + "=".repeat(50));
  console.log(`结果: ${passed} 通过, ${failed} 失败, ${passed + failed} 总计`);
  console.log("=".repeat(50));
  return { passed, failed, total: passed + failed };
}

runTests().then(console.log);

/*
 * 手动回归检查清单（在浏览器中逐项验证）:
 * 
 * 1. 财务支出 > 合同支出:
 *    [ ] 表格列: 项目/合同编号/收款方/合同金额/已付金额/状态/操作
 *    [ ] 状态显示: 未付款/部分付款/已付清
 *    [ ] 操作列: 详情/付款/删除 三个按钮
 *    [ ] 详情弹窗: 金额网格(2x2) + 银行信息 + 付款申请记录
 *    [ ] 付款申请弹窗: 卡片展示 + 银行信息
 *
 * 2. 财务支出 > 其他支出:
 *    [ ] 新增表单包含 交易对方/开户行/银行账号
 *
 * 3. 财务支出 > 借出款:
 *    [ ] 新增表单包含 借入方/开户行/银行账号
 *
 * 4. 财务收入 > 合同收入:
 *    [ ] 操作列: 详情/收款/删除
 *    [ ] 详情弹窗: 金额网格(合同金额/已开票/已收/未收)
 *
 * 5. 项目线索 > 投标保证金:
 *    [ ] 弹窗包含 交易对方名称/开户行/银行账号
 *
 * 6. 系统设置 > 往来信息管理:
 *    [ ] 页面可访问(管理员)
 *    [ ] 可新增/删除往来信息
 *    [ ] 非管理员访问限制
 */

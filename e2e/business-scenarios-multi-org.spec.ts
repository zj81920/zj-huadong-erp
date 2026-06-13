import { test, expect } from "@playwright/test";

/**
 * 多经营主体业务场景测试
 * ======================
 * 
 * 测试场景覆盖：
 *   场景1 - 客户签总公司，管理费坐扣（90%主流业务）
 *   场景2 - 客户签分公司，单独付管理费
 *   场景3 - 总公司代付供应商（支出）
 *   场景4 - 总公司内部服务结算
 *   场景5 - 挂靠公司管理费坐扣
 * 
 * 测试数据会保留在数据库中，方便业务人员查阅。
 * 每条测试数据的名称都带有 "【业务验证】" 前缀。
 */

const BASE_URL = "http://localhost:3000";

test.describe("多经营主体业务场景验证", () => {
  test.describe.configure({ mode: "serial" });

  // ============ Shared State ============
  const ids: Record<string, string> = {};
  const ts = Date.now();
  const tag = `【业务验证】`;

  // ============ Helper Functions ============

  async function apiPost(ctx: any, url: string, body: unknown) {
    const r = await ctx.post(`${BASE_URL}${url}`, {
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    const j = await r.json();
    if (!r.ok()) {
      const msg = `POST ${url} ${r.status()}: ${JSON.stringify(j)}`;
      console.error(`\n❌ ${msg}`);
      console.error(`   请求体: ${JSON.stringify(body, null, 2)}`);
      throw new Error(msg);
    }
    return j;
  }

  async function apiPut(ctx: any, url: string, body: unknown) {
    const r = await ctx.put(`${BASE_URL}${url}`, {
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    const j = await r.json();
    if (!r.ok()) {
      const msg = `PUT ${url} ${r.status()}: ${j.error || JSON.stringify(j)}`;
      console.error(`\n❌ ${msg}`);
      throw new Error(msg);
    }
    return j;
  }

  async function apiGet(ctx: any, url: string) {
    const r = await ctx.get(`${BASE_URL}${url}`);
    const j = await r.json();
    if (!r.ok()) {
      const msg = `GET ${url} ${r.status()}: ${JSON.stringify(j)}`;
      console.error(`\n❌ ${msg}`);
      throw new Error(msg);
    }
    return j;
  }

  async function login(ctx: any) {
    const r = await ctx.post(`${BASE_URL}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.ok()).toBeTruthy();
    console.log("  ✅ 登录成功");
  }

  async function fetchOrgs(ctx: any) {
    const orgs = await apiGet(ctx, "/api/organizations");
    for (const o of orgs.data) {
      ids[`org_${o.code}`] = o.id;
    }
    console.log(`  ✅ 获取经营主体: ${orgs.data.map((o: any) => o.shortName).join(", ")}`);
  }

  // ========================================================================
  // 前置准备：登录 + 获取主体 + 创建基础数据
  // ========================================================================

  test("前置准备：登录、获取主体、创建客户/供应商/银行账户", async ({ request }) => {
    await login(request);
    await fetchOrgs(request);

    // 创建客户（共享）
    const cust = await apiPost(request, "/api/customers", {
      name: `${tag}测试客户-${ts}`,
      ownershipType: "民营",
      contactPerson: "张三",
      phone: "13800138000",
      address: "合肥市高新区测试路100号",
    });
    ids.customerId = cust.data.id;
    console.log(`  ✅ 创建客户: ${cust.data.name}`);

    // 创建供应商（共享）
    const supp = await apiPost(request, "/api/suppliers", {
      name: `${tag}测试供应商-${ts}`,
      supplierType: "企业",
      status: "当前有效",
      contactPerson: "李四",
      phone: "13900139000",
      address: "合肥市经开区测试路200号",
    });
    ids.supplierId = supp.data.id;
    console.log(`  ✅ 创建供应商: ${supp.data.name}`);

    // 创建总公司的银行账户
    const hqBank = await apiPost(request, "/api/bank-accounts", {
      accountName: `${tag}总公司测试账户-${ts}`,
      bankName: "中国工商银行合肥分行",
      accountNo: `HQ${ts}001`,
      accountType: "公司账户",
      organizationId: ids.org_HQ,
    });
    ids.bank_HQ = hqBank.id;

    // 创建分公司的银行账户
    const branchBank = await apiPost(request, "/api/bank-accounts", {
      accountName: `${tag}分公司测试账户-${ts}`,
      bankName: "中国建设银行合肥分行",
      accountNo: `BR${ts}001`,
      accountType: "公司账户",
      organizationId: ids.org_BRANCH,
    });
    ids.bank_BRANCH = branchBank.id;

    // 创建咨询公司的银行账户
    const consultBank = await apiPost(request, "/api/bank-accounts", {
      accountName: `${tag}咨询公司测试账户-${ts}`,
      bankName: "招商银行合肥分行",
      accountNo: `CO${ts}001`,
      accountType: "公司账户",
      organizationId: ids.org_CONSULT,
    });
    ids.bank_CONSULT = consultBank.id;

    // 创建挂靠公司的银行账户
    const affBank = await apiPost(request, "/api/bank-accounts", {
      accountName: `${tag}挂靠公司测试账户-${ts}`,
      bankName: "中国银行合肥分行",
      accountNo: `AF${ts}001`,
      accountType: "公司账户",
      organizationId: ids.org_AFFILIATED,
    });
    ids.bank_AFFILIATED = affBank.id;

    console.log(`  ✅ 创建了 4 个银行账户（分属不同主体）`);
    expect(hqBank).toBeDefined();
  });

  // ========================================================================
  // 场景1：客户签总公司，管理费坐扣
  // ========================================================================

  test("场景1：客户签总公司 → 管理费坐扣 → 净额给分公司", async ({ request }) => {
    console.log(`\n========== 场景1：客户签总公司（管理费坐扣）==========`);
    await login(request);

    // Step 1: 创建项目线索 + 项目
    const lead = await apiPost(request, "/api/project-leads", {
      customerId: ids.customerId,
      projectName: `${tag}场景1-EPC总包项目-${ts}`,
      location: "安徽省合肥市",
      contactPerson: "王工",
      contactPhone: "13700137000",
      projectNature: "EPcm",
      implementationEntity: "总公司签约",
      currentStatus: "已中标",
    });
    ids.lead1 = lead.data.projectSourceId;
    console.log(`  ✅ 创建项目线索: projectSourceId=${ids.lead1}`);

    const proj = await apiPost(request, "/api/projects", {
      projectSourceId: ids.lead1,
      projectCode: `SC1-${ts}`,
      name: `${tag}场景1-EPC项目-${ts}`,
      customerId: ids.customerId,
      projectCategory: "EPC",
      designManagerId: null,
      supervisorLeaderId: null,
      organizationId: ids.org_HQ,
    });
    ids.project1 = proj.id;
    console.log(`  ✅ 创建项目: ${proj.name}（所属主体=总公司）`);

    // Step 2: 创建总公司收入合同（客户和总公司签）
    const income1 = await apiPost(request, "/api/income-contracts", {
      contractNo: `SC1-INC-${ts}`,
      customerId: ids.customerId,
      totalAmount: "500000",
      projectSourceId: ids.lead1,
      organizationId: ids.org_HQ,
    });
    ids.incomeContract1 = income1.data.id;
    console.log(`  ✅ 创建收入合同: ${income1.data.contractNo}（所属主体=总公司，金额¥500,000）`);

    // Step 3: 创建内部结算合同（管理费坐扣，管理费10% = ¥50,000）
    const inter1 = await apiPost(request, "/api/inter-org-contracts", {
      contractNo: `SC1-INT-${ts}`,
      contractName: `${tag}场景1-项目管理费-${ts}`,
      fromOrgId: ids.org_HQ,      // 收款方 = 总公司
      toOrgId: ids.org_BRANCH,     // 付款方 = 分公司
      type: "MANAGEMENT_FEE",
      settlementType: "NETTED",
      relatedContractId: ids.incomeContract1,
      relatedContractType: "income_contract",
      totalAmount: 500000,
      managementFeeTotal: 50000,
      remainingAmount: 50000,
    });
    ids.interContract1 = inter1.id;
    console.log(`  ✅ 创建内部结算合同（管理费坐扣，总管理费¥50,000）`);

    // Step 4: 模拟审批通过（直接update状态）
    await apiPut(request, `/api/inter-org-contracts/${ids.interContract1}`, {
      status: "执行中",
    });
    console.log(`  ✅ 内部结算合同审批通过，进入执行中状态`);

    // Step 5: 创建应收记录（总公司的应收：客户应付款）
    const receiv1 = await apiPost(request, "/api/receivables", {
      sourceType: "income_contract",
      sourceId: ids.incomeContract1,
      projectSourceId: ids.lead1,
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      amount: "500000",
      organizationId: ids.org_HQ,
    });
    ids.receivable1 = receiv1.id;
    console.log(`  ✅ 创建应收记录（总公司，金额¥500,000）`);

    // Step 6: 验证内部结算合同的坐扣信息
    const contractCheck1 = await apiGet(request, `/api/inter-org-contracts/${ids.interContract1}`);
    console.log(`  ✅ 内部结算合同: 总管理费=¥${contractCheck1.managementFeeTotal}, 已扣=${contractCheck1.deductedAmount}, 剩余=${contractCheck1.remainingAmount}`);
    expect(Number(contractCheck1.remainingAmount)).toBe(50000);

    // Step 7: 创建发票（分公司开票给总公司，管理费发票）
    const invoice1 = await apiPost(request, "/api/invoices", {
      invoiceNo: `SC1-INV-${ts}`,
      invoiceType: "增值税专用发票",
      invoiceCategory: "销项发票",
      invoiceDate: new Date().toISOString(),
      amount: 50000,
      totalAmount: 50000,
      sourceType: "inter_org_contract",
      sourceId: ids.interContract1,
      organizationId: ids.org_BRANCH, // 开票方=分公司
      sellerName: "安徽华东化工医药工程有限责任公司",
      buyerName: "总公司",
    });
    ids.invoice1 = invoice1.id;
    console.log(`  ✅ 创建发票（分公司→总公司，金额¥50,000）`);

    console.log(`\n📋 场景1完成！数据已保存在系统中。`);
  });

  // ========================================================================
  // 场景2：客户签分公司，单独付管理费（场景2a）
  // ========================================================================

  test("场景2：客户签分公司 → 单独付管理费给总公司", async ({ request }) => {
    console.log(`\n========== 场景2：客户签分公司（单独付管理费）==========`);
    await login(request);

    // Step 1: 创建项目
    const lead2 = await apiPost(request, "/api/project-leads", {
      customerId: ids.customerId,
      projectName: `${tag}场景2-设计咨询项目-${ts}`,
      location: "安徽省芜湖市",
      contactPerson: "赵工",
      contactPhone: "13600136000",
      projectNature: "设计",
      implementationEntity: "分公司签约",
      currentStatus: "已中标",
    });
    ids.lead2 = lead2.data.projectSourceId;
    console.log(`  ✅ 创建项目线索: projectSourceId=${ids.lead2}`);
    const proj2 = await apiPost(request, "/api/projects", {
      projectSourceId: ids.lead2,
      projectCode: `SC2-${ts}`,
      name: `${tag}场景2-设计咨询项目-${ts}`,
      customerId: ids.customerId,
      projectCategory: "设计",
      designManagerId: null,
      supervisorLeaderId: null,
      organizationId: ids.org_BRANCH,
    });
    ids.project2 = proj2.id;
    console.log(`  ✅ 创建项目: ${proj2.name}（所属主体=分公司）`);

    // Step 2: 创建分公司收入合同
    const income2 = await apiPost(request, "/api/income-contracts", {
      contractNo: `SC2-INC-${ts}`,
      customerId: ids.customerId,
      totalAmount: "300000",
      projectSourceId: ids.lead2,
      organizationId: ids.org_BRANCH,
    });
    ids.incomeContract2 = income2.data.id;
    console.log(`  ✅ 创建收入合同: ${income2.data.contractNo}（所属主体=分公司，金额¥300,000）`);

    // Step 3: 创建内部结算合同（管理费单独付 SEPARATE）
    const inter2 = await apiPost(request, "/api/inter-org-contracts", {
      contractNo: `SC2-INT-${ts}`,
      contractName: `${tag}场景2-管理费-${ts}`,
      fromOrgId: ids.org_HQ,       // 收款方 = 总公司
      toOrgId: ids.org_BRANCH,     // 付款方 = 分公司
      type: "MANAGEMENT_FEE",
      settlementType: "SEPARATE",   // 单独支付
      relatedContractId: ids.incomeContract2,
      relatedContractType: "income_contract",
      totalAmount: 300000,
      managementFeeTotal: 15000,    // 5%管理费
      remainingAmount: 15000,
    });
    ids.interContract2 = inter2.id;
    console.log(`  ✅ 创建内部结算合同（管理费单独付，¥15,000）`);

    // Step 4: 创建发票（总公司开票给分公司）
    const invoice2 = await apiPost(request, "/api/invoices", {
      invoiceNo: `SC2-INV-${ts}`,
      invoiceType: "增值税专用发票",
      invoiceCategory: "销项发票",
      invoiceDate: new Date().toISOString(),
      amount: 15000,
      totalAmount: 15000,
      sourceType: "inter_org_contract",
      sourceId: ids.interContract2,
      organizationId: ids.org_HQ,  // 开票方=总公司
      sellerName: "总公司",
      buyerName: "安徽华东化工医药工程有限责任公司",
    });
    ids.invoice2 = invoice2.id;
    console.log(`  ✅ 创建发票（总公司→分公司，金额¥15,000）`);

    // Step 5: 验证
    const contractCheck2 = await apiGet(request, `/api/inter-org-contracts/${ids.interContract2}`);
    console.log(`  ✅ 内部结算合同状态: type=${contractCheck2.type}, settlementType=${contractCheck2.settlementType}`);
    expect(contractCheck2.settlementType).toBe("SEPARATE");

    console.log(`\n📋 场景2完成！数据已保存在系统中。`);
  });

  // ========================================================================
  // 场景3：总公司代付供应商（支出场景）
  // ========================================================================

  test("场景3：总公司代付 → 分公司还款（支出场景）", async ({ request }) => {
    console.log(`\n========== 场景3：总公司代付供应商 ==========`);
    await login(request);

    // Step 1: 创建项目（分公司项目）
    const lead3 = await apiPost(request, "/api/project-leads", {
      customerId: ids.customerId,
      projectName: `${tag}场景3-设备采购项目-${ts}`,
      location: "安徽省合肥市",
      contactPerson: "孙工",
      contactPhone: "13500135000",
      projectNature: "采购",
      implementationEntity: "分公司",
      currentStatus: "已中标",
    });
    ids.lead3 = lead3.data.projectSourceId;

    const proj3 = await apiPost(request, "/api/projects", {
      projectSourceId: ids.lead3,
      projectCode: `SC3-${ts}`,
      name: `${tag}场景3-设备采购项目-${ts}`,
      customerId: ids.customerId,
      projectCategory: "采购",
      designManagerId: null,
      supervisorLeaderId: null,
      organizationId: ids.org_BRANCH,
    });
    ids.project3 = proj3.id;
    console.log(`  ✅ 创建项目（分公司）`);

    // Step 2: 创建总公司支出合同（总公司和供应商签）
    const expense3 = await apiPost(request, "/api/expense-contracts", {
      contractNo: `SC3-EXP-${ts}`,
      supplierId: ids.supplierId,
      totalAmount: "80000",
      projectSourceId: ids.lead3,
      organizationId: ids.org_HQ,  // 签约主体=总公司
    });
    ids.expenseContract3 = expense3.data.id;
    console.log(`  ✅ 创建支出合同（总公司→供应商，金额¥80,000）`);

    // Step 3: 创建内部结算合同（代付结算）
    const inter3 = await apiPost(request, "/api/inter-org-contracts", {
      contractNo: `SC3-INT-${ts}`,
      contractName: `${tag}场景3-总公司代付结算-${ts}`,
      fromOrgId: ids.org_HQ,       // 收款方 = 总公司
      toOrgId: ids.org_BRANCH,     // 付款方 = 分公司
      type: "REIMBURSEMENT",
      settlementType: "SEPARATE",
      relatedContractId: expense3.data.id,
      relatedContractType: "expense_contract",
      totalAmount: 80000,
      managementFeeTotal: 0,       // 代付无管理费
      remainingAmount: 0,
    });
    ids.interContract3 = inter3.id;
    console.log(`  ✅ 创建内部结算合同（代付结算，¥80,000）`);

    // Step 4: 验证
    const contractCheck3 = await apiGet(request, `/api/inter-org-contracts/${ids.interContract3}`);
    console.log(`  ✅ 代付结算合同: type=${contractCheck3.type}, 金额=¥${contractCheck3.totalAmount}`);
    expect(contractCheck3.type).toBe("REIMBURSEMENT");

    console.log(`\n📋 场景3完成！数据已保存在系统中。`);
  });

  // ========================================================================
  // 场景4：总公司内部服务（技术支持/出版印刷）
  // ========================================================================

  test("场景4：总公司内部服务 → 分公司付费", async ({ request }) => {
    console.log(`\n========== 场景4：总公司内部服务 ==========`);
    await login(request);

    // Step 1: 创建内部结算合同（技术服务）
    const inter4 = await apiPost(request, "/api/inter-org-contracts", {
      contractNo: `SC4-INT-${ts}`,
      contractName: `${tag}场景4-技术支持服务费-${ts}`,
      fromOrgId: ids.org_HQ,       // 收款方 = 总公司
      toOrgId: ids.org_BRANCH,     // 付款方 = 分公司
      type: "INTERNAL_SERVICE",
      settlementType: "SEPARATE",
      totalAmount: 20000,
      managementFeeTotal: 0,       // 内部服务无管理费
      remainingAmount: 0,
    });
    ids.interContract4 = inter4.id;
    console.log(`  ✅ 创建内部结算合同（技术支持服务，¥20,000）`);

    // Step 2: 创建发票（总公司开票给分公司）
    const invoice4 = await apiPost(request, "/api/invoices", {
      invoiceNo: `SC4-INV-${ts}`,
      invoiceType: "增值税专用发票",
      invoiceCategory: "销项发票",
      invoiceDate: new Date().toISOString(),
      amount: 20000,
      totalAmount: 20000,
      sourceType: "inter_org_contract",
      sourceId: ids.interContract4,
      organizationId: ids.org_HQ,  // 开票方=总公司
      sellerName: "总公司",
      buyerName: "安徽华东化工医药工程有限责任公司",
      remark: "2026年度技术支持服务费",
    });
    ids.invoice4 = invoice4.id;
    console.log(`  ✅ 创建发票（总公司→分公司，金额¥20,000）`);

    // Step 3: 验证
    const contractCheck4 = await apiGet(request, `/api/inter-org-contracts/${ids.interContract4}`);
    console.log(`  ✅ 内部服务合同: type=${contractCheck4.type}, 金额=¥${contractCheck4.totalAmount}`);
    expect(contractCheck4.type).toBe("INTERNAL_SERVICE");

    console.log(`\n📋 场景4完成！数据已保存在系统中。`);
  });

  // ========================================================================
  // 场景5：挂靠公司管理费坐扣
  // ========================================================================

  test("场景5：挂靠业务 → 挂靠公司签客户 → 管理费坐扣 → 净额给咨询公司", async ({ request }) => {
    console.log(`\n========== 场景5：挂靠业务（管理费坐扣）==========`);
    await login(request);

    // Step 1: 创建项目（挂靠公司主体）
    const lead5 = await apiPost(request, "/api/project-leads", {
      customerId: ids.customerId,
      projectName: `${tag}场景5-挂靠业务项目-${ts}`,
      location: "安徽省合肥市",
      contactPerson: "周工",
      contactPhone: "13400134000",
      projectNature: "咨询",
      implementationEntity: "挂靠公司",
      currentStatus: "已中标",
    });
    ids.lead5 = lead5.data.projectSourceId;

    const proj5 = await apiPost(request, "/api/projects", {
      projectSourceId: ids.lead5,
      projectCode: `SC5-${ts}`,
      name: `${tag}场景5-挂靠业务项目-${ts}`,
      customerId: ids.customerId,
      projectCategory: "咨询",
      designManagerId: null,
      supervisorLeaderId: null,
      organizationId: ids.org_AFFILIATED,
    });
    ids.project5 = proj5.id;
    console.log(`  ✅ 创建项目（所属主体=挂靠公司）`);

    // Step 2: 创建挂靠公司收入合同
    const income5 = await apiPost(request, "/api/income-contracts", {
      contractNo: `SC5-INC-${ts}`,
      customerId: ids.customerId,
      totalAmount: "200000",
      projectSourceId: ids.lead5,
      organizationId: ids.org_AFFILIATED,
    });
    ids.incomeContract5 = income5.data.id;
    console.log(`  ✅ 创建收入合同（挂靠公司→客户，金额¥200,000）`);

    // Step 3: 创建内部结算合同（挂靠公司→咨询公司，管理费坐扣8% = ¥16,000）
    const inter5 = await apiPost(request, "/api/inter-org-contracts", {
      contractNo: `SC5-INT-${ts}`,
      contractName: `${tag}场景5-挂靠管理费-${ts}`,
      fromOrgId: ids.org_AFFILIATED, // 收款方 = 挂靠公司
      toOrgId: ids.org_CONSULT,      // 付款方 = 咨询公司
      type: "MANAGEMENT_FEE",
      settlementType: "NETTED",
      relatedContractId: ids.incomeContract5,
      relatedContractType: "income_contract",
      totalAmount: 200000,
      managementFeeTotal: 16000,      // 8%管理费
      remainingAmount: 16000,
    });
    ids.interContract5 = inter5.id;
    console.log(`  ✅ 创建内部结算合同（挂靠管理费坐扣，¥16,000）`);

    // Step 4: 创建发票（咨询公司开票给挂靠公司，管理费发票）
    const invoice5 = await apiPost(request, "/api/invoices", {
      invoiceNo: `SC5-INV-${ts}`,
      invoiceType: "增值税专用发票",
      invoiceCategory: "销项发票",
      invoiceDate: new Date().toISOString(),
      amount: 16000,
      totalAmount: 16000,
      sourceType: "inter_org_contract",
      sourceId: ids.interContract5,
      organizationId: ids.org_CONSULT,  // 开票方=咨询公司
      sellerName: "咨询公司",
      buyerName: "挂靠公司",
    });
    ids.invoice5 = invoice5.id;
    console.log(`  ✅ 创建发票（咨询公司→挂靠公司，金额¥16,000）`);

    // Step 5: 验证坐扣信息
    const contractCheck5 = await apiGet(request, `/api/inter-org-contracts/${ids.interContract5}`);
    console.log(`  ✅ 挂靠结算合同: 管理费总额=¥${contractCheck5.managementFeeTotal}, 已扣=${contractCheck5.deductedAmount}, 剩余=${contractCheck5.remainingAmount}`);
    expect(Number(contractCheck5.remainingAmount)).toBe(16000);
    expect(contractCheck5.settlementType).toBe("NETTED");

    console.log(`\n📋 场景5完成！数据已保存在系统中。`);
  });

  // ========================================================================
  // 最终验证：查询汇总
  // ========================================================================

  test("最终验证：查询所有场景的合同和内部结算", async ({ request }) => {
    console.log(`\n========== 最终验证 ==========`);
    await login(request);

    // 查询所有内部结算合同
    const allInter = await apiGet(request, "/api/inter-org-contracts");
    const businessContracts = allInter.data.filter(
      (c: any) => c.contractName && c.contractName.includes(tag)
    );
    console.log(`  ✅ 查询到 ${businessContracts.length} 个内部结算合同（业务验证数据）`);

    // 按类型统计
    const types: Record<string, number> = {};
    for (const c of businessContracts) {
      types[c.type] = (types[c.type] || 0) + 1;
    }
    console.log(`  📊 类型分布: ${JSON.stringify(types)}`);

    // 查询所有带 tag 的发票
    const allInvoices = await apiGet(request, "/api/invoices");
    const bizInvoices = allInvoices.data?.filter
      ? allInvoices.data.filter((inv: any) => inv.invoiceNo && inv.invoiceNo.includes(ts.toString()))
      : [];
    console.log(`  ✅ 查询到 ${bizInvoices.length} 个相关发票`);

    // 查询所有组织
    const orgs = await apiGet(request, "/api/organizations");
    console.log(`  ✅ 经营主体列表:`);
    for (const o of orgs.data) {
      console.log(`     - ${o.shortName} (${o.type})`);
    }

    console.log(`\n========================================`);
    console.log(`📋 所有场景测试完成！`);
    console.log(`   测试数据标签: ${tag}`);
    console.log(`   时间戳: ${ts}`);
    console.log(`   所有数据已保留在系统中，可在对应页面查看。`);
    console.log(`========================================`);

    // 断言所有场景都创建了内部结算合同（至少5个，可能有旧数据）
    expect(businessContracts.length).toBeGreaterThanOrEqual(5);
  });
});

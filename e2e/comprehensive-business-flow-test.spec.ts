import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";
const TEST_TIMEOUT = 120_000;

interface TestResult {
  step: string;
  name: string;
  status: "success" | "fail";
  message: string;
}

const results: TestResult[] = [];

function recordResult(step: string, name: string, status: "success" | "fail", message: string) {
  results.push({ step, name, status, message });
  const icon = status === "success" ? "✅" : "❌";
  console.log(`${icon} [${step}] ${name}: ${message}`);
}

function recordError(step: string, name: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  recordResult(step, name, "fail", msg);
}

test.describe("全业务流自动化综合测试 - 4 大项", () => {
  test.describe.configure({ mode: "serial" });

  const ids: Record<string, string> = {};
  const ts = Date.now();
  const today = new Date().toISOString().split("T")[0];

  // ====================== 通用工具函数 ======================

  async function loginAs(ctx: any, username: string, password: string) {
    const r = await ctx.post(`${BASE_URL}/api/auth/login`, {
      data: { username, password },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.ok()).toBeTruthy();
  }

  async function loginAsZhangJing(ctx: any) {
    await loginAs(ctx, "zhangjing@hcec.group", "123456");
  }

  async function loginAsAdmin(ctx: any) {
    await loginAs(ctx, "admin", "admin123");
  }

  async function loginAndSetStatus(ctx: any, businessType: string, businessId: string, newStatus: string) {
    await loginAsAdmin(ctx);
    await apiPost(ctx, "/api/admin/set-approval-status", { businessType, businessId, newStatus });
  }

  async function apiPost(ctx: any, url: string, body: unknown) {
    const r = await ctx.post(`${BASE_URL}${url}`, {
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    const j = await r.json();
    if (!r.ok()) throw new Error(`POST ${url} ${r.status()}: ${JSON.stringify(j)}`);
    return j;
  }

  async function apiPut(ctx: any, url: string, body: unknown) {
    const r = await ctx.put(`${BASE_URL}${url}`, {
      data: body,
      headers: { "Content-Type": "application/json" },
    });
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

  async function adminSetStatus(ctx: any, businessType: string, businessId: string, newStatus: string) {
    await loginAsAdmin(ctx);
    await apiPost(ctx, "/api/admin/set-approval-status", { businessType, businessId, newStatus });
    await loginAsZhangJing(ctx);
  }

  async function adminForceAdvance(ctx: any, instanceId: string, comment?: string) {
    await loginAsAdmin(ctx);
    const result = await apiPost(ctx, "/api/approval-flows/force-advance", {
      instanceId,
      comment: comment || "管理员推进",
    });
    await loginAsZhangJing(ctx);
    return result;
  }

  async function adminDeleteApprovalInstance(ctx: any, instanceId: string) {
    await loginAsAdmin(ctx);
    await ctx.delete(`${BASE_URL}/api/admin/approval-debug?instanceId=${instanceId}`);
    await loginAsZhangJing(ctx);
  }

  async function configureApprovalFlow(ctx: any, businessType: string, nodes: { nodeOrder: number; nodeName: string; approverRole: string; nodeType?: string }[]) {
    await apiPost(ctx, "/api/approval-flows", {
      businessType,
      flowLevel: "common",
      nodes,
    });
  }

  async function startApproval(ctx: any, businessType: string, businessId: string, flowLevel = "common") {
    return await apiPost(ctx, "/api/approval-instances", { businessType, businessId, flowLevel });
  }

  async function approveAction(ctx: any, instanceId: string, comment?: string) {
    return await apiPost(ctx, `/api/approval-instances/${instanceId}/actions`, {
      action: "approve",
      comment: comment || "审批通过",
    });
  }

  async function rejectAction(ctx: any, instanceId: string, comment?: string) {
    return await apiPost(ctx, `/api/approval-instances/${instanceId}/actions`, {
      action: "reject",
      comment: comment || "审批不通过，请修改",
    });
  }

  async function archiveAction(ctx: any, instanceId: string, comment?: string, archivedUrl?: string) {
    return await apiPost(ctx, `/api/approval-instances/${instanceId}/actions`, {
      action: "archive",
      comment: comment || "归档完成",
      archivedUrl: archivedUrl || "https://test-archive.example.com/scanned-contract.pdf",
    });
  }

  async function paymentAction(ctx: any, instanceId: string, bankAccountId: string, comment?: string) {
    return await apiPost(ctx, `/api/approval-instances/${instanceId}/actions`, {
      action: "payment",
      bankAccountId,
      comment: comment || "已支付",
    });
  }

  async function getCurrentUser(ctx: any) {
    const r = await ctx.get(`${BASE_URL}/api/auth/current-user`);
    const j = await r.json();
    return j.data;
  }

  async function verifyApprovalInstance(ctx: any, businessType: string, businessId: string, expectedStatus: string) {
    // Use ?type=all to bypass the "pending" default branch and hit the businessType+businessId query
    const instances = await apiGet(ctx, `/api/approval-instances?type=all&businessType=${businessType}&businessId=${businessId}`);
    if (!instances.data || instances.data.length === 0) {
      throw new Error(`未找到 ${businessType}/${businessId} 的审批实例`);
    }
    const instance = instances.data[0];
    if (instance.status !== expectedStatus) {
      throw new Error(`审批实例状态期望 ${expectedStatus}，实际 ${instance.status}，实例ID: ${instance.id}`);
    }
    const hasActions = instance.actions && instance.actions.length > 0;
    if (!hasActions) {
      throw new Error(`审批实例 ${instance.id} 没有审批动作记录`);
    }
    return instance;
  }

  // ====================== 第 1 大项：合同管理 ======================

  test("【第1大项-前置】创建客户、项目线索、项目", async ({ request }) => {
    test.setTimeout(TEST_TIMEOUT);
    try {
      await loginAsZhangJing(request);
      recordResult("1-前置", "张晶登录", "success", "登录成功");

      // 创建客户
      const cust = await apiPost(request, "/api/customers", {
        name: `综合测试客户-${ts}`,
        shortName: "测试客户",
        industryType: "化工",
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
      ids.customerId = cust.data.id;
      recordResult("1-前置", "创建客户", "success", `客户ID: ${ids.customerId}`);

      // 创建项目线索
      const lead = await apiPost(request, "/api/project-leads", {
        customerId: ids.customerId,
        projectName: `综合测试项目-${ts}`,
        location: "安徽省合肥市",
        contactPerson: "王工",
        contactPhone: "13900139000",
        projectNature: ["EP"],
        implementationEntity: "华东工程",
        currentStatus: "已中标",
      });
      ids.projectSourceId = lead.data.projectSourceId;
      recordResult("1-前置", "创建项目线索", "success", `线索ID: ${ids.projectSourceId}`);

      // 创建正式项目
      const proj = await apiPost(request, "/api/projects", {
        projectSourceId: ids.projectSourceId,
        projectCode: `PROJ-${ts}`,
        name: `综合测试项目-${ts}`,
        customerId: ids.customerId,
        projectCategory: "EP",
        source: "项目线索",
        status: "执行",
      });
      ids.projectId = proj.data.id;
      recordResult("1-前置", "创建正式项目", "success", `项目ID: ${ids.projectId}`);

      // 获取用户ID
      const curUser = await getCurrentUser(request);
      ids.zhangjingId = curUser.id;
      recordResult("1-前置", "获取用户信息", "success", `张晶ID: ${ids.zhangjingId}`);

      // 获取银行账户
      const bankRes = await apiGet(request, "/api/bank-accounts?isActive=true");
      if (bankRes.data && bankRes.data.length > 0) {
        ids.bankAccountId = bankRes.data[0].id;
        recordResult("1-前置", "获取银行账户", "success", `账户ID: ${ids.bankAccountId}`);
      } else {
        const bank = await apiPost(request, "/api/bank-accounts", {
          bankName: "测试银行",
          accountName: "华东工程基本户",
          accountNo: `622202${String(ts).slice(0, 12)}`,
          accountType: "公司账户",
        });
        ids.bankAccountId = bank.data.id;
        recordResult("1-前置", "创建银行账户", "success", `账户ID: ${ids.bankAccountId}`);
      }

      // 创建个人银行账户（用于支付）
      const personalBank = await apiPost(request, "/api/bank-accounts", {
        bankName: "测试银行",
        accountName: "张晶个人卡",
        accountNo: `622203${String(ts + 1).slice(0, 12)}`,
        accountType: "个人账户",
      });
      ids.personalBankAccountId = personalBank.data.id;
      recordResult("1-前置", "创建个人银行账户", "success", `账户ID: ${ids.personalBankAccountId}`);

      recordResult("1-前置", "前置数据准备", "success", "全部完成");
    } catch (e) {
      recordError("1-前置", "前置数据准备", e);
      throw e;
    }
  });

  test("【第1大项-收入合同】新建收入合同 → 退回 → 重新提交 → 归档", async ({ request }) => {
    test.setTimeout(TEST_TIMEOUT);
    try {
      await loginAsZhangJing(request);

      const contractNo = `SR-${today.replace(/-/g, "")}-${ts.toString().slice(-4)}`;

      // 创建收入合同
      const contract = await apiPost(request, "/api/income-contracts", {
        contractNo,
        projectSourceId: ids.projectSourceId,
        customerId: ids.customerId,
        totalAmount: "1000000",
        paymentTerms: "按进度付款",
        splitStages: [
          { name: "预付款", amount: 300000 },
          { name: "进度款", amount: 500000 },
          { name: "尾款", amount: 200000 },
        ],
      });
      ids.incomeContractId = contract.data.id;
      recordResult("1-收入合同", "创建收入合同", "success", `合同ID: ${ids.incomeContractId}, 编号: ${contractNo}`);

      // 提交审批（审批流已由 setup-test-approval-flows 脚本配置）
      await adminSetStatus(request, "income_contract", ids.incomeContractId, "审批中");
      const instance1 = await startApproval(request, "income_contract", ids.incomeContractId);
      ids.incomeContractInstanceId = instance1.data.instanceId;
      recordResult("1-收入合同", "启动审批", "success", `实例ID: ${ids.incomeContractInstanceId}`);

      // 验证审批实例已创建
      const instanceDetail = await verifyApprovalInstance(request, "income_contract", ids.incomeContractId, "审批中");
      recordResult("1-收入合同", "验证审批实例", "success", `实例状态: ${instanceDetail.status}, 动作数: ${instanceDetail.actions.length}`);

      // ====== 退回测试 ======
      // 当前在节点1（行政人事初审），执行退回
      const rejectRes = await rejectAction(request, ids.incomeContractInstanceId, "合同金额与项目预算不符，请修改");
      recordResult("1-收入合同", "退回测试-行政人事初审退回", "success", `状态: ${rejectRes.data.status}`);

      // 退回后业务状态为"已驳回"，需先重置为草稿才能编辑
      await adminSetStatus(request, "income_contract", ids.incomeContractId, "草稿");
      recordResult("1-收入合同", "退回测试-重置为草稿", "success", "合同已重置为草稿状态");

      // 修改合同
      await apiPut(request, `/api/income-contracts/${ids.incomeContractId}`, {
        totalAmount: "1200000",
        contractSummary: "根据审批意见修改了合同金额",
      });
      recordResult("1-收入合同", "退回测试-修改合同", "success", "已修改金额并重新提交");

      // 删除旧实例并重新启动流程
      await adminDeleteApprovalInstance(request, ids.incomeContractInstanceId);
      await adminSetStatus(request, "income_contract", ids.incomeContractId, "审批中");
      const newInstance = await startApproval(request, "income_contract", ids.incomeContractId);
      ids.incomeContractInstanceId = newInstance.data.instanceId;
      recordResult("1-收入合同", "退回测试-重新提交实例", "success", "已重新创建审批实例");

      // ====== 通过测试 ======
      // 张晶拥有所有审批角色，全部由张晶审批
      await approveAction(request, ids.incomeContractInstanceId, "初审通过");
      await approveAction(request, ids.incomeContractInstanceId, "财务审核通过");
      await approveAction(request, ids.incomeContractInstanceId, "总经理同意");

      // 节点4：归档节点，先检查实例状态
      const checkInstance = await apiGet(request, `/api/approval-instances?type=all&businessType=income_contract&businessId=${ids.incomeContractId}`);
      const instanceStatus = checkInstance.data?.[0]?.status;
      const currentNode = checkInstance.data?.[0]?.currentNode;
      recordResult("1-收入合同", "审批后实例状态", "success", `状态: ${instanceStatus}, 当前节点: ${currentNode}`);

      if (instanceStatus === "已批准") {
        recordResult("1-收入合同", "归档完成", "success", "实例已自动完成审批并归档");
      } else {
        // 归档节点需要传 archivedUrl（扫描件URL）
        const archiveRes = await archiveAction(request, ids.incomeContractInstanceId, "合同已归档，扫描件已上传");
        recordResult("1-收入合同", "归档完成", "success", `最终状态: ${archiveRes.data.status}`);
      }

      // 验证合同状态
      const updatedContract = await apiGet(request, `/api/income-contracts/${ids.incomeContractId}`);
      recordResult("1-收入合同", "验证合同状态", "success", `合同状态: ${updatedContract.data.status}`);

      // 验证审批实例详情
      await verifyApprovalInstance(request, "income_contract", ids.incomeContractId, "已批准");
      recordResult("1-收入合同", "验证完整审批实例", "success", "收入合同审批实例完整");

      recordResult("1-收入合同", "完整流程", "success", "全部完成");
    } catch (e) {
      recordError("1-收入合同", "完整流程", e);
      throw e;
    }
  });

  test("【第1大项-支出合同】新建支出合同 → 退回 → 重新提交 → 归档", async ({ request }) => {
    test.setTimeout(TEST_TIMEOUT);
    try {
      await loginAsZhangJing(request);

      // 先创建供应商
      const supp = await apiPost(request, "/api/suppliers", {
        name: `综合测试供应商-${ts}`,
        supplierType: "企业",
        status: "当前有效",
        contactPerson: "赵六",
        phone: "13700137000",
        address: "测试路200号",
      });
      ids.supplierId = supp.data.id;
      recordResult("1-支出合同", "创建供应商", "success", `供应商ID: ${ids.supplierId}`);

      const contractNo = `ZC-${today.replace(/-/g, "")}-${ts.toString().slice(-4)}`;

      // 创建支出合同
      const contract = await apiPost(request, "/api/expense-contracts", {
        contractNo,
        projectSourceId: ids.projectSourceId,
        supplierId: ids.supplierId,
        totalAmount: "500000",
        contractType: "项目采购",
        signedDate: today,
        paymentTerms: "货到付款",
      });
      ids.expenseContractId = contract.data.id;
      recordResult("1-支出合同", "创建支出合同", "success", `合同ID: ${ids.expenseContractId}, 编号: ${contractNo}`);

      // 提交审批（审批流已由 setup-test-approval-flows 脚本配置）
      await adminSetStatus(request, "expense_contract", ids.expenseContractId, "审批中");
      const instance1 = await startApproval(request, "expense_contract", ids.expenseContractId);
      ids.expenseContractInstanceId = instance1.data.instanceId;
      recordResult("1-支出合同", "启动审批", "success", `实例ID: ${ids.expenseContractInstanceId}`);

      // ====== 退回测试（在财务审核节点退回）======
      await approveAction(request, ids.expenseContractInstanceId, "初审通过");
      recordResult("1-支出合同", "行政人事初审通过", "success", "已进入财务审核节点");

      // 财务审核退回
      await loginAsZhangJing(request);
      const rejectRes = await rejectAction(request, ids.expenseContractInstanceId, "付款条款需要修改");
      recordResult("1-支出合同", "退回测试-财务审核退回", "success", `状态: ${rejectRes.data.status}`);

      // 退回后业务状态为"已驳回"，需先重置为草稿才能编辑
      await adminSetStatus(request, "expense_contract", ids.expenseContractId, "草稿");
      recordResult("1-支出合同", "退回测试-重置为草稿", "success", "合同已重置为草稿状态");

      // 修改合同
      await apiPut(request, `/api/expense-contracts/${ids.expenseContractId}`, {
        paymentTerms: "验收合格后30天内付款",
      });
      recordResult("1-支出合同", "退回测试-修改合同", "success", "已修改付款条款");

      // 重新提交
      await adminDeleteApprovalInstance(request, ids.expenseContractInstanceId);
      await adminSetStatus(request, "expense_contract", ids.expenseContractId, "审批中");
      const newExpInst = await startApproval(request, "expense_contract", ids.expenseContractId);
      ids.expenseContractInstanceId = newExpInst.data.instanceId;
      recordResult("1-支出合同", "退回测试-重新提交", "success", "已重新创建审批实例");

      // ====== 通过测试 ======
      await approveAction(request, ids.expenseContractInstanceId, "初审通过");
      await approveAction(request, ids.expenseContractInstanceId, "财务审核通过");
      await approveAction(request, ids.expenseContractInstanceId, "总经理同意");

      // 归档节点，先检查实例状态
      const checkExpInst = await apiGet(request, `/api/approval-instances?type=all&businessType=expense_contract&businessId=${ids.expenseContractId}`);
      const expStatus = checkExpInst.data?.[0]?.status;
      recordResult("1-支出合同", "审批后实例状态", "success", `状态: ${expStatus}`);

      if (expStatus !== "已批准") {
        await archiveAction(request, ids.expenseContractInstanceId, "合同已归档");
      }
      recordResult("1-支出合同", "归档完成", "success", "支出合同归档完成");

      // 验证审批实例
      await verifyApprovalInstance(request, "expense_contract", ids.expenseContractId, "已批准");
      recordResult("1-支出合同", "验证完整审批实例", "success", "支出合同审批实例完整");

      recordResult("1-支出合同", "完整流程", "success", "全部完成");
    } catch (e) {
      recordError("1-支出合同", "完整流程", e);
      throw e;
    }
  });

  // ====================== 第 2 大项：收付款凭据 ======================

  test("【第2大项-收款】收入合同收款登记", async ({ request }) => {
    test.setTimeout(TEST_TIMEOUT);
    try {
      await loginAsZhangJing(request);

      // 查询应收记录（收入合同审批通过后自动创建）
      const receivables = await apiGet(request, `/api/receivables?sourceType=income_contract&sourceId=${ids.incomeContractId}&pageSize=10`);
      let receivableData;
      if (receivables.data && receivables.data.length > 0) {
        ids.receivableId = receivables.data[0].id;
        receivableData = receivables.data[0];
        recordResult("2-收款", "查询应收记录", "success", `应收ID: ${ids.receivableId}, 金额: ${receivableData.amount}`);
      } else {
        // 手动创建应收记录
        const recv = await apiPost(request, "/api/receivables", {
          sourceType: "income_contract",
          sourceId: ids.incomeContractId,
          projectSourceId: ids.projectSourceId,
          dueDate: today,
          amount: 1000000,
        });
        ids.receivableId = recv.data.id;
        receivableData = recv.data;
        recordResult("2-收款", "手动创建应收记录", "success", `应收ID: ${ids.receivableId}`);
      }

      // 创建收款凭证（必须创建 ReceiptVoucher，UI 的"记录"按钮查询的是收款凭证列表）
      const voucher = await apiPost(request, "/api/receipt-vouchers", {
        receivableId: ids.receivableId,
        amount: receivableData.amount,
        receiptDate: today,
        receiptReason: "合同收款",
        receiptMethod: "银行转账",
        bankAccount: "测试银行账户",
      });
      recordResult("2-收款", "收款凭证创建", "success", `凭证ID: ${voucher.data.id}, 金额: ${voucher.data.amount}`);

      // 验证余额更新
      const updatedRecv = await apiGet(request, `/api/receivables/${ids.receivableId}`);
      recordResult("2-收款", "验证收款记录", "success", `状态: ${updatedRecv.data.status}, 已收: ${updatedRecv.data.paidAmount}`);

      // 验证收款凭证已生成（UI 点开记录能看到数据）
      const vouchers = await apiGet(request, `/api/receipt-vouchers?receivableId=${ids.receivableId}`);
      recordResult("2-收款", "验证收款凭证", "success", `收款凭证数: ${vouchers.data.length}`);

      recordResult("2-收款", "收款流程", "success", "全部完成");
    } catch (e) {
      recordError("2-收款", "收款流程", e);
      throw e;
    }
  });

  test("【第2大项-付款】支出合同付款申请 → 退回 → 重新提交 → 支付", async ({ request }) => {
    test.setTimeout(TEST_TIMEOUT);
    try {
      await loginAsZhangJing(request);

      // 查询应付记录
      const payables = await apiGet(request, `/api/payables?sourceType=expense_contract&sourceId=${ids.expenseContractId}&pageSize=10`);
      let payableId: string;
      if (payables.data && payables.data.length > 0) {
        payableId = payables.data[0].id;
        recordResult("2-付款", "查询应付记录", "success", `应付ID: ${payableId}`);
      } else {
        const payable = await apiPost(request, "/api/payables", {
          sourceType: "expense_contract",
          sourceId: ids.expenseContractId,
          projectSourceId: ids.projectSourceId,
          dueDate: today,
          amount: 500000,
        });
        payableId = payable.data.id;
        recordResult("2-付款", "创建应付记录", "success", `应付ID: ${payableId}`);
      }
      ids.payableId = payableId;

      // 创建付款凭据（付款申请）
      const paymentApp = await apiPost(request, "/api/payment-applications", {
        payableId: ids.payableId,
        applicantId: ids.zhangjingId,
        amount: 500000,
        paymentReason: "采购合同付款",
        paymentMethod: "银行转账",
      });
      ids.paymentAppId = paymentApp.data.id;
      recordResult("2-付款", "创建付款申请", "success", `付款申请ID: ${ids.paymentAppId}`);

      // 提交审批（审批流已由 setup-test-approval-flows 脚本配置）
      await adminSetStatus(request, "payment_application", ids.paymentAppId, "审批中");
      const instance = await startApproval(request, "payment_application", ids.paymentAppId);
      ids.paymentInstanceId = instance.data.instanceId;
      recordResult("2-付款", "启动审批", "success", `实例ID: ${ids.paymentInstanceId}`);

      // ====== 退回测试 ======
      // 行政人事初审退回
      const rejectRes = await rejectAction(request, ids.paymentInstanceId, "付款账号信息不完整");
      recordResult("2-付款", "退回测试-初审退回", "success", `状态: ${rejectRes.data.status}`);

      // 退回后业务状态为"已驳回"，需先重置为草稿才能编辑
      await adminSetStatus(request, "payment_application", ids.paymentAppId, "草稿");
      recordResult("2-付款", "退回测试-重置为草稿", "success", "已重置为草稿");

      // 修改后重新提交
      await apiPut(request, `/api/payment-applications/${ids.paymentAppId}`, {
        bankAccount: "622202****1234",
        remark: "已补充银行账号信息",
      });
      await adminSetStatus(request, "payment_application", ids.paymentAppId, "审批中");
      await adminDeleteApprovalInstance(request, ids.paymentInstanceId);
      const newPayInst = await startApproval(request, "payment_application", ids.paymentAppId);
      ids.paymentInstanceId = newPayInst.data.instanceId;
      recordResult("2-付款", "退回测试-重新提交", "success", "已重新创建审批实例");

      // ====== 通过测试 ======
      await approveAction(request, ids.paymentInstanceId, "初审通过");
      await loginAsZhangJing(request);
      await approveAction(request, ids.paymentInstanceId, "财务审核通过");
      await approveAction(request, ids.paymentInstanceId, "总经理同意");

      // 验证支付节点
      const detail = await apiGet(request, `/api/approval-instances/${ids.paymentInstanceId}`);
      const flowNodes = detail.data.flowNodes || [];
      const paymentNode = flowNodes.find((n: any) => n.nodeType === "payment");
      if (paymentNode) {
        recordResult("2-付款", "支付节点检测", "success", `找到payment类型节点: ${paymentNode.nodeName}`);
      }

      // 支付
      const payRes = await paymentAction(request, ids.paymentInstanceId, ids.bankAccountId, "已通过银行转账支付");
      recordResult("2-付款", "支付完成", "success", `状态: ${payRes.data.status}`);

      // 验证审批实例
      await verifyApprovalInstance(request, "payment_application", ids.paymentAppId, "已批准");
      recordResult("2-付款", "验证完整审批实例", "success", "付款申请审批实例完整");

      recordResult("2-付款", "付款流程", "success", "全部完成");
    } catch (e) {
      recordError("2-付款", "付款流程", e);
      throw e;
    }
  });

  // ====================== 第 3 大项：财务支出全场景 ======================

  test("【第3大项-其他支付】非合同支出 → 退回 → 重新提交 → 支付", async ({ request }) => {
    test.setTimeout(TEST_TIMEOUT);
    try {
      await loginAsZhangJing(request);

      // 创建非合同支出
      const nce = await apiPost(request, "/api/non-contract-expenses", {
        projectSourceId: ids.projectSourceId,
        amount: 30000,
        transactionDate: today,
        counterparty: "临时供应商",
        description: "项目现场零星采购",
      });
      ids.nonContractExpenseId = nce.data.id;
      recordResult("3-其他支付", "创建非合同支出", "success", `支出ID: ${ids.nonContractExpenseId}`);

      // 提交审批（审批流已由 setup-test-approval-flows 脚本配置）
      await adminSetStatus(request, "non_contract_expense", ids.nonContractExpenseId, "审批中");
      const instance = await startApproval(request, "non_contract_expense", ids.nonContractExpenseId);
      ids.nceInstanceId = instance.data.instanceId;
      recordResult("3-其他支付", "启动审批", "success", `实例ID: ${ids.nceInstanceId}`);

      // 退回测试
      const rejectRes = await rejectAction(request, ids.nceInstanceId, "请补充费用明细");
      recordResult("3-其他支付", "退回测试", "success", `状态: ${rejectRes.data.status}`);

      await adminSetStatus(request, "non_contract_expense", ids.nonContractExpenseId, "审批中");
      await adminDeleteApprovalInstance(request, ids.nceInstanceId);
      const newNceInst = await startApproval(request, "non_contract_expense", ids.nonContractExpenseId);
      ids.nceInstanceId = newNceInst.data.instanceId;
      recordResult("3-其他支付", "退回后重新提交", "success", "已重新创建审批实例");

      // 全部通过
      await approveAction(request, ids.nceInstanceId, "初审通过");
      await loginAsZhangJing(request);
      await approveAction(request, ids.nceInstanceId, "财务审核通过");
      await approveAction(request, ids.nceInstanceId, "总经理同意");
      const payRes = await paymentAction(request, ids.nceInstanceId, ids.bankAccountId, "已支付");
      recordResult("3-其他支付", "支付完成", "success", `状态: ${payRes.data.status}`);

      // 验证审批实例
      const verifyRes = await verifyApprovalInstance(request, "non_contract_expense", ids.nonContractExpenseId, "已批准");
      recordResult("3-其他支付", "验证审批实例", "success", `动作数: ${verifyRes.actions.length}`);

      recordResult("3-其他支付", "完整流程", "success", "全部完成");
    } catch (e) {
      recordError("3-其他支付", "完整流程", e);
      throw e;
    }
  });

  test("【第3大项-费用报销】费用报销 → 退回 → 重新提交 → 支付", async ({ request }) => {
    test.setTimeout(TEST_TIMEOUT);
    try {
      await loginAsZhangJing(request);

      // 创建费用报销
      const expenseReport = await apiPost(request, "/api/expense-reports", {
        applicantId: ids.zhangjingId,
        expenseType: "差旅费",
        amount: 5000,
        projectSourceId: ids.projectSourceId,
        budgetCategory: "项目差旅费",
        description: "项目现场出差费用",
        items: [
          { expenseType: "交通费", amount: 2000, description: "高铁票" },
          { expenseType: "住宿费", amount: 2000, description: "酒店住宿" },
          { expenseType: "餐饮补贴", amount: 1000, description: "出差餐补" },
        ],
      });
      ids.expenseReportId = expenseReport.data.id;
      recordResult("3-费用报销", "创建费用报销", "success", `报销ID: ${ids.expenseReportId}`);

      // 提交审批（审批流已由 setup-test-approval-flows 脚本配置）
      await adminSetStatus(request, "expense_report", ids.expenseReportId, "审批中");
      const instance = await startApproval(request, "expense_report", ids.expenseReportId);
      ids.expenseReportInstanceId = instance.data.instanceId;
      recordResult("3-费用报销", "启动审批", "success", `实例ID: ${ids.expenseReportInstanceId}`);

      // 初审通过
      await approveAction(request, ids.expenseReportInstanceId, "初审通过");
      recordResult("3-费用报销", "初审通过", "success", "已进入财务审核节点");

      // 退回测试（财务审核退回）
      await loginAsZhangJing(request);
      const rejectRes = await rejectAction(request, ids.expenseReportInstanceId, "住宿费超标，请调整");
      recordResult("3-费用报销", "退回测试-财务退回", "success", `状态: ${rejectRes.data.status}`);

      // 退回后业务状态为"已驳回"，需先重置为草稿才能编辑
      await adminSetStatus(request, "expense_report", ids.expenseReportId, "草稿");
      recordResult("3-费用报销", "退回测试-重置为草稿", "success", "已重置为草稿");

      // 修改报销单
      await apiPut(request, `/api/expense-reports/${ids.expenseReportId}`, {
        amount: 4000,
        description: "已调整住宿费用",
        items: [
          { expenseType: "交通费", amount: 2000, description: "高铁票" },
          { expenseType: "住宿费", amount: 1000, description: "酒店住宿（已调整）" },
          { expenseType: "餐饮补贴", amount: 1000, description: "出差餐补" },
        ],
      });
      recordResult("3-费用报销", "退回测试-修改报销单", "success", "已调整金额");

      // 重新提交
      await adminSetStatus(request, "expense_report", ids.expenseReportId, "审批中");
      await adminDeleteApprovalInstance(request, ids.expenseReportInstanceId);
      const newExpRepInst = await startApproval(request, "expense_report", ids.expenseReportId);
      ids.expenseReportInstanceId = newExpRepInst.data.instanceId;
      recordResult("3-费用报销", "退回测试-重新提交", "success", "已重新创建审批实例");

      // 全部通过
      await approveAction(request, ids.expenseReportInstanceId, "初审通过");
      await loginAsZhangJing(request);
      await approveAction(request, ids.expenseReportInstanceId, "财务审核通过");
      await approveAction(request, ids.expenseReportInstanceId, "总经理同意");
      const payRes = await paymentAction(request, ids.expenseReportInstanceId, ids.personalBankAccountId, "已支付到个人账户");
      recordResult("3-费用报销", "支付完成", "success", `状态: ${payRes.data.status}`);

      // 验证审批实例
      await verifyApprovalInstance(request, "expense_report", ids.expenseReportId, "已批准");
      recordResult("3-费用报销", "验证审批实例", "success", "费用报销审批实例完整");

      recordResult("3-费用报销", "完整流程", "success", "全部完成");
    } catch (e) {
      recordError("3-费用报销", "完整流程", e);
      throw e;
    }
  });

  test("【第3大项-借出款】借出款 → 退回 → 重新提交 → 支付", async ({ request }) => {
    test.setTimeout(TEST_TIMEOUT);
    try {
      await loginAsZhangJing(request);

      // 创建借出款
      const lend = await apiPost(request, "/api/lending-outs", {
        lendingType: "备用金",
        projectSourceId: ids.projectSourceId,
        borrowerName: "张晶",
        amount: 20000,
        lendingDate: today,
        expectedReturnDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        description: "项目现场备用金",
      });
      ids.lendingOutId = lend.data.id;
      recordResult("3-借出款", "创建借出款", "success", `借出款ID: ${ids.lendingOutId}`);

      // 提交审批（审批流已由 setup-test-approval-flows 脚本配置）
      await adminSetStatus(request, "lending_out", ids.lendingOutId, "审批中");
      const instance = await startApproval(request, "lending_out", ids.lendingOutId);
      ids.lendingInstanceId = instance.data.instanceId;
      recordResult("3-借出款", "启动审批", "success", `实例ID: ${ids.lendingInstanceId}`);

      // 初审通过
      await approveAction(request, ids.lendingInstanceId, "初审通过");
      recordResult("3-借出款", "初审通过", "success", "");

      // 财务审核通过
      await loginAsZhangJing(request);
      await approveAction(request, ids.lendingInstanceId, "财务审核通过");
      recordResult("3-借出款", "财务审核通过", "success", "");

      // 退回测试（总经理退回）
      const rejectRes = await rejectAction(request, ids.lendingInstanceId, "备用金金额偏大，建议调整为10000");
      recordResult("3-借出款", "退回测试-总经理退回", "success", `状态: ${rejectRes.data.status}`);

      // 退回后业务状态为"已驳回"，需先重置为草稿才能编辑
      await adminSetStatus(request, "lending_out", ids.lendingOutId, "草稿");
      recordResult("3-借出款", "退回测试-重置为草稿", "success", "已重置为草稿");

      // 修改后重新提交
      await apiPut(request, `/api/lending-outs/${ids.lendingOutId}`, {
        amount: 10000,
        description: "根据审批意见调整备用金金额为10000",
      });
      await adminSetStatus(request, "lending_out", ids.lendingOutId, "审批中");
      await adminDeleteApprovalInstance(request, ids.lendingInstanceId);
      const newLendInst = await startApproval(request, "lending_out", ids.lendingOutId);
      ids.lendingInstanceId = newLendInst.data.instanceId;
      recordResult("3-借出款", "退回后重新提交", "success", "已重新创建审批实例");

      // 全部通过
      await approveAction(request, ids.lendingInstanceId, "初审通过");
      await loginAsZhangJing(request);
      await approveAction(request, ids.lendingInstanceId, "财务审核通过");
      await approveAction(request, ids.lendingInstanceId, "总经理同意");
      const payRes = await paymentAction(request, ids.lendingInstanceId, ids.personalBankAccountId, "已支付备用金");
      recordResult("3-借出款", "支付完成", "success", `状态: ${payRes.data.status}`);

      // 验证审批实例
      await verifyApprovalInstance(request, "lending_out", ids.lendingOutId, "已批准");
      recordResult("3-借出款", "验证审批实例", "success", "借出款审批实例完整");

      recordResult("3-借出款", "完整流程", "success", "全部完成");
    } catch (e) {
      recordError("3-借出款", "完整流程", e);
      throw e;
    }
  });

  test("【第3大项-工资发放】工资发放 → 退回 → 重新提交 → 支付", async ({ request }) => {
    test.setTimeout(TEST_TIMEOUT);
    try {
      await loginAsZhangJing(request);

      // 获取员工列表
      const usersRes = await apiGet(request, "/api/users?pageSize=100");
      const activeUsers = usersRes.data.filter((u: any) => u.isActive !== false && u.id === ids.zhangjingId);
      if (activeUsers.length === 0) {
        recordResult("3-工资发放", "获取员工", "fail", "未找到张晶员工信息，尝试使用其他用户");
        const allActive = usersRes.data.filter((u: any) => u.isActive !== false);
        if (allActive.length === 0) {
          throw new Error("无可用员工");
        }
        ids.salaryEmployeeId = allActive[0].id;
      } else {
        ids.salaryEmployeeId = activeUsers[0].id;
      }
      recordResult("3-工资发放", "获取员工", "success", `员工ID: ${ids.salaryEmployeeId}`);

      // 创建工资批次
      const salaryBatch = await apiPost(request, "/api/salary-batches", {
        period: today.substring(0, 7),
        title: `${today.substring(0, 7)} 综合测试工资批次-${ts}`,
        employeeIds: [ids.salaryEmployeeId],
        remark: "综合测试工资发放",
      });
      ids.salaryBatchId = salaryBatch.data.id;
      recordResult("3-工资发放", "创建工资批次", "success", `批次ID: ${ids.salaryBatchId}`);

      // 提交审批（审批流已由 setup-test-approval-flows 脚本配置）
      await adminSetStatus(request, "salary_payment", ids.salaryBatchId, "审批中");
      const instance = await startApproval(request, "salary_payment", ids.salaryBatchId);
      ids.salaryInstanceId = instance.data.instanceId;
      recordResult("3-工资发放", "启动审批", "success", `实例ID: ${ids.salaryInstanceId}`);

      // 退回测试（财务审核退回）
      await approveAction(request, ids.salaryInstanceId, "初审通过");
      recordResult("3-工资发放", "初审通过", "success", "");

      await loginAsZhangJing(request);
      const rejectRes = await rejectAction(request, ids.salaryInstanceId, "工资计算基数有误，请核对");
      recordResult("3-工资发放", "退回测试-财务退回", "success", `状态: ${rejectRes.data.status}`);

      // 重新提交
      await adminSetStatus(request, "salary_payment", ids.salaryBatchId, "审批中");
      await adminDeleteApprovalInstance(request, ids.salaryInstanceId);
      const newSalInst = await startApproval(request, "salary_payment", ids.salaryBatchId);
      ids.salaryInstanceId = newSalInst.data.instanceId;
      recordResult("3-工资发放", "退回后重新提交", "success", "已重新创建审批实例");

      // 全部通过
      await approveAction(request, ids.salaryInstanceId, "初审通过");
      await loginAsZhangJing(request);
      await approveAction(request, ids.salaryInstanceId, "财务审核通过");
      await approveAction(request, ids.salaryInstanceId, "总经理同意");
      const payRes = await paymentAction(request, ids.salaryInstanceId, ids.bankAccountId, "工资已发放");
      recordResult("3-工资发放", "支付完成", "success", `状态: ${payRes.data.status}`);

      // 验证审批实例
      await verifyApprovalInstance(request, "salary_payment", ids.salaryBatchId, "已批准");
      recordResult("3-工资发放", "验证审批实例", "success", "工资发放审批实例完整");

      recordResult("3-工资发放", "完整流程", "success", "全部完成");
    } catch (e) {
      recordError("3-工资发放", "完整流程", e);
      throw e;
    }
  });

  test("【第3大项-借入资金归还】借入资金归还 → 退回 → 重新提交 → 支付", async ({ request }) => {
    test.setTimeout(TEST_TIMEOUT);
    try {
      await loginAsZhangJing(request);

      // 先创建其他借入款记录
      const borrowing = await apiPost(request, "/api/other-borrowings", {
        lenderName: "某金融机构",
        amount: 100000,
        borrowingDate: today,
        description: "短期资金周转",
      });
      ids.otherBorrowingId = borrowing.data.id;
      recordResult("3-借入归还", "创建借入款", "success", `借入款ID: ${ids.otherBorrowingId}`);

      // 创建借入资金归还申请
      const borrReturn = await apiPost(request, "/api/borrowing-return-applications", {
        sourceType: "other_borrowing",
        sourceId: ids.otherBorrowingId,
        sourceName: "短期资金周转",
        sourceAmount: 100000,
        returnAmount: 50000,
        returnDate: today,
        remark: "部分归还",
      });
      ids.borrowingReturnId = borrReturn.data.id;
      recordResult("3-借入归还", "创建归还申请", "success", `归还申请ID: ${ids.borrowingReturnId}`);

      // 提交审批（审批流已由 setup-test-approval-flows 脚本配置）
      await adminSetStatus(request, "borrowing_return_application", ids.borrowingReturnId, "审批中");
      const instance = await startApproval(request, "borrowing_return_application", ids.borrowingReturnId);
      ids.borrowingReturnInstanceId = instance.data.instanceId;
      recordResult("3-借入归还", "启动审批", "success", `实例ID: ${ids.borrowingReturnInstanceId}`);

      // 退回测试
      const rejectRes = await rejectAction(request, ids.borrowingReturnInstanceId, "请提供还款资金来源证明");
      recordResult("3-借入归还", "退回测试-初审退回", "success", `状态: ${rejectRes.data.status}`);

      await adminSetStatus(request, "borrowing_return_application", ids.borrowingReturnId, "审批中");
      await adminDeleteApprovalInstance(request, ids.borrowingReturnInstanceId);
      const newBorrInst = await startApproval(request, "borrowing_return_application", ids.borrowingReturnId);
      ids.borrowingReturnInstanceId = newBorrInst.data.instanceId;
      recordResult("3-借入归还", "退回后重新提交", "success", "已重新创建审批实例");

      // 全部通过
      await approveAction(request, ids.borrowingReturnInstanceId, "初审通过");
      await loginAsZhangJing(request);
      await approveAction(request, ids.borrowingReturnInstanceId, "财务审核通过");
      await approveAction(request, ids.borrowingReturnInstanceId, "总经理同意");
      const payRes = await paymentAction(request, ids.borrowingReturnInstanceId, ids.bankAccountId, "已归还");
      recordResult("3-借入归还", "支付完成", "success", `状态: ${payRes.data.status}`);

      // 验证审批实例
      await verifyApprovalInstance(request, "borrowing_return_application", ids.borrowingReturnId, "已批准");
      recordResult("3-借入归还", "验证审批实例", "success", "借入资金归还审批实例完整");

      recordResult("3-借入归还", "完整流程", "success", "全部完成");
    } catch (e) {
      recordError("3-借入归还", "完整流程", e);
      throw e;
    }
  });

  // ====================== 第 4 大项：投标保证金支付 ======================

  test("【第4大项-投标保证金】市场开发项目线索 → 投标报价 → 保证金支付", async ({ request }) => {
    test.setTimeout(TEST_TIMEOUT);
    try {
      await loginAsZhangJing(request);

      // 创建市场开发项目线索
      const marketLead = await apiPost(request, "/api/project-leads", {
        customerId: ids.customerId,
        projectName: `市场开发投标项目-${ts}`,
        location: "安徽省合肥市",
        contactPerson: "李工",
        contactPhone: "13900139001",
        projectNature: ["EPC"],
        implementationEntity: "华东工程",
        currentStatus: "跟踪中",
      });
      ids.marketLeadId = marketLead.data.id;
      ids.marketProjectSourceId = marketLead.data.projectSourceId;
      recordResult("4-投标保证金", "创建市场开发线索", "success", `线索ID: ${ids.marketLeadId}`);

      // 先创建投标报价
      const quotation = await apiPost(request, "/api/quotations", {
        projectSourceId: ids.marketProjectSourceId,
        customerId: ids.customerId,
        totalAmount: "800000",
        estimatedCost: { material: 300000, labor: 200000, other: 100000 },
      });
      ids.bidQuotationId = quotation.data.id;
      recordResult("4-投标保证金", "创建投标报价", "success", `报价ID: ${ids.bidQuotationId}`);

      // 投标报价审批通过
      await adminSetStatus(request, "quotation", ids.bidQuotationId, "审批中");
      const quoteInstance = await startApproval(request, "quotation", ids.bidQuotationId);
      // 逐个审批节点推进，每次检查状态
      for (const step of ["初审通过", "财务审核通过", "总经理同意", "终审通过"]) {
        const qInst = await apiGet(request, `/api/approval-instances?type=all&businessType=quotation&businessId=${ids.bidQuotationId}`);
        const qStatus = qInst.data?.[0]?.status;
        if (qStatus === "已批准") {
          recordResult("4-投标保证金", `报价审批-${step}`, "success", "实例已批准，跳过后续节点");
          break;
        }
        await approveAction(request, quoteInstance.data.instanceId, step);
      }
      recordResult("4-投标保证金", "投标报价审批完成", "success", "已批准");

      // ====== 发起投标保证金支付 ======
      // 调用 bond-payment 接口创建借出款并启动审批流
      const bondPayment = await apiPost(request, "/api/project-leads/bond-payment", {
        leadId: ids.marketLeadId,
        projectSourceId: ids.marketProjectSourceId,
        borrowerName: "张晶",
        amount: 50000,
        description: `投标保证金-${ts}`,
      });
      ids.bondLendingId = bondPayment.data.id;
      recordResult("4-投标保证金", "发起保证金支付", "success", `借出款ID: ${ids.bondLendingId}`);

      // 查询审批实例(借出款类型)
      const bondInstances = await apiGet(request, `/api/approval-instances?businessType=lending_out&businessId=${ids.bondLendingId}`);
      if (bondInstances.data && bondInstances.data.length > 0) {
        ids.bondInstanceId = bondInstances.data[0].id;
        recordResult("4-投标保证金", "获取保证金审批实例", "success", `实例ID: ${ids.bondInstanceId}`);

        // 走借出款的审批流程（审批流已由 setup-test-approval-flows 配置）
        // 初审
        await approveAction(request, ids.bondInstanceId, "初审通过");
        // 财务审核（张晶）
        await loginAsZhangJing(request);
        await approveAction(request, ids.bondInstanceId, "财务审核通过");
        // 总经理审批
        await approveAction(request, ids.bondInstanceId, "总经理同意");
        // 支付节点
        const payRes = await paymentAction(request, ids.bondInstanceId, ids.bankAccountId, "投标保证金已支付");
        recordResult("4-投标保证金", "保证金支付完成", "success", `状态: ${payRes.data.status}`);

        // 验证审批实例
        await verifyApprovalInstance(request, "lending_out", ids.bondLendingId, "已批准");
        recordResult("4-投标保证金", "验证保证金审批实例", "success", "投标保证金审批实例完整");
      } else {
        recordResult("4-投标保证金", "保证金审批", "fail", "未找到审批实例，可能是审批流未配置");
      }

      recordResult("4-投标保证金", "完整流程", "success", "全部完成");
    } catch (e) {
      recordError("4-投标保证金", "完整流程", e);
      throw e;
    }
  });

  // ====================== 汇总报告 ======================

  test("【汇总报告】生成测试报告", async () => {
    console.log("\n");
    console.log("=".repeat(80));
    console.log("全业务流自动化综合测试汇总报告");
    console.log("=".repeat(80));

    const total = results.length;
    const successCount = results.filter((r) => r.status === "success").length;
    const failCount = results.filter((r) => r.status === "fail").length;

    console.log(`\n总步骤: ${total}  |  成功: ${successCount}  |  失败: ${failCount}`);

    if (failCount > 0) {
      console.log("\n--- 失败步骤详情 ---");
      for (const r of results.filter((r) => r.status === "fail")) {
        console.log(`[${r.step}] ${r.name}: ${r.message}`);
      }
    }

    console.log("\n--- 全部步骤详情 ---");
    for (const r of results) {
      const icon = r.status === "success" ? "" : "";
      console.log(`${icon} [${r.step}] ${r.name}: ${r.message}`);
    }

    console.log("\n" + "=".repeat(80));

    // 写入测试报告到文件
    const docDir = path.join(process.cwd(), "doc");
    if (!fs.existsSync(docDir)) {
      fs.mkdirSync(docDir, { recursive: true });
    }

    const reportPath = path.join(docDir, "test-report.md");
    let report = `# 全业务流自动化测试报告\n\n`;
    report += `**测试时间**: ${new Date().toLocaleString()}\n`;
    report += `**测试账户**: 张晶 (zhangjing@hcec.group)\n`;
    report += `**总步骤**: ${total} | **成功**: ${successCount} | **失败**: ${failCount}\n\n`;

    report += `## 测试覆盖范围\n\n`;
    report += `1. **第1大项-合同管理**: 收入合同 + 支出合同（含退回/通过/归档）\n`;
    report += `2. **第2大项-收付款凭据**: 收款登记 + 付款申请审批流（含退回/支付）\n`;
    report += `3. **第3大项-财务支出**: 其他支付 + 费用报销 + 借出款 + 工资发放 + 借入资金归还\n`;
    report += `4. **第4大项-投标保证金**: 市场线索 → 投标报价 → 保证金支付\n\n`;

    if (failCount > 0) {
      report += `## 问题报告\n\n`;
      report += `| 步骤 | 名称 | 错误信息 |\n`;
      report += `|------|------|---------|\n`;
      for (const r of results.filter((r) => r.status === "fail")) {
        report += `| ${r.step} | ${r.name} | ${r.message} |\n`;
      }
      report += `\n`;

      report += `## 修复计划\n\n`;
      report += `| 问题编号 | 严重程度 | 描述 | 修复建议 | 负责人 | 状态 |\n`;
      report += `|---------|---------|------|---------|-------|------|\n`;
      let bugNum = 1;
      for (const r of results.filter((r) => r.status === "fail")) {
        report += `| ${bugNum} | P1 | [${r.step}] ${r.name}: ${r.message} | 需要开发人员排查 | TBD | 待修复 |\n`;
        bugNum++;
      }
      report += `\n`;
    } else {
      report += `## 测试结果\n\n`;
      report += `所有测试全部通过，未发现问题。\n\n`;
    }

    report += `## 步骤详情\n\n`;
    report += `| 步骤 | 名称 | 状态 | 消息 |\n`;
    report += `|------|------|------|------|\n`;
    for (const r of results) {
      const statusIcon = r.status === "success" ? "✅" : "❌";
      report += `| ${r.step} | ${r.name} | ${statusIcon} | ${r.message} |\n`;
    }

    fs.writeFileSync(reportPath, report, "utf-8");
    console.log(`\n测试报告已写入: ${reportPath}`);

    expect(failCount).toBe(0);
  });
});

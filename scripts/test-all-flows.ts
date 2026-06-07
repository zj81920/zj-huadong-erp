/**
 * 全模块审批流程测试脚本
 *
 * 运行方式: npx tsx scripts/test-all-flows.ts
 *
 * 测试内容：
 * 1. 遍历所有有流程配置的业务模块
 * 2. 创建测试数据并提交审批
 * 3. 验证流程在每个节点正确推进
 * 4. 验证各节点的待办列表正确返回
 * 5. 验证业务状态正确更新
 * 6. 检测并报告所有异常
 */
import { PrismaClient } from "@prisma/client";
import {
  startApprovalFlow,
  processApprovalAction,
  getPendingApprovals,
  resolveApproverIds,
} from "../src/lib/approval-engine";

const prisma = new PrismaClient();

const MODULE_LABELS: Record<string, string> = {
  quotation: "商务报价",
  supplier: "供应商审批",
  outsourcing: "外包任务",
  purchase_request: "采购需求",
  delivery_receipt: "到货验收",
  income_contract: "收入合同",
  expense_contract: "支出合同",
  non_contract_income: "非合同收入",
  non_contract_expense: "其他支出",
  payment_application: "付款申请",
  expense_report: "费用报销",
  other_borrowing: "其他借入款",
  lending_out: "借出款",
  salary_payment: "工资发放",
  borrowing_return_application: "借入资金归还",
};

interface TestStep {
  name: string;
  success: boolean;
  detail?: string;
}

interface TestResult {
  businessType: string;
  label: string;
  success: boolean;
  steps: TestStep[];
  flowNodes: { nodeOrder: number; nodeName: string; approverRole: string; nodeType: string }[];
  error?: string;
}

// 用于记录创建的测试数据，最后清理
const createdRecords: { businessType: string; id: string; model: string }[] = [];
const createdInstances: string[] = [];
const createdExtraRecords: string[] = [];

function log(prefix: string, msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`${ts} ${prefix} ${msg}`);
}

function ok(msg: string) {
  log("✅", msg);
}

function warn(msg: string) {
  log("⚠️", msg);
}

function fail(msg: string) {
  log("❌", msg);
}

function step(name: string, success: boolean, detail?: string): TestStep {
  const s = { name, success, detail };
  if (success) ok(`  ${name}`);
  else fail(`  ${name}${detail ? ` — ${detail}` : ""}`);
  return s;
}

async function createTestRecord(businessType: string, userId: string): Promise<{ id: string } | null> {
  const now = new Date();
  const testSuffix = `_test_${Date.now()}`;

  try {
    switch (businessType) {
      case "supplier":
        return await prisma.supplier.create({
          data: { name: `测试供应商${testSuffix}`, approvalStatus: "草稿" },
        });

      case "quotation": {
        const customer = await prisma.customer.create({
          data: { name: `测试客户${testSuffix}` },
        });
        createdExtraRecords.push(customer.id);
        return await prisma.quotation.create({
          data: { customerId: customer.id, totalAmount: 1000, approvalStatus: "草稿" },
        });
      }

      case "outsourcing": {
        const customerOut = await prisma.customer.create({
          data: { name: `测试客户外包${testSuffix}` },
        });
        createdExtraRecords.push(customerOut.id);
        const projectLeadOut = await prisma.projectLead.create({
          data: {
            projectSourceId: `test_${testSuffix}`,
            customerId: customerOut.id,
            projectName: `测试项目${testSuffix}`,
            implementationEntity: "公司本部",
          },
        });
        createdExtraRecords.push(projectLeadOut.id);
        const projectOut = await prisma.project.create({
          data: { projectSourceId: projectLeadOut.projectSourceId, projectCode: `PC${testSuffix}`, name: `测试项目${testSuffix}`, customerId: customerOut.id },
        });
        createdExtraRecords.push(projectOut.id);
        const supplier = await prisma.supplier.create({
          data: { name: `测试外包供应商${testSuffix}`, approvalStatus: "草稿" },
        });
        createdExtraRecords.push(supplier.id);
        return await prisma.outsourcingTask.create({
          data: {
            projectSourceId: projectOut.projectSourceId,
            targetName: `测试承接方${testSuffix}`,
            taskDescription: "测试任务描述",
            deliveryDeadline: new Date(Date.now() + 86400000 * 30),
            amount: 5000,
            approvalStatus: "草稿",
          },
        });
      }

      case "purchase_request": {
        const customerPr = await prisma.customer.create({
          data: { name: `测试客户采购${testSuffix}` },
        });
        createdExtraRecords.push(customerPr.id);
        const projectLeadPr = await prisma.projectLead.create({
          data: {
            projectSourceId: `test_pr_${testSuffix}`,
            customerId: customerPr.id,
            projectName: `测试采购项目${testSuffix}`,
            implementationEntity: "公司本部",
          },
        });
        createdExtraRecords.push(projectLeadPr.id);
        const projectPr = await prisma.project.create({
          data: { projectSourceId: projectLeadPr.projectSourceId, projectCode: `PRC${testSuffix}`, name: `测试采购项目${testSuffix}`, customerId: customerPr.id },
        });
        createdExtraRecords.push(projectPr.id);
        return await prisma.purchaseRequest.create({
          data: {
            requestNo: `PR${testSuffix}`,
            projectSourceId: projectPr.projectSourceId,
            status: "草稿",
          },
        });
      }

      case "delivery_receipt": {
        const expenseContract = await prisma.expenseContract.create({
          data: { contractNo: `EC${testSuffix}`, totalAmount: 10000, status: "草稿" },
        });
        createdExtraRecords.push(expenseContract.id);
        return await prisma.deliveryReceipt.create({
          data: { expenseContractId: expenseContract.id, status: "草稿" },
        });
      }

      case "income_contract": {
        const customer = await prisma.customer.create({
          data: { name: `测试收入客户${testSuffix}` },
        });
        createdExtraRecords.push(customer.id);
        return await prisma.incomeContract.create({
          data: { contractNo: `IC${testSuffix}`, customerId: customer.id, totalAmount: 20000, status: "草稿" },
        });
      }

      case "expense_contract":
        return await prisma.expenseContract.create({
          data: { contractNo: `EC_${testSuffix}`, totalAmount: 15000, status: "草稿" },
        });

      case "non_contract_income":
        return await prisma.nonContractIncome.create({
          data: { amount: 3000, status: "草稿" },
        });

      case "non_contract_expense":
        return await prisma.nonContractExpense.create({
          data: { amount: 2000, status: "草稿" },
        });

      case "payment_application": {
        const payable = await prisma.payable.create({
          data: { sourceType: "expense_contract", sourceId: `ec_${testSuffix}`, dueDate: new Date(Date.now() + 86400000 * 30), amount: 8000 },
        });
        createdExtraRecords.push(payable.id);
        return await prisma.paymentApplication.create({
          data: { payableId: payable.id, applicantId: userId, amount: 8000, approvalStatus: "草稿" },
        });
      }

      case "expense_report":
        return await prisma.expenseReport.create({
          data: { applicantId: userId, expenseType: "差旅费", amount: 1500, status: "草稿" },
        });

      case "lending_out":
        return await prisma.lendingOut.create({
          data: {
            lendingType: "投标保证金",
            borrowerName: `测试借款人${testSuffix}`,
            amount: 10000,
            remainingAmount: 10000,
            lendingDate: now,
            status: "草稿",
          },
        });

      case "salary_payment":
        return await prisma.salaryBatch.create({
          data: { batchNo: `SB${testSuffix}`, period: "2026-06", title: `测试工资${testSuffix}`, status: "草稿" },
        });

      case "borrowing_return_application": {
        const otherBorrowing = await prisma.otherBorrowing.create({
          data: {
            lenderName: `测试出借人${testSuffix}`,
            amount: 50000,
            remainingAmount: 50000,
            borrowingDate: now,
            status: "未还清",
          },
        });
        createdExtraRecords.push(otherBorrowing.id);
        return await prisma.borrowingReturnApplication.create({
          data: {
            sourceType: "other_borrowing",
            sourceId: otherBorrowing.id,
            sourceName: `测试借入${testSuffix}`,
            sourceAmount: 50000,
            returnAmount: 50000,
            returnDate: new Date(Date.now() + 86400000 * 7),
            status: "草稿",
          },
        });
      }

      case "other_borrowing":
        return await prisma.otherBorrowing.create({
          data: {
            lenderName: `测试出借人${testSuffix}`,
            amount: 30000,
            remainingAmount: 30000,
            borrowingDate: now,
            status: "未还清",
          },
        });

      default:
        return null;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    warn(`  创建测试数据失败: ${msg}`);
    return null;
  }
}

async function getBusinessStatus(businessType: string, id: string): Promise<Record<string, unknown> | null> {
  try {
    switch (businessType) {
      case "supplier":
        return await prisma.supplier.findUnique({ where: { id }, select: { approvalStatus: true, status: true } });
      case "quotation":
        return await prisma.quotation.findUnique({ where: { id }, select: { approvalStatus: true, status: true } });
      case "outsourcing":
        return await prisma.outsourcingTask.findUnique({ where: { id }, select: { approvalStatus: true } });
      case "purchase_request":
        return await prisma.purchaseRequest.findUnique({ where: { id }, select: { status: true } });
      case "delivery_receipt":
        return await prisma.deliveryReceipt.findUnique({ where: { id }, select: { status: true } });
      case "income_contract":
        return await prisma.incomeContract.findUnique({ where: { id }, select: { status: true } });
      case "expense_contract":
        return await prisma.expenseContract.findUnique({ where: { id }, select: { status: true } });
      case "non_contract_income":
        return await prisma.nonContractIncome.findUnique({ where: { id }, select: { status: true } });
      case "non_contract_expense":
        return await prisma.nonContractExpense.findUnique({ where: { id }, select: { status: true } });
      case "payment_application":
        return await prisma.paymentApplication.findUnique({ where: { id }, select: { approvalStatus: true } });
      case "expense_report":
        return await prisma.expenseReport.findUnique({ where: { id }, select: { status: true } });
      case "lending_out":
        return await prisma.lendingOut.findUnique({ where: { id }, select: { status: true } });
      case "salary_payment":
        return await prisma.salaryBatch.findUnique({ where: { id }, select: { status: true } });
      case "borrowing_return_application":
        return await prisma.borrowingReturnApplication.findUnique({ where: { id }, select: { status: true } });
      case "other_borrowing":
        return await prisma.otherBorrowing.findUnique({ where: { id }, select: { status: true } });
      default:
        return null;
    }
  } catch {
    return null;
  }
}

async function getFlowDefinitions() {
  const flowDefs = await prisma.approvalFlowDefinition.groupBy({
    by: ["businessType"],
    where: { isActive: true },
    _count: { id: true },
  });

  const result: { businessType: string; nodeCount: number; nodes: { nodeOrder: number; nodeName: string; approverRole: string; nodeType: string }[] }[] = [];

  for (const f of flowDefs) {
    const nodes = await prisma.approvalFlowDefinition.findMany({
      where: { businessType: f.businessType, flowLevel: "common", isActive: true },
      orderBy: { nodeOrder: "asc" },
      select: { nodeOrder: true, nodeName: true, approverRole: true, nodeType: true },
    });
    result.push({ businessType: f.businessType, nodeCount: f._count.id, nodes });
  }

  return result.sort((a, b) => a.businessType.localeCompare(b.businessType));
}

async function cleanup() {
  const ids = [...createdRecords];
  const instanceIds = [...createdInstances];

  for (const r of ids.reverse()) {
    try {
      // @ts-ignore dynamic delete
      await (prisma as any)[r.model].delete({ where: { id: r.id } });
    } catch {
      // ignore cleanup errors
    }
  }

  for (const id of instanceIds) {
    try {
      await prisma.approvalAction.deleteMany({ where: { instanceId: id } });
      await prisma.approvalInstance.delete({ where: { id } });
    } catch {
      // ignore
    }
  }

  for (const id of createdExtraRecords) {
    try {
      await prisma.customer.delete({ where: { id } }).catch(() => {});
      await prisma.project.delete({ where: { id } }).catch(() => {});
      await prisma.projectLead.delete({ where: { id } }).catch(() => {});
      await prisma.supplier.delete({ where: { id } }).catch(() => {});
      await prisma.payable.delete({ where: { id } }).catch(() => {});
      await prisma.expenseContract.delete({ where: { id } }).catch(() => {});
      await prisma.otherBorrowing.delete({ where: { id } }).catch(() => {});
    } catch {
      // ignore
    }
  }
}

async function main() {
  console.log("\n============================================");
  console.log("  全模块审批流程综合测试");
  console.log("============================================\n");

  const allResults: TestResult[] = [];
  let totalPass = 0;
  let totalFail = 0;

  // 1. 查找测试用户
  const zhangjing = await prisma.user.findFirst({
    where: { realName: "张晶" },
    include: { userRoles: { include: { role: true } } },
  });

  if (!zhangjing) {
    fail("未找到用户「张晶」，请先创建该用户");
    await prisma.$disconnect();
    process.exit(1);
  }

  ok(`测试用户: ${zhangjing.realName} (${zhangjing.username})`);
  const roleList = zhangjing.userRoles.map((ur) => `${ur.role.name}(${ur.role.code})`).join(", ");
  ok(`用户角色: ${roleList}\n`);

  // 获取 admin 用户 ID（会签中排除）
  const adminUser = await prisma.user.findUnique({
    where: { username: "admin" },
    select: { id: true },
  });
  ok(`admin 用户: ${adminUser ? adminUser.id : "不存在"}\n`);

  // 辅助函数：获取某角色的非 admin 用户数
  async function countRoleNonAdminUsers(roleCode: string): Promise<number> {
    try {
      const role = await prisma.role.findUnique({
        where: { code: roleCode },
        include: { users: { include: { user: { select: { id: true } } } } },
      });
      if (!role) return 0;
      const ids = role.users.map((ur) => ur.user.id);
      return adminUser ? ids.filter((id) => id !== adminUser.id).length : ids.length;
    } catch {
      return 0;
    }
  }

  // 2. 获取所有有流程配置的模块
  const flows = await getFlowDefinitions();
  ok(`发现 ${flows.length} 个已配置流程的业务模块:\n`);

  for (const f of flows) {
    const label = MODULE_LABELS[f.businessType] || f.businessType;
    console.log(`  ${f.businessType.padEnd(25)} ${label.padEnd(12)} ${f.nodeCount} 个节点`);
    for (const n of f.nodes) {
      const tag = n.nodeType !== "approval" ? ` [${n.nodeType}]` : "";
      console.log(`    ${n.nodeOrder}. ${n.nodeName} (${n.approverRole})${tag}`);
    }
  }

  // 3. 逐模块测试
  console.log("\n" + "=".repeat(60));
  console.log("  开始逐模块测试\n");

  for (const flow of flows) {
    const label = MODULE_LABELS[flow.businessType] || flow.businessType;
    console.log(`\n─── ${label} (${flow.businessType}) ───\n`);

    const steps: TestStep[] = [];
    let moduleSuccess = true;
    let testRecordId: string | null = null;

    // 3a. 创建测试数据
    const record = await createTestRecord(flow.businessType, zhangjing.id);
    if (!record) {
      steps.push(step("创建测试数据", false, "无法创建测试记录，跳过此模块"));
      allResults.push({ businessType: flow.businessType, label, success: false, steps, flowNodes: flow.nodes, error: "创建测试数据失败" });
      totalFail++;
      continue;
    }
    testRecordId = record.id;
    createdRecords.push({ businessType: flow.businessType, id: record.id, model: getModelName(flow.businessType) });
    steps.push(step("创建测试数据", true, `id=${record.id}`));

    // 3b. 发起审批
    let instanceId: string | null = null;
    let currentNodeOrder: number = 0;
    try {
      const result = await startApprovalFlow({
        businessType: flow.businessType,
        businessId: record.id,
        flowLevel: "common",
        initiatorId: zhangjing.id,
      });
      instanceId = result.instanceId;
      currentNodeOrder = result.currentNode;
      createdInstances.push(result.instanceId);
      steps.push(step("发起审批", true, `instanceId=${result.instanceId}, 状态=${result.status}, currentNode=${result.currentNode}`));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      steps.push(step("发起审批", false, msg));
      allResults.push({ businessType: flow.businessType, label, success: false, steps, flowNodes: flow.nodes, error: msg });
      totalFail++;
      continue;
    }

    // 3c. 检查业务状态是否更新为"审批中"
    const bizStatus = await getBusinessStatus(flow.businessType, record.id);
    const hasApprovalStatus = !!(bizStatus && Object.values(bizStatus).some((v) => v === "审批中"));
    steps.push(step("检查业务状态", hasApprovalStatus, hasApprovalStatus ? JSON.stringify(bizStatus) : `状态未更新: ${JSON.stringify(bizStatus)}`));
    if (!hasApprovalStatus) moduleSuccess = false;

    // 3d. 检查待办列表
    let pendingItems: any[] = [];
    try {
      pendingItems = await getPendingApprovals(zhangjing.id);
      const found = pendingItems.some((p: any) => p.id === instanceId);
      steps.push(step("待办列表包含此实例", found, found ? `待办列表共 ${pendingItems.length} 项` : `未找到实例 ${instanceId}`));
      if (!found) moduleSuccess = false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      steps.push(step("查询待办列表", false, msg));
      moduleSuccess = false;
    }

    // 3e. 获取流程节点（跳过发起节点）
    const flowNodes = flow.nodes;
    const startNode = flowNodes[0];
    const approvalNodes = flowNodes.filter((n) => n.nodeOrder > startNode.nodeOrder);

    if (approvalNodes.length === 0) {
      steps.push(step("流程节点检查", true, "只有发起节点，无需审批"));
      allResults.push({ businessType: flow.businessType, label, success: moduleSuccess, steps, flowNodes });
      if (moduleSuccess) totalPass++;
      else totalFail++;
      continue;
    }

    // 3f. 逐个节点审批通过
    let currentInstanceId = instanceId;
    let lastNodeProcessed = false;

    for (const node of approvalNodes) {
      const nodeLabel = `节点${node.nodeOrder}: ${node.nodeName}`;

      // 检查是否需要跳过此节点（自动跳过逻辑）
      if (node.nodeOrder < currentNodeOrder) {
        steps.push(step(`${nodeLabel} — 已跳过`, true));
        continue;
      }

      // 检查当前节点是否是归档/支付类型（需要特殊处理）
      if (node.nodeType === "archive") {
        steps.push(step(`${nodeLabel} — 归档节点`, true, "归档节点需在前端上传扫描件，脚本中跳过"));
        continue;
      }
      if (node.nodeType === "payment") {
        steps.push(step(`${nodeLabel} — 支付节点`, true, "支付节点需在前端选择银行账户，脚本中跳过"));
        continue;
      }

      if (!currentInstanceId) {
        steps.push(step(`${nodeLabel} — 跳过`, false, "instanceId 为空"));
        moduleSuccess = false;
        break;
      }

      // 审批通过
      try {
        // 获取该节点的角色成员数（排除 admin），判断是否会签才能完成
        const roleCodes = node.approverRole.split(",").map((r) => r.trim()).filter(Boolean);
        let roleUserCount = 0;
        for (const rc of roleCodes) {
          const cnt = await countRoleNonAdminUsers(rc);
          if (cnt > roleUserCount) roleUserCount = cnt;
        }
        // roleUserCount > 1 表示该角色有多人，会签需要多人审批

        const approveResult = await processApprovalAction({
          instanceId: currentInstanceId,
          approverId: zhangjing.id,
          action: "approve",
        });

        currentNodeOrder = approveResult.currentNode;
        const newStatus = approveResult.status;
        const isLast = node.nodeOrder >= flowNodes[flowNodes.length - 1].nodeOrder;
        const countersignComplete = currentNodeOrder !== node.nodeOrder;

        // 检查待办列表在审批后是否正确
        const pendingAfter = await getPendingApprovals(zhangjing.id);
        const foundAfter = pendingAfter.some((p: any) => p.id === currentInstanceId);

        if (roleUserCount > 1 && !countersignComplete) {
          // 会签尚未完成（还有其他人未审批），currentNode 不变
          // 当前用户已提交审批，实例不应出现在他的待办列表中
          const listOk = !foundAfter;
          steps.push(step(`${nodeLabel} — 通过(会签等待中，需${roleUserCount}人全部审批)`,
            listOk,
            `角色${node.approverRole}共${roleUserCount}人, currentNode=${node.nodeOrder}, 待办中包含=${foundAfter}`
          ));
          if (!listOk) moduleSuccess = false;
          // 会签未完成，无法推进到后续节点，跳出
          break;
        } else if (isLast && newStatus === "已批准") {
          steps.push(step(`${nodeLabel} — 通过, 流程完成`, true, `状态=${newStatus}, 待办列表不再包含=${!foundAfter}`));
          lastNodeProcessed = true;
        } else if (newStatus === "审批中" || newStatus === "待归档" || newStatus === "待支付") {
          const shouldShow = newStatus === "待支付" ? false : true;
          const listCorrect = shouldShow ? foundAfter : !foundAfter;
          steps.push(step(`${nodeLabel} — 通过, 推进到节点${approveResult.currentNode}`,
            listCorrect,
            `状态=${newStatus}, 待办中包含=${foundAfter}, currentNode=${approveResult.currentNode}`
          ));
          if (!listCorrect) {
            warn(`    待办列表状态异常: 当前状态=${newStatus}, isLast=${isLast}, 待办中有=${foundAfter}`);
            moduleSuccess = false;
          }
        } else {
          steps.push(step(`${nodeLabel} — 通过`, true, `状态=${newStatus}`));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        steps.push(step(`${nodeLabel} — 审批失败`, false, msg));
        moduleSuccess = false;
        break;
      }
    }

    // 3g. 验证最终业务状态
    if (lastNodeProcessed) {
      const finalStatus = await getBusinessStatus(flow.businessType, record.id);
      if (finalStatus) {
        const isApproved = Object.values(finalStatus).some((v) => v === "已批准" || v === "已归档" || v === "已支付");
        steps.push(step("最终业务状态", isApproved, JSON.stringify(finalStatus)));
        if (!isApproved) moduleSuccess = false;
      }
    }

    // 3h. 特殊检查: 供应商的 delete 场景
    if (flow.businessType === "supplier" && testRecordId) {
      const supplierStatus = await prisma.supplier.findUnique({
        where: { id: testRecordId },
        select: { approvalStatus: true },
      });
      const deleteBlocked = supplierStatus?.approvalStatus === "审批中" || supplierStatus?.approvalStatus === "已批准";
      steps.push(step("删除按钮安全性检查", deleteBlocked,
        deleteBlocked
          ? `approvalStatus=${supplierStatus?.approvalStatus}，前端应隐藏删除按钮 ✅`
          : `approvalStatus=${supplierStatus?.approvalStatus}，删除按钮可能可见 ⚠️`
      ));
    }

    const result: TestResult = { businessType: flow.businessType, label, success: moduleSuccess, steps, flowNodes: flow.nodes };
    allResults.push(result);
    if (moduleSuccess) totalPass++;
    else totalFail++;
  }

  // 4. 汇总报告
  console.log("\n" + "=".repeat(60));
  console.log("  测试结果汇总");
  console.log("=".repeat(60) + "\n");

  for (const r of allResults) {
    const icon = r.success ? "✅" : "❌";
    const status = r.success ? "通过" : "失败";
    const failCount = r.steps.filter((s) => !s.success).length;
    console.log(`${icon} [${status}] ${r.label} (${r.businessType}) — ${r.steps.length} 步骤${failCount > 0 ? `, ${failCount} 个失败` : ""}`);
    if (r.error) {
      console.log(`   错误: ${r.error}`);
    }
    for (const s of r.steps) {
      if (!s.success) {
        console.log(`   ❌ ${s.name}${s.detail ? `: ${s.detail}` : ""}`);
      }
    }
  }

  console.log(`\n总计: ${allResults.length} 模块 | ✅ ${totalPass} 通过 | ❌ ${totalFail} 失败\n`);

  if (totalFail > 0) {
    console.log("\n⚠️  请修复上述失败后再运行验收测试\n");
  } else {
    console.log("🎉 所有模块审批流程测试通过！\n");
  }

  // 5. 清理测试数据
  console.log("正在清理测试数据...");
  await cleanup();
  console.log("清理完成\n");

  return totalFail === 0;
}

function getModelName(businessType: string): string {
  const map: Record<string, string> = {
    supplier: "supplier",
    quotation: "quotation",
    outsourcing: "outsourcingTask",
    purchase_request: "purchaseRequest",
    delivery_receipt: "deliveryReceipt",
    income_contract: "incomeContract",
    expense_contract: "expenseContract",
    non_contract_income: "nonContractIncome",
    non_contract_expense: "nonContractExpense",
    payment_application: "paymentApplication",
    expense_report: "expenseReport",
    lending_out: "lendingOut",
    salary_payment: "salaryBatch",
    borrowing_return_application: "borrowingReturnApplication",
    other_borrowing: "otherBorrowing",
  };
  return map[businessType] || businessType;
}

main()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((e) => {
    console.error("测试脚本异常:", e);
    cleanup().then(() => process.exit(1));
  });

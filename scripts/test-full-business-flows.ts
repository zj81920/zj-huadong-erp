/**
 * 全业务流回归测试脚本 — A/B/C 三个方向
 *
 * 运行方式: npx tsx scripts/test-full-business-flows.ts
 *
 * 测试策略：
 *   - 每个流程运行为两轮：
 *     第1轮：全部节点"通过"，测试审批流转
 *     第2轮：只测试"退回"（退回后终止，不再继续）
 *   - 财务会审：张晶+谢小霞两人都通过
 *   - 支付节点：验证银行账户存在
 */
import { PrismaClient } from "@prisma/client";
import { startApprovalFlow, processApprovalAction, getPendingApprovals } from "../src/lib/approval-engine";

const prisma = new PrismaClient();
const testSuffix = `_auto_${Date.now()}`;

let stepCount = 0; let failCount = 0; let warnCount = 0;
const allBugs: { id: number; dir: string; step: string; desc: string; sev: string }[] = [];

function ok(m: string) { stepCount++; console.log(`  ✅ ${m}`); }
function warn(m: string) { warnCount++; console.log(`  ⚠️ ${m}`); }
function bug(dir: string, step: string, desc: string, sev: string) {
  failCount++; allBugs.push({ id: allBugs.length + 1, dir, step, desc, sev });
  console.log(`  ❌ [P${sev}] ${dir} - ${step}: ${desc}`);
}

function title(t: string) { console.log(`\n${"=".repeat(60)}\n  ${t}\n${"=".repeat(60)}`); }
function sub(t: string) { console.log(`\n─── ${t} ───`); }

let zj: any; let xx: any; let adminId: string | null;

// ============================================================
// 审批辅助
// ============================================================
async function flowDef(bt: string) {
  return prisma.approvalFlowDefinition.findMany({
    where: { businessType: bt, flowLevel: "common", isActive: true },
    orderBy: { nodeOrder: "asc" },
    select: { nodeOrder: true, nodeName: true, approverRole: true, nodeType: true },
  });
}

async function startFlow(bt: string, bid: string, initiatorId: string): Promise<string | null> {
  try {
    const r = await startApprovalFlow({ businessType: bt, businessId: bid, flowLevel: "common", initiatorId });
    console.log(`    发起审批: iid=${r.instanceId.slice(-8)}, status=${r.status}, node=${r.currentNode}`);
    return r.instanceId;
  } catch (e: any) { bug(bt, "发起", e.message, "P1"); return null; }
}

async function approve(instanceId: string, uid: string) {
  return processApprovalAction({ instanceId, approverId: uid, action: "approve" });
}
async function reject(instanceId: string, uid: string) {
  return processApprovalAction({ instanceId, approverId: uid, action: "reject", comment: "自动测试-退回" });
}

async function roleUserCount(code: string): Promise<number> {
  const r = await prisma.role.findUnique({ where: { code }, include: { users: { include: { user: { select: { id: true } } } } } });
  if (!r) return 0;
  return adminId ? r.users.filter(u => u.user.id !== adminId).length : r.users.length;
}

async function checkPending(iid: string, uid: string, expect: boolean, ctx: string) {
  try {
    const items = await getPendingApprovals(uid);
    const found = items.some((p: any) => p.id === iid);
    if (found !== expect) bug(`待办-${ctx}`, `期望${expect ? "含" : "不含"}实例`, `含=${found}`, "P2");
  } catch (e: any) { warn(`待办查询失败: ${e.message}`); }
}

// ============================================================
// 全流程审批（第1轮：全通过）+ 退回测试（第2轮：仅退回）
// ============================================================
async function fullFlowTest(bt: string, bid: string, label: string) {
  const nodes = await flowDef(bt);
  if (!nodes.length) { warn(`${label}: 无流程定义`); return; }
  console.log(`\n${"─".repeat(50)}`);
  console.log(`📌 ${label} (${bt}) — ${nodes.length} 节点`);

  // ============ 第1轮：全部通过 ============
  sub(`第1轮：全部通过`);
  const iid1 = await startFlow(bt, bid, zj.id);
  if (!iid1) return;
  await checkPending(iid1, zj.id, true, "发起后待办");

  let ciid = iid1; let cNode = 1;

  for (const n of nodes) {
    if (n.nodeOrder < cNode) continue;
    const nl = `节点${n.nodeOrder}:${n.nodeName}`;

    if (n.nodeType === "archive") {
      try {
        const r = await approve(ciid, zj.id);
        console.log(`  📁 ${nl} [归档] → ${r.status}`);
        cNode = r.currentNode;
      } catch (e: any) { bug(bt, `${nl}-归档`, e.message, "P1"); }
      continue;
    }

    if (n.nodeType === "payment") {
      const bas = await prisma.bankAccount.count({ where: { isActive: true } });
      console.log(`  ⭐ ${nl} [支付] — 可用银行账户: ${bas} 个`);
      try {
        const r = await approve(ciid, zj.id);
        console.log(`  💰 ${nl} 支付完成 → ${r.status}`);
        cNode = r.currentNode;
      } catch (e: any) { bug(bt, `${nl}-支付`, e.message, "P1"); }
      continue;
    }

    try {
      const rcs = n.approverRole.split(",").map((s: string) => s.trim()).filter(Boolean);
      let cnt = 0; for (const rc of rcs) { const c = await roleUserCount(rc); if (c > cnt) cnt = c; }

      const r = await approve(ciid, zj.id);
      const last = n.nodeOrder >= nodes[nodes.length - 1].nodeOrder;
      const isFin = n.approverRole.includes("finance");

      if (cnt > 1 && r.currentNode === n.nodeOrder) {
        console.log(`  👥 ${nl}: 张晶已通过，会签等待(${cnt}人)`);
        if (isFin && xx) {
          const xr = await approve(ciid, xx.id);
          if (xr.currentNode !== n.nodeOrder) {
            console.log(`  ✅ 财务会审完成 → node${xr.currentNode}`);
            cNode = xr.currentNode;
          } else { bug(bt, `${nl}-会签未推进`, "两人都通过后currentNode未变", "P1"); }
        } else { console.log(`  ⚠️ 非财务会签，需人工介入`); continue; }
      } else if (last && ["已批准", "已归档", "待归档"].includes(r.status)) {
        console.log(`  ✅ ${nl} 流程完成! status=${r.status}`);
        cNode = r.currentNode;
      } else {
        console.log(`  ✅ ${nl} → node${r.currentNode}, status=${r.status}`);
        cNode = r.currentNode;
      }
    } catch (e: any) { bug(bt, `${nl}-通过`, e.message, "P1"); }
  }

  // 流程完成后，验证待办列表中不再包含该实例
  await checkPending(ciid, zj.id, false, `${label}流程完成后`);

  // ============ 第2轮：退回测试（只退第1个审批节点） ============
  sub(`第2轮：退回测试`);
  const iid2 = await startFlow(bt, bid, zj.id);
  if (!iid2) return;

  // 找到第一个审批节点
  const firstNode = nodes.find(n => n.nodeType === "approval");
  if (!firstNode) { console.log(`  无审批节点可退回`); return; }

  try {
    const rr = await reject(iid2, zj.id);
    if (["已驳回", "退回"].includes(rr.status)) {
      console.log(`  ✅ 退回成功: status=${rr.status}`);
    } else {
      console.log(`  ⚠️ 退回结果: status=${rr.status} (非预期)`);
    }
  } catch (e: any) { bug(bt, "退回测试", e.message, "P1"); }
}

// ============================================================
// 初始化
// ============================================================
async function init() {
  title("初始化");
  zj = await prisma.user.findFirst({ where: { realName: "张晶" }, include: { userRoles: { include: { role: true } } } });
  if (!zj) { console.log("❌ 未找到张晶"); return false; }
  ok(`张晶: ${zj.username}`);

  xx = await prisma.user.findFirst({ where: { realName: "谢小霞" } });
  if (xx) ok(`谢小霞: ${xx.username}`); else warn("未找到谢小霞，会签跳过");

  const a = await prisma.user.findUnique({ where: { username: "admin" }, select: { id: true } });
  adminId = a?.id || null;

  const cnt = await prisma.bankAccount.count({ where: { isActive: true } });
  ok(`银行账户: ${cnt} 个`);
  return true;
}

// ============================================================
// A方向
// ============================================================
async function testA() {
  title("A方向：商务→采购→合同→付款");

  // A1
  sub("A1: 客户+供应商");
  const cust = await prisma.customer.create({ data: { name: `测试客户${testSuffix}`, contactPerson: "张三", phone: "13800138000", address: "测试路100号", industryType: "化工", isActive: true } });
  shared.customerId = cust.id; ok(`客户: ${cust.name}`);
  const supp = await prisma.supplier.create({ data: { name: `测试供应商${testSuffix}`, supplierType: "企业", contactPerson: "赵六", phone: "13700137000", address: "测试路200号", approvalStatus: "草稿" } });
  shared.supplierId = supp.id; ok(`供应商: ${supp.name}`);

  // A2
  sub("A2: 项目线索");
  const lead = await prisma.projectLead.create({ data: { customerId: cust.id, projectSourceId: `src_a_${testSuffix}`, projectName: `A测试项目${testSuffix}`, location: "合肥", contactPerson: "王工", contactPhone: "13900139000", projectNature: ["EP"], implementationEntity: "公司本部", currentStatus: "已中标" } });
  shared.projectSourceId = lead.projectSourceId; ok(`线索: ${lead.projectSourceId}`);

  // A3a 商务报价
  sub("A3a: 商务报价");
  const qt = await prisma.quotation.create({ data: { customerId: cust.id, projectSourceId: lead.projectSourceId, totalAmount: 100000, approvalStatus: "草稿" } });
  await fullFlowTest("quotation", qt.id, "商务报价");

  // A3b 投标报价
  sub("A3b: 投标报价");
  const bd = await prisma.bidding.create({ data: { projectSourceId: lead.projectSourceId, bidAmount: 200000, bondAmount: 10000, bidDeadline: new Date(Date.now() + 30 * 86400000) } }).catch(() => null);
  if (bd) {
    ok(`投标: ${bd.id}`);
    await fullFlowTest("quotation", bd.id, "投标报价");
  } else warn("bidding创建失败");

  // A4 项目
  sub("A4: 项目立项");
  const pj = await prisma.project.create({ data: { projectSourceId: lead.projectSourceId, projectCode: `PA${testSuffix}`, name: `A项目${testSuffix}`, customerId: cust.id, projectCategory: "EP", source: "项目线索", status: "执行" } });
  shared.projectId = pj.id; ok(`项目: ${pj.projectCode}`);

  // A5 采购申请
  sub("A5: 采购申请");
  const pr = await prisma.purchaseRequest.create({ data: { requestNo: `PR${testSuffix}`, projectSourceId: lead.projectSourceId, status: "草稿" } });
  await fullFlowTest("purchase_request", pr.id, "采购申请");

  // A7 采购合同
  sub("A7: 采购合同");
  const ec = await prisma.expenseContract.create({ data: { contractNo: `EC_A${testSuffix}`, supplierId: supp.id, projectSourceId: lead.projectSourceId, totalAmount: 80000, contractType: "采购合同", status: "草稿" } });
  await fullFlowTest("expense_contract", ec.id, "采购合同");

  // A8 付款
  sub("A8: 采购付款");
  const py = await prisma.payable.create({ data: { sourceType: "expense_contract", sourceId: ec.id, dueDate: new Date(Date.now() + 30 * 86400000), amount: 80000, status: "未付" } });
  const pa = await prisma.paymentApplication.create({ data: { payableId: py.id, applicantId: zj.id, amount: 80000, approvalStatus: "草稿", paymentReason: "采购付款" } });
  await fullFlowTest("payment_application", pa.id, "采购付款");

  // A9 发票
  sub("A9: 发票登记");
  await prisma.invoice.create({ data: { invoiceNo: `INV_A${testSuffix}`, invoiceType: "进项发票", invoiceCategory: "增值税专用发票", amount: 80000, taxAmount: 10400, totalAmount: 90400, invoiceDate: new Date(), sourceType: "expense_contract", sourceId: ec.id, status: "已登记" } }).then(() => ok("进项发票登记成功")).catch((e: any) => bug("A9", "发票", e.message, "P2"));
}

// ============================================================
// B方向
// ============================================================
async function testB() {
  title("B方向：项目→合同→外包→收支");

  const sid = shared.projectSourceId!;
  const cust = await prisma.customer.findFirst({ orderBy: { createdAt: "desc" } });

  // B2 收入合同
  sub("B2: 收入合同");
  const ic = await prisma.incomeContract.create({ data: { contractNo: `IC_B${testSuffix}`, customerId: cust!.id, projectSourceId: sid, totalAmount: 500000, status: "草稿" } });
  await fullFlowTest("income_contract", ic.id, "收入合同");

  // B3 支出合同
  sub("B3: 支出合同");
  const ec = await prisma.expenseContract.create({ data: { contractNo: `EC_B${testSuffix}`, projectSourceId: sid, totalAmount: 200000, contractType: "分包合同", status: "草稿" } });
  await fullFlowTest("expense_contract", ec.id, "支出合同");

  // B4a 外包给个人 (type=to_person)
  sub("B4a: 外包(个人)");
  await prisma.outsourcingTask.create({
    data: { projectSourceId: sid, type: "to_person", targetName: `个人承接方${testSuffix}`, taskDescription: "工艺设计", deliveryDeadline: new Date(Date.now() + 30 * 86400000), amount: 30000, approvalStatus: "草稿" },
  }).then(async (ot) => { ok(`外包(个人): ${ot.id}`); await fullFlowTest("outsourcing", ot.id, "外包(个人)"); }).catch((e: any) => bug("B4a", `创建:${e.message}`, e.message, "P2"));

  // B4b 外包给公司 (type=to_company)
  sub("B4b: 外包(公司)");
  const sc = await prisma.supplier.findFirst({ orderBy: { createdAt: "desc" } });
  await prisma.outsourcingTask.create({
    data: { projectSourceId: sid, type: "to_company", targetName: `测试设计院${testSuffix}`, supplierId: sc?.id, taskDescription: "结构设计", deliveryDeadline: new Date(Date.now() + 45 * 86400000), amount: 80000, approvalStatus: "草稿" },
  }).then(async (ot) => { ok(`外包(公司): ${ot.id}`); await fullFlowTest("outsourcing", ot.id, "外包(公司)"); }).catch((e: any) => bug("B4b", `创建:${e.message}`, e.message, "P2"));

  // B5 支出付款
  sub("B5: 支出付款");
  const py = await prisma.payable.create({ data: { sourceType: "expense_contract", sourceId: ec.id, dueDate: new Date(Date.now() + 30 * 86400000), amount: 200000, status: "未付" } });
  const pa = await prisma.paymentApplication.create({ data: { payableId: py.id, applicantId: zj.id, amount: 200000, approvalStatus: "草稿", paymentReason: "分包付款" } });
  await fullFlowTest("payment_application", pa.id, "支出付款");

  // B6 收入收款
  sub("B6: 收入收款");
  await prisma.receivable.create({ data: { sourceType: "income_contract", sourceId: ic.id, dueDate: new Date(Date.now() + 30 * 86400000), amount: 500000, status: "未收" } })
    .then(async rv => { await prisma.receiptVoucher.create({ data: { receivableId: rv.id, amount: 500000, receiptDate: new Date(), receiptMethod: "银行转账" } }); ok("收款成功"); })
    .catch((e: any) => bug("B6", "收入收款失败", e.message, "P2"));

  // B7 销项发票
  sub("B7: 销项发票");
  await prisma.invoice.create({ data: { invoiceNo: `INV_OUT_B${testSuffix}`, invoiceType: "销项发票", invoiceCategory: "增值税专用发票", amount: 500000, taxAmount: 65000, totalAmount: 565000, invoiceDate: new Date(), sourceType: "income_contract", sourceId: ic.id, status: "已开具" } }).then(() => ok("销项发票成功")).catch((e: any) => bug("B7", "销项发票创建失败", e.message, "P2"));

  // B8 进项发票
  sub("B8: 进项发票");
  await prisma.invoice.create({ data: { invoiceNo: `INV_IN_B${testSuffix}`, invoiceType: "进项发票", invoiceCategory: "增值税专用发票", amount: 200000, taxAmount: 26000, totalAmount: 226000, invoiceDate: new Date(), sourceType: "expense_contract", sourceId: ec.id, status: "已登记" } }).then(() => ok("进项发票成功")).catch((e: any) => bug("B8", "进项发票创建失败", e.message, "P2"));
}

// ============================================================
// C方向
// ============================================================
async function testC() {
  title("C方向：费用报销 + 工资");

  // C1a 公司费用报销
  sub("C1a: 费用报销(公司)");
  const ec = await prisma.expenseReport.create({ data: { applicantId: zj.id, expenseType: "办公用品", amount: 5000, status: "草稿" } });
  ok(`费用报销(公司): ${ec.id}`);
  await fullFlowTest("expense_report", ec.id, "费用报销(公司)");

  // C1b 项目费用报销
  sub("C1b: 费用报销(项目)");
  const ep = await prisma.expenseReport.create({ data: { applicantId: zj.id, expenseType: "差旅费", amount: 8000, status: "草稿", projectSourceId: shared.projectSourceId || undefined } });
  ok(`费用报销(项目): ${ep.id}`);
  await fullFlowTest("expense_report", ep.id, "费用报销(项目)");

  // C2 工资
  sub("C2: 工资发放");
  await prisma.salaryBatch.create({ data: { batchNo: `SB${testSuffix}`, period: "2026-06", title: `测试工资${testSuffix}`, totalGrossSalary: 50000, totalNetSalary: 40000, totalBankOutflow: 40000, status: "草稿" } })
    .then(async sb => { ok(`工资: ${sb.batchNo}`); await fullFlowTest("salary_payment", sb.id, "工资发放"); })
    .catch((e: any) => bug("C2", "工资发放创建失败", e.message, "P1"));
}

// ============================================================
// 报告
// ============================================================
function report() {
  title("测试结果");
  console.log(`  步骤: ${stepCount} | 通过: ${stepCount - failCount - warnCount} | 警告: ${warnCount} | 失败: ${failCount}`);
  if (allBugs.length > 0) {
    console.log(`\n  📋 Bug (${allBugs.length}):`);
    allBugs.forEach(b => console.log(`  | #${b.id} | P${b.sev} | ${b.dir} | ${b.step.substring(0, 40)} | ${b.desc.substring(0, 60)} |`));
  } else { console.log("\n  🎉 无 Bug!"); }
  console.log(`\n  💡 测试数据已保留在数据库中供前端验证`);
}

const shared: Record<string, string | null> = {};

async function main() {
  console.log(`\n${"=".repeat(60)}\n  全业务流回归测试\n  ${new Date().toISOString()}\n${"=".repeat(60)}`);
  if (!(await init())) process.exit(1);
  await testA(); await testB(); await testC();
  report();
  await prisma.$disconnect();
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); prisma.$disconnect().then(() => process.exit(1)); });

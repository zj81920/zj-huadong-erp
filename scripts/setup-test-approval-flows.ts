import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface FlowNode {
  nodeOrder: number;
  nodeName: string;
  approverRole: string;
  nodeType: "approval" | "archive" | "payment";
}

interface BusinessTypeConfig {
  key: string;
  label: string;
  terminalType: "approval" | "archive" | "payment";
  terminalRoleName: string;
  terminalName: string;
}

interface RoleMapping {
  name: string;
  code: string;
}

// 所有业务模块配置
const BUSINESS_MODULES: BusinessTypeConfig[] = [
  // 商务管理
  { key: "quotation", label: "商务报价", terminalType: "approval", terminalRoleName: "总经理", terminalName: "总经理终审" },
  { key: "supplier", label: "供应商审批", terminalType: "approval", terminalRoleName: "总经理", terminalName: "总经理终审" },
  // 项目管理
  { key: "outsourcing", label: "外包任务", terminalType: "approval", terminalRoleName: "总经理", terminalName: "总经理终审" },
  // 项目采购
  { key: "purchase_request", label: "采购需求", terminalType: "approval", terminalRoleName: "总经理", terminalName: "总经理终审" },
  { key: "delivery_receipt", label: "到货验收", terminalType: "approval", terminalRoleName: "总经理", terminalName: "总经理终审" },
  // 合同管理 - 归档节点
  { key: "income_contract", label: "收入合同", terminalType: "archive", terminalRoleName: "总经理", terminalName: "合同归档" },
  { key: "expense_contract", label: "支出合同", terminalType: "archive", terminalRoleName: "总经理", terminalName: "合同归档" },
  // 其他
  { key: "non_contract_income", label: "非合同收入", terminalType: "approval", terminalRoleName: "总经理", terminalName: "总经理终审" },
  { key: "other_borrowing", label: "其他借入款", terminalType: "approval", terminalRoleName: "总经理", terminalName: "总经理终审" },
  // 财务管理·支出 - 支付节点
  { key: "non_contract_expense", label: "其他支付", terminalType: "payment", terminalRoleName: "出纳", terminalName: "出纳支付" },
  { key: "payment_application", label: "合同支付", terminalType: "payment", terminalRoleName: "出纳", terminalName: "出纳支付" },
  { key: "expense_report", label: "费用报销", terminalType: "payment", terminalRoleName: "出纳", terminalName: "出纳支付" },
  { key: "lending_out", label: "借出款", terminalType: "payment", terminalRoleName: "出纳", terminalName: "出纳支付" },
  { key: "salary_payment", label: "工资发放", terminalType: "payment", terminalRoleName: "出纳", terminalName: "出纳支付" },
  { key: "borrowing_return_application", label: "借入资金归还", terminalType: "payment", terminalRoleName: "出纳", terminalName: "出纳支付" },
];

// 通过角色名称查找对应的 role code（兼容标准代码和自定义代码）
async function resolveRoleCode(name: string): Promise<string> {
  const role = await prisma.role.findFirst({ where: { name } });
  if (!role) {
    throw new Error(`数据库中未找到名为「${name}」的角色，请先创建该角色`);
  }
  return role.code;
}

async function resolveAllRoles(roleNames: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const name of roleNames) {
    result[name] = await resolveRoleCode(name);
  }
  return result;
}

function buildFlowNodes(module: BusinessTypeConfig, roleCodes: Record<string, string>): FlowNode[] {
  const commonNodes: FlowNode[] = [
    { nodeOrder: 1, nodeName: "行政人事初审", approverRole: roleCodes["行政人事专员"], nodeType: "approval" },
    { nodeOrder: 2, nodeName: "财务审核", approverRole: roleCodes["财务"], nodeType: "approval" },
    { nodeOrder: 3, nodeName: "总经理审批", approverRole: roleCodes["总经理"], nodeType: "approval" },
  ];

  const terminalNode: FlowNode = {
    nodeOrder: 4,
    nodeName: module.terminalName,
    approverRole: roleCodes[module.terminalRoleName],
    nodeType: module.terminalType,
  };

  return [...commonNodes, terminalNode];
}

async function setupFlows() {
  console.log("🔧 开始批量配置审批流程...\n");

  // 1. 查找张晶用户
  const zhangjing = await prisma.user.findFirst({
    where: { realName: "张晶" },
    include: {
      userRoles: {
        include: { role: true },
      },
    },
  });

  if (!zhangjing) {
    console.error("❌ 未找到用户「张晶」，请先通过系统设置 > 用户管理 创建该用户");
    process.exit(1);
  }

  console.log(`✅ 已找到用户: ${zhangjing.realName} (${zhangjing.username})`);
  console.log(`   拥有的角色: ${zhangjing.userRoles.map((ur) => `${ur.role.name}(${ur.role.code})`).join(", ")}\n`);

  // 2. 通过角色名称解析实际的角色代码（兼容自定义代码）
  const neededRoleNames = ["行政人事专员", "财务", "总经理", "出纳"];
  const roleCodes = await resolveAllRoles(neededRoleNames);
  console.log("📌 角色代码映射（名称 → 实际代码）:");
  for (const [name, code] of Object.entries(roleCodes)) {
    console.log(`   ${name} → ${code}`);
  }
  console.log();

  // 3. 检查张晶是否有流程所需的所有角色
  const userRoleCodes = new Set(zhangjing.userRoles.map((ur) => ur.role.code));
  const missingRoles = Object.values(roleCodes).filter((code) => !userRoleCodes.has(code));
  if (missingRoles.length > 0) {
    console.warn(`⚠️  张晶缺少以下角色，请先分配: ${missingRoles.join(", ")}`);
    console.warn("   可通过 系统设置 > 用户管理 编辑张晶用户分配角色\n");
    process.exit(1);
  }
  console.log(`✅ 张晶拥有所有流程所需角色\n`);

  // 4. 逐个模块配置流程
  for (const module of BUSINESS_MODULES) {
    const nodes = buildFlowNodes(module, roleCodes);

    // 先删除该模块已有的流程配置
    const deleted = await prisma.approvalFlowDefinition.deleteMany({
      where: { businessType: module.key, flowLevel: "common" },
    });

    // 创建新流程节点
    await prisma.approvalFlowDefinition.createMany({
      data: nodes.map((n) => ({
        businessType: module.key,
        flowLevel: "common",
        nodeOrder: n.nodeOrder,
        nodeName: n.nodeName,
        approverRole: n.approverRole,
        nodeType: n.nodeType,
        isActive: true,
      })),
    });

    const nodeSummary = nodes
      .map((n) => `  ${n.nodeOrder}. ${n.nodeName}(${n.approverRole})${n.nodeType !== "approval" ? ` [${n.nodeType}]` : ""}`)
      .join("\n");

    console.log(`📋 ${module.label} (${module.key}):`);
    console.log(nodeSummary);
    console.log(`   → 已删除旧配置 ${deleted.count} 条，新建 ${nodes.length} 个节点\n`);
  }

  // 5. 统计
  const totalNodes = await prisma.approvalFlowDefinition.count({
    where: { flowLevel: "common", isActive: true },
  });

  console.log(`🎉 配置完成！共配置 ${BUSINESS_MODULES.length} 个业务模块，${totalNodes} 个审批节点`);
  console.log(`💡 现在可以登录为「张晶」，测试所有业务模块的审批流程了`);
}

setupFlows()
  .catch((e) => {
    console.error("❌ 配置失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

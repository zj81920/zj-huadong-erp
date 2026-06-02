import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface BusinessType {
  key: string;
  label: string;
}

interface ApproverRole {
  key: string;
  label: string;
}

const businessTypes: BusinessType[] = [
  { key: "quotation", label: "商务报价" },
  { key: "outsourcing", label: "外包任务" },
  { key: "purchase_request", label: "采购需求" },
  { key: "income_contract", label: "收入合同" },
  { key: "expense_contract", label: "支出合同" },
  { key: "non_contract_income", label: "非合同收入" },
  { key: "non_contract_expense", label: "其他支付" },
  { key: "payment_application", label: "合同支付" },
  { key: "expense_report", label: "费用报销" },
  { key: "other_borrowing", label: "其他借入款" },
  { key: "lending_out", label: "借出款" },
  { key: "salary_payment", label: "工资发放" },
  { key: "borrowing_return_application", label: "借入资金归还" },
  { key: "delivery_receipt", label: "到货验收" },
];

const approverRoles: ApproverRole[] = [
  { key: "initiator", label: "经办人" },
  { key: "dept_head", label: "部门负责人" },
  { key: "project_manager", label: "项目经理" },
  { key: "pmo", label: "项目管理部" },
  { key: "admin", label: "行政" },
  { key: "procurement", label: "采购部" },
  { key: "production", label: "设计负责人/生产经理" },
  { key: "finance", label: "财务" },
  { key: "vice_gm", label: "副总经理" },
  { key: "gm", label: "总经理" },
  { key: "chairman", label: "董事长" },
  { key: "cashier", label: "出纳" },
];

const defaultFlows: Array<{ nodeOrder: number; nodeName: string; approverRole: string }> = [
  { nodeOrder: 1, nodeName: "发起", approverRole: "initiator" },
  { nodeOrder: 2, nodeName: "部门负责人审批", approverRole: "dept_head" },
  { nodeOrder: 3, nodeName: "副总经理审批", approverRole: "vice_gm" },
  { nodeOrder: 4, nodeName: "总经理审批", approverRole: "gm" },
];

export async function GET() {
  return NextResponse.json({
    data: {
      businessTypes,
      approverRoles,
    },
  });
}

export async function POST() {
  try {
    let createdCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const bt of businessTypes) {
        const flowLevel = "common";

        for (const node of defaultFlows) {
          const existing = await tx.approvalFlowDefinition.findFirst({
            where: {
              businessType: bt.key,
              flowLevel,
              nodeOrder: node.nodeOrder,
            },
          });

          if (!existing) {
            await tx.approvalFlowDefinition.create({
              data: {
                businessType: bt.key,
                flowLevel,
                nodeOrder: node.nodeOrder,
                nodeName: node.nodeName,
                approverRole: node.approverRole,
                isActive: true,
              },
            });
            createdCount++;
          }
        }
      }
    });

    return NextResponse.json({
      data: { createdCount },
      message: `已初始化 ${createdCount} 条审批流定义`,
    });
  } catch (error) {
    console.error("初始化审批流模板失败:", error);
    return NextResponse.json({ error: "初始化审批流模板失败" }, { status: 500 });
  }
}

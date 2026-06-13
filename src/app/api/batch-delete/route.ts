import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

const BUSINESS_MODELS = [
  "supplier",
  "customer",
  "income_contract",
  "expense_contract",
  "non_contract_income",
  "non_contract_expense",
  "purchase_request",
  "inquiries",
  "delivery_receipt",
  "project",
  "outsourcing",
  "project_plan",
  "quotation",
  "payment_application",
  "expense_report",
  "other_borrowing",
  "lending_out",
  "salary_payment",
  "borrowing_return_application",
  "supplier_change",
  "inter_org_contract",
  "contract_change_order",
  "invoice",
  "bank_account",
  "project_lead",
] as const;

type BusinessType = (typeof BUSINESS_MODELS)[number];

// 注意：所有有审批流程的业务类型都应使用物理删除，否则会导致流程实例残留
// supplier/customer 之前是软删除，已统一改为物理删除
const SOFT_DELETE_TYPES: BusinessType[] = [];

export async function POST(request: NextRequest) {
  try {
    const adminUser = await getCurrentUser();
    if (!adminUser || !isAdmin(adminUser)) {
      return NextResponse.json({ error: "仅管理员可执行批量删除" }, { status: 403 });
    }

    const body = await request.json();
    const { businessType, ids } = body as { businessType: BusinessType; ids: string[] };

    if (!businessType || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    if (!BUSINESS_MODELS.includes(businessType)) {
      return NextResponse.json({ error: "不支持的业务类型" }, { status: 400 });
    }

    if (SOFT_DELETE_TYPES.includes(businessType)) {
      await handleSoftDelete(businessType, ids);
    } else {
      await handleHardDelete(businessType, ids);
    }

    return NextResponse.json({ message: `成功删除 ${ids.length} 条记录` });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "批量删除失败";
    console.error("批量删除失败:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handleSoftDelete(businessType: BusinessType, ids: string[]) {
  // 所有业务统一改为物理删除 + 清理审批记录（确保无孤儿实例）
  for (const id of ids) {
    await cleanupBusinessApprovalRecords(businessType, id);
  }
  // handleSoftDelete 仅用于特殊场景，目前不使用软删除
}

async function handleHardDelete(businessType: BusinessType, ids: string[]) {
  // 先清理所有业务对应的审批实例，避免流程配置页面"有活跃实例"误报
  // 注意：cleanupBusinessApprovalRecords 内部有自己的事务，不能放在外层事务里（嵌套事务问题）
  for (const id of ids) {
    await cleanupBusinessApprovalRecords(businessType, id);
  }

  await prisma.$transaction(async (tx) => {
    switch (businessType) {
      case "supplier":
        // 级联清理关联子表（避免外键约束阻止删除）
        await tx.supplierChange.deleteMany({ where: { supplierId: { in: ids } } });
        await tx.supplierQuote.deleteMany({ where: { supplierId: { in: ids } } });
        await tx.expenseContract.updateMany({ where: { supplierId: { in: ids } }, data: { supplierId: null } });
        await tx.outsourcingTask.updateMany({ where: { supplierId: { in: ids } }, data: { supplierId: null } });
        await tx.supplier.deleteMany({ where: { id: { in: ids } } });
        break;
      case "customer":
        await tx.customer.deleteMany({ where: { id: { in: ids } } });
        break;
      case "income_contract":
        await tx.incomeContract.deleteMany({ where: { id: { in: ids } } });
        break;
      case "expense_contract":
        await tx.expenseContract.deleteMany({ where: { id: { in: ids } } });
        break;
      case "non_contract_income":
        await tx.nonContractIncome.deleteMany({ where: { id: { in: ids } } });
        break;
      case "non_contract_expense":
        await tx.nonContractExpense.deleteMany({ where: { id: { in: ids } } });
        break;
      case "purchase_request":
        await tx.purchaseRequest.deleteMany({ where: { id: { in: ids } } });
        break;
      case "inquiries":
        await tx.inquiry.deleteMany({ where: { id: { in: ids } } });
        break;
      case "delivery_receipt":
        await tx.deliveryReceipt.deleteMany({ where: { id: { in: ids } } });
        break;
      case "project":
        for (const id of ids) {
          await tx.receivable.updateMany({ where: { sourceType: "project", sourceId: id }, data: { sourceId: "" } });
          await tx.payable.updateMany({ where: { sourceType: "project", sourceId: id }, data: { sourceId: "" } });
          await tx.project.delete({ where: { id } });
        }
        break;
      case "outsourcing":
        await tx.outsourcingTask.deleteMany({ where: { id: { in: ids } } });
        break;
      case "project_plan":
        await tx.projectPlan.deleteMany({ where: { id: { in: ids } } });
        break;
      case "quotation":
        await tx.quotation.deleteMany({ where: { id: { in: ids } } });
        break;
      case "payment_application":
        await tx.paymentApplication.deleteMany({ where: { id: { in: ids } } });
        break;
      case "expense_report":
        await tx.expenseReport.deleteMany({ where: { id: { in: ids } } });
        break;
      case "other_borrowing":
        await tx.otherBorrowing.deleteMany({ where: { id: { in: ids } } });
        break;
      case "lending_out":
        await tx.lendingOut.deleteMany({ where: { id: { in: ids } } });
        break;
      case "salary_payment":
        await tx.salaryBatch.deleteMany({ where: { id: { in: ids } } });
        break;
      case "borrowing_return_application":
        await tx.borrowingReturnApplication.deleteMany({ where: { id: { in: ids } } });
        break;
      case "supplier_change":
        await tx.supplierChange.deleteMany({ where: { id: { in: ids } } });
        break;
      case "inter_org_contract":
        await tx.interOrgContract.deleteMany({ where: { id: { in: ids } } });
        break;
      case "contract_change_order":
        await tx.contractChangeOrder.deleteMany({ where: { id: { in: ids } } });
        break;
      case "invoice":
        await tx.invoice.deleteMany({ where: { id: { in: ids } } });
        break;
      case "bank_account":
        await tx.bankAccount.deleteMany({ where: { id: { in: ids } } });
        break;
      case "project_lead":
        for (const id of ids) {
          const lead = await tx.projectLead.findUnique({ where: { id }, select: { projectSourceId: true } });
          if (!lead) continue;
          const psid = lead.projectSourceId;
          await tx.bidding.deleteMany({ where: { projectSourceId: psid } });
          await tx.quotation.updateMany({ where: { projectSourceId: psid }, data: { projectSourceId: null } });
          await tx.incomeContract.updateMany({ where: { projectSourceId: psid }, data: { projectSourceId: null } });
          await tx.expenseContract.updateMany({ where: { projectSourceId: psid }, data: { projectSourceId: null } });
          await tx.project.updateMany({ where: { projectSourceId: psid }, data: { projectSourceId: "" } });
          await tx.projectLead.delete({ where: { id } });
        }
        break;
    }
  });
}

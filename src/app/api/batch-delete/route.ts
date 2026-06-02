import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";

const BUSINESS_MODELS = [
  "supplier",
  "customer",
  "income_contract",
  "expense_contract",
  "non_contract_income",
  "non_contract_expense",
  "purchase_request",
  "inquiry",
  "delivery_receipt",
  "project",
  "outsourcing",
  "project_plan",
  "project_progress",
  "quotation",
  "payment_application",
  "expense_report",
  "other_borrowing",
  "lending_out",
  "salary_payment",
  "borrowing_return_application",
  "invoice",
  "bank_account",
  "project_lead",
] as const;

type BusinessType = (typeof BUSINESS_MODELS)[number];

const SOFT_DELETE_TYPES: BusinessType[] = [
  "supplier",
  "customer",
];

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
  await prisma.$transaction(async (tx) => {
    for (const id of ids) {
      switch (businessType) {
        case "supplier":
          await tx.supplier.update({ where: { id }, data: { isActive: false } });
          break;
        case "customer":
          await tx.customer.update({ where: { id }, data: { isActive: false } });
          break;
      }
    }
  });
}

async function handleHardDelete(businessType: BusinessType, ids: string[]) {
  await prisma.$transaction(async (tx) => {
    switch (businessType) {
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
      case "inquiry":
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
      case "project_progress":
        await tx.projectProgress.deleteMany({ where: { id: { in: ids } } });
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

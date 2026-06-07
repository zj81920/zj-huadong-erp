import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin, getCurrentUser } from "@/lib/auth";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        project: { select: { projectSourceId: true, name: true, projectCode: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "发票不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: invoice });
  } catch (error) {
    console.error("获取发票详情失败:", error);
    return NextResponse.json({ error: "获取发票详情失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await prisma.invoice.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "发票不存在" }, { status: 404 });
    }

    if (existing.status === "已作废") {
      return NextResponse.json({ error: "已作废的发票不能编辑" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    const fields = [
      "invoiceNo", "invoiceCode", "invoiceType", "invoiceCategory",
      "sellerName", "sellerTaxNo", "buyerName", "buyerTaxNo",
      "projectSourceId", "sourceType", "sourceId", "status", "remark", "attachments",
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (body.invoiceDate !== undefined) updateData.invoiceDate = new Date(body.invoiceDate);
    if (body.amount !== undefined) updateData.amount = parseFloat(body.amount);
    if (body.taxRate !== undefined) updateData.taxRate = parseFloat(body.taxRate);
    if (body.taxAmount !== undefined) updateData.taxAmount = parseFloat(body.taxAmount);
    if (body.totalAmount !== undefined) updateData.totalAmount = parseFloat(body.totalAmount);

    const record = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { projectSourceId: true, name: true, projectCode: true } },
      },
    });

    // 作废联动：发票作废时扣减关联模块的 invoicedAmount
    if (body.status === "已作废" && existing.status !== "已作废") {
      await updateRelatedInvoicedAmount(
        existing.sourceType,
        existing.sourceId,
        Number(existing.totalAmount),
        "subtract"
      );
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("更新发票失败:", error);
    return NextResponse.json({ error: "更新发票失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const adminUser = await getCurrentUser();
    const existing = await prisma.invoice.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "发票不存在" }, { status: 404 });
    }

    if (existing.status === "已作废" && !isAdmin(adminUser)) {
      return NextResponse.json({ error: "已作废的发票不能删除" }, { status: 400 });
    }

    // 仅"已登记"状态才扣减（已作废的已在作废时扣过）
    if (existing.status !== "已作废") {
      await updateRelatedInvoicedAmount(existing.sourceType, existing.sourceId, Number(existing.totalAmount), "subtract");
    }

    await cleanupBusinessApprovalRecords("invoice", id);
    await prisma.invoice.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除发票失败:", error);
    return NextResponse.json({ error: "删除发票失败" }, { status: 500 });
  }
}

async function updateRelatedInvoicedAmount(
  sourceType: string,
  sourceId: string | null,
  amount: number,
  operation: "add" | "subtract"
) {
  if (!sourceId) return;
  const delta = operation === "add" ? amount : -amount;

  if (sourceType === "expense_contract") {
    const contract = await prisma.expenseContract.findUnique({ where: { id: sourceId } });
    if (contract) {
      await prisma.expenseContract.update({
        where: { id: sourceId },
        data: { invoicedAmount: { increment: delta } },
      });
    }
  } else if (sourceType === "income_contract") {
    const contract = await prisma.incomeContract.findUnique({ where: { id: sourceId } });
    if (contract) {
      await prisma.incomeContract.update({
        where: { id: sourceId },
        data: { invoicedAmount: { increment: delta } },
      });
    }
  } else if (sourceType === "delivery_receipt") {
    const receipt = await prisma.deliveryReceipt.findUnique({ where: { id: sourceId } });
    if (receipt) {
      await prisma.deliveryReceipt.update({
        where: { id: sourceId },
        data: { invoiceAmount: { increment: delta } },
      });
    }
  } else if (sourceType === "non_contract_expense") {
    const expense = await prisma.nonContractExpense.findUnique({ where: { id: sourceId } });
    if (expense) {
      await prisma.nonContractExpense.update({
        where: { id: sourceId },
        data: { invoicedAmount: { increment: delta } },
      });
    }
  }
}

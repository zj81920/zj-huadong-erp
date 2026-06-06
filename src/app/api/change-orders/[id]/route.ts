import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await prisma.contractChangeOrder.findUnique({ where: { id } });
  if (!data) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  let relatedContract = null;
  if (data.contractType === "income_contract") {
    relatedContract = await prisma.incomeContract.findUnique({
      where: { id: data.contractId },
      include: { customer: true, project: true },
    });
  } else if (data.contractType === "expense_contract") {
    relatedContract = await prisma.expenseContract.findUnique({
      where: { id: data.contractId },
      include: { supplier: true, project: true },
    });
  } else if (data.contractType === "inter_org_contract") {
    relatedContract = await prisma.interOrgContract.findUnique({
      where: { id: data.contractId },
      include: { fromOrg: true, toOrg: true },
    });
  }

  return NextResponse.json({ data: { ...data, relatedContract } });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data = await prisma.contractChangeOrder.update({
    where: { id },
    data: {
      changeReason: body.changeReason,
      newAmount: body.newAmount ? parseFloat(body.newAmount) : undefined,
      newData: body.newData || undefined,
      amountDifference: body.newAmount
        ? parseFloat(body.newAmount) - parseFloat(body.previousAmount)
        : undefined,
      newFiles: body.newFiles || undefined,
      remark: body.remark || null,
    },
  });
  return NextResponse.json({ data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await cleanupBusinessApprovalRecords("contract_change_order", id);
  await prisma.contractChangeOrder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

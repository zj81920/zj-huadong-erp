import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin, getCurrentUser } from "@/lib/auth";
import { checkDeletePermission, checkEditPermission } from "@/lib/permission-check";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const record = await prisma.nonContractIncome.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: "非合同收入记录不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("获取非合同收入详情失败:", error);
    return NextResponse.json(
      { error: "获取非合同收入详情失败" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.nonContractIncome.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "非合同收入记录不存在" },
        { status: 404 }
      );
    }

    const editCheck = await checkEditPermission("non_contract_income", undefined, existing.status, existing.createdById);
    if (!editCheck.allowed) {
      return NextResponse.json({ error: editCheck.error }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.projectSourceId !== undefined)
      updateData.projectSourceId = body.projectSourceId || null;
    if (body.amount !== undefined)
      updateData.amount = parseFloat(body.amount);
    if (body.transactionDate !== undefined)
      updateData.transactionDate = body.transactionDate ? new Date(body.transactionDate) : new Date();
    if (body.counterparty !== undefined)
      updateData.counterparty = body.counterparty?.trim() || null;
    if (body.description !== undefined)
      updateData.description = body.description?.trim() || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.approvalInstanceId !== undefined)
      updateData.approvalInstanceId = body.approvalInstanceId;

    const record = await prisma.nonContractIncome.update({
      where: { id },
      data: updateData,
      include: {
        project: true,
      },
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("更新非合同收入失败:", error);
    return NextResponse.json(
      { error: "更新非合同收入失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminUser = await getCurrentUser();

    const existing = await prisma.nonContractIncome.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "非合同收入记录不存在" },
        { status: 404 }
      );
    }

    const deleteCheck = await checkDeletePermission("non_contract_income", undefined, existing.status, existing.createdById);
    if (!deleteCheck.allowed) {
      return NextResponse.json({ error: deleteCheck.error }, { status: 403 });
    }

    await prisma.nonContractIncome.delete({
      where: { id },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除非合同收入失败:", error);
    return NextResponse.json(
      { error: "删除非合同收入失败" },
      { status: 500 }
    );
  }
}

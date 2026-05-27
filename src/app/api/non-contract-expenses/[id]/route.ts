import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const record = await prisma.nonContractExpense.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: "非合同支出记录不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("获取非合同支出详情失败:", error);
    return NextResponse.json(
      { error: "获取非合同支出详情失败" },
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

    const existing = await prisma.nonContractExpense.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "非合同支出记录不存在" },
        { status: 404 }
      );
    }

    const fieldKeys = Object.keys(body).filter((k) => k !== "status");
    const isStatusOnlyChange = body.status !== undefined && fieldKeys.length === 0;

    if (!isStatusOnlyChange && existing.status !== "草稿") {
      return NextResponse.json(
        { error: "只有草稿状态的记录可以编辑" },
        { status: 400 }
      );
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

    const record = await prisma.nonContractExpense.update({
      where: { id },
      data: updateData,
      include: {
        project: true,
      },
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("更新非合同支出失败:", error);
    return NextResponse.json(
      { error: "更新非合同支出失败" },
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

    const existing = await prisma.nonContractExpense.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "非合同支出记录不存在" },
        { status: 404 }
      );
    }

    if (existing.status !== "草稿") {
      return NextResponse.json(
        { error: "只有草稿状态的记录可以删除" },
        { status: 400 }
      );
    }

    await prisma.nonContractExpense.delete({
      where: { id },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除非合同支出失败:", error);
    return NextResponse.json(
      { error: "删除非合同支出失败" },
      { status: 500 }
    );
  }
}

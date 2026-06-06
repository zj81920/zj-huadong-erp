import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkDeletePermission, checkEditPermission } from "@/lib/permission-check";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const record = await prisma.borrowingReturnApplication.findUnique({
      where: { id },
    });

    if (!record) {
      return NextResponse.json(
        { error: "归还申请记录不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("获取归还申请详情失败:", error);
    return NextResponse.json(
      { error: "获取归还申请详情失败" },
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

    const existing = await prisma.borrowingReturnApplication.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "归还申请记录不存在" },
        { status: 404 }
      );
    }

    const editCheck = await checkEditPermission("borrowing_return_application", undefined, existing.status, existing.createdById);
    if (!editCheck.allowed) {
      return NextResponse.json({ error: editCheck.error }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.returnAmount !== undefined) {
      const parsedAmount = parseFloat(body.returnAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json(
          { error: "归还金额必须大于0" },
          { status: 400 }
        );
      }
      updateData.returnAmount = parsedAmount;
    }
    if (body.returnDate !== undefined)
      updateData.returnDate = body.returnDate ? new Date(body.returnDate) : new Date();
    if (body.remark !== undefined)
      updateData.remark = body.remark?.trim() || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.approvalInstanceId !== undefined)
      updateData.approvalInstanceId = body.approvalInstanceId;
    if (body.lastModifiedBy !== undefined)
      updateData.lastModifiedBy = body.lastModifiedBy;

    const record = await prisma.borrowingReturnApplication.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("更新归还申请失败:", error);
    return NextResponse.json(
      { error: "更新归还申请失败" },
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
    await getCurrentUser();

    const existing = await prisma.borrowingReturnApplication.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "归还申请记录不存在" },
        { status: 404 }
      );
    }

    const deleteCheck = await checkDeletePermission("borrowing_return_application", undefined, existing.status, existing.createdById);
    if (!deleteCheck.allowed) {
      return NextResponse.json({ error: deleteCheck.error }, { status: 403 });
    }

    await cleanupBusinessApprovalRecords("borrowing_return_application", id);
    await prisma.borrowingReturnApplication.delete({
      where: { id },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除归还申请失败:", error);
    return NextResponse.json(
      { error: "删除归还申请失败" },
      { status: 500 }
    );
  }
}

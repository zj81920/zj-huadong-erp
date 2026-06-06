import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkDeletePermission, checkEditPermission } from "@/lib/permission-check";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const record = await prisma.lendingOut.findUnique({
      where: { id },
      include: {
        returns: true,
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: "借出款记录不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("获取借出款详情失败:", error);
    return NextResponse.json(
      { error: "获取借出款详情失败" },
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

    const existing = await prisma.lendingOut.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "借出款记录不存在" },
        { status: 404 }
      );
    }

    const editCheck = await checkEditPermission("lending_out", undefined, existing.status, existing.createdById);
    if (!editCheck.allowed) {
      return NextResponse.json({ error: editCheck.error }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.lendingType !== undefined) updateData.lendingType = body.lendingType;
    if (body.projectSourceId !== undefined) updateData.projectSourceId = body.projectSourceId || null;
    if (body.biddingId !== undefined) updateData.biddingId = body.biddingId || null;
    if (body.borrowerName !== undefined) updateData.borrowerName = body.borrowerName;
    if (body.amount !== undefined) updateData.amount = parseFloat(body.amount);
    if (body.lendingDate !== undefined) updateData.lendingDate = new Date(body.lendingDate);
    if (body.expectedReturnDate !== undefined) updateData.expectedReturnDate = body.expectedReturnDate ? new Date(body.expectedReturnDate) : null;
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.status !== undefined) {
      updateData.status = body.status === "已批准" && existing.status === "审批中" ? "未还清" : body.status;
    }

    const record = await prisma.lendingOut.update({
      where: { id },
      data: updateData,
      include: {
        returns: true,
      },
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("更新借出款失败:", error);
    return NextResponse.json(
      { error: "更新借出款失败" },
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

    const existing = await prisma.lendingOut.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "借出款记录不存在" },
        { status: 404 }
      );
    }

    const deleteCheck = await checkDeletePermission("lending_out", undefined, existing.status, existing.createdById);
    if (!deleteCheck.allowed) {
      return NextResponse.json({ error: deleteCheck.error }, { status: 403 });
    }

    await cleanupBusinessApprovalRecords("lending_out", id);
    await prisma.lendingOut.delete({
      where: { id },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除借出款失败:", error);
    return NextResponse.json(
      { error: "删除借出款失败" },
      { status: 500 }
    );
  }
}

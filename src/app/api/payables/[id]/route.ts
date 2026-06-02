import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin, getCurrentUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const record = await prisma.payable.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: "应付记录不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("获取应付详情失败:", error);
    return NextResponse.json(
      { error: "获取应付详情失败" },
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

    const existing = await prisma.payable.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "应付记录不存在" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.amount !== undefined)
      updateData.amount = parseFloat(body.amount);
    if (body.dueDate !== undefined)
      updateData.dueDate = new Date(body.dueDate);
    if (body.paidAmount !== undefined)
      updateData.paidAmount = parseFloat(body.paidAmount);
    if (body.status !== undefined)
      updateData.status = body.status;
    if (body.projectSourceId !== undefined)
      updateData.projectSourceId = body.projectSourceId || null;
    if (body.sourceType !== undefined)
      updateData.sourceType = body.sourceType;
    if (body.sourceId !== undefined)
      updateData.sourceId = body.sourceId;

    const record = await prisma.payable.update({
      where: { id },
      data: updateData,
      include: {
        project: true,
      },
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("更新应付记录失败:", error);
    return NextResponse.json(
      { error: "更新应付记录失败" },
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

    const existing = await prisma.payable.findUnique({
      where: { id },
      include: {
        paymentApplications: {
          include: { paymentVouchers: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "应付记录不存在" },
        { status: 404 }
      );
    }

    if (existing.status !== "未付" && !isAdmin(adminUser)) {
      return NextResponse.json(
        { error: "只有未付状态的记录可以删除" },
        { status: 400 }
      );
    }

    if (existing.paymentApplications.length > 0 && !isAdmin(adminUser)) {
      return NextResponse.json(
        { error: "该应付记录已有付款申请，无法删除" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const app of existing.paymentApplications) {
        if (app.paymentVouchers.length > 0) {
          await tx.paymentVoucher.deleteMany({
            where: { paymentApplicationId: app.id },
          });
        }
      }
      if (existing.paymentApplications.length > 0) {
        await tx.paymentApplication.deleteMany({
          where: { payableId: id },
        });
      }
      await tx.payable.delete({ where: { id } });
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除应付记录失败:", error);
    return NextResponse.json(
      { error: "删除应付记录失败" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin, getCurrentUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const record = await prisma.expenseReport.findUnique({
      where: { id },
      include: {
        project: true,
        applicant: {
          select: { id: true, realName: true, username: true },
        },
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: "费用报销记录不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("获取费用报销详情失败:", error);
    return NextResponse.json(
      { error: "获取费用报销详情失败" },
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

    const existing = await prisma.expenseReport.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "费用报销记录不存在" },
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

    if (body.applicantId !== undefined) updateData.applicantId = body.applicantId;
    if (body.expenseType !== undefined) updateData.expenseType = body.expenseType;
    if (body.amount !== undefined) updateData.amount = parseFloat(body.amount);
    if (body.projectSourceId !== undefined) updateData.projectSourceId = body.projectSourceId || null;
    if (body.budgetCategory !== undefined) updateData.budgetCategory = body.budgetCategory || null;
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.attachmentUrl !== undefined) updateData.attachmentUrl = body.attachmentUrl;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.approvalInstanceId !== undefined) updateData.approvalInstanceId = body.approvalInstanceId;

    const record = await prisma.expenseReport.update({
      where: { id },
      data: updateData,
      include: {
        project: true,
        applicant: {
          select: { id: true, realName: true, username: true },
        },
      },
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("更新费用报销失败:", error);
    return NextResponse.json(
      { error: "更新费用报销失败" },
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

    const existing = await prisma.expenseReport.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "费用报销记录不存在" },
        { status: 404 }
      );
    }

    if (existing.status !== "草稿" && !isAdmin(adminUser)) {
      return NextResponse.json(
        { error: "只有草稿状态的记录可以删除" },
        { status: 400 }
      );
    }

    await prisma.expenseReport.delete({
      where: { id },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除费用报销失败:", error);
    return NextResponse.json(
      { error: "删除费用报销失败" },
      { status: 500 }
    );
  }
}

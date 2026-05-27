import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const borrowing = await prisma.otherBorrowing.findUnique({
      where: { id },
      include: {
        returns: { orderBy: { returnDate: "desc" } },
      },
    });

    if (!borrowing) {
      return NextResponse.json({ error: "借入款记录不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: borrowing });
  } catch (error) {
    console.error("获取借入款详情失败:", error);
    return NextResponse.json({ error: "获取借入款详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.otherBorrowing.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "借入款记录不存在" }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {};
    if (body.status !== undefined) {
      updatePayload.status = body.status === "已批准" && existing.status === "审批中" ? "未还清" : body.status;
    }
    if (body.description !== undefined) updatePayload.description = body.description || null;
    if (body.expectedReturnDate !== undefined) {
      updatePayload.expectedReturnDate = body.expectedReturnDate ? new Date(body.expectedReturnDate) : null;
    }

    const borrowing = await prisma.otherBorrowing.update({
      where: { id },
      data: updatePayload,
      include: {
        returns: { orderBy: { returnDate: "desc" } },
      },
    });

    return NextResponse.json({ data: borrowing });
  } catch (error) {
    console.error("更新借入款失败:", error);
    return NextResponse.json({ error: "更新借入款失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.otherBorrowing.findUnique({
      where: { id },
      include: { returns: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "借入款记录不存在" }, { status: 404 });
    }

    if (existing.returns.length > 0) {
      return NextResponse.json({ error: "该借入款下有归还记录，无法删除" }, { status: 400 });
    }

    await prisma.otherBorrowing.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除借入款失败:", error);
    return NextResponse.json({ error: "删除借入款失败" }, { status: 500 });
  }
}

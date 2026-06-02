import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const receivable = await prisma.receivable.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, projectSourceId: true, name: true, projectCode: true } },
        receiptVouchers: true,
      },
    });

    if (!receivable) {
      return NextResponse.json({ error: "应收记录不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: receivable });
  } catch (error) {
    console.error("获取应收详情失败:", error);
    return NextResponse.json({ error: "获取应收详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.receivable.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "应收记录不存在" }, { status: 404 });
    }

    const receivable = await prisma.receivable.update({
      where: { id },
      data: {
        ...(body.dueDate !== undefined && { dueDate: new Date(body.dueDate) }),
        ...(body.amount !== undefined && { amount: parseFloat(body.amount) }),
        ...(body.paidAmount !== undefined && { paidAmount: parseFloat(body.paidAmount) }),
        ...(body.status !== undefined && { status: body.status }),
      },
      include: {
        project: { select: { id: true, projectSourceId: true, name: true, projectCode: true } },
      },
    });

    return NextResponse.json({ data: receivable });
  } catch (error) {
    console.error("更新应收记录失败:", error);
    return NextResponse.json({ error: "更新应收记录失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.receivable.findUnique({
      where: { id },
      include: { receiptVouchers: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "应收记录不存在" }, { status: 404 });
    }

    if (existing.receiptVouchers.length > 0) {
      return NextResponse.json({ error: "该应收记录已有收款凭证，无法删除" }, { status: 400 });
    }

    await prisma.receivable.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除应收记录失败:", error);
    return NextResponse.json({ error: "删除应收记录失败" }, { status: 500 });
  }
}

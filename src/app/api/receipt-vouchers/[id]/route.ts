import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const voucher = await prisma.receiptVoucher.findUnique({
      where: { id },
      include: {
        receivable: {
          include: {
            project: { select: { id: true, projectSourceId: true, name: true, projectCode: true } },
          },
        },
      },
    });

    if (!voucher) {
      return NextResponse.json({ error: "收款凭证不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: voucher });
  } catch (error) {
    console.error("获取收款凭证详情失败:", error);
    return NextResponse.json({ error: "获取收款凭证详情失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.receiptVoucher.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "收款凭证不存在" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const receivable = await tx.receivable.findUnique({
        where: { id: existing.receivableId },
      });
      if (receivable) {
        const newPaidAmount = parseFloat(receivable.paidAmount.toString()) - parseFloat(existing.amount.toString());
        await tx.receivable.update({
          where: { id: existing.receivableId },
          data: {
            paidAmount: Math.max(0, newPaidAmount),
            status: newPaidAmount <= 0 ? "未收" : "部分收款",
          },
        });
      }

      await tx.receiptVoucher.delete({ where: { id } });
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除收款凭证失败:", error);
    return NextResponse.json({ error: "删除收款凭证失败" }, { status: 500 });
  }
}

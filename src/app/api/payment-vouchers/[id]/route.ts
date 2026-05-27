import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const voucher = await prisma.paymentVoucher.findUnique({
      where: { id },
      include: {
        paymentApplication: {
          include: {
            payable: {
              include: {
                project: { select: { id: true, projectSourceId: true, name: true, projectCode: true } },
              },
            },
            applicant: { select: { id: true, realName: true, username: true } },
          },
        },
      },
    });

    if (!voucher) {
      return NextResponse.json({ error: "付款凭证不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: voucher });
  } catch (error) {
    console.error("获取付款凭证详情失败:", error);
    return NextResponse.json({ error: "获取付款凭证详情失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.paymentVoucher.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "付款凭证不存在" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const application = await tx.paymentApplication.findUnique({
        where: { id: existing.paymentApplicationId },
        include: { payable: true },
      });
      if (application) {
        const payable = application.payable;
        const newPaidAmount = parseFloat(payable.paidAmount.toString()) - parseFloat(existing.amount.toString());
        await tx.payable.update({
          where: { id: payable.id },
          data: {
            paidAmount: Math.max(0, newPaidAmount),
            status: newPaidAmount <= 0 ? "未付" : "部分付款",
          },
        });

        await tx.paymentApplication.update({
          where: { id: existing.paymentApplicationId },
          data: { approvalStatus: "已批准" },
        });
      }

      await tx.paymentVoucher.delete({ where: { id } });
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除付款凭证失败:", error);
    return NextResponse.json({ error: "删除付款凭证失败" }, { status: 500 });
  }
}

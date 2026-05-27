import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentApplicationId = searchParams.get("paymentApplicationId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (paymentApplicationId) {
      where.paymentApplicationId = paymentApplicationId;
    }

    const [vouchers, total] = await Promise.all([
      prisma.paymentVoucher.findMany({
        where,
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
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.paymentVoucher.count({ where }),
    ]);

    return NextResponse.json({
      data: vouchers,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取付款凭证列表失败:", error);
    return NextResponse.json({ error: "获取付款凭证列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      paymentApplicationId,
      amount,
      paymentDate,
      bankAccount,
      paymentNo,
      registrant,
      registerDate,
      paymentReason,
      paymentMethod,
      attachments,
      remark,
    } = body;

    if (!paymentApplicationId) {
      return NextResponse.json({ error: "必须提供付款申请ID" }, { status: 400 });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "金额必须大于0" }, { status: 400 });
    }

    const application = await prisma.paymentApplication.findUnique({
      where: { id: paymentApplicationId },
      include: { payable: true },
    });
    if (!application) {
      return NextResponse.json({ error: "付款申请不存在" }, { status: 400 });
    }

    if (application.approvalStatus !== "已批准") {
      return NextResponse.json({ error: "只有已批准的付款申请才能创建付款凭证" }, { status: 400 });
    }

    const voucher = await prisma.$transaction(async (tx) => {
      const v = await tx.paymentVoucher.create({
        data: {
          paymentApplicationId,
          amount: parseFloat(amount),
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          bankAccount: bankAccount || null,
          paymentNo: paymentNo || null,
          registrant: registrant || null,
          registerDate: registerDate ? new Date(registerDate) : null,
          paymentReason: paymentReason || null,
          paymentMethod: paymentMethod || null,
          attachments: attachments || null,
          remark: remark || null,
        },
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

      await tx.paymentApplication.update({
        where: { id: paymentApplicationId },
        data: { approvalStatus: "已付款" },
      });

      const payable = application.payable;
      const newPaidAmount = parseFloat(payable.paidAmount.toString()) + parseFloat(amount);
      const totalAmount = parseFloat(payable.amount.toString());

      await tx.payable.update({
        where: { id: payable.id },
        data: {
          paidAmount: newPaidAmount,
          status: newPaidAmount >= totalAmount ? "已付" : "部分付款",
        },
      });

      return v;
    });

    return NextResponse.json({ data: voucher }, { status: 201 });
  } catch (error) {
    console.error("创建付款凭证失败:", error);
    return NextResponse.json({ error: "创建付款凭证失败" }, { status: 500 });
  }
}

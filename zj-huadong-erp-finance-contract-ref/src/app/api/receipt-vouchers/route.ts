import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const receivableId = searchParams.get("receivableId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (receivableId) {
      where.receivableId = receivableId;
    }

    const [vouchers, total] = await Promise.all([
      prisma.receiptVoucher.findMany({
        where,
        include: {
          receivable: {
            include: {
              project: { select: { id: true, projectSourceId: true, name: true, projectCode: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.receiptVoucher.count({ where }),
    ]);

    return NextResponse.json({
      data: vouchers,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取收款凭证列表失败:", error);
    return NextResponse.json({ error: "获取收款凭证列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      receivableId,
      receiptNo,
      registrant,
      registerDate,
      amount,
      receiptDate,
      receiptReason,
      receiptMethod,
      bankAccount,
      attachments,
      remark,
    } = body;

    if (!receivableId) {
      return NextResponse.json({ error: "必须提供应收记录ID" }, { status: 400 });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "金额必须大于0" }, { status: 400 });
    }

    const receivable = await prisma.receivable.findUnique({ where: { id: receivableId } });
    if (!receivable) {
      return NextResponse.json({ error: "应收记录不存在" }, { status: 400 });
    }

    const newPaidAmount = parseFloat(receivable.paidAmount.toString()) + parseFloat(amount);
    const totalAmount = parseFloat(receivable.amount.toString());

    const voucher = await prisma.$transaction(async (tx) => {
      const v = await tx.receiptVoucher.create({
        data: {
          receivableId,
          receiptNo: receiptNo?.trim() || null,
          registrant: registrant?.trim() || null,
          registerDate: registerDate ? new Date(registerDate) : new Date(),
          amount: parseFloat(amount),
          receiptDate: receiptDate ? new Date(receiptDate) : new Date(),
          receiptReason: receiptReason?.trim() || null,
          receiptMethod: receiptMethod || null,
          bankAccount: bankAccount?.trim() || null,
          attachments: attachments?.trim() || null,
          remark: remark?.trim() || null,
        },
        include: {
          receivable: {
            include: {
              project: { select: { id: true, projectSourceId: true, name: true, projectCode: true } },
            },
          },
        },
      });

      await tx.receivable.update({
        where: { id: receivableId },
        data: {
          paidAmount: newPaidAmount,
          status: newPaidAmount >= totalAmount ? "已收" : "部分收款",
        },
      });

      return v;
    });

    return NextResponse.json({ data: voucher }, { status: 201 });
  } catch (error) {
    console.error("创建收款凭证失败:", error);
    return NextResponse.json({ error: "创建收款凭证失败" }, { status: 500 });
  }
}

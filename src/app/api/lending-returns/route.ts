import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lendingId = searchParams.get("lendingId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (lendingId) {
      where.lendingId = lendingId;
    }

    const [data, total] = await Promise.all([
      prisma.lendingReturn.findMany({
        where,
        include: {
          lending: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.lendingReturn.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("获取收回记录列表失败:", error);
    return NextResponse.json(
      { error: "获取收回记录列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lendingId, amount, returnDate, remark } = body;

    if (!lendingId) {
      return NextResponse.json(
        { error: "必须提供借出款ID" },
        { status: 400 }
      );
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: "收回金额必须大于0" },
        { status: 400 }
      );
    }

    if (!returnDate) {
      return NextResponse.json(
        { error: "必须提供收回日期" },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);

    const lending = await prisma.lendingOut.findUnique({
      where: { id: lendingId },
    });

    if (!lending) {
      return NextResponse.json(
        { error: "借出款记录不存在" },
        { status: 400 }
      );
    }

    const newReturnedAmount = Number(lending.returnedAmount) + parsedAmount;
    const newRemainingAmount = Number(lending.remainingAmount) - parsedAmount;

    if (newRemainingAmount < 0) {
      return NextResponse.json(
        { error: "收回金额超过剩余金额" },
        { status: 400 }
      );
    }

    let newStatus: string;
    if (newRemainingAmount === 0) {
      newStatus = "已还清";
    } else {
      newStatus = "未还清";
    }

    const record = await prisma.$transaction(async (tx) => {
      const lendingReturn = await tx.lendingReturn.create({
        data: {
          lendingId,
          amount: parsedAmount,
          returnDate: new Date(returnDate),
          remark: remark?.trim() || null,
        },
        include: {
          lending: true,
        },
      });

      await tx.lendingOut.update({
        where: { id: lendingId },
        data: {
          returnedAmount: newReturnedAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
        },
      });

      return lendingReturn;
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error("创建收回记录失败:", error);
    return NextResponse.json(
      { error: "创建收回记录失败" },
      { status: 500 }
    );
  }
}

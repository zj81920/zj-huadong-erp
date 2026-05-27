import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const borrowingId = searchParams.get("borrowingId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (borrowingId) {
      where.borrowingId = borrowingId;
    }

    const [data, total] = await Promise.all([
      prisma.borrowingReturn.findMany({
        where,
        include: {
          borrowing: true,
        },
        orderBy: { returnDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.borrowingReturn.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取借入款归还记录列表失败:", error);
    return NextResponse.json({ error: "获取借入款归还记录列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { borrowingId, amount, returnDate, remark } = body;

    if (!borrowingId) {
      return NextResponse.json({ error: "必须选择借入款记录" }, { status: 400 });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "归还金额必须大于0" }, { status: 400 });
    }

    if (!returnDate) {
      return NextResponse.json({ error: "必须提供归还日期" }, { status: 400 });
    }

    const borrowing = await prisma.otherBorrowing.findUnique({
      where: { id: borrowingId },
    });

    if (!borrowing) {
      return NextResponse.json({ error: "借入款记录不存在" }, { status: 400 });
    }

    const returnAmount = parseFloat(amount);

    const result = await prisma.$transaction(async (tx) => {
      const borrowingReturn = await tx.borrowingReturn.create({
        data: {
          borrowingId,
          amount: returnAmount,
          returnDate: new Date(returnDate),
          remark: remark || null,
        },
        include: {
          borrowing: true,
        },
      });

      const newReturnedAmount = Number(borrowing.returnedAmount) + returnAmount;
      const newRemainingAmount = Number(borrowing.remainingAmount) - returnAmount;
      const newStatus = newRemainingAmount <= 0 ? "已还清" : "未还清";

      await tx.otherBorrowing.update({
        where: { id: borrowingId },
        data: {
          returnedAmount: newReturnedAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
        },
      });

      return borrowingReturn;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("创建借入款归还记录失败:", error);
    return NextResponse.json({ error: "创建借入款归还记录失败" }, { status: 500 });
  }
}

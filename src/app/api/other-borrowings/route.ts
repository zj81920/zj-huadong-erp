import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkReadPermission } from "@/lib/permission-check";

export async function GET(request: NextRequest) {
  try {
    const { canReadAll, userId } = await checkReadPermission("other_borrowing")
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    // 权限过滤
    if (!canReadAll && userId) {
      where.createdById = userId;
    }

    const [data, total] = await Promise.all([
      prisma.otherBorrowing.findMany({
        where,
        include: {
          returns: { orderBy: { returnDate: "desc" } },
        },
        orderBy: { borrowingDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.otherBorrowing.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取借入款列表失败:", error);
    return NextResponse.json({ error: "获取借入款列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentUser = await getCurrentUser();
    const { lenderName, amount, borrowingDate, expectedReturnDate, description } = body;

    if (!lenderName) {
      return NextResponse.json({ error: "必须提供出借人名称" }, { status: 400 });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "金额必须大于0" }, { status: 400 });
    }

    if (!borrowingDate) {
      return NextResponse.json({ error: "必须提供借款日期" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);

    const borrowing = await prisma.otherBorrowing.create({
      data: {
        lenderName,
        amount: parsedAmount,
        returnedAmount: 0,
        remainingAmount: parsedAmount,
        borrowingDate: new Date(borrowingDate),
        expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
        description: description || null,
        status: "草稿",
        createdById: currentUser?.id || null,
      },
      include: {
        returns: true,
      },
    });

    return NextResponse.json({ data: borrowing }, { status: 201 });
  } catch (error) {
    console.error("创建借入款失败:", error);
    return NextResponse.json({ error: "创建借入款失败" }, { status: 500 });
  }
}

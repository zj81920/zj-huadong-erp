import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lendingType = searchParams.get("lendingType") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (lendingType) {
      where.lendingType = lendingType;
    }

    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      prisma.lendingOut.findMany({
        where,
        include: {
          returns: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.lendingOut.count({ where }),
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
    console.error("获取借出款列表失败:", error);
    return NextResponse.json(
      { error: "获取借出款列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      lendingType,
      projectSourceId,
      biddingId,
      borrowerName,
      borrowerBankName,
      borrowerBankAccount,
      amount,
      lendingDate,
      expectedReturnDate,
      description,
    } = body;

    if (!lendingType) {
      return NextResponse.json(
        { error: "必须提供借出类型" },
        { status: 400 }
      );
    }

    const validLendingTypes = ["投标保证金", "押金", "备用金", "其他借出款"];
    if (!validLendingTypes.includes(lendingType)) {
      return NextResponse.json(
        { error: "无效的借出类型" },
        { status: 400 }
      );
    }

    if (lendingType === "投标保证金" && !projectSourceId) {
      return NextResponse.json(
        { error: "投标保证金必须关联项目线索" },
        { status: 400 }
      );
    }

    if (!borrowerName) {
      return NextResponse.json(
        { error: "必须提供借款人" },
        { status: 400 }
      );
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: "金额必须大于0" },
        { status: 400 }
      );
    }

    if (!lendingDate) {
      return NextResponse.json(
        { error: "必须提供借出日期" },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);

    const record = await prisma.lendingOut.create({
      data: {
        lendingType,
        projectSourceId: projectSourceId || null,
        biddingId: biddingId || null,
        borrowerName,
        borrowerBankName: borrowerBankName?.trim() || null,
        borrowerBankAccount: borrowerBankAccount?.trim() || null,
        amount: parsedAmount,
        returnedAmount: 0,
        remainingAmount: parsedAmount,
        lendingDate: new Date(lendingDate),
        expectedReturnDate: expectedReturnDate
          ? new Date(expectedReturnDate)
          : null,
        description: description?.trim() || null,
        status: "草稿",
      },
      include: {
        returns: true,
      },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error("创建借出款失败:", error);
    return NextResponse.json(
      { error: "创建借出款失败" },
      { status: 500 }
    );
  }
}

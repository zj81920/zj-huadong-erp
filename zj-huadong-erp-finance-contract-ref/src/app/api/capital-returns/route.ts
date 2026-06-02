import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contributionId = searchParams.get("contributionId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (contributionId) {
      where.contributionId = contributionId;
    }

    const [data, total] = await Promise.all([
      prisma.capitalReturn.findMany({
        where,
        include: {
          contribution: {
            include: {
              shareholder: true,
            },
          },
        },
        orderBy: { returnDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.capitalReturn.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取出资归还记录列表失败:", error);
    return NextResponse.json({ error: "获取出资归还记录列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contributionId, amount, returnDate, remark } = body;

    if (!contributionId) {
      return NextResponse.json({ error: "必须选择出资记录" }, { status: 400 });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "归还金额必须大于0" }, { status: 400 });
    }

    if (!returnDate) {
      return NextResponse.json({ error: "必须提供归还日期" }, { status: 400 });
    }

    const contribution = await prisma.capitalContribution.findUnique({
      where: { id: contributionId },
    });

    if (!contribution) {
      return NextResponse.json({ error: "出资记录不存在" }, { status: 400 });
    }

    const returnAmount = parseFloat(amount);

    const result = await prisma.$transaction(async (tx) => {
      const capitalReturn = await tx.capitalReturn.create({
        data: {
          contributionId,
          amount: returnAmount,
          returnDate: new Date(returnDate),
          remark: remark || null,
        },
        include: {
          contribution: {
            include: {
              shareholder: true,
            },
          },
        },
      });

      const newReturnedAmount = Number(contribution.returnedAmount) + returnAmount;
      const newRemainingAmount = Number(contribution.remainingAmount) - returnAmount;

      await tx.capitalContribution.update({
        where: { id: contributionId },
        data: {
          returnedAmount: newReturnedAmount,
          remainingAmount: newRemainingAmount,
        },
      });

      return capitalReturn;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("创建出资归还记录失败:", error);
    return NextResponse.json({ error: "创建出资归还记录失败" }, { status: 500 });
  }
}

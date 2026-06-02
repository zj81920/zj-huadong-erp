import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shareholderId = searchParams.get("shareholderId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (shareholderId) {
      where.shareholderId = shareholderId;
    }

    const [contributions, total] = await Promise.all([
      prisma.capitalContribution.findMany({
        where,
        include: {
          shareholder: true,
        },
        orderBy: { contributeDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.capitalContribution.count({ where }),
    ]);

    return NextResponse.json({
      data: contributions,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取出资记录列表失败:", error);
    return NextResponse.json({ error: "获取出资记录列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shareholderId, amount, contributeDate, method, remark } = body;

    if (!shareholderId) {
      return NextResponse.json({ error: "必须选择股东" }, { status: 400 });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "金额必须大于0" }, { status: 400 });
    }

    if (!contributeDate) {
      return NextResponse.json({ error: "必须提供出资日期" }, { status: 400 });
    }

    const shareholder = await prisma.shareholder.findUnique({ where: { id: shareholderId } });
    if (!shareholder) {
      return NextResponse.json({ error: "股东不存在" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);

    const contribution = await prisma.capitalContribution.create({
      data: {
        shareholderId,
        amount: parsedAmount,
        returnedAmount: 0,
        remainingAmount: parsedAmount,
        contributeDate: new Date(contributeDate),
        method: method || null,
        remark: remark || null,
      },
      include: { shareholder: true },
    });

    return NextResponse.json({ data: contribution }, { status: 201 });
  } catch (error) {
    console.error("创建出资记录失败:", error);
    return NextResponse.json({ error: "创建出资记录失败" }, { status: 500 });
  }
}

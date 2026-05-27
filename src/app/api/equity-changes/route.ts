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

    const [changes, total] = await Promise.all([
      prisma.equityChange.findMany({
        where,
        include: {
          shareholder: true,
        },
        orderBy: { changeDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.equityChange.count({ where }),
    ]);

    return NextResponse.json({
      data: changes,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取股权变更列表失败:", error);
    return NextResponse.json({ error: "获取股权变更列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shareholderId, changeType, beforeRatio, afterRatio, changeDate, remark } = body;

    if (!shareholderId) {
      return NextResponse.json({ error: "必须选择股东" }, { status: 400 });
    }

    if (!changeType) {
      return NextResponse.json({ error: "必须提供变更类型" }, { status: 400 });
    }

    if (!changeDate) {
      return NextResponse.json({ error: "必须提供变更日期" }, { status: 400 });
    }

    const shareholder = await prisma.shareholder.findUnique({ where: { id: shareholderId } });
    if (!shareholder) {
      return NextResponse.json({ error: "股东不存在" }, { status: 400 });
    }

    const change = await prisma.equityChange.create({
      data: {
        shareholderId,
        changeType,
        beforeRatio: beforeRatio ? parseFloat(beforeRatio) : null,
        afterRatio: afterRatio ? parseFloat(afterRatio) : null,
        changeDate: new Date(changeDate),
        remark: remark || null,
      },
      include: { shareholder: true },
    });

    if (afterRatio !== undefined && afterRatio !== null) {
      await prisma.shareholder.update({
        where: { id: shareholderId },
        data: { shareRatio: parseFloat(afterRatio) },
      });
    }

    return NextResponse.json({ data: change }, { status: 201 });
  } catch (error) {
    console.error("创建股权变更失败:", error);
    return NextResponse.json({ error: "创建股权变更失败" }, { status: 500 });
  }
}

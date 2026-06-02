import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const [shareholders, total] = await Promise.all([
      prisma.shareholder.findMany({
        where,
        include: {
          contributions: { orderBy: { contributeDate: "desc" } },
          equityChanges: { orderBy: { changeDate: "desc" } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.shareholder.count({ where }),
    ]);

    return NextResponse.json({
      data: shareholders,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取股东列表失败:", error);
    return NextResponse.json({ error: "获取股东列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, idNumber, shareRatio, contactPhone } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "股东姓名不能为空" }, { status: 400 });
    }

    const shareholder = await prisma.shareholder.create({
      data: {
        name: name.trim(),
        idNumber: idNumber?.trim() || null,
        shareRatio: shareRatio ? parseFloat(shareRatio) : null,
        contactPhone: contactPhone?.trim() || null,
      },
      include: {
        contributions: true,
        equityChanges: true,
      },
    });

    return NextResponse.json({ data: shareholder }, { status: 201 });
  } catch (error) {
    console.error("创建股东失败:", error);
    return NextResponse.json({ error: "创建股东失败" }, { status: 500 });
  }
}

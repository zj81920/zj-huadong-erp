import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin, getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { bankName: { contains: search, mode: "insensitive" } },
        { bankAccount: { contains: search, mode: "insensitive" } },
      ];
    }

    const [records, total] = await Promise.all([
      prisma.counterpartyInfo.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.counterpartyInfo.count({ where }),
    ]);

    return NextResponse.json({
      data: records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取往来信息列表失败:", error);
    return NextResponse.json({ error: "获取往来信息列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 403 });
    }

    const body = await request.json();
    const { name, bankName, bankAccount } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "交易对方名称不能为空" }, { status: 400 });
    }

    const existing = await prisma.counterpartyInfo.findFirst({
      where: {
        name: name.trim(),
        bankName: bankName?.trim() || null,
        bankAccount: bankAccount?.trim() || null,
      },
    });

    if (existing) {
      return NextResponse.json({ data: existing });
    }

    const record = await prisma.counterpartyInfo.create({
      data: {
        name: name.trim(),
        bankName: bankName?.trim() || null,
        bankAccount: bankAccount?.trim() || null,
      },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error("创建往来信息失败:", error);
    return NextResponse.json({ error: "创建往来信息失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: "仅管理员可操作" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "缺少ID" }, { status: 400 });
    }

    await prisma.counterpartyInfo.delete({ where: { id } });
    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除往来信息失败:", error);
    return NextResponse.json({ error: "删除往来信息失败" }, { status: 500 });
  }
}

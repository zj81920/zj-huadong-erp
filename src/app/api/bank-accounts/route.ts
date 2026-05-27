import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const isActive = searchParams.get("isActive");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { accountName: { contains: search, mode: "insensitive" } },
        { bankName: { contains: search, mode: "insensitive" } },
        { accountNo: { contains: search, mode: "insensitive" } },
      ];
    }

    if (isActive !== null && isActive !== "") {
      where.isActive = isActive === "true";
    }

    const [data, total] = await Promise.all([
      prisma.bankAccount.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.bankAccount.count({ where }),
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
    console.error("获取银行账户列表失败:", error);
    return NextResponse.json(
      { error: "获取银行账户列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountName, bankName, accountNo, accountType, isActive, remark } =
      body;

    if (!accountName || !accountName.trim()) {
      return NextResponse.json(
        { error: "账户名称不能为空" },
        { status: 400 }
      );
    }

    if (!bankName || !bankName.trim()) {
      return NextResponse.json(
        { error: "银行名称不能为空" },
        { status: 400 }
      );
    }

    if (!accountNo || !accountNo.trim()) {
      return NextResponse.json(
        { error: "银行账号不能为空" },
        { status: 400 }
      );
    }

    if (!accountType || !["公司账户", "个人账户"].includes(accountType)) {
      return NextResponse.json(
        { error: "账户类型只能为'公司账户'或'个人账户'" },
        { status: 400 }
      );
    }

    const existing = await prisma.bankAccount.findUnique({
      where: { accountNo: accountNo.trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "银行账号已存在" },
        { status: 400 }
      );
    }

    const bankAccount = await prisma.bankAccount.create({
      data: {
        accountName: accountName.trim(),
        bankName: bankName.trim(),
        accountNo: accountNo.trim(),
        accountType,
        isActive: isActive !== undefined ? isActive : true,
        remark: remark?.trim() || null,
      },
    });

    return NextResponse.json({ data: bankAccount }, { status: 201 });
  } catch (error) {
    console.error("创建银行账户失败:", error);
    return NextResponse.json(
      { error: "创建银行账户失败" },
      { status: 500 }
    );
  }
}

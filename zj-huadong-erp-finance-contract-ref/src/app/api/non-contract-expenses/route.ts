import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const projectSourceId = searchParams.get("projectSourceId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { counterparty: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (projectSourceId) {
      where.projectSourceId = projectSourceId;
    }

    const [records, total] = await Promise.all([
      prisma.nonContractExpense.findMany({
        where,
        include: {
          project: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.nonContractExpense.count({ where }),
    ]);

    return NextResponse.json({
      data: records,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("获取非合同支出列表失败:", error);
    return NextResponse.json(
      { error: "获取非合同支出列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectSourceId,
      amount,
      transactionDate,
      counterparty,
      description,
    } = body;

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: "金额必须大于0" },
        { status: 400 }
      );
    }

    if (projectSourceId) {
      const project = await prisma.project.findUnique({
        where: { projectSourceId },
      });

      if (!project) {
        return NextResponse.json(
          { error: "关联项目不存在" },
          { status: 400 }
        );
      }
    }

    const record = await prisma.nonContractExpense.create({
      data: {
        projectSourceId: projectSourceId || null,
        amount: parseFloat(amount),
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        counterparty: counterparty?.trim() || null,
        description: description?.trim() || null,
      },
      include: {
        project: true,
      },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error("创建非合同支出失败:", error);
    return NextResponse.json(
      { error: "创建非合同支出失败" },
      { status: 500 }
    );
  }
}

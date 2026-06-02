import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const projectSourceId = searchParams.get("projectSourceId") || "";
    const sourceType = searchParams.get("sourceType") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { sourceId: { contains: search, mode: "insensitive" } },
        { sourceType: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (projectSourceId) {
      where.projectSourceId = projectSourceId;
    }

    if (sourceType) {
      where.sourceType = sourceType;
    }

    const [records, total] = await Promise.all([
      prisma.payable.findMany({
        where,
        include: {
          project: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.payable.count({ where }),
    ]);

    let contractMap: Record<string, unknown> = {};
    if (sourceType === "expense_contract") {
      const contractIds = records.map((r) => r.sourceId).filter(Boolean);
      if (contractIds.length > 0) {
        const contracts = await prisma.expenseContract.findMany({
          where: { id: { in: contractIds } },
          include: {
            supplier: true,
            project: true,
          },
        });
        contractMap = Object.fromEntries(contracts.map((c) => [c.id, c]));
      }
    }

    let outsourcingMap: Record<string, unknown> = {};
    if (sourceType === "outsourcing") {
      const outsourcingIds = records.map((r) => r.sourceId).filter(Boolean);
      if (outsourcingIds.length > 0) {
        const outsourcingTasks = await prisma.outsourcingTask.findMany({
          where: { id: { in: outsourcingIds } },
          include: {
            project: { select: { name: true, projectSourceId: true } },
          },
        });
        outsourcingMap = Object.fromEntries(outsourcingTasks.map((t) => [t.id, t]));
      }
    }

    const enriched = records.map((r) => ({
      ...r,
      sourceContract: (contractMap as Record<string, unknown>)[r.sourceId] || null,
      sourceOutsourcing: (outsourcingMap as Record<string, unknown>)[r.sourceId] || null,
    }));

    return NextResponse.json({
      data: enriched,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("获取应付列表失败:", error);
    return NextResponse.json(
      { error: "获取应付列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceType, sourceId, dueDate, amount, projectSourceId } = body;

    if (!sourceType) {
      return NextResponse.json(
        { error: "来源类型不能为空" },
        { status: 400 }
      );
    }

    if (!sourceId) {
      return NextResponse.json(
        { error: "来源ID不能为空" },
        { status: 400 }
      );
    }

    if (!dueDate) {
      return NextResponse.json(
        { error: "到期日不能为空" },
        { status: 400 }
      );
    }

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

    const record = await prisma.payable.create({
      data: {
        sourceType,
        sourceId,
        dueDate: new Date(dueDate),
        amount: parseFloat(amount),
        paidAmount: 0,
        invoicedAmount: 0,
        projectSourceId: projectSourceId || null,
      },
      include: {
        project: true,
      },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error("创建应付记录失败:", error);
    return NextResponse.json(
      { error: "创建应付记录失败" },
      { status: 500 }
    );
  }
}

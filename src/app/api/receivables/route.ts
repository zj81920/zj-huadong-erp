import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const projectSourceId = searchParams.get("projectSourceId") || "";
    const sourceType = searchParams.get("sourceType") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (projectSourceId) {
      where.projectSourceId = projectSourceId;
    }

    if (sourceType) {
      where.sourceType = sourceType;
    }

    const [receivables, total] = await Promise.all([
      prisma.receivable.findMany({
        where,
        include: {
          project: { select: { id: true, projectSourceId: true, name: true, projectCode: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.receivable.count({ where }),
    ]);

    let contractMap: Record<string, unknown> = {};
    if (sourceType === "income_contract") {
      const contractIds = receivables
        .map((r) => r.sourceId)
        .filter(Boolean);

      if (contractIds.length > 0) {
        const contracts = await prisma.incomeContract.findMany({
          where: { id: { in: contractIds } },
          include: {
            customer: true,
            project: true,
          },
        });
        contractMap = Object.fromEntries(contracts.map((c) => [c.id, c]));
      }
    } else if (sourceType === "inter_org_contract") {
      const contractIds = receivables
        .map((r) => r.sourceId)
        .filter(Boolean);

      if (contractIds.length > 0) {
        const contracts = await prisma.interOrgContract.findMany({
          where: { id: { in: contractIds } },
          include: { fromOrg: true, toOrg: true },
        });
        contractMap = Object.fromEntries(contracts.map((c) => [c.id, c]));
      }
    }

    const enriched = receivables.map((r) => ({
      ...r,
      sourceContract: (contractMap as Record<string, unknown>)[r.sourceId] || null,
    }));

    return NextResponse.json({
      data: enriched,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取应收列表失败:", error);
    return NextResponse.json({ error: "获取应收列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceType, sourceId, projectSourceId, dueDate, amount } = body;

    if (!sourceType || !sourceId) {
      return NextResponse.json({ error: "必须提供来源类型和来源ID" }, { status: 400 });
    }

    if (!dueDate) {
      return NextResponse.json({ error: "必须提供到期日期" }, { status: 400 });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "金额必须大于0" }, { status: 400 });
    }

    const receivable = await prisma.receivable.create({
      data: {
        sourceType,
        sourceId,
        projectSourceId: projectSourceId || null,
        dueDate: new Date(dueDate),
        amount: parseFloat(amount),
        paidAmount: 0,
        invoicedAmount: 0,
        status: "未收",
      },
      include: {
        project: { select: { id: true, projectSourceId: true, name: true, projectCode: true } },
      },
    });

    return NextResponse.json({ data: receivable }, { status: 201 });
  } catch (error) {
    console.error("创建应收记录失败:", error);
    return NextResponse.json({ error: "创建应收记录失败" }, { status: 500 });
  }
}

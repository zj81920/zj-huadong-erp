import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkReadPermission } from "@/lib/permission-check";

export async function GET(request: NextRequest) {
  try {
    const { canReadAll, userId } = await checkReadPermission("expense_report")
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const projectSourceId = searchParams.get("projectSourceId") || "";
    const applicantId = searchParams.get("applicantId") || "";
    const expenseType = searchParams.get("expenseType") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { budgetCategory: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (projectSourceId) {
      where.projectSourceId = projectSourceId;
    }

    if (applicantId) {
      where.applicantId = applicantId;
    }

    if (expenseType) {
      where.expenseType = expenseType;
    }

    // 权限过滤
    if (!canReadAll && userId) {
      where.createdById = userId;
    }

    const [records, total] = await Promise.all([
      prisma.expenseReport.findMany({
        where,
        include: {
          project: true,
          applicant: {
            select: { id: true, realName: true, username: true },
          },
          items: {
            include: {
              project: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.expenseReport.count({ where }),
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
    console.error("获取费用报销列表失败:", error);
    return NextResponse.json(
      { error: "获取费用报销列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentUser = await getCurrentUser();
    const { applicantId, expenseType, amount, projectSourceId, budgetCategory, description, items } = body;

    if (!applicantId) {
      return NextResponse.json(
        { error: "必须提供申请人" },
        { status: 400 }
      );
    }

    if (!expenseType) {
      return NextResponse.json(
        { error: "必须提供费用类型" },
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

      if (!budgetCategory) {
        return NextResponse.json(
          { error: "关联项目时预算科目必填" },
          { status: 400 }
        );
      }
    }

    const parsedAmount = parseFloat(amount);

    if (items && Array.isArray(items) && items.length > 0) {
      const itemsTotal = items.reduce(
        (sum: number, item: { amount: number }) => sum + parseFloat(String(item.amount)),
        0
      );

      if (Math.abs(itemsTotal - parsedAmount) > 0.01) {
        return NextResponse.json(
          { error: "明细金额总和必须等于报销总金额" },
          { status: 400 }
        );
      }
    }

    const record = await prisma.$transaction(async (tx) => {
      const report = await tx.expenseReport.create({
        data: {
          applicantId,
          expenseType,
          amount: parsedAmount,
          projectSourceId: projectSourceId || null,
          budgetCategory: budgetCategory || null,
          description: description?.trim() || null,
          createdById: currentUser?.id || null,
        },
        include: {
          project: true,
          applicant: {
            select: { id: true, realName: true, username: true },
          },
          items: {
            include: {
              project: { select: { name: true } },
            },
          },
        },
      });

      if (items && Array.isArray(items) && items.length > 0) {
        await tx.expenseReportItem.createMany({
          data: items.map(
            (item: { expenseType: string; amount: number; description?: string; projectSourceId?: string; invoiceAttachments?: string[] }, index: number) => ({
              reportId: report.id,
              expenseType: item.expenseType,
              amount: parseFloat(String(item.amount)),
              description: item.description?.trim() || null,
              projectSourceId: item.projectSourceId || null,
              invoiceAttachments: item.invoiceAttachments || [],
              sortOrder: index,
            })
          ),
        });

        const updatedReport = await tx.expenseReport.findUnique({
          where: { id: report.id },
          include: {
            project: true,
            applicant: {
              select: { id: true, realName: true, username: true },
            },
            items: {
              include: {
                project: { select: { name: true } },
              },
            },
          },
        });

        return updatedReport;
      }

      return report;
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error("创建费用报销失败:", error);
    return NextResponse.json(
      { error: "创建费用报销失败" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkReadPermission } from "@/lib/permission-check";

export async function GET(request: NextRequest) {
  try {
    const { canReadAll, userId } = await checkReadPermission("borrowing_return_application")
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const sourceType = searchParams.get("sourceType") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.sourceName = { contains: search, mode: "insensitive" };
    }

    if (status) {
      where.status = status;
    }

    if (sourceType) {
      where.sourceType = sourceType;
    }

    // 权限过滤
    if (!canReadAll && userId) {
      where.createdById = userId;
    }

    const [records, total] = await Promise.all([
      prisma.borrowingReturnApplication.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.borrowingReturnApplication.count({ where }),
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
    console.error("获取归还申请列表失败:", error);
    return NextResponse.json(
      { error: "获取归还申请列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentUser = await getCurrentUser();
    const {
      sourceType,
      sourceId,
      sourceName,
      sourceAmount,
      returnAmount,
      returnDate,
      remark,
    } = body;

    if (!sourceType || !["shareholder_capital", "other_borrowing"].includes(sourceType)) {
      return NextResponse.json(
        { error: "来源类型无效" },
        { status: 400 }
      );
    }

    if (!returnAmount || isNaN(parseFloat(returnAmount)) || parseFloat(returnAmount) <= 0) {
      return NextResponse.json(
        { error: "归还金额必须大于0" },
        { status: 400 }
      );
    }

    if (!sourceId) {
      return NextResponse.json(
        { error: "来源ID不能为空" },
        { status: 400 }
      );
    }

    if (sourceType === "shareholder_capital") {
      const contribution = await prisma.capitalContribution.findUnique({
        where: { id: sourceId },
      });

      if (!contribution) {
        return NextResponse.json(
          { error: "关联的出资记录不存在" },
          { status: 400 }
        );
      }

      if (parseFloat(returnAmount) > Number(contribution.remainingAmount)) {
        return NextResponse.json(
          { error: "归还金额超过出资记录的剩余金额" },
          { status: 400 }
        );
      }
    } else if (sourceType === "other_borrowing") {
      const borrowing = await prisma.otherBorrowing.findUnique({
        where: { id: sourceId },
      });

      if (!borrowing) {
        return NextResponse.json(
          { error: "关联的借入记录不存在" },
          { status: 400 }
        );
      }

      if (parseFloat(returnAmount) > Number(borrowing.remainingAmount)) {
        return NextResponse.json(
          { error: "归还金额超过借入记录的剩余金额" },
          { status: 400 }
        );
      }
    }

    const record = await prisma.borrowingReturnApplication.create({
      data: {
        sourceType,
        sourceId,
        sourceName: sourceName || "",
        sourceAmount: parseFloat(sourceAmount) || 0,
        returnAmount: parseFloat(returnAmount),
        returnDate: returnDate ? new Date(returnDate) : new Date(),
        remark: remark?.trim() || null,
        createdById: currentUser?.id || null,
      },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error("创建归还申请失败:", error);
    return NextResponse.json(
      { error: "创建归还申请失败" },
      { status: 500 }
    );
  }
}

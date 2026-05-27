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
      where.contractNo = { contains: search, mode: "insensitive" };
    }

    if (status) {
      where.status = status;
    }

    if (projectSourceId) {
      where.projectSourceId = projectSourceId;
    }

    const [contracts, total] = await Promise.all([
      prisma.incomeContract.findMany({
        where,
        include: {
          customer: true,
          project: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.incomeContract.count({ where }),
    ]);

    return NextResponse.json({
      data: contracts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("获取收入合同列表失败:", error);
    return NextResponse.json(
      { error: "获取收入合同列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      contractNo,
      projectSourceId,
      customerId,
      signedDate,
      totalAmount,
      splitStages,
      scannedUrl,
    } = body;

    if (!contractNo || !contractNo.trim()) {
      return NextResponse.json(
        { error: "合同编号不能为空" },
        { status: 400 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "请选择客户" },
        { status: 400 }
      );
    }

    if (!totalAmount || isNaN(parseFloat(totalAmount)) || parseFloat(totalAmount) <= 0) {
      return NextResponse.json(
        { error: "合同金额必须大于0" },
        { status: 400 }
      );
    }

    const existing = await prisma.incomeContract.findUnique({
      where: { contractNo: contractNo.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "合同编号已存在" },
        { status: 409 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer || !customer.isActive) {
      return NextResponse.json(
        { error: "客户不存在或已停用" },
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

    const contract = await prisma.incomeContract.create({
      data: {
        contractNo: contractNo.trim(),
        projectSourceId: projectSourceId || null,
        customerId,
        signedDate: signedDate ? new Date(signedDate) : null,
        totalAmount: parseFloat(totalAmount),
        splitStages: splitStages || [],
        scannedUrl: scannedUrl?.trim() || null,
      },
      include: {
        customer: true,
        project: true,
      },
    });

    return NextResponse.json({ data: contract }, { status: 201 });
  } catch (error) {
    console.error("创建收入合同失败:", error);
    return NextResponse.json(
      { error: "创建收入合同失败" },
      { status: 500 }
    );
  }
}

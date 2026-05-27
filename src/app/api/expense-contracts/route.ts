import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const projectSourceId = searchParams.get("projectSourceId") || "";
    const contractType = searchParams.get("contractType") || "";
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

    if (contractType) {
      where.contractType = contractType;
    }

    const [contracts, total] = await Promise.all([
      prisma.expenseContract.findMany({
        where,
        include: {
          supplier: true,
          project: true,
          inquiry: {
            include: {
              purchaseRequest: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.expenseContract.count({ where }),
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
    console.error("获取支出合同列表失败:", error);
    return NextResponse.json(
      { error: "获取支出合同列表失败" },
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
      supplierId,
      inquiryId,
      signedDate,
      totalAmount,
      paymentTerms,
      contractType,
      scannedUrl,
    } = body;

    if (!contractNo || !contractNo.trim()) {
      return NextResponse.json(
        { error: "合同编号不能为空" },
        { status: 400 }
      );
    }

    if (!totalAmount || isNaN(parseFloat(totalAmount)) || parseFloat(totalAmount) <= 0) {
      return NextResponse.json(
        { error: "合同金额必须大于0" },
        { status: 400 }
      );
    }

    const existing = await prisma.expenseContract.findUnique({
      where: { contractNo: contractNo.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "合同编号已存在" },
        { status: 409 }
      );
    }

    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier || !supplier.isActive) {
        return NextResponse.json(
          { error: "供应商不存在或已停用" },
          { status: 400 }
        );
      }
    }

    if (inquiryId) {
      const inquiry = await prisma.inquiry.findUnique({
        where: { id: inquiryId },
      });
      if (!inquiry) {
        return NextResponse.json(
          { error: "询价单不存在" },
          { status: 400 }
        );
      }
      const linked = await prisma.expenseContract.findUnique({
        where: { inquiryId },
      });
      if (linked) {
        return NextResponse.json(
          { error: "该询价单已关联合同" },
          { status: 400 }
        );
      }
    }

    if (contractType === "项目采购" && !projectSourceId) {
      return NextResponse.json(
        { error: "项目采购必须关联项目" },
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

    const contract = await prisma.expenseContract.create({
      data: {
        contractNo: contractNo.trim(),
        projectSourceId: projectSourceId || null,
        supplierId: supplierId || null,
        inquiryId: inquiryId || null,
        signedDate: signedDate ? new Date(signedDate) : null,
        totalAmount: parseFloat(totalAmount),
        paymentTerms: paymentTerms?.trim() || null,
        contractType: contractType || "其他",
        scannedUrl: scannedUrl?.trim() || null,
      },
      include: {
        supplier: true,
        project: true,
        inquiry: {
          include: {
            purchaseRequest: true,
          },
        },
      },
    });

    return NextResponse.json({ data: contract }, { status: 201 });
  } catch (error) {
    console.error("创建支出合同失败:", error);
    return NextResponse.json(
      { error: "创建支出合同失败" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const approvalStatus = searchParams.get("approvalStatus") || "";
    const customerId = searchParams.get("customerId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { projectLead: { projectName: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (approvalStatus) {
      where.approvalStatus = approvalStatus;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, industryType: true } },
          projectLead: { select: { id: true, projectSourceId: true, projectName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.quotation.count({ where }),
    ]);

    return NextResponse.json({
      data: quotations,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取报价单列表失败:", error);
    return NextResponse.json({ error: "获取报价单列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentUser = await getCurrentUser();
    const {
      projectSourceId,
      customerId,
      estimatedCost,
      totalAmount,
      profitMargin,
      adjustmentReason,
      quotationLetterUrl,
      files,
    } = body;

    if (!customerId) {
      return NextResponse.json({ error: "请选择客户" }, { status: 400 });
    }
    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      return NextResponse.json({ error: "报价总金额必须大于0" }, { status: 400 });
    }

    if (projectSourceId) {
      const lead = await prisma.projectLead.findUnique({
        where: { projectSourceId },
        include: { biddings: { select: { id: true } } },
      });
      if (!lead) {
        return NextResponse.json({ error: "关联的项目线索不存在" }, { status: 400 });
      }
      if (lead.biddings.length > 0) {
        return NextResponse.json({ error: "该线索已有投标记录，无法添加报价" }, { status: 400 });
      }
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || !customer.isActive) {
      return NextResponse.json({ error: "客户不存在" }, { status: 400 });
    }

    let nextVersion = 1;
    if (projectSourceId) {
      const latestQuotation = await prisma.quotation.findFirst({
        where: { projectSourceId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      if (latestQuotation) {
        nextVersion = latestQuotation.version + 1;
      }
    }

    const quotation = await prisma.quotation.create({
      data: {
        projectSourceId: projectSourceId || null,
        customerId,
        estimatedCost: estimatedCost || {},
        totalAmount: parseFloat(totalAmount),
        profitMargin: profitMargin ? parseFloat(profitMargin) : null,
        approvalStatus: "草稿",
        version: nextVersion,
        adjustmentReason: adjustmentReason?.trim() || null,
        quotationLetterUrl: quotationLetterUrl || null,
        files: files || [],
        lastModifiedBy: currentUser?.realName || null,
      },
      include: {
        customer: { select: { id: true, name: true, industryType: true } },
        projectLead: { select: { id: true, projectSourceId: true, projectName: true } },
      },
    });

    if (projectSourceId) {
      await prisma.projectLead.update({
        where: { projectSourceId },
        data: { currentStatus: "报价中", leadMode: "商务报价" },
      });
    }

    return NextResponse.json({ data: quotation }, { status: 201 });
  } catch (error) {
    console.error("创建报价单失败:", error);
    return NextResponse.json({ error: "创建报价单失败" }, { status: 500 });
  }
}

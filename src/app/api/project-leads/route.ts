import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

async function generateProjectSourceId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PJ-${year}-`;

  const lastLead = await prisma.projectLead.findFirst({
    where: { projectSourceId: { startsWith: prefix } },
    orderBy: { projectSourceId: "desc" },
    select: { projectSourceId: true },
  });

  let nextNum = 1;
  if (lastLead) {
    const parts = lastLead.projectSourceId.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const customerId = searchParams.get("customerId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { projectSourceId: { contains: search, mode: "insensitive" } },
        { projectName: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { infoSource: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.currentStatus = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    const [leads, total] = await Promise.all([
      prisma.projectLead.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, industryType: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.projectLead.count({ where }),
    ]);

    return NextResponse.json({
      data: leads,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取项目线索列表失败:", error);
    return NextResponse.json({ error: "获取项目线索列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerId,
      projectName,
      location,
      estimatedInvestment,
      bidReleaseTime,
      infoSource,
      currentStatus,
      followUpRecords,
      competitorInfo,
    } = body;

    if (!customerId) {
      return NextResponse.json({ error: "请选择客户" }, { status: 400 });
    }
    if (!projectName || !projectName.trim()) {
      return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || !customer.isActive) {
      return NextResponse.json({ error: "客户不存在" }, { status: 400 });
    }

    const projectSourceId = await generateProjectSourceId();

    const lead = await prisma.projectLead.create({
      data: {
        projectSourceId,
        customerId,
        projectName: projectName.trim(),
        location: location?.trim() || null,
        estimatedInvestment: estimatedInvestment ? parseFloat(estimatedInvestment) : null,
        bidReleaseTime: bidReleaseTime ? new Date(bidReleaseTime) : null,
        infoSource: infoSource?.trim() || null,
        currentStatus: currentStatus || "潜在",
        followUpRecords: followUpRecords || [],
        competitorInfo: competitorInfo || [],
      },
      include: {
        customer: { select: { id: true, name: true, industryType: true } },
      },
    });

    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (error) {
    console.error("创建项目线索失败:", error);
    return NextResponse.json({ error: "创建项目线索失败" }, { status: 500 });
  }
}

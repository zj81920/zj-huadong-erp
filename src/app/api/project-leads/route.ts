import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkReadPermission } from "@/lib/permission-check";

async function generateProjectSourceId(): Promise<string> {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PJ-${year}-${timestamp}${random}`;
}

export async function GET(request: NextRequest) {
  try {
    const { canReadAll, userId } = await checkReadPermission("project_leads")
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
        { implementationEntity: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { project: { projectCode: { contains: search, mode: "insensitive" } } },
        { project: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status) {
      where.currentStatus = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    // 权限过滤
    if (!canReadAll && userId) {
      where.createdById = userId;
    }

    const [leads, total] = await Promise.all([
      prisma.projectLead.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, industryType: true } },
          project: { select: { id: true, projectCode: true, name: true, status: true, projectCategory: true } },
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
    const currentUser = await getCurrentUser();
    const {
      customerId,
      projectName,
      location,
      contactPerson,
      contactPhone,
      contactEmail,
      projectNature,
      implementationEntity,
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
    if (!projectNature || !Array.isArray(projectNature) || projectNature.length === 0) {
      return NextResponse.json({ error: "请选择项目性质" }, { status: 400 });
    }
    if (!implementationEntity || !implementationEntity.trim()) {
      return NextResponse.json({ error: "请选择实施主体" }, { status: 400 });
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
        contactPerson: contactPerson?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        projectNature: projectNature || [],
        implementationEntity: implementationEntity.trim(),
        currentStatus: currentStatus || "跟踪中",
        followUpRecords: followUpRecords || [],
        competitorInfo: competitorInfo || [],
        lastModifiedBy: currentUser?.realName || null,
        createdById: currentUser?.id || null,
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

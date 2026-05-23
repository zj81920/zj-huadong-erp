import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

async function generateProjectSourceId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PJ-${year}-`;

  const lastProject = await prisma.project.findFirst({
    where: { projectSourceId: { startsWith: prefix } },
    orderBy: { projectSourceId: "desc" },
    select: { projectSourceId: true },
  });

  let nextNum = 1;
  if (lastProject) {
    const parts = lastProject.projectSourceId.split("-");
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
    const type = searchParams.get("type") || "";
    const projectCategory = searchParams.get("projectCategory") || "";
    const source = searchParams.get("source") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { projectSourceId: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { projectCode: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (projectCategory) {
      where.projectCategory = projectCategory;
    }

    if (source) {
      where.source = source;
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, industryType: true } },
          projectLead: { select: { projectSourceId: true, projectName: true, currentStatus: true } },
          designManager: { select: { id: true, realName: true } },
          supervisorLeader: { select: { id: true, realName: true } },
          _count: { select: { plans: true, designTasks: true, outsourcingTasks: true, purchaseRequests: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.project.count({ where }),
    ]);

    return NextResponse.json({
      data: projects,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取项目列表失败:", error);
    return NextResponse.json({ error: "获取项目列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectCode,
      name,
      customerId,
      type,
      address,
      projectCategory,
      source,
      status,
      designManagerId,
      supervisorLeaderId,
      startDate,
      plannedEndDate,
      actualCloseDate,
    } = body;

    if (!projectCode || !projectCode.trim()) {
      return NextResponse.json({ error: "项目编号不能为空" }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 });
    }
    if (!customerId) {
      return NextResponse.json({ error: "请选择客户" }, { status: 400 });
    }

    const existingCode = await prisma.project.findUnique({
      where: { projectCode: projectCode.trim() },
    });
    if (existingCode) {
      return NextResponse.json({ error: "项目编号已存在" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || !customer.isActive) {
      return NextResponse.json({ error: "客户不存在或已停用" }, { status: 400 });
    }

    let projectSourceId: string;
    let sourceRefId: string | null = null;
    const projectSource = source || "投标中标";

    if (projectSource === "投标中标") {
      const { projectSourceId: leadSourceId, biddingId } = body;
      if (!leadSourceId) {
        return NextResponse.json({ error: "中标项目必须关联项目线索" }, { status: 400 });
      }

      const lead = await prisma.projectLead.findUnique({
        where: { projectSourceId: leadSourceId },
      });
      if (!lead) {
        return NextResponse.json({ error: "项目线索不存在" }, { status: 400 });
      }
      if (lead.currentStatus !== "中标") {
        return NextResponse.json({ error: "该项目线索尚未中标" }, { status: 400 });
      }

      const existingProject = await prisma.project.findUnique({
        where: { projectSourceId: leadSourceId },
      });
      if (existingProject) {
        return NextResponse.json({ error: "该项目线索已创建项目" }, { status: 400 });
      }

      projectSourceId = leadSourceId;
      sourceRefId = biddingId || null;
    } else if (projectSource === "商务报价") {
      const { quotationId } = body;
      if (!quotationId) {
        return NextResponse.json({ error: "商务报价项目必须关联报价单" }, { status: 400 });
      }

      const quotation = await prisma.quotation.findUnique({
        where: { id: quotationId },
        include: { projectLead: { select: { projectSourceId: true } } },
      });
      if (!quotation) {
        return NextResponse.json({ error: "报价单不存在" }, { status: 400 });
      }

      if (!quotation.projectSourceId || !quotation.projectLead) {
        return NextResponse.json({ error: "该报价单未关联项目线索" }, { status: 400 });
      }

      const leadSourceId = quotation.projectLead.projectSourceId;

      const existingProject = await prisma.project.findUnique({
        where: { projectSourceId: leadSourceId },
      });
      if (existingProject) {
        return NextResponse.json({ error: "该项目线索已创建项目" }, { status: 400 });
      }

      projectSourceId = leadSourceId;
      sourceRefId = quotationId;
    } else if (projectSource === "直接授予") {
      projectSourceId = await generateProjectSourceId();
    } else {
      return NextResponse.json({ error: "无效的项目来源" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        projectSourceId,
        projectCode: projectCode.trim(),
        name: name.trim(),
        customerId,
        type: type?.trim() || null,
        address: address?.trim() || null,
        projectCategory: projectCategory?.trim() || null,
        source: projectSource,
        sourceRefId: sourceRefId || null,
        status: status || "筹备",
        designManagerId: designManagerId || null,
        supervisorLeaderId: supervisorLeaderId || null,
        startDate: startDate ? new Date(startDate) : null,
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
        actualCloseDate: actualCloseDate ? new Date(actualCloseDate) : null,
      },
      include: {
        customer: { select: { id: true, name: true, industryType: true } },
        projectLead: { select: { projectSourceId: true, projectName: true, currentStatus: true } },
        designManager: { select: { id: true, realName: true } },
        supervisorLeader: { select: { id: true, realName: true } },
      },
    });

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (error) {
    console.error("创建项目失败:", error);
    return NextResponse.json({ error: "创建项目失败" }, { status: 500 });
  }
}

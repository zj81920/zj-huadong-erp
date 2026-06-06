import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkReadPermission } from "@/lib/permission-check";

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
    const { canReadAll, userId } = await checkReadPermission("projects_list")
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

    // 权限过滤
    if (!canReadAll && userId) {
      where.createdById = userId;
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
    const currentUser = await getCurrentUser();
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

    const existingName = await prisma.project.findUnique({
      where: { name: name.trim() },
    });
    if (existingName) {
      return NextResponse.json({ error: "项目名称已存在" }, { status: 409 });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || !customer.isActive) {
      return NextResponse.json({ error: "客户不存在或已停用" }, { status: 400 });
    }

    let projectSourceId: string;
    let sourceRefId: string | null = null;
    const projectSource = source || "项目线索";

    if (projectSource === "项目线索") {
      const { projectSourceId: leadSourceId } = body;
      if (!leadSourceId) {
        return NextResponse.json({ error: "必须选择项目线索" }, { status: 400 });
      }

      const lead = await prisma.projectLead.findUnique({
        where: { projectSourceId: leadSourceId },
      });
      if (!lead) {
        return NextResponse.json({ error: "项目线索不存在" }, { status: 400 });
      }
      if (lead.currentStatus !== "已中标" && lead.currentStatus !== "落地") {
        return NextResponse.json({ error: "只能选择已中标或落地状态的项目线索" }, { status: 400 });
      }

      const existingProject = await prisma.project.findUnique({
        where: { projectSourceId: leadSourceId },
      });
      if (existingProject) {
        return NextResponse.json({ error: "该项目线索已创建项目" }, { status: 400 });
      }

      projectSourceId = leadSourceId;

      await prisma.projectLead.update({
        where: { projectSourceId: leadSourceId },
        data: { currentStatus: "已立项", projectName: name.trim() },
      });
    } else if (projectSource === "直接委托") {
      const lastLead = await prisma.projectLead.findFirst({
        where: { projectSourceId: { startsWith: `PJ-${new Date().getFullYear()}-` } },
        orderBy: { projectSourceId: "desc" },
        select: { projectSourceId: true },
      });

      const lastProject = await prisma.project.findFirst({
        where: { projectSourceId: { startsWith: `PJ-${new Date().getFullYear()}-` } },
        orderBy: { projectSourceId: "desc" },
        select: { projectSourceId: true },
      });

      let nextNum = 1;
      const candidates = [lastLead?.projectSourceId, lastProject?.projectSourceId].filter(Boolean) as string[];
      for (const candidate of candidates) {
        const parts = candidate.split("-");
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum) && lastNum >= nextNum) {
          nextNum = lastNum + 1;
        }
      }

      projectSourceId = `PJ-${new Date().getFullYear()}-${String(nextNum).padStart(4, "0")}`;

      await prisma.projectLead.create({
        data: {
          projectSourceId,
          customerId,
          projectName: name.trim(),
          location: body.location?.trim() || null,
          implementationEntity: body.implementationEntity?.trim() || "华东工程",
          currentStatus: "已立项",
          createdById: currentUser?.id || null,
        },
      });
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
        status: status || "执行",
        designManagerId: designManagerId || null,
        supervisorLeaderId: supervisorLeaderId || null,
        startDate: startDate ? new Date(startDate) : null,
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
        actualCloseDate: actualCloseDate ? new Date(actualCloseDate) : null,
        lastModifiedBy: currentUser?.realName || null,
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

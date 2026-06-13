import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkReadPermission } from "@/lib/permission-check";
import { syncProjectToDS } from "@/lib/project-sync";

async function generateProjectSourceId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PJ-${year}-`;

  const projects = await prisma.project.findMany({
    where: { projectSourceId: { startsWith: prefix } },
    select: { projectSourceId: true },
  });

  let nextNum = 1;
  for (const p of projects) {
    const suffix = p.projectSourceId.slice(prefix.length);
    const num = parseInt(suffix, 10);
    if (!isNaN(num) && num >= nextNum) {
      nextNum = num + 1;
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
          customer: { select: { id: true, name: true, ownershipType: true } },
          projectLead: { select: { projectSourceId: true, projectName: true, currentStatus: true } },
          designManager: { select: { id: true, realName: true } },
          supervisorLeader: { select: { id: true, realName: true } },
          _count: { select: { wbsNodes: true, designTasks: true, outsourcingTasks: true, purchaseRequests: true } },
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
      projectContent,
      address,
      projectCategory,
      source,
      status,
      designManagerId,
      supervisorLeaderId,
      startDate,
      plannedEndDate,
      actualCloseDate,
      designPhases,
      contactPerson,
      contactPhone,
      contactEmail,
      implementationEntity,
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
    if (!startDate) {
      return NextResponse.json({ error: "计划开始时间不能为空" }, { status: 400 });
    }
    if (!plannedEndDate) {
      return NextResponse.json({ error: "计划完成时间不能为空" }, { status: 400 });
    }
    if (!projectContent || !projectContent.trim()) {
      return NextResponse.json({ error: "项目内容描述不能为空" }, { status: 400 });
    }
    if (!address || !address.trim()) {
      return NextResponse.json({ error: "地址不能为空" }, { status: 400 });
    }
    if (!projectCategory) {
      return NextResponse.json({ error: "请选择类别" }, { status: 400 });
    }
    if (!designPhases) {
      return NextResponse.json({ error: "请选择设计阶段" }, { status: 400 });
    }
    if (!designManagerId) {
      return NextResponse.json({ error: "请选择设计经理" }, { status: 400 });
    }
    if (!supervisorLeaderId) {
      return NextResponse.json({ error: "请选择主管领导" }, { status: 400 });
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
      const year = new Date().getFullYear();
      const prefix = `PJ-${year}-`;

      // 查询所有匹配前缀的编号，遍历找最大数字（排除 cuid 格式的编号）
      const [leads, projects] = await Promise.all([
        prisma.projectLead.findMany({
          where: { projectSourceId: { startsWith: prefix } },
          select: { projectSourceId: true },
        }),
        prisma.project.findMany({
          where: { projectSourceId: { startsWith: prefix } },
          select: { projectSourceId: true },
        }),
      ]);

      let nextNum = 1;
      const allIds = [...leads.map(l => l.projectSourceId), ...projects.map(p => p.projectSourceId)];
      for (const id of allIds) {
        const suffix = id.slice(prefix.length);
        const num = parseInt(suffix, 10);
        if (!isNaN(num) && num >= nextNum) {
          nextNum = num + 1;
        }
      }

      projectSourceId = `${prefix}${String(nextNum).padStart(4, "0")}`;

      await prisma.projectLead.create({
        data: {
          projectSourceId,
          customerId,
          projectName: name.trim(),
          location: address?.trim() || null,
          contactPerson: contactPerson?.trim() || null,
          contactPhone: contactPhone?.trim() || null,
          contactEmail: contactEmail?.trim() || null,
          projectNature: projectCategory?.trim() || null,
          implementationEntity: implementationEntity?.trim() || "华东工程",
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
        projectContent: projectContent?.trim() || null,
        address: address?.trim() || null,
        projectCategory: projectCategory?.trim() || null,
        source: projectSource,
        sourceRefId: sourceRefId || null,
        designPhases: designPhases || null,
        status: status || "执行",
        designManagerId: designManagerId || null,
        supervisorLeaderId: supervisorLeaderId || null,
        startDate: startDate ? new Date(startDate) : null,
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
        lastModifiedBy: currentUser?.realName || null,
        createdById: currentUser?.id || null,
      },
      include: {
        customer: { select: { id: true, name: true, ownershipType: true } },
        projectLead: { select: { projectSourceId: true, projectName: true, currentStatus: true } },
        designManager: { select: { id: true, realName: true } },
        supervisorLeader: { select: { id: true, realName: true } },
      },
    });

    // 如果勾选了设计阶段，自动创建一级WBS节点
    if (designPhases) {
      try {
        const phases: string[] = JSON.parse(designPhases);
        if (phases.length > 0) {
          await prisma.projectWbsNode.createMany({
            data: phases.map((phaseName, index) => ({
              projectSourceId: project.projectSourceId,
              level: 1,
              name: phaseName,
              sortOrder: index,
            })),
          });
        }
      } catch {
        // designPhases 解析失败不影响项目创建
      }
    }

    // 检查 DS 同步开关
    let shouldSyncToDS = true;
    try {
      const dsSetting = await prisma.systemSetting.findUnique({
        where: { key: "ds_sync_disabled" },
      });
      if (dsSetting?.value === "true") {
        shouldSyncToDS = false;
      }
    } catch {
      // 查询失败默认同步
    }

    // 同步到 DS 系统
    if (shouldSyncToDS) {
      const syncResult = await syncProjectToDS({
        id: project.id,
        projectCode: project.projectCode,
        name: project.name,
        projectContent: project.projectContent,
        status: project.status,
        dsProjectCode: project.dsProjectCode,
        customerId: project.customerId,
        address: project.address,
        designManagerId: project.designManagerId,
        supervisorLeaderId: project.supervisorLeaderId,
        designPhases: project.designPhases,
      });

      // 如果创建成功，回写 dsProjectCode
      if (syncResult.success && syncResult.dsCode) {
        await prisma.project.update({
          where: { id: project.id },
          data: { dsProjectCode: syncResult.dsCode },
        });
        project.dsProjectCode = syncResult.dsCode;
      } else {
        console.warn("[project-sync] 首次同步失败，将在下次编辑时重试");
      }
    }

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (error) {
    console.error("创建项目失败:", error);
    return NextResponse.json({ error: "创建项目失败" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { canAccessProjectWbs, canEditProjectWbs } from "@/lib/wbs-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectSourceId: string }> }
) {
  try {
    const { projectSourceId } = await params;
    const authorized = await canAccessProjectWbs(projectSourceId);
    if (!authorized) return NextResponse.json({ error: "无权查看" }, { status: 403 });

    const nodes = await prisma.projectWbsNode.findMany({
      where: { projectSourceId },
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json({ data: nodes });
  } catch (error) {
    console.error("获取 WBS 节点失败:", error);
    return NextResponse.json({ error: "获取 WBS 节点失败" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectSourceId: string }> }
) {
  try {
    const { projectSourceId } = await params;
    const authorized = await canEditProjectWbs(projectSourceId);
    if (!authorized) return NextResponse.json({ error: "无权操作" }, { status: 403 });

    const body = await request.json();
    const { parentId, name, level, disciplineId, isMilestone, planStartDate, planEndDate, responsibleIds } = body;

    // 一级节点保护：不允许通过 API 手动创建
    if (level === 1) {
      return NextResponse.json({ error: "一级节点由项目创建时自动生成，不可手动添加" }, { status: 400 });
    }

    // 三级节点必选专业
    if (level === 3 && !disciplineId) {
      return NextResponse.json({ error: "三级节点必须选择专业" }, { status: 400 });
    }

    // 校验同一子项下不允许重复专业
    if (level === 3 && disciplineId) {
      const existing = await prisma.projectWbsNode.findFirst({
        where: {
          projectSourceId,
          parentId: parentId || null,
          level: 3,
          disciplineId,
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: "该子项下已存在相同专业，不允许重复创建" },
          { status: 409 }
        );
      }
    }

    // 四级节点计划时间校验：必须在项目计划时间范围内
    if (level === 4 && planStartDate && planEndDate) {
      const project = await prisma.project.findUnique({
        where: { projectSourceId },
        select: { startDate: true, plannedEndDate: true },
      });
      if (project?.startDate && new Date(planStartDate) < project.startDate) {
        return NextResponse.json({ error: "计划开始时间不能早于项目启动时间" }, { status: 400 });
      }
      if (project?.plannedEndDate && new Date(planEndDate) > project.plannedEndDate) {
        return NextResponse.json({ error: "计划结束时间不能晚于项目计划完成时间" }, { status: 400 });
      }
    }

    // 计算 sortOrder
    const maxSort = await prisma.projectWbsNode.findFirst({
      where: { projectSourceId, parentId: parentId || null, level },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const node = await prisma.projectWbsNode.create({
      data: {
        projectSourceId,
        parentId: parentId || null,
        name,
        level,
        disciplineId: level === 3 ? disciplineId : null,
        isMilestone: isMilestone || false,
        planStartDate: level === 4 && planStartDate ? new Date(planStartDate) : null,
        planEndDate: level === 4 && planEndDate ? new Date(planEndDate) : null,
        responsibleIds: responsibleIds || [],
        sortOrder: (maxSort?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json({ data: node }, { status: 201 });
  } catch (error) {
    console.error("创建 WBS 节点失败:", error);
    return NextResponse.json({ error: "创建 WBS 节点失败" }, { status: 500 });
  }
}

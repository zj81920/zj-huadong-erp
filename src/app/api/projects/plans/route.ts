import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectSourceId = searchParams.get("projectSourceId") || "";
    const planType = searchParams.get("planType") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (projectSourceId) {
      where.projectSourceId = projectSourceId;
    }

    if (planType) {
      where.planType = planType;
    }

    if (status) {
      where.status = status;
    }

    const [plans, total] = await Promise.all([
      prisma.projectPlan.findMany({
        where,
        include: {
          project: { select: { name: true, projectSourceId: true } },
          responsiblePerson: { select: { id: true, realName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.projectPlan.count({ where }),
    ]);

    return NextResponse.json({
      data: plans,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取项目计划列表失败:", error);
    return NextResponse.json({ error: "获取项目计划列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectSourceId,
      planType,
      planContent,
      startDate,
      endDate,
      responsibleId,
      actualProgress,
      status,
      version,
    } = body;

    if (!projectSourceId) {
      return NextResponse.json({ error: "请选择所属项目" }, { status: 400 });
    }
    if (!planType || !planType.trim()) {
      return NextResponse.json({ error: "计划类型不能为空" }, { status: 400 });
    }
    if (!planContent || !planContent.trim()) {
      return NextResponse.json({ error: "计划内容不能为空" }, { status: 400 });
    }
    if (!startDate) {
      return NextResponse.json({ error: "开始日期不能为空" }, { status: 400 });
    }
    if (!endDate) {
      return NextResponse.json({ error: "结束日期不能为空" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { projectSourceId },
    });
    if (!project) {
      return NextResponse.json({ error: "所属项目不存在" }, { status: 400 });
    }

    if (responsibleId) {
      const user = await prisma.user.findUnique({ where: { id: responsibleId } });
      if (!user) {
        return NextResponse.json({ error: "负责人不存在" }, { status: 400 });
      }
    }

    const plan = await prisma.projectPlan.create({
      data: {
        projectSourceId,
        planType: planType.trim(),
        planContent: planContent.trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        responsibleId: responsibleId || null,
        actualProgress: actualProgress ?? 0,
        status: status || "未开始",
        version: version ?? 1,
      },
      include: {
        project: { select: { name: true, projectSourceId: true } },
        responsiblePerson: { select: { id: true, realName: true } },
      },
    });

    return NextResponse.json({ data: plan }, { status: 201 });
  } catch (error) {
    console.error("创建项目计划失败:", error);
    return NextResponse.json({ error: "创建项目计划失败" }, { status: 500 });
  }
}

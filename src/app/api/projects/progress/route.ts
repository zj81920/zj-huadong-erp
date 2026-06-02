import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectSourceId = searchParams.get("projectSourceId") || "";
    const alertStatus = searchParams.get("alertStatus") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (projectSourceId) {
      where.projectSourceId = projectSourceId;
    }

    if (alertStatus) {
      where.alertStatus = alertStatus;
    }

    const [records, total] = await Promise.all([
      prisma.projectProgress.findMany({
        where,
        include: {
          project: { select: { name: true, projectSourceId: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.projectProgress.count({ where }),
    ]);

    return NextResponse.json({
      data: records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取项目进度列表失败:", error);
    return NextResponse.json({ error: "获取项目进度列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentUser = await getCurrentUser();
    const {
      projectSourceId,
      taskNode,
      plannedPercentage,
      actualPercentage,
      delayDays,
    } = body;

    if (!projectSourceId) {
      return NextResponse.json({ error: "请选择所属项目" }, { status: 400 });
    }
    if (!taskNode || !taskNode.trim()) {
      return NextResponse.json({ error: "任务节点不能为空" }, { status: 400 });
    }
    if (plannedPercentage === undefined || plannedPercentage === null) {
      return NextResponse.json({ error: "计划完成百分比不能为空" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { projectSourceId },
    });
    if (!project) {
      return NextResponse.json({ error: "所属项目不存在" }, { status: 400 });
    }

    const actual = actualPercentage ?? 0;
    const planned = plannedPercentage;
    const calculatedAlertStatus = actual < planned ? "滞后" : "正常";

    const record = await prisma.projectProgress.create({
      data: {
        projectSourceId,
        taskNode: taskNode.trim(),
        plannedPercentage: planned,
        actualPercentage: actual,
        delayDays: delayDays ?? 0,
        alertStatus: calculatedAlertStatus,
        lastModifiedBy: currentUser?.realName || null,
      },
      include: {
        project: { select: { name: true, projectSourceId: true } },
      },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error("创建项目进度记录失败:", error);
    return NextResponse.json({ error: "创建项目进度记录失败" }, { status: 500 });
  }
}

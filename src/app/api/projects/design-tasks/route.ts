import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectSourceId = searchParams.get("projectSourceId") || "";
    const discipline = searchParams.get("discipline") || "";
    const assignedTo = searchParams.get("assignedTo") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (projectSourceId) {
      where.projectSourceId = projectSourceId;
    }

    if (discipline) {
      where.discipline = discipline;
    }

    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    const [tasks, total] = await Promise.all([
      prisma.designTask.findMany({
        where,
        include: {
          project: { select: { name: true, projectSourceId: true } },
          assignee: { select: { id: true, realName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.designTask.count({ where }),
    ]);

    return NextResponse.json({
      data: tasks,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取设计任务列表失败:", error);
    return NextResponse.json({ error: "获取设计任务列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectSourceId,
      discipline,
      volume,
      drawingNo,
      assignedTo,
      plannedHours,
      actualHours,
      fileLink,
      changeRecord,
    } = body;

    if (!projectSourceId) {
      return NextResponse.json({ error: "请选择所属项目" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { projectSourceId },
    });
    if (!project) {
      return NextResponse.json({ error: "所属项目不存在" }, { status: 400 });
    }

    const task = await prisma.designTask.create({
      data: {
        projectSourceId,
        discipline: discipline?.trim() || null,
        volume: volume?.trim() || null,
        drawingNo: drawingNo?.trim() || null,
        assignedTo: assignedTo || null,
        plannedHours: plannedHours ? parseFloat(plannedHours) : null,
        actualHours: actualHours ? parseFloat(actualHours) : null,
        fileLink: fileLink?.trim() || null,
        changeRecord: changeRecord || [],
      },
      include: {
        project: { select: { name: true, projectSourceId: true } },
        assignee: { select: { id: true, realName: true } },
      },
    });

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    console.error("创建设计任务失败:", error);
    return NextResponse.json({ error: "创建设计任务失败" }, { status: 500 });
  }
}

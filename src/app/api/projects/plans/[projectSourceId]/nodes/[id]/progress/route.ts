import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { canEditProjectWbs } from "@/lib/wbs-auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectSourceId: string; id: string }> }
) {
  try {
    const { projectSourceId, id } = await params;
    const authorized = await canEditProjectWbs(projectSourceId);
    if (!authorized) return NextResponse.json({ error: "无权操作" }, { status: 403 });

    const body = await request.json();
    const { progress } = body;

    if (typeof progress !== "number" || progress < 0 || progress > 100) {
      return NextResponse.json({ error: "进度值非法(0-100)" }, { status: 400 });
    }

    const existing = await prisma.projectWbsNode.findFirst({
      where: { id, projectSourceId },
    });
    if (!existing) return NextResponse.json({ error: "节点不存在" }, { status: 404 });
    if (existing.level !== 4) {
      return NextResponse.json({ error: "仅4级节点(任务)支持进度填报" }, { status: 400 });
    }

    const existingProgress = existing.progress ?? 0;
    const updateData: Record<string, unknown> = { progress };

    // actualStartDate: 首次 >0% 即锁定
    if (existingProgress === 0 && progress > 0 && !existing.actualStartDate) {
      updateData.actualStartDate = new Date();
    }

    // actualEndDate: 达到 100% 记录，退回清空
    if (existingProgress !== 100 && progress === 100) {
      updateData.actualEndDate = new Date();
    } else if (existingProgress === 100 && progress !== 100) {
      updateData.actualEndDate = null;
    }

    const node = await prisma.projectWbsNode.update({
      where: { id },
      data: updateData,
    });

    // 同步更新项目级别的实际开始/完成时间（取所有 L4 节点的最早开始和最晚完成）
    const l4Nodes = await prisma.projectWbsNode.findMany({
      where: { projectSourceId, level: 4 },
      select: { actualStartDate: true, actualEndDate: true },
    });

    const startDates = l4Nodes
      .map((n) => n.actualStartDate)
      .filter((d): d is Date => d !== null);
    const endDates = l4Nodes
      .map((n) => n.actualEndDate)
      .filter((d): d is Date => d !== null);

    await prisma.project.update({
      where: { projectSourceId },
      data: {
        actualStartDate:
          startDates.length > 0
            ? new Date(Math.min(...startDates.map((d) => d.getTime())))
            : null,
        actualEndDate:
          endDates.length > 0
            ? new Date(Math.max(...endDates.map((d) => d.getTime())))
            : null,
      },
    });

    // 返回整棵树（前端自行计算状态）
    const allNodes = await prisma.projectWbsNode.findMany({
      where: { projectSourceId },
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
    });

    return NextResponse.json({ data: node, tree: allNodes });
  } catch (error) {
    console.error("填报进度失败:", error);
    return NextResponse.json({ error: "填报进度失败" }, { status: 500 });
  }
}

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

    // 只更新 progress，不再推 actualStart/End、status、delayDays
    const node = await prisma.projectWbsNode.update({
      where: { id },
      data: { progress },
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

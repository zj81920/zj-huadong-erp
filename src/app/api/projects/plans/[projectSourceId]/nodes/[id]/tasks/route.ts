import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { canEditProjectWbs } from "@/lib/wbs-auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectSourceId: string; id: string }> }
) {
  try {
    const { projectSourceId, id } = await params;
    const authorized = await canEditProjectWbs(projectSourceId);
    if (!authorized) return NextResponse.json({ error: "无权操作" }, { status: 403 });

    const parent = await prisma.projectWbsNode.findFirst({
      where: { id, projectSourceId, level: 3 },
    });
    if (!parent) return NextResponse.json({ error: "专业节点不存在" }, { status: 404 });

    const result = await prisma.projectWbsNode.deleteMany({
      where: { parentId: id, projectSourceId, level: 4 },
    });

    return NextResponse.json({ data: { deletedCount: result.count } });
  } catch (error) {
    console.error("清空任务失败:", error);
    return NextResponse.json({ error: "清空任务失败" }, { status: 500 });
  }
}

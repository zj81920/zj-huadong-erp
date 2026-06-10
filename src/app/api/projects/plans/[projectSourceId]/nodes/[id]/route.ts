import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectSourceId: string; id: string }> }
) {
  try {
    const { projectSourceId, id } = await params;
    const node = await prisma.projectWbsNode.findFirst({
      where: { id, projectSourceId },
      include: {
        responsiblePerson: { select: { id: true, realName: true } },
        children: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!node) return NextResponse.json({ error: "节点不存在" }, { status: 404 });
    return NextResponse.json({ data: node });
  } catch (error) {
    console.error("获取WBS节点失败:", error);
    return NextResponse.json({ error: "获取WBS节点失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectSourceId: string; id: string }> }
) {
  try {
    const { projectSourceId, id } = await params;
    const body = await request.json();

    const existing = await prisma.projectWbsNode.findFirst({
      where: { id, projectSourceId },
    });
    if (!existing) return NextResponse.json({ error: "节点不存在" }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    const simpleFields = ["name", "disciplineCode", "responsibleId", "status", "sortOrder", "isMilestone"];
    for (const field of simpleFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    if (body.plannedPct !== undefined) updateData.plannedPct = body.plannedPct;
    if (body.actualPct !== undefined) updateData.actualPct = body.actualPct;
    if (body.delayDays !== undefined) updateData.delayDays = body.delayDays;
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;

    // 自动计算预警状态
    if (body.actualPct !== undefined || body.plannedPct !== undefined) {
      const planned = body.plannedPct ?? existing.plannedPct;
      const actual = body.actualPct ?? existing.actualPct;
      updateData.alertStatus = actual < planned ? "滞后" : "正常";
    }

    const node = await prisma.projectWbsNode.update({
      where: { id },
      data: updateData,
      include: {
        responsiblePerson: { select: { id: true, realName: true } },
      },
    });

    return NextResponse.json({ data: node });
  } catch (error) {
    console.error("更新WBS节点失败:", error);
    return NextResponse.json({ error: "更新WBS节点失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectSourceId: string; id: string }> }
) {
  try {
    const { projectSourceId, id } = await params;
    const existing = await prisma.projectWbsNode.findFirst({
      where: { id, projectSourceId },
    });
    if (!existing) return NextResponse.json({ error: "节点不存在" }, { status: 404 });

    // 递归删除所有子节点
    const deleteRecursive = async (nodeId: string) => {
      const children = await prisma.projectWbsNode.findMany({
        where: { parentId: nodeId },
      });
      for (const child of children) {
        await deleteRecursive(child.id);
      }
      await prisma.projectWbsNode.delete({ where: { id: nodeId } });
    };

    await deleteRecursive(id);
    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除WBS节点失败:", error);
    return NextResponse.json({ error: "删除WBS节点失败" }, { status: 500 });
  }
}

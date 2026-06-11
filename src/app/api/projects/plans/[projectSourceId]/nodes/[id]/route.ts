import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { canAccessProjectWbs } from "@/lib/wbs-auth";

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

    // 一级节点不允许修改名称
    if (existing.level === 1) {
      return NextResponse.json({ error: "一级节点(阶段)不可编辑" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined && existing.level !== 1) updateData.name = body.name;
    if (body.isMilestone !== undefined) updateData.isMilestone = body.isMilestone;
    if (body.responsibleId !== undefined) updateData.responsibleId = body.responsibleId;
    if (body.actualStartDate !== undefined) {
      updateData.actualStartDate = body.actualStartDate ? new Date(body.actualStartDate) : null;
    }
    if (body.actualEndDate !== undefined) {
      updateData.actualEndDate = body.actualEndDate ? new Date(body.actualEndDate) : null;
    }

    // 四级节点可编辑计划时间和实际时间
    if (existing.level === 4) {
      if (body.planStartDate !== undefined) updateData.planStartDate = body.planStartDate ? new Date(body.planStartDate) : null;
      if (body.planEndDate !== undefined) updateData.planEndDate = body.planEndDate ? new Date(body.planEndDate) : null;
    }

    const node = await prisma.projectWbsNode.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: node });
  } catch (error) {
    console.error("编辑 WBS 节点失败:", error);
    return NextResponse.json({ error: "编辑 WBS 节点失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectSourceId: string; id: string }> }
) {
  try {
    const { projectSourceId, id } = await params;
    const authorized = await canAccessProjectWbs(projectSourceId);
    if (!authorized) return NextResponse.json({ error: "无权操作" }, { status: 403 });

    const existing = await prisma.projectWbsNode.findFirst({
      where: { id, projectSourceId },
    });
    if (!existing) return NextResponse.json({ error: "节点不存在" }, { status: 404 });

    // 一级节点禁止删除
    if (existing.level === 1) {
      return NextResponse.json({ error: "一级节点(阶段)不可删除" }, { status: 400 });
    }

    // 级联删除子节点
    async function deleteChildren(parentId: string) {
      const children = await prisma.projectWbsNode.findMany({ where: { parentId } });
      for (const child of children) {
        await deleteChildren(child.id);
      }
      await prisma.projectWbsNode.deleteMany({ where: { parentId } });
    }
    await deleteChildren(id);
    await prisma.projectWbsNode.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除 WBS 节点失败:", error);
    return NextResponse.json({ error: "删除 WBS 节点失败" }, { status: 500 });
  }
}

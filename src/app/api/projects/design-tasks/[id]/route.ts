import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await prisma.designTask.findUnique({
      where: { id },
      include: {
        project: { select: { name: true, projectSourceId: true } },
        assignee: { select: { id: true, realName: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "设计任务不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: task });
  } catch (error) {
    console.error("获取设计任务详情失败:", error);
    return NextResponse.json({ error: "获取设计任务详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.designTask.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "设计任务不存在" }, { status: 404 });
    }

    const {
      discipline,
      volume,
      drawingNo,
      assignedTo,
      plannedHours,
      actualHours,
      fileLink,
      changeRecord,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (discipline !== undefined) updateData.discipline = discipline?.trim() || null;
    if (volume !== undefined) updateData.volume = volume?.trim() || null;
    if (drawingNo !== undefined) updateData.drawingNo = drawingNo?.trim() || null;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo || null;
    if (plannedHours !== undefined) updateData.plannedHours = plannedHours ? parseFloat(plannedHours) : null;
    if (actualHours !== undefined) updateData.actualHours = actualHours ? parseFloat(actualHours) : null;
    if (fileLink !== undefined) updateData.fileLink = fileLink?.trim() || null;
    if (changeRecord !== undefined) updateData.changeRecord = changeRecord;

    const task = await prisma.designTask.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { name: true, projectSourceId: true } },
        assignee: { select: { id: true, realName: true } },
      },
    });

    return NextResponse.json({ data: task });
  } catch (error) {
    console.error("更新设计任务失败:", error);
    return NextResponse.json({ error: "更新设计任务失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.designTask.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "设计任务不存在" }, { status: 404 });
    }

    await prisma.designTask.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除设计任务失败:", error);
    return NextResponse.json({ error: "删除设计任务失败" }, { status: 500 });
  }
}

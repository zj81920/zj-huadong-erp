import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const record = await prisma.projectProgress.findUnique({
      where: { id },
      include: {
        project: { select: { name: true, projectSourceId: true } },
      },
    });

    if (!record) {
      return NextResponse.json({ error: "进度记录不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("获取进度记录详情失败:", error);
    return NextResponse.json({ error: "获取进度记录详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.projectProgress.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "进度记录不存在" }, { status: 404 });
    }

    const {
      taskNode,
      plannedPercentage,
      actualPercentage,
      delayDays,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (taskNode !== undefined) updateData.taskNode = taskNode.trim();
    if (plannedPercentage !== undefined) updateData.plannedPercentage = plannedPercentage;
    if (actualPercentage !== undefined) updateData.actualPercentage = actualPercentage;
    if (delayDays !== undefined) updateData.delayDays = delayDays;

    const planned = plannedPercentage !== undefined ? plannedPercentage : existing.plannedPercentage;
    const actual = actualPercentage !== undefined ? actualPercentage : existing.actualPercentage;
    updateData.alertStatus = actual < planned ? "滞后" : "正常";

    const record = await prisma.projectProgress.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { name: true, projectSourceId: true } },
      },
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("更新进度记录失败:", error);
    return NextResponse.json({ error: "更新进度记录失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.projectProgress.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "进度记录不存在" }, { status: 404 });
    }

    await prisma.projectProgress.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除进度记录失败:", error);
    return NextResponse.json({ error: "删除进度记录失败" }, { status: 500 });
  }
}

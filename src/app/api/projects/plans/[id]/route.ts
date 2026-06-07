import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const plan = await prisma.projectPlan.findUnique({
      where: { id },
      include: {
        project: { select: { name: true, projectSourceId: true } },
        responsiblePerson: { select: { id: true, realName: true } },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "项目计划不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: plan });
  } catch (error) {
    console.error("获取项目计划详情失败:", error);
    return NextResponse.json({ error: "获取项目计划详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.projectPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "项目计划不存在" }, { status: 404 });
    }

    const {
      planType,
      planContent,
      startDate,
      endDate,
      responsibleId,
      actualProgress,
      status,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (planType !== undefined) updateData.planType = planType.trim();
    if (planContent !== undefined) updateData.planContent = planContent.trim();
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (responsibleId !== undefined) updateData.responsibleId = responsibleId || null;
    if (actualProgress !== undefined) updateData.actualProgress = actualProgress;
    if (status !== undefined) updateData.status = status;

    const plan = await prisma.projectPlan.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { name: true, projectSourceId: true } },
        responsiblePerson: { select: { id: true, realName: true } },
      },
    });

    return NextResponse.json({ data: plan });
  } catch (error) {
    console.error("更新项目计划失败:", error);
    return NextResponse.json({ error: "更新项目计划失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.projectPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "项目计划不存在" }, { status: 404 });
    }

    await cleanupBusinessApprovalRecords("project_plan", id);
    await prisma.projectPlan.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除项目计划失败:", error);
    return NextResponse.json({ error: "删除项目计划失败" }, { status: 500 });
  }
}

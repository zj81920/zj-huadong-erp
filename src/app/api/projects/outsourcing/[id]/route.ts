import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await prisma.outsourcingTask.findUnique({
      where: { id },
      include: {
        project: { select: { name: true, projectSourceId: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "外包任务不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: task });
  } catch (error) {
    console.error("获取外包任务详情失败:", error);
    return NextResponse.json({ error: "获取外包任务详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.outsourcingTask.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "外包任务不存在" }, { status: 404 });
    }

    const {
      type,
      targetName,
      contractId,
      taskDescription,
      workload,
      deliveryDeadline,
      amount,
      acceptanceStatus,
      approvalStatus,
      approvalInstanceId,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (type !== undefined) updateData.type = type;
    if (targetName !== undefined) updateData.targetName = targetName.trim();
    if (contractId !== undefined) updateData.contractId = contractId || null;
    if (taskDescription !== undefined) updateData.taskDescription = taskDescription.trim();
    if (workload !== undefined) updateData.workload = workload?.trim() || null;
    if (deliveryDeadline !== undefined) updateData.deliveryDeadline = new Date(deliveryDeadline);
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (acceptanceStatus !== undefined) updateData.acceptanceStatus = acceptanceStatus;
    if (approvalStatus !== undefined) updateData.approvalStatus = approvalStatus;
    if (approvalInstanceId !== undefined) updateData.approvalInstanceId = approvalInstanceId || null;

    const task = await prisma.outsourcingTask.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { name: true, projectSourceId: true } },
      },
    });

    return NextResponse.json({ data: task });
  } catch (error) {
    console.error("更新外包任务失败:", error);
    return NextResponse.json({ error: "更新外包任务失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.outsourcingTask.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "外包任务不存在" }, { status: 404 });
    }

    await prisma.outsourcingTask.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除外包任务失败:", error);
    return NextResponse.json({ error: "删除外包任务失败" }, { status: 500 });
  }
}

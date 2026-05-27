import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectSourceId = searchParams.get("projectSourceId") || "";
    const type = searchParams.get("type") || "";
    const acceptanceStatus = searchParams.get("acceptanceStatus") || "";
    const approvalStatus = searchParams.get("approvalStatus") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (projectSourceId) {
      where.projectSourceId = projectSourceId;
    }

    if (type) {
      where.type = type;
    }

    if (acceptanceStatus) {
      where.acceptanceStatus = acceptanceStatus;
    }

    if (approvalStatus) {
      where.approvalStatus = approvalStatus;
    }

    const [tasks, total] = await Promise.all([
      prisma.outsourcingTask.findMany({
        where,
        include: {
          project: { select: { name: true, projectSourceId: true } },
          supplier: { select: { id: true, name: true, supplierType: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.outsourcingTask.count({ where }),
    ]);

    return NextResponse.json({
      data: tasks,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取外包任务列表失败:", error);
    return NextResponse.json({ error: "获取外包任务列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectSourceId,
      type,
      targetName,
      supplierId,
      contractId,
      taskDescription,
      workload,
      deliveryDeadline,
      amount,
      acceptanceStatus,
      approvalStatus,
    } = body;

    if (!projectSourceId) {
      return NextResponse.json({ error: "请选择所属项目" }, { status: 400 });
    }

    let resolvedTargetName = targetName?.trim() || "";
    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (supplier) {
        resolvedTargetName = supplier.name;
      }
    }

    if (!resolvedTargetName) {
      return NextResponse.json({ error: "外包对象名称不能为空" }, { status: 400 });
    }
    if (!taskDescription || !taskDescription.trim()) {
      return NextResponse.json({ error: "任务描述不能为空" }, { status: 400 });
    }
    if (!deliveryDeadline) {
      return NextResponse.json({ error: "交付截止日期不能为空" }, { status: 400 });
    }
    if (amount === undefined || amount === null) {
      return NextResponse.json({ error: "金额不能为空" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { projectSourceId },
    });
    if (!project) {
      return NextResponse.json({ error: "所属项目不存在" }, { status: 400 });
    }

    const taskType = type || "to_person";

    const task = await prisma.outsourcingTask.create({
      data: {
        projectSourceId,
        type: taskType,
        targetName: resolvedTargetName,
        supplierId: supplierId || null,
        contractId: contractId || null,
        taskDescription: taskDescription.trim(),
        workload: workload?.trim() || null,
        deliveryDeadline: new Date(deliveryDeadline),
        amount: parseFloat(amount),
        acceptanceStatus: acceptanceStatus || "未验收",
        approvalStatus: approvalStatus || "草稿",
        approvalInstanceId: body.approvalInstanceId || null,
      },
      include: {
        project: { select: { name: true, projectSourceId: true } },
        supplier: { select: { id: true, name: true, supplierType: true } },
      },
    });

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    console.error("创建外包任务失败:", error);
    return NextResponse.json({ error: "创建外包任务失败" }, { status: 500 });
  }
}

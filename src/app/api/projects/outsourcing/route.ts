import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkReadPermission } from "@/lib/permission-check";

export async function GET(request: NextRequest) {
  try {
    const { canReadAll, userId } = await checkReadPermission("outsourcing")
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

    // 权限过滤
    if (!canReadAll && userId) {
      where.createdById = userId;
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
    const currentUser = await getCurrentUser();
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
      wbsItems,
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
    // 根据 wbsItems 自动计算汇总值
    let computedDescription = taskDescription?.trim() || "";
    let computedAmount = amount !== undefined && amount !== null ? parseFloat(amount) : 0;
    let computedDeadline = deliveryDeadline ? new Date(deliveryDeadline) : null;

    if (Array.isArray(wbsItems) && wbsItems.length > 0) {
      const wbsNodeIds = wbsItems.map((item: Record<string, unknown>) => item.wbsNodeId as string);
      const wbsNodes = await prisma.projectWbsNode.findMany({
        where: { id: { in: wbsNodeIds } },
        select: { id: true, name: true, planEndDate: true },
      });
      const nodeMap = new Map(wbsNodes.map((n) => [n.id, n]));

      // 任务描述：WBS 任务名拼接
      if (!computedDescription) {
        computedDescription = wbsItems
          .map((item: Record<string, unknown>) => nodeMap.get(item.wbsNodeId as string)?.name || "")
          .filter(Boolean)
          .join(" / ");
      }

      // 金额：汇总 subtotal
      if (!amount && amount !== 0) {
        computedAmount = wbsItems.reduce((sum: number, item: Record<string, unknown>) => {
          const wl = parseFloat(String(item.workload)) || 0;
          const up = parseFloat(String(item.unitPrice)) || 0;
          return sum + wl * up;
        }, 0);
      }

      // 截止日：取最早 planEndDate
      if (!deliveryDeadline && wbsNodes.length > 0) {
        const dates = wbsNodes
          .map((n) => n.planEndDate)
          .filter((d): d is Date => d !== null);
        if (dates.length > 0) {
          computedDeadline = new Date(Math.min(...dates.map((d) => d.getTime())));
        }
      }
    }

    if (!computedDescription) {
      return NextResponse.json({ error: "任务描述不能为空" }, { status: 400 });
    }
    if (!computedDeadline) {
      return NextResponse.json({ error: "交付截止日期不能为空" }, { status: 400 });
    }
    if (computedAmount === 0 && (!wbsItems || wbsItems.length === 0)) {
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
        taskDescription: computedDescription,
        workload: workload?.trim() || null,
        deliveryDeadline: computedDeadline,
        amount: computedAmount,
        acceptanceStatus: acceptanceStatus || "未验收",
        approvalStatus: approvalStatus || "草稿",
        approvalInstanceId: body.approvalInstanceId || null,
        createdById: currentUser?.id || null,
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

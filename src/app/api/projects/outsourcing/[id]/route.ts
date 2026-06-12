import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkDeletePermission, checkEditPermission } from "@/lib/permission-check";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

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
        supplier: { select: { id: true, name: true, supplierType: true } },
        wbsItems: {
          include: {
            wbsNode: { select: { id: true, name: true, planEndDate: true } },
          },
        },
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

    const existing = await prisma.outsourcingTask.findUnique({
      where: { id },
      include: { wbsItems: { select: { wbsNodeId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "外包任务不存在" }, { status: 404 });
    }

    const editCheck = await checkEditPermission("outsourcing", undefined, existing.approvalStatus, existing.createdById);
    if (!editCheck.allowed) {
      return NextResponse.json({ error: editCheck.error }, { status: 403 });
    }

    const {
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
      approvalInstanceId,
      wbsItems: incomingWbsItems,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (type !== undefined) updateData.type = type;
    if (targetName !== undefined) updateData.targetName = targetName.trim();
    if (supplierId !== undefined) {
      updateData.supplierId = supplierId || null;
      if (supplierId) {
        const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
        if (supplier) updateData.targetName = supplier.name;
      }
    }
    if (contractId !== undefined) updateData.contractId = contractId || null;
    if (taskDescription !== undefined) updateData.taskDescription = taskDescription.trim();
    if (workload !== undefined) updateData.workload = workload?.trim() || null;
    if (deliveryDeadline !== undefined) updateData.deliveryDeadline = new Date(deliveryDeadline);
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (acceptanceStatus !== undefined) updateData.acceptanceStatus = acceptanceStatus;
    if (approvalStatus !== undefined) updateData.approvalStatus = approvalStatus;
    if (approvalInstanceId !== undefined) updateData.approvalInstanceId = approvalInstanceId || null;

    // wbsItems 自动汇总（仅草稿/已驳回状态允许修改）
    const canEditWbs = existing.approvalStatus === "草稿" || existing.approvalStatus === "已驳回";
    if (incomingWbsItems !== undefined && canEditWbs && Array.isArray(incomingWbsItems) && incomingWbsItems.length > 0) {
      const wbsNodeIds = incomingWbsItems.map((item: Record<string, unknown>) => item.wbsNodeId as string);
      const wbsNodes = await prisma.projectWbsNode.findMany({
        where: { id: { in: wbsNodeIds } },
        select: { id: true, name: true, planEndDate: true },
      });
      const nodeMap = new Map(wbsNodes.map((n) => [n.id, n]));

      // 任务描述自动拼接
      if (taskDescription === undefined) {
        updateData.taskDescription = incomingWbsItems
          .map((item: Record<string, unknown>) => nodeMap.get(item.wbsNodeId as string)?.name || "")
          .filter(Boolean)
          .join(" / ");
      }

      // 金额自动汇总
      if (amount === undefined) {
        updateData.amount = incomingWbsItems.reduce((sum: number, item: Record<string, unknown>) => {
          const wl = parseFloat(String(item.workload)) || 0;
          const up = parseFloat(String(item.unitPrice)) || 0;
          return sum + wl * up;
        }, 0);
      }

      // 截止日自动取最早
      if (deliveryDeadline === undefined && wbsNodes.length > 0) {
        const dates = wbsNodes
          .map((n) => n.planEndDate)
          .filter((d): d is Date => d !== null);
        if (dates.length > 0) {
          updateData.deliveryDeadline = new Date(Math.min(...dates.map((d) => d.getTime())));
        }
      }
    }

    // 分包公司：审批通过时自动生成支出合同草稿并回填 contractId
    const taskType = (updateData.type as string) || existing.type;
    const newApprovalStatus = updateData.approvalStatus as string | undefined;
    const isApprovalApproved = newApprovalStatus === "已批准" && existing.approvalStatus !== "已批准";

    // 分包个人：验收通过时自动创建应付记录
    const newAcceptanceStatus = updateData.acceptanceStatus as string | undefined;
    const isAcceptanceApproved = newAcceptanceStatus === "已验收" && existing.acceptanceStatus !== "已验收";

    const result = await prisma.$transaction(async (tx) => {
      // 分包公司 + 审批通过 → 自动创建支出合同草稿
      if (isApprovalApproved && taskType === "to_company" && !existing.contractId) {
        const now = new Date();
        const contractNo = `OUT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;

        const taskAmount = updateData.amount !== undefined
          ? parseFloat(updateData.amount as string)
          : parseFloat(existing.amount.toString());

        const contract = await tx.expenseContract.create({
          data: {
            contractNo,
            projectSourceId: existing.projectSourceId,
            supplierId: existing.supplierId || (updateData.supplierId as string) || null,
            totalAmount: taskAmount,
            contractType: "设计外包",
            status: "草稿",
          },
        });

        updateData.contractId = contract.id;
      }

      const task = await tx.outsourcingTask.update({
        where: { id },
        data: updateData,
        include: {
          project: { select: { name: true, projectSourceId: true } },
          supplier: { select: { id: true, name: true, supplierType: true } },
        },
      });

      // 分包个人 + 验收通过 → 自动创建应付记录
      if (isAcceptanceApproved && taskType === "to_person") {
        const existingPayable = await tx.payable.findFirst({
          where: { sourceType: "outsourcing", sourceId: id },
        });

        if (!existingPayable) {
          await tx.payable.create({
            data: {
              sourceType: "outsourcing",
              sourceId: id,
              projectSourceId: task.projectSourceId,
              dueDate: task.deliveryDeadline,
              amount: parseFloat(task.amount.toString()),
              paidAmount: 0,
              invoicedAmount: 0,
              status: "未付",
            },
          });
        }
      }

      return task;
    });

    return NextResponse.json({ data: result });
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

    const existing = await prisma.outsourcingTask.findUnique({
      where: { id },
      include: { wbsItems: { select: { wbsNodeId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "外包任务不存在" }, { status: 404 });
    }

    const deleteCheck = await checkDeletePermission("outsourcing", undefined, existing.approvalStatus, existing.createdById);
    if (!deleteCheck.allowed) {
      return NextResponse.json({ error: deleteCheck.error }, { status: 403 });
    }

    // 如果已批准，从 WBS responsibleIds 中移除外包条目
    if (existing.approvalStatus === "已批准" && existing.wbsItems.length > 0) {
      const wbsNodeIds = existing.wbsItems.map((item) => item.wbsNodeId);
      const wbsNodes = await prisma.projectWbsNode.findMany({
        where: { id: { in: wbsNodeIds } },
        select: { id: true, responsibleIds: true },
      });

      for (const node of wbsNodes) {
        const rawIds = node.responsibleIds as unknown[];
        if (!Array.isArray(rawIds)) continue;

        const filtered = rawIds.filter((item: unknown) => {
          if (typeof item === "object" && item !== null) {
            const obj = item as Record<string, unknown>;
            return !(obj.type === "outsourcing" && obj.id === id);
          }
          return true;
        });

        await prisma.projectWbsNode.update({
          where: { id: node.id },
          data: { responsibleIds: filtered as any },
        });
      }
    }

    // 删除 OutsourcingWbsItem 关联记录
    await prisma.outsourcingWbsItem.deleteMany({
      where: { outsourcingTaskId: id },
    });

    await cleanupBusinessApprovalRecords("outsourcing", id);
    await prisma.outsourcingTask.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除外包任务失败:", error);
    return NextResponse.json({ error: "删除外包任务失败" }, { status: 500 });
  }
}

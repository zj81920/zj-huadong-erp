import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserApprovalCapabilities } from "@/lib/approval-engine";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;

    const instance = await prisma.approvalInstance.findUnique({
      where: { id },
      include: {
        actions: {
          include: {
            approver: {
              select: { id: true, realName: true, username: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!instance) {
      return NextResponse.json({ error: "审批实例不存在" }, { status: 404 });
    }

    // 获取审批流节点定义
    const flowNodes = await prisma.approvalFlowDefinition.findMany({
      where: {
        businessType: instance.businessType,
        flowLevel: instance.flowLevel,
        isActive: true,
      },
      orderBy: { nodeOrder: "asc" },
    });

    // 递归加载父链 actions，合并完整审批历史
    const allActions = [...instance.actions];
    const parentInstances: { id: string; status: string; createdAt: string }[] = [];
    let currentParentId = instance.parentInstanceId;
    let depth = 0;
    const MAX_DEPTH = 20;
    while (currentParentId && depth < MAX_DEPTH) {
      const parent = await prisma.approvalInstance.findUnique({
        where: { id: currentParentId },
        include: {
          actions: {
            include: {
              approver: {
                select: { id: true, realName: true, username: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!parent) break;
      parentInstances.push({ id: parent.id, status: parent.status, createdAt: parent.createdAt.toISOString() });
      allActions.push(...parent.actions);
      currentParentId = parent.parentInstanceId;
      depth++;
    }
    // 按时间排序
    allActions.sort((a, b) => {
      const timeA = a.actedAt ? new Date(a.actedAt).getTime() : new Date(a.createdAt).getTime();
      const timeB = b.actedAt ? new Date(b.actedAt).getTime() : new Date(b.createdAt).getTime();
      return timeA - timeB;
    });

    // 计算当前用户的审批权限（后端驱动，前端只读）
    const capabilities = user
      ? await resolveUserApprovalCapabilities({ instanceId: id, userId: user.id })
      : { canApprove: false, canReject: false, canArchive: false, canPayment: false, isInitiator: false, hasActedThisRound: false };

    return NextResponse.json({
      data: {
        ...instance,
        actions: allActions,
        flowNodes,
        parentInstances,
        // 权限标志：前端直接读取，禁止自行计算
        canApprove: capabilities.canApprove,
        canReject: capabilities.canReject,
        canArchive: capabilities.canArchive,
        canPayment: capabilities.canPayment,
        isInitiator: capabilities.isInitiator,
        hasActedThisRound: capabilities.hasActedThisRound,
      },
    });
  } catch (error) {
    console.error("获取审批详情失败:", error);
    return NextResponse.json({ error: "获取审批详情失败" }, { status: 500 });
  }
}

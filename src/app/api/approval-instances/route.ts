import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  startApprovalFlow,
  getPendingApprovals,
  canInitiateFlow,
} from "@/lib/approval-engine";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const { businessType, businessId, flowLevel, projectSourceId } = body;

    if (!businessType || !businessId || !flowLevel) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const canInitiate = await canInitiateFlow({ businessType, flowLevel, userId: user.id });
    if (!canInitiate) {
      return NextResponse.json({ error: "您没有权限发起此类型的审批流程" }, { status: 403 });
    }

    const result = await startApprovalFlow({
      businessType,
      businessId,
      flowLevel,
      initiatorId: user.id,
      projectSourceId,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "发起审批失败";
    console.error("发起审批失败:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "pending";

    if (type === "pending") {
      const pending = await getPendingApprovals(user.id);
      return NextResponse.json({ data: pending });
    }

    if (type === "processed") {
      const { prisma } = await import("@/lib/prisma");
      const actionInstances = await prisma.approvalAction.findMany({
        where: {
          approverId: user.id,
          action: { in: ["approve", "reject", "archive", "payment"] },
        },
        select: { instanceId: true },
        distinct: ["instanceId"],
        orderBy: { actedAt: "desc" },
        take: 50,
      });
      const instanceIds = actionInstances.map((a) => a.instanceId);
      const instances = instanceIds.length > 0
        ? await prisma.approvalInstance.findMany({
            where: { id: { in: instanceIds } },
            orderBy: { createdAt: "desc" },
          })
        : [];
      return NextResponse.json({ data: instances });
    }

    if (type === "initiated") {
      const { prisma } = await import("@/lib/prisma");
      const instances = await prisma.approvalInstance.findMany({
        where: {
          actions: {
            some: {
              approverId: user.id,
              action: "initiate",
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return NextResponse.json({ data: instances });
    }

    if (type === "my-initiated") {
      const { prisma } = await import("@/lib/prisma");
      const instances = await prisma.approvalInstance.findMany({
        where: {
          actions: {
            some: {
              approverId: user.id,
              action: "initiate",
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return NextResponse.json({ data: instances });
    }

    const businessType = searchParams.get("businessType");
    const businessId = searchParams.get("businessId");
    if (businessType && businessId) {
      const { prisma } = await import("@/lib/prisma");
      const instances = await prisma.approvalInstance.findMany({
        where: { businessType, businessId },
        orderBy: { createdAt: "desc" },
        include: {
          actions: {
            include: {
              approver: {
                select: { id: true, realName: true, username: true },
              },
            },
            orderBy: { actedAt: "asc" },
          },
        },
      });

      const enriched = await Promise.all(
        instances.map(async (inst) => {
          const flowNodes = await prisma.approvalFlowDefinition.findMany({
            where: { businessType: inst.businessType, flowLevel: inst.flowLevel, isActive: true },
            orderBy: { nodeOrder: "asc" },
            select: { nodeOrder: true, nodeName: true, approverRole: true, nodeType: true },
          });
          return { ...inst, flowNodes };
        })
      );

      return NextResponse.json({ data: enriched });
    }

    return NextResponse.json(
      { error: "无效的 type 参数" },
      { status: 400 }
    );
  } catch (error) {
    console.error("获取审批列表失败:", error);
    return NextResponse.json({ error: "获取审批列表失败" }, { status: 500 });
  }
}

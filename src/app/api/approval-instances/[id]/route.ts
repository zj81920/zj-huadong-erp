import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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

    return NextResponse.json({
      data: {
        ...instance,
        flowNodes,
      },
    });
  } catch (error) {
    console.error("获取审批详情失败:", error);
    return NextResponse.json({ error: "获取审批详情失败" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth";

// GET /api/approval-flows - 获取所有审批流配置
// Optional query params: businessType, flowLevel
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessType = searchParams.get("businessType");
    const flowLevel = searchParams.get("flowLevel");

    const where: Record<string, unknown> = { isActive: true };
    if (businessType) where.businessType = businessType;
    if (flowLevel) where.flowLevel = flowLevel;

    const flows = await prisma.approvalFlowDefinition.findMany({
      where,
      orderBy: [{ businessType: "asc" }, { flowLevel: "asc" }, { nodeOrder: "asc" }],
    });

    return NextResponse.json({ data: flows });
  } catch (error) {
    console.error("获取审批流配置失败:", error);
    return NextResponse.json({ error: "获取审批流配置失败" }, { status: 500 });
  }
}

// POST /api/approval-flows - 批量保存审批流配置
// Body: { businessType, flowLevel, nodes: [{ nodeOrder, nodeName, approverRole }] }
// This will delete existing nodes for the businessType+flowLevel and recreate them
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json({ error: "仅管理员可执行此操作" }, { status: 403 });
    }
    const body = await request.json();
    const { businessType, flowLevel, nodes } = body;

    if (!businessType || !flowLevel || !Array.isArray(nodes)) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // 防止误传空数组清空流程
    if (nodes.length === 0) {
      return NextResponse.json(
        { error: "至少需要 1 个审批节点，不能保存空流程。如需删除流程，请使用专门的清空操作。" },
        { status: 400 }
      );
    }

    // 检查是否有活跃的审批实例
    const activeCount = await prisma.approvalInstance.count({
      where: {
        businessType,
        flowLevel,
        status: "审批中",
      },
    });
    if (activeCount > 0) {
      return NextResponse.json(
        { error: `该流程下有 ${activeCount} 个正在审批中的实例，无法修改。请等待所有审批完成后再修改流程配置。` },
        { status: 409 }
      );
    }

    // 使用事务包裹删除+创建，保证原子性（中途失败时数据库回滚到原状态）
    const created = await prisma.$transaction(async (tx) => {
      await tx.approvalFlowDefinition.deleteMany({
        where: { businessType, flowLevel },
      });

      return await tx.approvalFlowDefinition.createMany({
        data: nodes.map((node: { nodeOrder: number; nodeName: string; approverRole: string; nodeType?: string }) => ({
          businessType,
          flowLevel,
          nodeOrder: node.nodeOrder,
          nodeName: node.nodeName,
          approverRole: node.approverRole,
          nodeType: node.nodeType || "approval",
          isActive: true,
        })),
      });
    });

    return NextResponse.json({ data: { count: created.count } });
  } catch (error) {
    console.error("保存审批流配置失败:", error);
    return NextResponse.json({ error: "保存审批流配置失败" }, { status: 500 });
  }
}

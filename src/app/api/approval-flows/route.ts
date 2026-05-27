import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    const body = await request.json();
    const { businessType, flowLevel, nodes } = body;

    if (!businessType || !flowLevel || !Array.isArray(nodes)) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // Delete existing nodes for this businessType+flowLevel
    await prisma.approvalFlowDefinition.deleteMany({
      where: { businessType, flowLevel },
    });

    // Create new nodes
    const created = await prisma.approvalFlowDefinition.createMany({
      data: nodes.map((node: { nodeOrder: number; nodeName: string; approverRole: string }) => ({
        businessType,
        flowLevel,
        nodeOrder: node.nodeOrder,
        nodeName: node.nodeName,
        approverRole: node.approverRole,
        isActive: true,
      })),
    });

    return NextResponse.json({ data: { count: created.count } });
  } catch (error) {
    console.error("保存审批流配置失败:", error);
    return NextResponse.json({ error: "保存审批流配置失败" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/approval-flows/apply - 批量应用审批流到多个模块
// Body: { sourceBusinessType, sourceFlowLevel, targets: [{ businessType, flowLevel }] }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceBusinessType, sourceFlowLevel, targets } = body;

    if (!sourceBusinessType || !sourceFlowLevel || !Array.isArray(targets)) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // Get source flow definition
    const sourceNodes = await prisma.approvalFlowDefinition.findMany({
      where: { businessType: sourceBusinessType, flowLevel: sourceFlowLevel, isActive: true },
      orderBy: { nodeOrder: "asc" },
    });

    if (sourceNodes.length === 0) {
      return NextResponse.json({ error: "源审批流配置不存在" }, { status: 404 });
    }

    // 检查所有目标模块是否有活跃审批实例
    const conflictTargets: string[] = [];
    for (const target of targets) {
      const activeCount = await prisma.approvalInstance.count({
        where: {
          businessType: target.businessType,
          flowLevel: target.flowLevel,
          status: "审批中",
        },
      });
      if (activeCount > 0) {
        conflictTargets.push(`${target.businessType}(${target.flowLevel}) 有 ${activeCount} 个审批中实例`);
      }
    }
    if (conflictTargets.length > 0) {
      return NextResponse.json(
        { error: `以下模块无法应用：${conflictTargets.join("；")}。请等待审批完成后再操作。` },
        { status: 409 }
      );
    }

    // Apply to each target
    for (const target of targets) {
      // Delete existing nodes for target
      await prisma.approvalFlowDefinition.deleteMany({
        where: { businessType: target.businessType, flowLevel: target.flowLevel },
      });

      // Create new nodes from source
      await prisma.approvalFlowDefinition.createMany({
        data: sourceNodes.map((node) => ({
          businessType: target.businessType,
          flowLevel: target.flowLevel,
          nodeOrder: node.nodeOrder,
          nodeName: node.nodeName,
          approverRole: node.approverRole,
          isActive: true,
        })),
      });
    }

    return NextResponse.json({ data: { appliedCount: targets.length } });
  } catch (error) {
    console.error("批量应用审批流失败:", error);
    return NextResponse.json({ error: "批量应用审批流失败" }, { status: 500 });
  }
}

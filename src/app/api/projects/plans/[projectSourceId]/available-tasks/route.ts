import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectSourceId: string }> }
) {
  try {
    const { projectSourceId } = await params;
    const { searchParams } = new URL(request.url);
    const excludeOutsourcingId = searchParams.get("excludeOutsourcingId") || "";

    // 1. 获取该项目所有 WBS 节点
    const allNodes = await prisma.projectWbsNode.findMany({
      where: { projectSourceId },
      select: {
        id: true,
        parentId: true,
        level: true,
        name: true,
        planStartDate: true,
        planEndDate: true,
        responsibleIds: true,
      },
    });

    if (allNodes.length === 0) {
      return NextResponse.json({ tasks: [] });
    }

    // 2. 构建节点映射
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

    // 3. 查找每个节点的 Level 1 祖先
    function findLevel1Ancestor(nodeId: string): { id: string; name: string } | null {
      let current = nodeMap.get(nodeId);
      while (current) {
        if (current.level === 1) {
          return { id: current.id, name: current.name };
        }
        if (!current.parentId) break;
        current = nodeMap.get(current.parentId);
      }
      return null;
    }

    // 4. 获取已被锁定的 WBS 节点 ID（排除指定外包的）
    const lockedWhere: Record<string, unknown> = {};
    if (excludeOutsourcingId) {
      lockedWhere.outsourcingTaskId = { not: excludeOutsourcingId };
    }
    const lockedItems = await prisma.outsourcingWbsItem.findMany({
      where: lockedWhere,
      select: { wbsNodeId: true, outsourcingTaskId: true },
    });
    const lockedNodeIds = new Set(lockedItems.map((i) => i.wbsNodeId));
    const lockedByMap = new Map<string, string>();
    for (const item of lockedItems) {
      lockedByMap.set(item.wbsNodeId, item.outsourcingTaskId);
    }

    // 5. 过滤 Level 4 任务
    const level4Nodes = allNodes.filter((n) => n.level === 4);
    const availableTasks = level4Nodes.map((node) => {
      const level1Ancestor = findLevel1Ancestor(node.id);

      // 仅设计阶段
      const isDesignPhase = level1Ancestor?.name.includes("设计") ?? false;

      // 无责任人（兼容新旧格式）
      const rawIds = node.responsibleIds as unknown;
      const hasResponsible = Array.isArray(rawIds) && rawIds.length > 0;

      const isLocked = lockedNodeIds.has(node.id);

      const isAvailable = isDesignPhase && !hasResponsible && !isLocked;

      return {
        id: node.id,
        name: node.name,
        level: node.level,
        planStartDate: node.planStartDate?.toISOString() || null,
        planEndDate: node.planEndDate?.toISOString() || null,
        parentId: node.parentId,
        level1Ancestor,
        isAvailable,
        hasResponsible,
        lockedByOutsourcing: lockedByMap.get(node.id) || null,
      };
    });

    return NextResponse.json({ tasks: availableTasks });
  } catch (error) {
    console.error("获取可用 WBS 任务失败:", error);
    return NextResponse.json({ error: "获取可用 WBS 任务失败" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { judgeTaskStatus, calcPlanProgress } from "@/lib/wbs-utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const search = searchParams.get("search")?.trim() || "";

    // 构建查询条件：搜索 + 必须有 WBS 节点
    const where: any = { wbsNodes: { some: {} } };
    if (search) {
      where.OR = [
        { sourceRefId: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    // 查询所有匹配项目（需要全部计算进度以获取准确的统计数）
    const allProjects = await prisma.project.findMany({
      where,
      select: {
        id: true,
        projectSourceId: true,
        projectCode: true,
        sourceRefId: true,
        name: true,
        type: true,
        projectCategory: true,
        designPhases: true,
        customer: { select: { name: true } },
        _count: { select: { wbsNodes: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const total = allProjects.length;
    const totalPages = Math.ceil(total / pageSize) || 1;

    // 分页
    const paged = allProjects.slice((page - 1) * pageSize, page * pageSize);

    // 批量获取所有项目的 WBS 节点
    const allSourceIds = allProjects.map((p) => p.projectSourceId);
    const allNodes = await prisma.projectWbsNode.findMany({
      where: { projectSourceId: { in: allSourceIds } },
      select: {
        projectSourceId: true,
        level: true,
        progress: true,
        planStartDate: true,
        planEndDate: true,
        actualStartDate: true,
        actualEndDate: true,
      },
    });

    const nodesByProject: Record<string, typeof allNodes> = {};
    for (const n of allNodes) {
      if (!nodesByProject[n.projectSourceId]) nodesByProject[n.projectSourceId] = [];
      nodesByProject[n.projectSourceId].push(n);
    }

    const today = new Date();

    // 计算单个项目的进度摘要
    function computeProjectSummary(p: (typeof allProjects)[0], nodes: typeof allNodes) {
      const taskNodes = nodes.filter((n) => n.level === 4);
      const avgProgress =
        taskNodes.length > 0
          ? Math.round(taskNodes.reduce((s, n) => s + n.progress, 0) / taskNodes.length)
          : 0;

      const avgPlanPct =
        taskNodes.length > 0
          ? Math.round(
              taskNodes
                .filter((n) => n.planStartDate && n.planEndDate)
                .reduce((s, n) => s + calcPlanProgress(n.planStartDate!, n.planEndDate!, today), 0) /
                Math.max(1, taskNodes.filter((n) => n.planStartDate && n.planEndDate).length)
            )
          : 0;

      let delayedCount = 0;
      for (const n of taskNodes) {
        const status = judgeTaskStatus(
          {
            planStart: n.planStartDate?.toISOString() || "",
            planEnd: n.planEndDate?.toISOString() || "",
            actualStart: n.actualStartDate?.toISOString() || undefined,
            actualEnd: n.actualEndDate?.toISOString() || undefined,
            pct: n.progress,
          },
          today
        );
        if (status.status === "delayed") delayedCount++;
      }

      return {
        id: p.id,
        projectSourceId: p.projectSourceId,
        projectCode: p.projectCode,
        sourceRefId: p.sourceRefId,
        name: p.name,
        customerName: p.customer?.name ?? "",
        type: p.type,
        projectCategory: p.projectCategory,
        designPhases: p.designPhases,
        nodeCount: p._count.wbsNodes,
        taskCount: taskNodes.length,
        overallProgress: avgProgress,
        avgPlanPct,
        delayedCount,
        isDelayed: delayedCount > 0,
        aiStatus: delayedCount > 0 ? "delayed" : "ontrack",
      };
    }

    // 计算分页项目的详细摘要
    const projects = paged.map((p) =>
      computeProjectSummary(p, nodesByProject[p.projectSourceId] || [])
    );

    // 统计所有匹配项目的进度（用于统计卡片）
    let ontrackProjects = 0;
    let delayedProjects = 0;
    for (const p of allProjects) {
      const summary = computeProjectSummary(p, nodesByProject[p.projectSourceId] || []);
      if (summary.isDelayed) delayedProjects++;
      else ontrackProjects++;
    }

    return NextResponse.json({
      data: {
        projects,
        total,
        page,
        pageSize,
        totalPages,
        totalProjects: total,
        ontrackProjects,
        delayedProjects,
      },
    });
  } catch (error) {
    console.error("获取WBS汇总失败:", error);
    return NextResponse.json({ error: "获取WBS汇总失败" }, { status: 500 });
  }
}

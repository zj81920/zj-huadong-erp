import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeTaskStatus, calcPlanProgress } from "@/lib/wbs-utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const search = searchParams.get("search")?.trim() || "";

    const where: any = { wbsNodes: { some: {} } };
    if (search) {
      where.OR = [
        { sourceRefId: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

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
    const paged = allProjects.slice((page - 1) * pageSize, page * pageSize);

    // 只查 L4 节点（只需要 progress + planStart + planEnd）
    const allSourceIds = allProjects.map((p) => p.projectSourceId);
    const allNodes = await prisma.projectWbsNode.findMany({
      where: { projectSourceId: { in: allSourceIds }, level: 4 },
      select: {
        projectSourceId: true,
        progress: true,
        planStartDate: true,
        planEndDate: true,
      },
    });

    const nodesByProject: Record<string, typeof allNodes> = {};
    for (const n of allNodes) {
      if (!nodesByProject[n.projectSourceId]) nodesByProject[n.projectSourceId] = [];
      nodesByProject[n.projectSourceId].push(n);
    }

    const today = new Date();

    function computeProjectSummary(p: (typeof allProjects)[0], nodes: typeof allNodes) {
      const taskNodes = nodes;
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
      let aheadCount = 0;
      for (const n of taskNodes) {
        const s = computeTaskStatus(n.progress, n.planStartDate as Date | null, n.planEndDate as Date | null, today);
        if (s.status === "delayed" || s.status === "overdueComplete") delayedCount++;
        if (s.status === "ahead" || s.status === "aheadComplete") aheadCount++;
      }

      const riskLevel = delayedCount === 0 ? "low" : delayedCount <= 2 ? "medium" : "high";

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
        designPhasesList: (() => {
          try { return JSON.parse(p.designPhases || "[]") as string[]; }
          catch { return []; }
        })(),
        nodeCount: p._count.wbsNodes,
        taskCount: taskNodes.length,
        overallProgress: avgProgress,
        avgPlanPct,
        delayedCount,
        aheadCount,
        riskLevel,
        isDelayed: delayedCount > 0,
        aiStatus: delayedCount > 0 ? "delayed" : "normal",
      };
    }

    const projects = paged.map((p) =>
      computeProjectSummary(p, nodesByProject[p.projectSourceId] || [])
    );

    let normalProjects = 0;
    let aheadProjects = 0;
    let delayedProjects = 0;
    for (const p of allProjects) {
      const s = computeProjectSummary(p, nodesByProject[p.projectSourceId] || []);
      if (s.delayedCount > 0) delayedProjects++;
      else if (s.aheadCount > 0) aheadProjects++;
      else normalProjects++;
    }

    return NextResponse.json({
      data: {
        projects,
        total,
        page,
        pageSize,
        totalPages,
        totalProjects: total,
        normalProjects,
        aheadProjects,
        delayedProjects,
      },
    });
  } catch (error) {
    console.error("获取WBS汇总失败:", error);
    return NextResponse.json({ error: "获取WBS汇总失败" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { judgeTaskStatus, calcPlanProgress } from "@/lib/wbs-utils";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      where: {
        wbsNodes: { some: {} },
      },
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

    const today = new Date();

    // 为每个项目获取进度摘要
    const result = await Promise.all(
      projects.map(async (p) => {
        const nodes = await prisma.projectWbsNode.findMany({
          where: { projectSourceId: p.projectSourceId },
          select: {
            level: true,
            progress: true,
            planStartDate: true,
            planEndDate: true,
            actualStartDate: true,
            actualEndDate: true,
          },
        });

        const taskNodes = nodes.filter((n) => n.level === 4);
        const avgProgress =
          taskNodes.length > 0
            ? Math.round(taskNodes.reduce((s, n) => s + n.progress, 0) / taskNodes.length)
            : 0;

        // 计算平均计划进度
        const avgPlanPct =
          taskNodes.length > 0
            ? Math.round(
                taskNodes
                  .filter((n) => n.planStartDate && n.planEndDate)
                  .reduce((s, n) => s + calcPlanProgress(n.planStartDate!, n.planEndDate!, today), 0) /
                  Math.max(1, taskNodes.filter((n) => n.planStartDate && n.planEndDate).length)
              )
            : 0;

        // 用 AI 引擎判断延误数
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
      })
    );

    return NextResponse.json({
      data: {
        totalProjects: result.length,
        ontrackProjects: result.filter((p) => !p.isDelayed).length,
        delayedProjects: result.filter((p) => p.isDelayed).length,
        projects: result,
      },
    });
  } catch (error) {
    console.error("获取WBS汇总失败:", error);
    return NextResponse.json({ error: "获取WBS汇总失败" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPendingApprovals } from "@/lib/approval-engine";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    const [
      projectCount,
      projectByStatus,
      employeeCount,
      activeEmployeeCount,
      recentProjects,
    ] = await Promise.all([
      prisma.project.count(),

      prisma.project.groupBy({
        by: ["status"],
        _count: { status: true },
      }),

      prisma.user.count({ where: { username: { not: "admin" } } }),

      prisma.user.count({
        where: {
          username: { not: "admin" },
          isActive: true,
          employmentStatus: { in: ["active", "probation"] },
        },
      }),

      prisma.project.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          projectCode: true,
          status: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      }),
    ]);

    // 获取待办列表（当前用户需要处理的审批事项）
    let pendingApprovals = 0;
    let pendingTodoList: {
      id: string;
      businessType: string;
      businessTitle: string;
      status: string;
      createdAt: string;
    }[] = [];

    if (currentUser) {
      const pending = await getPendingApprovals(currentUser.id);
      pendingApprovals = pending.length;
      pendingTodoList = pending.map((p) => ({
        id: p.id,
        businessType: p.businessType,
        businessTitle: p.businessTitle || "",
        status: p.nodeType === "resubmit" ? "已驳回" : "审批中",
        createdAt: new Date(p.createdAt).toISOString(),
      }));
    }

    return NextResponse.json({
      projectCount,
      projectByStatus: projectByStatus.map((p) => ({
        status: p.status,
        count: p._count.status,
      })),
      employeeCount,
      activeEmployeeCount,
      pendingApprovals,
      pendingTodoList,
      recentProjects,
    });
  } catch (error) {
    console.error("获取仪表盘统计失败:", error);
    return NextResponse.json({ error: "获取统计数据失败" }, { status: 500 });
  }
}

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
      incomeContractTotal,
      expenseContractTotal,
      receivableTotal,
      payableTotal,
      recentProjects,
      nonContractIncomeTotal,
      nonContractExpenseTotal,
      receivableOverdue,
      payableOverdue,
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

      prisma.incomeContract.aggregate({
        _sum: { totalAmount: true },
        where: { status: { not: "已作废" } },
      }),

      prisma.expenseContract.aggregate({
        _sum: { totalAmount: true },
        where: { status: { not: "已作废" } },
      }),

      prisma.receivable.aggregate({
        _sum: { amount: true, paidAmount: true },
        where: { status: { not: "已收" } },
      }),

      prisma.payable.aggregate({
        _sum: { amount: true, paidAmount: true },
        where: { status: { not: "已付" } },
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

      prisma.nonContractIncome.aggregate({
        _sum: { amount: true },
        where: { status: { not: "已作废" } },
      }),

      prisma.nonContractExpense.aggregate({
        _sum: { amount: true },
        where: { status: { not: "已作废" } },
      }),

      prisma.receivable.count({
        where: {
          status: { not: "已收" },
          dueDate: { lt: new Date() },
        },
      }),

      prisma.payable.count({
        where: {
          status: { not: "已付" },
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    let pendingApprovals = 0;
    if (currentUser) {
      const pending = await getPendingApprovals(currentUser.id);
      pendingApprovals = pending.length;
    }

    const totalIncome = Number(incomeContractTotal._sum.totalAmount || 0) + Number(nonContractIncomeTotal._sum.amount || 0);
    const totalExpense = Number(expenseContractTotal._sum.totalAmount || 0) + Number(nonContractExpenseTotal._sum.amount || 0);

    return NextResponse.json({
      projectCount,
      projectByStatus: projectByStatus.map((p) => ({
        status: p.status,
        count: p._count.status,
      })),
      employeeCount,
      activeEmployeeCount,
      incomeContractTotal: Number(incomeContractTotal._sum.totalAmount || 0),
      expenseContractTotal: Number(expenseContractTotal._sum.totalAmount || 0),
      nonContractIncomeTotal: Number(nonContractIncomeTotal._sum.amount || 0),
      nonContractExpenseTotal: Number(nonContractExpenseTotal._sum.amount || 0),
      totalIncome,
      totalExpense,
      netAmount: totalIncome - totalExpense,
      receivableTotal: Number(receivableTotal._sum.amount || 0),
      receivablePaid: Number(receivableTotal._sum.paidAmount || 0),
      payableTotal: Number(payableTotal._sum.amount || 0),
      payablePaid: Number(payableTotal._sum.paidAmount || 0),
      pendingApprovals,
      receivableOverdue,
      payableOverdue,
      recentProjects,
    });
  } catch (error) {
    console.error("获取仪表盘统计失败:", error);
    return NextResponse.json({ error: "获取统计数据失败" }, { status: 500 });
  }
}

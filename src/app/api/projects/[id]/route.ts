import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin, getCurrentUser } from "@/lib/auth";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, industryType: true, contactPerson: true, phone: true } },
        projectLead: { select: { projectSourceId: true, projectName: true, currentStatus: true } },
        designManager: { select: { id: true, realName: true } },
        supervisorLeader: { select: { id: true, realName: true } },
        _count: {
          select: {
            plans: true,
            progressRecords: true,
            designTasks: true,
            outsourcingTasks: true,
            purchaseRequests: true,
            budgets: true,
            incomeContracts: true,
            expenseContracts: true,
            expenseReports: true,
            receivables: true,
            payables: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: project });
  } catch (error) {
    console.error("获取项目详情失败:", error);
    return NextResponse.json({ error: "获取项目详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const {
      projectCode,
      name,
      customerId,
      type,
      address,
      projectCategory,
      source,
      status,
      designManagerId,
      supervisorLeaderId,
      startDate,
      plannedEndDate,
      actualCloseDate,
    } = body;

    if (projectCode !== undefined && !projectCode.trim()) {
      return NextResponse.json({ error: "项目编号不能为空" }, { status: 400 });
    }
    if (name !== undefined && !name.trim()) {
      return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 });
    }

    if (projectCode !== undefined && projectCode.trim() !== existing.projectCode) {
      const duplicate = await prisma.project.findUnique({
        where: { projectCode: projectCode.trim() },
      });
      if (duplicate) {
        return NextResponse.json({ error: "项目编号已存在" }, { status: 400 });
      }
    }

    if (status !== undefined && status === "关闭" && existing.status !== "关闭") {
      const blockedCount = await prisma.purchaseRequest.count({
        where: {
          projectSourceId: existing.projectSourceId,
          status: { in: ["草稿", "审批中"] },
        },
      });
      if (blockedCount > 0) {
        return NextResponse.json(
          { error: `存在 ${blockedCount} 条草稿或审批中的采购申请，无法关闭项目` },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (projectCode !== undefined) updateData.projectCode = projectCode.trim();
    if (name !== undefined) updateData.name = name.trim();
    if (customerId !== undefined) updateData.customerId = customerId;
    if (type !== undefined) updateData.type = type?.trim() || null;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (projectCategory !== undefined) updateData.projectCategory = projectCategory?.trim() || null;
    if (source !== undefined) updateData.source = source;
    if (status !== undefined) updateData.status = status;
    if (designManagerId !== undefined) updateData.designManagerId = designManagerId || null;
    if (supervisorLeaderId !== undefined) updateData.supervisorLeaderId = supervisorLeaderId || null;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (plannedEndDate !== undefined) updateData.plannedEndDate = plannedEndDate ? new Date(plannedEndDate) : null;
    if (actualCloseDate !== undefined) updateData.actualCloseDate = actualCloseDate ? new Date(actualCloseDate) : null;

    const currentUser = await getCurrentUser();
    updateData.lastModifiedBy = currentUser?.realName || null;

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        customer: { select: { id: true, name: true, industryType: true } },
        projectLead: { select: { projectSourceId: true, projectName: true, currentStatus: true } },
        designManager: { select: { id: true, realName: true } },
        supervisorLeader: { select: { id: true, realName: true } },
      },
    });

    return NextResponse.json({ data: project });
  } catch (error) {
    console.error("更新项目失败:", error);
    return NextResponse.json({ error: "更新项目失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminUser = await getCurrentUser();
    console.log("[DELETE PROJECT] adminUser:", adminUser?.username, "isAdmin:", isAdmin(adminUser));

    const existing = await prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            plans: true,
            progressRecords: true,
            designTasks: true,
            outsourcingTasks: true,
            purchaseRequests: true,
            budgets: true,
            incomeContracts: true,
            expenseContracts: true,
            expenseReports: true,
            receivables: true,
            payables: true,
            nonContractIncomes: true,
            nonContractExpenses: true,
            invoices: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    if ((existing.status === "执行" || existing.status === "关闭") && !isAdmin(adminUser)) {
      return NextResponse.json({ error: "执行中或已关闭的项目不能删除" }, { status: 400 });
    }

    if (existing._count.purchaseRequests > 0 && !isAdmin(adminUser)) {
      return NextResponse.json(
        { error: `该项目下有 ${existing._count.purchaseRequests} 条采购申请，无法删除` },
        { status: 400 }
      );
    }

    if (existing._count.budgets > 0 && !isAdmin(adminUser)) {
      return NextResponse.json(
        { error: `该项目下有 ${existing._count.budgets} 条预算记录，无法删除` },
        { status: 400 }
      );
    }

    if ((existing._count.incomeContracts > 0 || existing._count.expenseContracts > 0) && !isAdmin(adminUser)) {
      return NextResponse.json(
        { error: "该项目下存在关联合同，无法删除" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const psid = existing.projectSourceId;

      if (existing._count.plans > 0) await tx.projectPlan.deleteMany({ where: { projectSourceId: psid } });
      if (existing._count.progressRecords > 0) await tx.projectProgress.deleteMany({ where: { projectSourceId: psid } });
      if (existing._count.designTasks > 0) await tx.designTask.deleteMany({ where: { projectSourceId: psid } });
      if (existing._count.outsourcingTasks > 0) await tx.outsourcingTask.deleteMany({ where: { projectSourceId: psid } });
      if (existing._count.purchaseRequests > 0) await tx.purchaseRequest.deleteMany({ where: { projectSourceId: psid } });
      if (existing._count.budgets > 0) await tx.projectBudget.deleteMany({ where: { projectSourceId: psid } });
      if (existing._count.expenseReports > 0) await tx.expenseReport.deleteMany({ where: { projectSourceId: psid } });
      if (existing._count.receivables > 0) await tx.receivable.deleteMany({ where: { projectSourceId: psid } });
      if (existing._count.payables > 0) await tx.payable.deleteMany({ where: { projectSourceId: psid } });
      if (existing._count.nonContractIncomes > 0) await tx.nonContractIncome.deleteMany({ where: { projectSourceId: psid } });
      if (existing._count.nonContractExpenses > 0) await tx.nonContractExpense.deleteMany({ where: { projectSourceId: psid } });
      if (existing._count.invoices > 0) await tx.invoice.deleteMany({ where: { projectSourceId: psid } });
      if (existing._count.incomeContracts > 0) await tx.incomeContract.deleteMany({ where: { projectSourceId: psid } });
      if (existing._count.expenseContracts > 0) await tx.expenseContract.deleteMany({ where: { projectSourceId: psid } });

      if (psid) {
        const linkedLead = await tx.projectLead.findUnique({
          where: { projectSourceId: psid },
          select: { leadMode: true },
        });
        if (linkedLead) {
          const revertStatus = linkedLead.leadMode === "商务报价" ? "落地" : "已中标";
          await tx.projectLead.update({
            where: { projectSourceId: psid },
            data: { currentStatus: revertStatus },
          });
        }
      }

      await tx.project.delete({ where: { id } });
    });

    await cleanupBusinessApprovalRecords("project", id);

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除项目失败:", error);
    return NextResponse.json({ error: "删除项目失败" }, { status: 500 });
  }
}

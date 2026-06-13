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
    const lead = await prisma.projectLead.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, ownershipType: true, contactPerson: true, phone: true } },
        biddings: true,
        quotations: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "项目线索不存在" }, { status: 404 });
    }

    if (lead.bondLendingId) {
      const lending = await prisma.lendingOut.findUnique({
        where: { id: lead.bondLendingId },
        select: { status: true },
      });
      if (lending) {
        const statusMap: Record<string, string> = {
          "草稿": "未付",
          "审批中": "审批中",
          "已批准": "已付",
          "已驳回": "已退回",
          "未还清": "已付",
          "已还清": "已退",
        };
        const mapped = statusMap[lending.status] || lead.bondPaymentStatus;
        if (mapped !== lead.bondPaymentStatus) {
          await prisma.projectLead.update({
            where: { id },
            data: { bondPaymentStatus: mapped },
          });
          lead.bondPaymentStatus = mapped;
        }
      }
    }

    return NextResponse.json({ data: lead });
  } catch (error) {
    console.error("获取项目线索详情失败:", error);
    return NextResponse.json({ error: "获取项目线索详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.projectLead.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "项目线索不存在" }, { status: 404 });
    }

    const {
      customerId,
      projectName,
      location,
      contactPerson,
      contactPhone,
      contactEmail,
      projectNature,
      implementationEntity,
      currentStatus,
      leadMode,
      followUpRecords,
      competitorInfo,
      tenderFiles,
      tenderNo,
      tenderDeadline,
      bondAmount,
      bondPaymentStatus,
      bondLendingId,
      biddingMethod,
      tenderDescription,
    } = body;

    if (projectName !== undefined && !projectName.trim()) {
      return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 });
    }
    if (projectNature !== undefined && (typeof projectNature !== "string" || !projectNature.trim())) {
      return NextResponse.json({ error: "请选择项目性质" }, { status: 400 });
    }
    if (implementationEntity !== undefined && !implementationEntity.trim()) {
      return NextResponse.json({ error: "请选择实施主体" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    const currentUser = await getCurrentUser();

    // 已立项线索的编辑保护
    const isEstablished = existing.currentStatus === "已立项";
    if (isEstablished) {
      if (!isAdmin(currentUser)) {
        return NextResponse.json({ error: "已立项的线索不可编辑" }, { status: 403 });
      }
      // 管理员可编辑其他字段，但状态和项目名称由系统管理，不允许修改
    }

    updateData.lastModifiedBy = currentUser?.realName || null;
    if (projectName !== undefined && !isEstablished) updateData.projectName = projectName.trim();
    if (location !== undefined) updateData.location = location?.trim() || null;
    if (contactPerson !== undefined) updateData.contactPerson = contactPerson?.trim() || null;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone?.trim() || null;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail?.trim() || null;
    if (projectNature !== undefined) updateData.projectNature = projectNature?.trim() || null;
    if (implementationEntity !== undefined) updateData.implementationEntity = implementationEntity.trim();
    if (currentStatus !== undefined && !isEstablished) updateData.currentStatus = currentStatus;
    if (followUpRecords !== undefined) updateData.followUpRecords = followUpRecords;
    if (competitorInfo !== undefined) updateData.competitorInfo = competitorInfo;
    if (tenderFiles !== undefined) updateData.tenderFiles = tenderFiles;
    if (tenderNo !== undefined) updateData.tenderNo = tenderNo?.trim() || null;
    if (tenderDeadline !== undefined) updateData.tenderDeadline = tenderDeadline ? new Date(tenderDeadline) : null;
    if (bondAmount !== undefined) updateData.bondAmount = bondAmount ? parseFloat(bondAmount) : null;
    if (bondPaymentStatus !== undefined) updateData.bondPaymentStatus = bondPaymentStatus;
    if (bondLendingId !== undefined) updateData.bondLendingId = bondLendingId || null;
    if (biddingMethod !== undefined) updateData.biddingMethod = biddingMethod || null;
    if (tenderDescription !== undefined) updateData.tenderDescription = tenderDescription?.trim() || null;
    if (customerId !== undefined) updateData.customerId = customerId;
    if (leadMode !== undefined) {
      if (leadMode === "商务报价" && existing.leadMode === "投标") {
        const biddingCount = await prisma.bidding.count({
          where: { projectSourceId: existing.projectSourceId },
        });
        const hasTenderInfo =
          existing.tenderNo ||
          existing.tenderDeadline ||
          existing.bondAmount ||
          existing.biddingMethod ||
          existing.tenderDescription ||
          (Array.isArray(existing.tenderFiles) && existing.tenderFiles.length > 0);
        if (biddingCount > 0 || hasTenderInfo) {
          return NextResponse.json({ error: "该线索已有投标/招标资料，无法切换到报价模式" }, { status: 400 });
        }
      }
      if (leadMode === "投标" && existing.leadMode === "商务报价") {
        const quotationCount = await prisma.quotation.count({
          where: { projectSourceId: existing.projectSourceId },
        });
        if (quotationCount > 0) {
          return NextResponse.json({ error: "该线索已有报价记录，无法切换到投标模式" }, { status: 400 });
        }
      }
      updateData.leadMode = leadMode;
    }

    const lead = await prisma.projectLead.update({
      where: { id },
      data: updateData,
      include: {
        customer: { select: { id: true, name: true, ownershipType: true } },
      },
    });

    return NextResponse.json({ data: lead });
  } catch (error) {
    console.error("更新项目线索失败:", error);
    return NextResponse.json({ error: "更新项目线索失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminUser = await getCurrentUser();
    console.log("[DELETE LEAD] adminUser:", adminUser?.username, "isAdmin:", isAdmin(adminUser));

    const existing = await prisma.projectLead.findUnique({
      where: { id },
      include: { project: { select: { id: true } }, _count: { select: { biddings: true, quotations: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "项目线索不存在" }, { status: 404 });
    }

    if (existing.currentStatus === "已立项" && !isAdmin(adminUser)) {
      return NextResponse.json({ error: "已立项的线索不能删除，请先删除关联项目" }, { status: 400 });
    }

    if (existing.project && !isAdmin(adminUser)) {
      return NextResponse.json({ error: "该线索已关联正式项目，无法删除" }, { status: 400 });
    }

    if (existing.currentStatus === "已中标" && !isAdmin(adminUser)) {
      return NextResponse.json({ error: "已中标的线索不能删除" }, { status: 400 });
    }

    if (existing._count.biddings > 0 && !isAdmin(adminUser)) {
      return NextResponse.json(
        { error: `该线索下有 ${existing._count.biddings} 条投标记录，无法删除` },
        { status: 400 }
      );
    }

    if (existing._count.quotations > 0 && !isAdmin(adminUser)) {
      return NextResponse.json(
        { error: `该线索下有 ${existing._count.quotations} 条报价记录，无法删除` },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      if (existing.project) {
        const proj = await tx.project.findUnique({
          where: { id: existing.project.id },
          include: { _count: { select: { plans: true, designTasks: true, outsourcingTasks: true, purchaseRequests: true, budgets: true, incomeContracts: true, expenseContracts: true, expenseReports: true, receivables: true, payables: true, nonContractIncomes: true, nonContractExpenses: true, invoices: true } } },
        });
        if (proj) {
          const psid = proj.projectSourceId;
          if (proj._count.plans > 0) await tx.projectPlan.deleteMany({ where: { projectSourceId: psid } });
          if (proj._count.designTasks > 0) await tx.designTask.deleteMany({ where: { projectSourceId: psid } });
          if (proj._count.outsourcingTasks > 0) await tx.outsourcingTask.deleteMany({ where: { projectSourceId: psid } });
          if (proj._count.purchaseRequests > 0) await tx.purchaseRequest.deleteMany({ where: { projectSourceId: psid } });
          if (proj._count.budgets > 0) await tx.projectBudget.deleteMany({ where: { projectSourceId: psid } });
          if (proj._count.expenseReports > 0) await tx.expenseReport.deleteMany({ where: { projectSourceId: psid } });
          if (proj._count.receivables > 0) await tx.receivable.deleteMany({ where: { projectSourceId: psid } });
          if (proj._count.payables > 0) await tx.payable.deleteMany({ where: { projectSourceId: psid } });
          if (proj._count.nonContractIncomes > 0) await tx.nonContractIncome.deleteMany({ where: { projectSourceId: psid } });
          if (proj._count.nonContractExpenses > 0) await tx.nonContractExpense.deleteMany({ where: { projectSourceId: psid } });
          if (proj._count.invoices > 0) await tx.invoice.deleteMany({ where: { projectSourceId: psid } });
          if (proj._count.incomeContracts > 0) await tx.incomeContract.deleteMany({ where: { projectSourceId: psid } });
          if (proj._count.expenseContracts > 0) await tx.expenseContract.deleteMany({ where: { projectSourceId: psid } });
          await tx.project.delete({ where: { id: proj.id } });
        }
      }

      if (existing._count.biddings > 0) {
        await tx.bidding.deleteMany({ where: { projectSourceId: existing.projectSourceId } });
      }

      if (existing._count.quotations > 0) {
        await tx.quotation.deleteMany({ where: { projectSourceId: existing.projectSourceId } });
      }

      await tx.projectLead.delete({ where: { id } });
    });

    await cleanupBusinessApprovalRecords("project_lead", id);

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除项目线索失败:", error);
    return NextResponse.json({ error: "删除项目线索失败" }, { status: 500 });
  }
}

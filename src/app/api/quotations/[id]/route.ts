import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin, getCurrentUser } from "@/lib/auth";
import { checkDeletePermission, checkEditPermission } from "@/lib/permission-check";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, ownershipType: true } },
        projectLead: { select: { id: true, projectSourceId: true, projectName: true } },
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: "报价单不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: quotation });
  } catch (error) {
    console.error("获取报价单详情失败:", error);
    return NextResponse.json({ error: "获取报价单详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "报价单不存在" }, { status: 404 });
    }

    const editCheck = await checkEditPermission("quotation", undefined, existing.approvalStatus, existing.createdById);
    if (!editCheck.allowed) {
      return NextResponse.json({ error: editCheck.error }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    const currentUser = await getCurrentUser();
    updateData.lastModifiedBy = currentUser?.realName || null;

    if (body.estimatedCost !== undefined) updateData.estimatedCost = body.estimatedCost;
    if (body.totalAmount !== undefined) updateData.totalAmount = parseFloat(body.totalAmount);
    if (body.profitMargin !== undefined) updateData.profitMargin = body.profitMargin ? parseFloat(body.profitMargin) : null;
    if (body.approvalStatus !== undefined) updateData.approvalStatus = body.approvalStatus;
    if (body.adjustmentReason !== undefined) updateData.adjustmentReason = body.adjustmentReason?.trim() || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.projectSourceId !== undefined) updateData.projectSourceId = body.projectSourceId || null;
    if (body.customerId !== undefined) updateData.customerId = body.customerId;
    if (body.quotationLetterUrl !== undefined) updateData.quotationLetterUrl = body.quotationLetterUrl || null;
    if (body.files !== undefined) updateData.files = body.files;

    const quotation = await prisma.quotation.update({
      where: { id },
      data: updateData,
      include: {
        customer: { select: { id: true, name: true, ownershipType: true } },
        projectLead: { select: { id: true, projectSourceId: true, projectName: true } },
      },
    });

    if (body.status !== undefined && existing.projectSourceId) {
      let newLeadStatus: string | null = null;
      if (body.status === "落地") newLeadStatus = "落地";
      else if (body.status === "放弃") newLeadStatus = "放弃";
      if (newLeadStatus) {
        await prisma.projectLead.update({
          where: { projectSourceId: existing.projectSourceId },
          data: { currentStatus: newLeadStatus },
        });
      }
    }

    return NextResponse.json({ data: quotation });
  } catch (error) {
    console.error("更新报价单失败:", error);
    return NextResponse.json({ error: "更新报价单失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminUser = await getCurrentUser();

    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "报价单不存在" }, { status: 404 });
    }

    if (existing.approvalStatus === "已批准" && !isAdmin(adminUser)) {
      return NextResponse.json({ error: "已批准的报价单不能删除" }, { status: 400 });
    }

    const deleteCheck = await checkDeletePermission("quotation", undefined, existing.approvalStatus, existing.createdById);
    if (!deleteCheck.allowed) {
      return NextResponse.json({ error: deleteCheck.error }, { status: 403 });
    }

    await cleanupBusinessApprovalRecords("quotation", id);
    await prisma.quotation.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除报价单失败:", error);
    return NextResponse.json({ error: "删除报价单失败" }, { status: 500 });
  }
}

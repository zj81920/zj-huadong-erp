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
    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      include: {
        purchaseRequest: {
          include: {
            items: { orderBy: { sortOrder: "asc" } },
            project: {
              select: { projectSourceId: true, name: true, projectCode: true },
            },
          },
        },
        expenseContract: { select: { id: true, contractNo: true } },
        supplierQuotes: {
          include: {
            supplier: { select: { id: true, name: true } },
            items: { include: { purchaseRequestItem: true } },
          },
        },
      },
    });

    if (!inquiry) {
      return NextResponse.json({ error: "询价记录不存在" }, { status: 404 });
    }

    const supplierIds = (inquiry.supplierIds as string[]) || [];
    const allIds = [...supplierIds];
    if (inquiry.recommendedSupplierId && !allIds.includes(inquiry.recommendedSupplierId)) {
      allIds.push(inquiry.recommendedSupplierId);
    }

    const suppliers = allIds.length > 0
      ? await prisma.supplier.findMany({
          where: { id: { in: allIds } },
          select: { id: true, name: true, contactPerson: true, phone: true },
        })
      : [];

    const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

    const confirmedQuoteItems: Record<string, { unitPrice: number | null; totalPrice: number | null }> = {};
    if (inquiry.confirmedSupplierId && inquiry.confirmedRound) {
      const confirmedQuote = inquiry.supplierQuotes.find(
        (sq) => sq.supplierId === inquiry.confirmedSupplierId && sq.round === inquiry.confirmedRound
      );
      if (confirmedQuote && confirmedQuote.items) {
        for (const qi of confirmedQuote.items) {
          confirmedQuoteItems[qi.purchaseRequestItemId] = {
            unitPrice: qi.unitPrice ? Number(qi.unitPrice) : null,
            totalPrice: qi.totalPrice ? Number(qi.totalPrice) : null,
          };
        }
      }
    }

    const purchaseRequestItems = inquiry.purchaseRequest.items.map((item) => ({
      ...item,
      unitPrice: confirmedQuoteItems[item.id]?.unitPrice ?? null,
      totalPrice: confirmedQuoteItems[item.id]?.totalPrice ?? null,
    }));

    return NextResponse.json({
      data: {
        ...inquiry,
        purchaseRequest: {
          ...inquiry.purchaseRequest,
          items: purchaseRequestItems,
        },
        currentRound: inquiry.currentRound,
        confirmedSupplierId: inquiry.confirmedSupplierId,
        confirmedRound: inquiry.confirmedRound,
        inquiryStatus: inquiry.status,
        projectName: inquiry.purchaseRequest.project?.name || inquiry.purchaseRequest.projectSourceId,
        projectCode: inquiry.purchaseRequest.project?.projectCode || inquiry.purchaseRequest.projectSourceId,
        supplierDetails: supplierIds.map((sid: string) => {
          const s = supplierMap.get(sid);
          return { id: sid, name: s?.name || "未知供应商", contactPerson: s?.contactPerson, phone: s?.phone };
        }),
        recommendedSupplierName: inquiry.recommendedSupplierId
          ? supplierMap.get(inquiry.recommendedSupplierId)?.name || null
          : null,
      },
    });
  } catch (error) {
    console.error("获取询价详情失败:", error);
    return NextResponse.json({ error: "获取询价详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      supplierIds,
      closingDate,
      quoteSummary,
      recommendedSupplierId,
      isSingleSource,
      singleSourceReason,
      inquiryMode,
      onlineDeadline,
      onlineStatus,
      attachments,
      currentRound,
      confirmedSupplierId,
      confirmedRound,
      status: inquiryStatus,
      supplierQuotes,
    } = body;

    const existing = await prisma.inquiry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "询价记录不存在" }, { status: 404 });
    }

    const editCheck = await checkEditPermission("inquiries", undefined, existing.status, existing.createdById);
    if (!editCheck.allowed) {
      return NextResponse.json({ error: editCheck.error }, { status: 403 });
    }

    if (existing.status === "已批准") {
      return NextResponse.json({ error: "已批准的询价不允许修改" }, { status: 400 });
    }

    const parsedSupplierIds = supplierIds !== undefined
      ? (Array.isArray(supplierIds) ? supplierIds : [])
      : undefined;

    if (parsedSupplierIds !== undefined && parsedSupplierIds.length === 0) {
      return NextResponse.json({ error: "请至少选择一个供应商" }, { status: 400 });
    }

    const effectiveSupplierIds = parsedSupplierIds || (existing.supplierIds as string[]) || [];

    if (recommendedSupplierId !== undefined && recommendedSupplierId && !effectiveSupplierIds.includes(recommendedSupplierId)) {
      return NextResponse.json({ error: "推荐供应商必须在已选供应商列表中" }, { status: 400 });
    }

    if (confirmedSupplierId !== undefined && confirmedSupplierId && !effectiveSupplierIds.includes(confirmedSupplierId)) {
      return NextResponse.json({ error: "确认供应商必须在已选供应商列表中" }, { status: 400 });
    }

    const effectiveIsSingleSource = isSingleSource !== undefined ? !!isSingleSource : existing.isSingleSource;
    if (effectiveIsSingleSource) {
      const effectiveReason = singleSourceReason !== undefined ? singleSourceReason : existing.singleSourceReason;
      if (!effectiveReason?.trim()) {
        return NextResponse.json({ error: "单一来源采购需填写原因" }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (parsedSupplierIds !== undefined) updateData.supplierIds = parsedSupplierIds;
    if (closingDate !== undefined) updateData.closingDate = closingDate ? new Date(closingDate) : null;
    if (quoteSummary !== undefined) updateData.quoteSummary = quoteSummary;
    if (recommendedSupplierId !== undefined) updateData.recommendedSupplierId = recommendedSupplierId || null;
    if (isSingleSource !== undefined) {
      updateData.isSingleSource = !!isSingleSource;
      updateData.singleSourceReason = !!isSingleSource
        ? (singleSourceReason?.trim() || existing.singleSourceReason || null)
        : null;
    } else if (singleSourceReason !== undefined) {
      updateData.singleSourceReason = singleSourceReason?.trim() || null;
    }

    if (inquiryMode !== undefined) {
      updateData.inquiryMode = inquiryMode;
      if (inquiryMode === "online" && !existing.onlineToken) {
        updateData.onlineToken = crypto.randomUUID();
      }
      if (inquiryMode === "offline") {
        updateData.onlineToken = null;
        updateData.onlineDeadline = null;
      }
    }
    if (onlineDeadline !== undefined) {
      updateData.onlineDeadline = onlineDeadline ? new Date(onlineDeadline) : null;
    }
    if (onlineStatus !== undefined) {
      updateData.onlineStatus = onlineStatus;
    }
    if (attachments !== undefined) {
      updateData.attachments = attachments;
    }
    if (currentRound !== undefined) updateData.currentRound = parseInt(currentRound);
    if (confirmedSupplierId !== undefined) updateData.confirmedSupplierId = confirmedSupplierId || null;
    if (confirmedRound !== undefined) updateData.confirmedRound = confirmedRound ? parseInt(confirmedRound) : null;
    if (inquiryStatus !== undefined) updateData.status = inquiryStatus;

    const inquiry = await prisma.$transaction(async (tx) => {
      const updated = await tx.inquiry.update({
        where: { id },
        data: updateData,
      });

      if (Array.isArray(supplierQuotes) && supplierQuotes.length > 0) {
        for (const sq of supplierQuotes) {
          const { supplierId: sqSupplierId, round: sqRound, items: sqItems, ...sqFields } = sq;
          if (!sqSupplierId || !sqRound) continue;

          await tx.supplierQuote.upsert({
            where: {
              inquiryId_supplierId_round: {
                inquiryId: id,
                supplierId: sqSupplierId,
                round: parseInt(sqRound),
              },
            },
            create: {
              inquiryId: id,
              supplierId: sqSupplierId,
              round: parseInt(sqRound),
              ...sqFields,
              items: Array.isArray(sqItems) && sqItems.length > 0
                ? {
                    create: sqItems.map((item: Record<string, unknown>) => ({
                      purchaseRequestItemId: item.purchaseRequestItemId,
                      unitPrice: item.unitPrice ?? null,
                      quantity: item.quantity ?? null,
                      totalPrice: item.totalPrice ?? null,
                      deliveryDays: item.deliveryDays ?? null,
                      remark: item.remark ?? null,
                    })),
                  }
                : undefined,
            },
            update: {
              ...sqFields,
              items: Array.isArray(sqItems) && sqItems.length > 0
                ? {
                    deleteMany: {},
                    create: sqItems.map((item: Record<string, unknown>) => ({
                      purchaseRequestItemId: item.purchaseRequestItemId,
                      unitPrice: item.unitPrice ?? null,
                      quantity: item.quantity ?? null,
                      totalPrice: item.totalPrice ?? null,
                      deliveryDays: item.deliveryDays ?? null,
                      remark: item.remark ?? null,
                    })),
                  }
                : { deleteMany: {} },
            },
          });
        }
      }

      return updated;
    });

    return NextResponse.json({ data: inquiry });
  } catch (error) {
    console.error("更新询价失败:", error);
    return NextResponse.json({ error: "更新询价失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminUser = await getCurrentUser();

    const existing = await prisma.inquiry.findUnique({
      where: { id },
      include: { expenseContract: { select: { id: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "询价记录不存在" }, { status: 404 });
    }

    const deleteCheck = await checkDeletePermission("inquiries", undefined, existing.status, existing.createdById);
    if (!deleteCheck.allowed) {
      return NextResponse.json({ error: deleteCheck.error }, { status: 403 });
    }

    if (existing.expenseContract && !isAdmin(adminUser)) {
      return NextResponse.json(
        { error: "该询价已生成支出合同，无法删除" },
        { status: 400 }
      );
    }

    await cleanupBusinessApprovalRecords("inquiries", id);
    await prisma.inquiry.delete({ where: { id } });

    await prisma.purchaseRequest.update({
      where: { id: existing.purchaseRequestId },
      data: { status: "已批准" },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除询价失败:", error);
    return NextResponse.json({ error: "删除询价失败" }, { status: 500 });
  }
}

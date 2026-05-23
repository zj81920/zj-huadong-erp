import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
        purchaseContract: { select: { id: true, contractNo: true } },
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

    return NextResponse.json({
      data: {
        ...inquiry,
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
    } = body;

    const existing = await prisma.inquiry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "询价记录不存在" }, { status: 404 });
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

    const effectiveIsSingleSource = isSingleSource !== undefined ? !!isSingleSource : existing.isSingleSource;
    if (effectiveIsSingleSource) {
      const effectiveReason = singleSourceReason !== undefined ? singleSourceReason : existing.singleSourceReason;
      if (!effectiveReason?.trim()) {
        return NextResponse.json({ error: "单一来源采购需填写原因" }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (parsedSupplierIds !== undefined) updateData.supplierIds = parsedSupplierIds;
    if (closingDate !== undefined) updateData.closingDate = closingDate || null;
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

    const inquiry = await prisma.inquiry.update({
      where: { id },
      data: updateData,
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

    const existing = await prisma.inquiry.findUnique({
      where: { id },
      include: { purchaseContract: { select: { id: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "询价记录不存在" }, { status: 404 });
    }

    if (existing.purchaseContract) {
      return NextResponse.json(
        { error: "该询价已生成采购合同，无法删除" },
        { status: 400 }
      );
    }

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

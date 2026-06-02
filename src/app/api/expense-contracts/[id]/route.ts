import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin, getCurrentUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const contract = await prisma.expenseContract.findUnique({
      where: { id },
      include: {
        supplier: true,
        project: true,
        items: {
          include: {
            purchaseRequestItem: true,
          },
          orderBy: { sortOrder: "asc" },
        },
        deliveryReceipts: {
          orderBy: { createdAt: "desc" },
        },
        inquiry: {
          include: {
            purchaseRequest: {
              include: {
                items: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "支出合同不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: contract });
  } catch (error) {
    console.error("获取支出合同详情失败:", error);
    return NextResponse.json(
      { error: "获取支出合同详情失败" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.expenseContract.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "支出合同不存在" },
        { status: 404 }
      );
    }

    const fieldKeys = Object.keys(body).filter((k) => k !== "status");
    const isStatusOnlyChange = body.status !== undefined && fieldKeys.length === 0;

    if (!isStatusOnlyChange && existing.status !== "草稿") {
      return NextResponse.json(
        { error: "只有草稿状态的合同可以编辑" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.contractNo !== undefined)
      updateData.contractNo = body.contractNo.trim();
    if (body.projectSourceId !== undefined)
      updateData.projectSourceId = body.projectSourceId || null;
    if (body.supplierId !== undefined)
      updateData.supplierId = body.supplierId || null;
    if (body.totalAmount !== undefined)
      updateData.totalAmount = parseFloat(body.totalAmount);
    if (body.paymentTerms !== undefined)
      updateData.paymentTerms = body.paymentTerms?.trim() || null;
    if (body.signedDate !== undefined)
      updateData.signedDate = body.signedDate ? new Date(body.signedDate) : null;
    if (body.contractType !== undefined)
      updateData.contractType = body.contractType;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.scannedUrl !== undefined)
      updateData.scannedUrl = body.scannedUrl?.trim() || null;
    if (body.archivedUrl !== undefined)
      updateData.archivedUrl = body.archivedUrl || null;
    if (body.taxRate !== undefined)
      updateData.taxRate = body.taxRate || null;
    if (body.pricingMethod !== undefined)
      updateData.pricingMethod = body.pricingMethod || null;
    if (body.contractSummary !== undefined)
      updateData.contractSummary = body.contractSummary || null;
    if (body.approvalInstanceId !== undefined)
      updateData.approvalInstanceId = body.approvalInstanceId;
    if (body.settledAmount !== undefined)
      updateData.settledAmount = parseFloat(body.settledAmount);
    if (body.invoicedAmount !== undefined)
      updateData.invoicedAmount = parseFloat(body.invoicedAmount);
    if (body.settlementStatus !== undefined)
      updateData.settlementStatus = body.settlementStatus;

    if (updateData.contractNo) {
      const duplicate = await prisma.expenseContract.findFirst({
        where: {
          contractNo: updateData.contractNo as string,
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "合同编号已存在" },
          { status: 409 }
        );
      }
    }

    const shouldCreatePayable =
      updateData.status === "已批准" && existing.status !== "已批准";

    const contract = await prisma.$transaction(async (tx) => {
      const updated = await tx.expenseContract.update({
        where: { id },
        data: updateData,
        include: {
          supplier: true,
          project: true,
          inquiry: {
            include: {
              purchaseRequest: true,
            },
          },
        },
      });

      if (shouldCreatePayable) {
        const existingPayables = await tx.payable.findMany({
          where: { sourceType: "expense_contract", sourceId: id },
        });

        if (existingPayables.length === 0) {
          const now = new Date();
          const dueDate = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            now.getDate()
          );

          await tx.payable.create({
            data: {
              sourceType: "expense_contract",
              sourceId: id,
              projectSourceId: updated.projectSourceId || null,
              dueDate,
              amount: parseFloat(updated.totalAmount.toString()),
              paidAmount: 0,
              invoicedAmount: 0,
              status: "未付",
            },
          });
        }

        if (updated.inquiry?.purchaseRequestId) {
          await tx.purchaseRequest.update({
            where: { id: updated.inquiry.purchaseRequestId },
            data: { status: "已采购" },
          });
        }
      }

      return updated;
    });

    return NextResponse.json({ data: contract });
  } catch (error) {
    console.error("更新支出合同失败:", error);
    return NextResponse.json(
      { error: "更新支出合同失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminUser = await getCurrentUser();

    const existing = await prisma.expenseContract.findUnique({
      where: { id },
      include: { deliveryReceipts: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "支出合同不存在" },
        { status: 404 }
      );
    }

    if (existing.status !== "草稿" && !isAdmin(adminUser)) {
      return NextResponse.json(
        { error: "只有草稿状态的合同可以删除" },
        { status: 400 }
      );
    }

    if (existing.deliveryReceipts.length > 0 && !isAdmin(adminUser)) {
      return NextResponse.json(
        { error: "该合同下存在到货验收记录，无法删除" },
        { status: 400 }
      );
    }

    await prisma.expenseContract.delete({
      where: { id },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除支出合同失败:", error);
    return NextResponse.json(
      { error: "删除支出合同失败" },
      { status: 500 }
    );
  }
}

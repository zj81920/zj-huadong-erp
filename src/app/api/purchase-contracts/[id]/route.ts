import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const contract = await prisma.purchaseContract.findUnique({
      where: { id },
      include: {
        supplier: true,
        inquiry: {
          include: {
            purchaseRequest: true,
          },
        },
        deliveryReceipts: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "采购合同不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: contract });
  } catch (error) {
    console.error("获取采购合同详情失败:", error);
    return NextResponse.json(
      { error: "获取采购合同详情失败" },
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

    const existing = await prisma.purchaseContract.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "采购合同不存在" },
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

    if (
      body.status === "已批准" &&
      existing.status !== "已批准" &&
      existing.inquiryId
    ) {
      const inquiry = await prisma.inquiry.findUnique({
        where: { id: existing.inquiryId },
      });

      if (inquiry) {
        await prisma.purchaseRequest.update({
          where: { id: inquiry.purchaseRequestId },
          data: { status: "已批准" },
        });
      }
    }

    const updateData: Record<string, unknown> = {};

    if (body.contractNo !== undefined)
      updateData.contractNo = body.contractNo.trim();
    if (body.projectSourceId !== undefined)
      updateData.projectSourceId = body.projectSourceId;
    if (body.supplierId !== undefined)
      updateData.supplierId = body.supplierId;
    if (body.totalAmount !== undefined)
      updateData.totalAmount = parseFloat(body.totalAmount);
    if (body.paymentTerms !== undefined)
      updateData.paymentTerms = body.paymentTerms?.trim() || null;
    if (body.signedDate !== undefined)
      updateData.signedDate = body.signedDate ? new Date(body.signedDate) : null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.scannedUrl !== undefined)
      updateData.scannedUrl = body.scannedUrl?.trim() || null;
    if (body.approvalInstanceId !== undefined)
      updateData.approvalInstanceId = body.approvalInstanceId;

    if (updateData.contractNo) {
      const duplicate = await prisma.purchaseContract.findFirst({
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

    const contract = await prisma.purchaseContract.update({
      where: { id },
      data: updateData,
      include: {
        supplier: true,
        inquiry: {
          include: {
            purchaseRequest: true,
          },
        },
      },
    });

    return NextResponse.json({ data: contract });
  } catch (error) {
    console.error("更新采购合同失败:", error);
    return NextResponse.json(
      { error: "更新采购合同失败" },
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

    const existing = await prisma.purchaseContract.findUnique({
      where: { id },
      include: { deliveryReceipts: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "采购合同不存在" },
        { status: 404 }
      );
    }

    if (existing.status !== "草稿") {
      return NextResponse.json(
        { error: "只有草稿状态的合同可以删除" },
        { status: 400 }
      );
    }

    if (existing.deliveryReceipts.length > 0) {
      return NextResponse.json(
        {
          error: `该合同下有 ${existing.deliveryReceipts.length} 条交付记录，无法删除`,
        },
        { status: 400 }
      );
    }

    await prisma.purchaseContract.delete({
      where: { id },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除采购合同失败:", error);
    return NextResponse.json(
      { error: "删除采购合同失败" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const receipt = await prisma.deliveryReceipt.findUnique({
      where: { id },
      include: {
        purchaseContract: {
          include: {
            supplier: true,
            inquiry: true,
          },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json(
        { error: "验收记录不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: receipt });
  } catch (error) {
    console.error("获取验收记录详情失败:", error);
    return NextResponse.json(
      { error: "获取验收记录详情失败" },
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

    const existing = await prisma.deliveryReceipt.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "验收记录不存在" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      deliveryDate,
      receivedQuantity,
      inspectionResult,
      receiptStatus,
      invoiceMatched,
    } = body;

    if (receivedQuantity !== undefined && !receivedQuantity.trim()) {
      return NextResponse.json(
        { error: "实收数量不能为空" },
        { status: 400 }
      );
    }

    const validInspectionResults = ["待检", "合格", "不合格"];
    if (
      inspectionResult !== undefined &&
      !validInspectionResults.includes(inspectionResult)
    ) {
      return NextResponse.json(
        { error: "无效的检验结果" },
        { status: 400 }
      );
    }

    const validReceiptStatuses = ["待验收", "已验收", "已拒绝"];
    if (
      receiptStatus !== undefined &&
      !validReceiptStatuses.includes(receiptStatus)
    ) {
      return NextResponse.json(
        { error: "无效的验收状态" },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (deliveryDate !== undefined) data.deliveryDate = new Date(deliveryDate);
    if (receivedQuantity !== undefined)
      data.receivedQuantity = receivedQuantity.trim();
    if (inspectionResult !== undefined) data.inspectionResult = inspectionResult;
    if (receiptStatus !== undefined) data.receiptStatus = receiptStatus;
    if (invoiceMatched !== undefined) data.invoiceMatched = invoiceMatched;

    const receipt = await prisma.deliveryReceipt.update({
      where: { id },
      data,
      include: {
        purchaseContract: {
          include: {
            supplier: true,
          },
        },
      },
    });

    return NextResponse.json({ data: receipt });
  } catch (error) {
    console.error("更新验收记录失败:", error);
    return NextResponse.json(
      { error: "更新验收记录失败" },
      { status: 500 }
    );
  }
}

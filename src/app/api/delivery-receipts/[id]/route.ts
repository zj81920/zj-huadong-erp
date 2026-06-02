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
        expenseContract: {
          include: {
            supplier: true,
            inquiry: true,
          },
        },
        items: {
          include: {
            contractItem: true,
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
      include: {
        expenseContract: {
          include: {
            items: true,
          },
        },
      },
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
      inspectionResult,
      attachments,
      items,
    } = body;

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

    const data: Record<string, unknown> = {};
    if (deliveryDate !== undefined) data.deliveryDate = new Date(deliveryDate);
    if (inspectionResult !== undefined) data.inspectionResult = inspectionResult;
    if (attachments !== undefined) data.attachments = attachments;

    const contractItemMap = new Map(
      existing.expenseContract.items.map((ci) => [ci.id, ci])
    );

    const receipt = await prisma.$transaction(async (tx) => {
      if (items && Array.isArray(items)) {
        await tx.deliveryReceiptItem.deleteMany({
          where: { deliveryReceiptId: id },
        });

        const itemsData = items.map((item: Record<string, unknown>) => {
          const ci = item.contractItemId
            ? contractItemMap.get(item.contractItemId as string)
            : null;
          const itemUnitPrice = ci ? Number(ci.unitPrice) : null;

          return {
            deliveryReceiptId: id,
            contractItemId: (item.contractItemId as string) || null,
            materialName: (item.materialName as string) || "",
            spec: (item.spec as string) || null,
            unit: (item.unit as string) || null,
            orderedQuantity: item.orderedQuantity
              ? Number(item.orderedQuantity)
              : null,
            receivedQuantity: item.receivedQuantity
              ? Number(item.receivedQuantity)
              : null,
            acceptedQuantity: item.acceptedQuantity
              ? Number(item.acceptedQuantity)
              : null,
            unitPrice: itemUnitPrice,
            inspectionResult: (item.inspectionResult as string) || "待检",
            remark: (item.remark as string) || null,
          };
        });

        await tx.deliveryReceiptItem.createMany({ data: itemsData });

        // 重新计算到货金额
        const newDeliveryAmount = itemsData.reduce((sum: number, item: typeof itemsData[number]) => {
          if (item.receivedQuantity && item.unitPrice) {
            return sum + item.receivedQuantity * item.unitPrice;
          }
          return sum;
        }, 0);
        data.deliveryAmount = newDeliveryAmount || null;
      }

      const updated = await tx.deliveryReceipt.update({
        where: { id },
        data,
        include: {
          expenseContract: {
            include: {
              supplier: true,
            },
          },
          items: {
            include: {
              contractItem: true,
            },
          },
        },
      });

      return updated;
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

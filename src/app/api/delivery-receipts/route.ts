import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const expenseContractId = searchParams.get("expenseContractId") || "";
    const inspectionResult = searchParams.get("inspectionResult") || "";
    const receiptStatus = searchParams.get("receiptStatus") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (expenseContractId) {
      where.expenseContractId = expenseContractId;
    }

    if (inspectionResult) {
      where.inspectionResult = inspectionResult;
    }

    if (receiptStatus) {
      where.receiptStatus = receiptStatus;
    }

    if (search) {
      where.OR = [
        {
          expenseContract: {
            contractNo: { contains: search, mode: "insensitive" },
          },
        },
        {
          expenseContract: {
            supplier: { name: { contains: search, mode: "insensitive" } },
          },
        },
      ];
    }

    const [receipts, total] = await Promise.all([
      prisma.deliveryReceipt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
      }),
      prisma.deliveryReceipt.count({ where }),
    ]);

    return NextResponse.json({
      data: receipts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("获取到货验收列表失败:", error);
    return NextResponse.json(
      { error: "获取到货验收列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      expenseContractId,
      deliveryDate,
      attachments,
      items,
    } = body;

    if (!expenseContractId) {
      return NextResponse.json(
        { error: "请选择费用合同" },
        { status: 400 }
      );
    }

    const contract = await prisma.expenseContract.findUnique({
      where: { id: expenseContractId },
      include: {
        items: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "费用合同不存在" },
        { status: 404 }
      );
    }

    if (contract.status !== "已批准") {
      return NextResponse.json(
        { error: "只有已批准状态的费用合同才能创建验收记录" },
        { status: 400 }
      );
    }

    const contractItemMap = new Map(
      contract.items.map((ci) => [ci.id, ci])
    );

    const itemsData = (items || []).map((item: Record<string, unknown>) => {
      const ci = item.contractItemId
        ? contractItemMap.get(item.contractItemId as string)
        : null;
      const itemUnitPrice = ci ? Number(ci.unitPrice) : null;

      return {
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

    // 自动计算到货金额：sum(receivedQuantity * unitPrice)
    const deliveryAmount = itemsData.reduce((sum: number, item: typeof itemsData[number]) => {
      if (item.receivedQuantity && item.unitPrice) {
        return sum + item.receivedQuantity * item.unitPrice;
      }
      return sum;
    }, 0);

    const receipt = await prisma.deliveryReceipt.create({
      data: {
        expenseContractId,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
        inspectionResult: "待检",
        deliveryAmount: deliveryAmount || null,
        attachments: attachments || "[]",
        items: {
          create: itemsData,
        },
      },
      include: {
        expenseContract: {
          include: {
            supplier: true,
            items: true,
          },
        },
        items: {
          include: {
            contractItem: true,
          },
        },
      },
    });

    return NextResponse.json({ data: receipt }, { status: 201 });
  } catch (error) {
    console.error("创建到货验收记录失败:", error);
    return NextResponse.json(
      { error: "创建到货验收记录失败" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const purchaseContractId = searchParams.get("purchaseContractId") || "";
    const inspectionResult = searchParams.get("inspectionResult") || "";
    const receiptStatus = searchParams.get("receiptStatus") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (purchaseContractId) {
      where.purchaseContractId = purchaseContractId;
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
          purchaseContract: {
            contractNo: { contains: search, mode: "insensitive" },
          },
        },
        {
          purchaseContract: {
            supplier: { name: { contains: search, mode: "insensitive" } },
          },
        },
        { receivedQuantity: { contains: search } },
      ];
    }

    const [receipts, total] = await Promise.all([
      prisma.deliveryReceipt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          purchaseContract: {
            include: {
              supplier: true,
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
      purchaseContractId,
      deliveryDate,
      receivedQuantity,
      inspectionResult,
      receiptStatus,
      invoiceMatched,
    } = body;

    if (!purchaseContractId) {
      return NextResponse.json(
        { error: "请选择采购合同" },
        { status: 400 }
      );
    }

    if (!receivedQuantity || !receivedQuantity.trim()) {
      return NextResponse.json(
        { error: "实收数量不能为空" },
        { status: 400 }
      );
    }

    const contract = await prisma.purchaseContract.findUnique({
      where: { id: purchaseContractId },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "采购合同不存在" },
        { status: 404 }
      );
    }

    if (contract.status !== "生效") {
      return NextResponse.json(
        { error: "只有生效状态的采购合同才能创建验收记录" },
        { status: 400 }
      );
    }

    const receipt = await prisma.deliveryReceipt.create({
      data: {
        purchaseContractId,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
        receivedQuantity: receivedQuantity.trim(),
        inspectionResult: inspectionResult || "待检",
        receiptStatus: receiptStatus || "待验收",
        invoiceMatched: invoiceMatched || false,
      },
      include: {
        purchaseContract: {
          include: {
            supplier: true,
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

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const projectSourceId = searchParams.get("projectSourceId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (projectSourceId) {
      where.projectSourceId = projectSourceId;
    }

    if (search) {
      where.OR = [
        { projectSourceId: { contains: search, mode: "insensitive" } },
        { purchaseRequest: { requestNo: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [inquiries, total] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        include: {
          purchaseRequest: { include: { items: { orderBy: { sortOrder: "asc" } } } },
          purchaseContract: { select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.inquiry.count({ where }),
    ]);

    const supplierIds = new Set<string>();
    inquiries.forEach((inq) => {
      const ids = inq.supplierIds as string[];
      if (Array.isArray(ids)) {
        ids.forEach((id) => supplierIds.add(id));
      }
    });

    const recommendedIds = inquiries
      .map((inq) => inq.recommendedSupplierId)
      .filter(Boolean) as string[];

    recommendedIds.forEach((id) => supplierIds.add(id));

    let suppliers: { id: string; name: string }[] = [];
    if (supplierIds.size > 0) {
      suppliers = await prisma.supplier.findMany({
        where: { id: { in: Array.from(supplierIds) } },
        select: { id: true, name: true },
      });
    }

    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));

    const data = inquiries.map((inq) => {
      const ids = (inq.supplierIds as string[]) || [];
      const recommendedName = inq.recommendedSupplierId
        ? supplierMap.get(inq.recommendedSupplierId) || null
        : null;

      return {
        id: inq.id,
        purchaseRequestId: inq.purchaseRequestId,
        projectSourceId: inq.projectSourceId,
        supplierIds: ids,
        inquiryDate: inq.inquiryDate,
        closingDate: inq.closingDate,
        quoteSummary: inq.quoteSummary,
        recommendedSupplierId: inq.recommendedSupplierId,
        isSingleSource: inq.isSingleSource,
        singleSourceReason: inq.singleSourceReason,
        createdAt: inq.createdAt,
        updatedAt: inq.updatedAt,
        hasContract: !!inq.purchaseContract,
        purchaseRequest: {
          id: inq.purchaseRequest.id,
          requestNo: inq.purchaseRequest.requestNo,
          status: inq.purchaseRequest.status,
          projectSourceId: inq.purchaseRequest.projectSourceId,
          items: inq.purchaseRequest.items.map((item) => ({
            id: item.id,
            materialName: item.materialName,
            spec: item.spec,
            material: item.material,
            brand: item.brand,
            standardNo: item.standardNo,
            unit: item.unit,
            quantity: item.quantity,
            remark: item.remark,
            sortOrder: item.sortOrder,
          })),
        },
        supplierNames: ids.map((sid: string) => ({ id: sid, name: supplierMap.get(sid) || "未知供应商" })),
        recommendedSupplierName: recommendedName,
      };
    });

    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("获取询价列表失败:", error);
    return NextResponse.json({ error: "获取询价列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      purchaseRequestId,
      supplierIds,
      closingDate,
      quoteSummary,
      recommendedSupplierId,
      isSingleSource,
      singleSourceReason,
    } = body;

    if (!purchaseRequestId) {
      return NextResponse.json({ error: "请选择采购需求" }, { status: 400 });
    }

    const purchaseRequest = await prisma.purchaseRequest.findUnique({
      where: { id: purchaseRequestId },
    });

    if (!purchaseRequest) {
      return NextResponse.json({ error: "采购需求不存在" }, { status: 404 });
    }

    if (purchaseRequest.status !== "已批准") {
      return NextResponse.json({ error: "只有已批准的采购需求才能创建询价" }, { status: 400 });
    }

    const existingInquiry = await prisma.inquiry.findUnique({
      where: { purchaseRequestId },
    });

    if (existingInquiry) {
      return NextResponse.json({ error: "该采购需求已存在询价记录" }, { status: 409 });
    }

    const parsedSupplierIds = Array.isArray(supplierIds) ? supplierIds : [];
    if (parsedSupplierIds.length === 0) {
      return NextResponse.json({ error: "请至少选择一个供应商" }, { status: 400 });
    }

    if (recommendedSupplierId && !parsedSupplierIds.includes(recommendedSupplierId)) {
      return NextResponse.json({ error: "推荐供应商必须在已选供应商列表中" }, { status: 400 });
    }

    if (isSingleSource && !singleSourceReason?.trim()) {
      return NextResponse.json({ error: "单一来源采购需填写原因" }, { status: 400 });
    }

    const inquiry = await prisma.inquiry.create({
      data: {
        purchaseRequestId,
        projectSourceId: purchaseRequest.projectSourceId,
        supplierIds: parsedSupplierIds,
        closingDate: closingDate || null,
        quoteSummary: quoteSummary || {},
        recommendedSupplierId: recommendedSupplierId || null,
        isSingleSource: !!isSingleSource,
        singleSourceReason: isSingleSource ? singleSourceReason?.trim() || null : null,
      },
    });

    await prisma.purchaseRequest.update({
      where: { id: purchaseRequestId },
      data: { status: "已转询价" },
    });

    return NextResponse.json({ data: inquiry }, { status: 201 });
  } catch (error) {
    console.error("创建询价失败:", error);
    return NextResponse.json({ error: "创建询价失败" }, { status: 500 });
  }
}

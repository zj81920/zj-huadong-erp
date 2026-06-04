import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkReadPermission } from "@/lib/permission-check";

export async function GET(request: NextRequest) {
  try {
    const { canReadAll, userId } = await checkReadPermission("expense_contract")
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "";

    if (mode === "available-inquiries") {
      const inquiries = await prisma.inquiry.findMany({
        where: {
          expenseContract: null,
          status: "已批准",
        },
        include: {
          purchaseRequest: {
            include: { items: { orderBy: { sortOrder: "asc" } } },
          },
          supplierQuotes: {
            include: {
              items: {
                include: {
                  purchaseRequestItem: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ data: inquiries });
    }

    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const projectSourceId = searchParams.get("projectSourceId") || "";
    const contractType = searchParams.get("contractType") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.contractNo = { contains: search, mode: "insensitive" };
    }

    if (status) {
      where.status = status;
    }

    if (projectSourceId) {
      where.projectSourceId = projectSourceId;
    }

    if (contractType) {
      where.contractType = contractType;
    }

    // 权限过滤
    if (!canReadAll && userId) {
      where.createdById = userId;
    }

    const [contracts, total] = await Promise.all([
      prisma.expenseContract.findMany({
        where,
        include: {
          supplier: true,
          project: true,
          inquiry: {
            include: {
              purchaseRequest: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.expenseContract.count({ where }),
    ]);

    return NextResponse.json({
      data: contracts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("获取支出合同列表失败:", error);
    return NextResponse.json(
      { error: "获取支出合同列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentUser = await getCurrentUser();
    const {
      contractNo,
      projectSourceId,
      supplierId,
      inquiryId,
      signedDate,
      totalAmount,
      paymentTerms,
      contractType,
      scannedUrl,
      taxRate,
      pricingMethod,
      contractSummary,
    } = body;

    if (!contractNo || !contractNo.trim()) {
      return NextResponse.json(
        { error: "合同编号不能为空" },
        { status: 400 }
      );
    }

    const existing = await prisma.expenseContract.findUnique({
      where: { contractNo: contractNo.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "合同编号已存在" },
        { status: 409 }
      );
    }

    let contractItemsData: {
      purchaseRequestItemId?: string;
      materialName: string;
      spec?: string | null;
      material?: string | null;
      brand?: string | null;
      standardNo?: string | null;
      unit?: string | null;
      quantity?: number | null;
      unitPrice?: number | null;
      totalPrice?: number | null;
      deliveryDays?: number | null;
      remark?: string | null;
      sortOrder: number;
    }[] = [];
    let finalSupplierId = supplierId || null;
    let finalTotalAmount = totalAmount ? parseFloat(totalAmount) : 0;

    if (inquiryId) {
      const inquiry = await prisma.inquiry.findUnique({
        where: { id: inquiryId },
        include: {
          purchaseRequest: {
            include: { items: { orderBy: { sortOrder: "asc" } } },
          },
          supplierQuotes: {
            include: {
              items: {
                include: {
                  purchaseRequestItem: true,
                },
              },
            },
          },
        },
      });

      if (!inquiry) {
        return NextResponse.json(
          { error: "询价单不存在" },
          { status: 400 }
        );
      }

      const linked = await prisma.expenseContract.findUnique({
        where: { inquiryId },
      });

      if (linked) {
        return NextResponse.json(
          { error: "该询价单已关联合同" },
          { status: 400 }
        );
      }

      if (inquiry.confirmedSupplierId && inquiry.confirmedRound) {
        const confirmedQuote = inquiry.supplierQuotes.find(
          (q) =>
            q.supplierId === inquiry.confirmedSupplierId &&
            q.round === inquiry.confirmedRound
        );

        if (confirmedQuote) {
          if (confirmedQuote.items.length > 0) {
            contractItemsData = confirmedQuote.items.map(
              (quoteItem, index) => ({
                purchaseRequestItemId: quoteItem.purchaseRequestItemId,
                materialName: quoteItem.purchaseRequestItem.materialName,
                spec: quoteItem.purchaseRequestItem.spec,
                material: quoteItem.purchaseRequestItem.material,
                brand: quoteItem.purchaseRequestItem.brand,
                standardNo: quoteItem.purchaseRequestItem.standardNo,
                unit: quoteItem.purchaseRequestItem.unit,
                quantity: quoteItem.quantity
                  ? Number(quoteItem.quantity)
                  : quoteItem.purchaseRequestItem.quantity
                    ? Number(quoteItem.purchaseRequestItem.quantity)
                    : null,
                unitPrice: quoteItem.unitPrice
                  ? Number(quoteItem.unitPrice)
                  : null,
                totalPrice: quoteItem.totalPrice
                  ? Number(quoteItem.totalPrice)
                  : null,
                deliveryDays: quoteItem.deliveryDays,
                remark: quoteItem.remark,
                sortOrder: index,
              })
            );
          } else if (confirmedQuote.totalPrice) {
            contractItemsData = inquiry.purchaseRequest.items.map(
              (item, index) => ({
                purchaseRequestItemId: item.id,
                materialName: item.materialName,
                spec: item.spec,
                material: item.material,
                brand: item.brand,
                standardNo: item.standardNo,
                unit: item.unit,
                quantity: item.quantity ? Number(item.quantity) : null,
                sortOrder: index,
              })
            );
          }
        }
      }

      finalSupplierId = inquiry.confirmedSupplierId || supplierId || null;

      const calculatedTotal = contractItemsData.reduce(
        (sum, item) => sum + (item.totalPrice ? Number(item.totalPrice) : 0),
        0
      );

      if (calculatedTotal > 0) {
        finalTotalAmount = totalAmount ? parseFloat(totalAmount) : calculatedTotal;
      } else {
        finalTotalAmount = totalAmount ? parseFloat(totalAmount) : 0;
      }
    }

    if (finalTotalAmount <= 0) {
      return NextResponse.json(
        { error: "合同金额必须大于0" },
        { status: 400 }
      );
    }

    if (finalSupplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: finalSupplierId },
      });

      if (!supplier || !supplier.isActive) {
        return NextResponse.json(
          { error: "供应商不存在或已停用" },
          { status: 400 }
        );
      }
    }

    if (contractType === "项目采购" && !projectSourceId) {
      return NextResponse.json(
        { error: "项目采购必须关联项目" },
        { status: 400 }
      );
    }

    if (projectSourceId) {
      const project = await prisma.project.findUnique({
        where: { projectSourceId },
      });

      if (!project) {
        return NextResponse.json(
          { error: "关联项目不存在" },
          { status: 400 }
        );
      }
    }

    const contract = await prisma.$transaction(async (tx) => {
      const created = await tx.expenseContract.create({
        data: {
          contractNo: contractNo.trim(),
          projectSourceId: projectSourceId || null,
          supplierId: finalSupplierId,
          inquiryId: inquiryId || null,
          signedDate: signedDate ? new Date(signedDate) : null,
          totalAmount: finalTotalAmount,
          paymentTerms: paymentTerms?.trim() || null,
          contractType: contractType || "其他",
          scannedUrl: scannedUrl?.trim() || null,
          taxRate: taxRate || null,
          pricingMethod: pricingMethod || null,
          contractSummary: contractSummary || null,
          createdById: currentUser?.id || null,
          ...(contractItemsData.length > 0 && {
            items: {
              create: contractItemsData,
            },
          }),
        },
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

      if (created.inquiry?.purchaseRequestId) {
        await tx.purchaseRequest.update({
          where: { id: created.inquiry.purchaseRequestId },
          data: { status: "已采购" },
        });
      }

      return created;
    });

    return NextResponse.json({ data: contract }, { status: 201 });
  } catch (error) {
    console.error("创建支出合同失败:", error);
    return NextResponse.json(
      { error: "创建支出合同失败" },
      { status: 500 }
    );
  }
}

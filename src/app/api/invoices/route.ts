import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const invoiceCategory = searchParams.get("invoiceCategory") || "";
    const invoiceType = searchParams.get("invoiceType") || "";
    const sourceType = searchParams.get("sourceType") || "";
    const projectSourceId = searchParams.get("projectSourceId") || "";
    const organizationId = searchParams.get("organizationId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { invoiceNo: { contains: search, mode: "insensitive" } },
        { invoiceCode: { contains: search, mode: "insensitive" } },
        { sellerName: { contains: search, mode: "insensitive" } },
        { buyerName: { contains: search, mode: "insensitive" } },
        { remark: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) where.status = status;
    if (invoiceCategory) where.invoiceCategory = invoiceCategory;
    if (invoiceType) where.invoiceType = invoiceType;
    if (sourceType) where.sourceType = sourceType;
    if (projectSourceId) where.projectSourceId = projectSourceId;

    const [records, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          project: { select: { projectSourceId: true, name: true, projectCode: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({
      data: records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取发票列表失败:", error);
    return NextResponse.json({ error: "获取发票列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      invoiceNo,
      invoiceCode,
      invoiceType,
      invoiceCategory,
      invoiceDate,
      amount,
      taxRate,
      taxAmount,
      totalAmount,
      sellerName,
      sellerTaxNo,
      buyerName,
      buyerTaxNo,
      projectSourceId,
      sourceType,
      sourceId,
      status,
      remark,
      attachments,
      organizationId,
    } = body;

    if (!invoiceNo || !invoiceType || !invoiceCategory || !invoiceDate || !totalAmount) {
      return NextResponse.json({ error: "发票号码、类型、方向、日期和价税合计为必填项" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount) || 0;
    const parsedTaxRate = parseFloat(taxRate) || 0;
    const parsedTaxAmount = parseFloat(taxAmount) || 0;
    const parsedTotalAmount = parseFloat(totalAmount) || 0;

    if (parsedTotalAmount <= 0) {
      return NextResponse.json({ error: "价税合计金额必须大于0" }, { status: 400 });
    }

    const record = await prisma.invoice.create({
      data: {
        invoiceNo: invoiceNo.trim(),
        invoiceCode: invoiceCode?.trim() || null,
        invoiceType,
        invoiceCategory,
        invoiceDate: new Date(invoiceDate),
        amount: parsedAmount,
        taxRate: parsedTaxRate,
        taxAmount: parsedTaxAmount,
        totalAmount: parsedTotalAmount,
        sellerName: sellerName?.trim() || null,
        sellerTaxNo: sellerTaxNo?.trim() || null,
        buyerName: buyerName?.trim() || null,
        buyerTaxNo: buyerTaxNo?.trim() || null,
        projectSourceId: projectSourceId || null,
        sourceType: sourceType || "manual",
        sourceId: sourceId || null,
        status: status || "已登记",
        remark: remark?.trim() || null,
        organizationId: organizationId || null,
        attachments: attachments || [],
      },
      include: {
        project: { select: { projectSourceId: true, name: true, projectCode: true } },
      },
    });

    await updateRelatedInvoicedAmount(sourceType, sourceId, parsedTotalAmount, "add");

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error("创建发票失败:", error);
    return NextResponse.json({ error: "创建发票失败" }, { status: 500 });
  }
}

async function updateRelatedInvoicedAmount(
  sourceType: string,
  sourceId: string | null,
  amount: number,
  operation: "add" | "subtract"
) {
  if (!sourceId) return;
  const delta = operation === "add" ? amount : -amount;

  if (sourceType === "expense_contract") {
    const contract = await prisma.expenseContract.findUnique({ where: { id: sourceId } });
    if (contract) {
      await prisma.expenseContract.update({
        where: { id: sourceId },
        data: { invoicedAmount: { increment: delta } },
      });
    }
  } else if (sourceType === "income_contract") {
    const contract = await prisma.incomeContract.findUnique({ where: { id: sourceId } });
    if (contract) {
      await prisma.incomeContract.update({
        where: { id: sourceId },
        data: { invoicedAmount: { increment: delta } },
      });
    }
  } else if (sourceType === "delivery_receipt") {
    const receipt = await prisma.deliveryReceipt.findUnique({ where: { id: sourceId } });
    if (receipt) {
      await prisma.deliveryReceipt.update({
        where: { id: sourceId },
        data: {
          invoiceAmount: { increment: delta },
          invoiceMatched: true,
        },
      });
    }
  } else if (sourceType === "non_contract_expense") {
    const expense = await prisma.nonContractExpense.findUnique({ where: { id: sourceId } });
    if (expense) {
      await prisma.nonContractExpense.update({
        where: { id: sourceId },
        data: { invoicedAmount: { increment: delta } },
      });
    }
  } else if (sourceType === "inter_org_contract") {
    const contract = await prisma.interOrgContract.findUnique({
      where: { id: sourceId },
    });
    if (!contract) {
      throw new Error('内部结算合同不存在');
    }
  }
}

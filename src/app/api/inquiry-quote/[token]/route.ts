import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const inquiry = await prisma.inquiry.findUnique({
    where: { onlineToken: token },
    include: {
      purchaseRequest: {
        include: {
          items: { orderBy: { sortOrder: "asc" } },
        },
      },
      supplierQuotes: {
        include: {
          supplier: { select: { id: true, name: true } },
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
    return NextResponse.json({ error: "询价不存在" }, { status: 404 });
  }

  if (inquiry.onlineStatus === "closed") {
    return NextResponse.json({ error: "该询价已截止" });
  }

  if (inquiry.onlineDeadline && new Date() > inquiry.onlineDeadline) {
    return NextResponse.json({ error: "该询价已超过截止时间" });
  }

  const supplierIds = (inquiry.supplierIds as string[]) || [];
  const suppliers = supplierIds.length > 0
    ? await prisma.supplier.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, name: true },
      })
    : [];

  return NextResponse.json({
    data: {
      id: inquiry.id,
      projectSourceId: inquiry.projectSourceId,
      inquiryDate: inquiry.inquiryDate,
      closingDate: inquiry.closingDate,
      onlineDeadline: inquiry.onlineDeadline,
      attachments: inquiry.attachments || [],
      purchaseRequest: {
        requestNo: inquiry.purchaseRequest?.requestNo,
        items: inquiry.purchaseRequest?.items,
      },
      suppliers,
      supplierQuotes: inquiry.supplierQuotes.map((q) => ({
        id: q.id,
        supplierId: q.supplierId,
        supplier: q.supplier,
        totalPrice: q.totalPrice,
        deliveryDays: q.deliveryDays,
        quotedAt: q.quotedAt,
        isValid: q.isValid,
        attachments: q.attachments || [],
        items: q.items,
      })),
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();

  const inquiry = await prisma.inquiry.findUnique({
    where: { onlineToken: token },
  });

  if (!inquiry) {
    return NextResponse.json({ error: "询价不存在" }, { status: 404 });
  }

  if (inquiry.onlineStatus === "closed") {
    return NextResponse.json({ error: "该询价已截止" });
  }

  if (inquiry.onlineDeadline && new Date() > inquiry.onlineDeadline) {
    return NextResponse.json({ error: "该询价已超过截止时间" });
  }

  const supplierIds = (inquiry.supplierIds as string[]) || [];
  if (!supplierIds.includes(body.supplierId)) {
    return NextResponse.json(
      { error: "该供应商未受邀参与此询价" },
      { status: 403 }
    );
  }

  const hasItems = Array.isArray(body.items) && body.items.length > 0;

  let totalPriceValue: number;
  if (hasItems) {
    totalPriceValue = body.items.reduce(
      (sum: number, item: { totalPrice?: number | string }) =>
        sum + parseFloat(String(item.totalPrice ?? 0)),
      0
    );
  } else {
    totalPriceValue = parseFloat(body.totalPrice);
  }

  if (!totalPriceValue || totalPriceValue <= 0) {
    return NextResponse.json(
      { error: "总价必须大于0" },
      { status: 400 }
    );
  }

  const targetRound = body.round || inquiry.currentRound;

  if (hasItems) {
    const result = await prisma.$transaction(async (tx) => {
      const quote = await tx.supplierQuote.upsert({
        where: {
          inquiryId_supplierId_round: {
            inquiryId: inquiry.id,
            supplierId: body.supplierId,
            round: targetRound,
          },
        },
        create: {
          inquiryId: inquiry.id,
          supplierId: body.supplierId,
          round: targetRound,
          quoteMode: "online",
          unitPrice: body.unitPrice ? parseFloat(body.unitPrice) : null,
          totalPrice: totalPriceValue,
          deliveryDays: body.deliveryDays ? parseInt(body.deliveryDays) : null,
          remark: body.remark || null,
          attachments: body.attachments || [],
          quotedAt: new Date(),
        },
        update: {
          unitPrice: body.unitPrice ? parseFloat(body.unitPrice) : null,
          totalPrice: totalPriceValue,
          deliveryDays: body.deliveryDays ? parseInt(body.deliveryDays) : null,
          remark: body.remark || null,
          attachments: body.attachments || [],
          quotedAt: new Date(),
          isValid: true,
        },
      });

      await tx.supplierQuoteItem.deleteMany({
        where: { supplierQuoteId: quote.id },
      });

      await tx.supplierQuoteItem.createMany({
        data: body.items.map(
          (item: {
            purchaseRequestItemId: string;
            unitPrice?: number | string;
            quantity?: number | string;
            totalPrice?: number | string;
            deliveryDays?: number | string;
            remark?: string;
          }) => ({
            supplierQuoteId: quote.id,
            purchaseRequestItemId: item.purchaseRequestItemId,
            unitPrice: item.unitPrice ? parseFloat(String(item.unitPrice)) : null,
            quantity: item.quantity ? parseFloat(String(item.quantity)) : null,
            totalPrice: item.totalPrice ? parseFloat(String(item.totalPrice)) : null,
            deliveryDays: item.deliveryDays ? parseInt(String(item.deliveryDays)) : null,
            remark: item.remark || null,
          })
        ),
      });

      if (inquiry.onlineStatus === "pending") {
        await tx.inquiry.update({
          where: { id: inquiry.id },
          data: { onlineStatus: "opened" },
        });
      }

      return quote;
    });

    return NextResponse.json({ data: result, message: "报价提交成功" });
  }

  const [quote] = await prisma.$transaction([
    prisma.supplierQuote.upsert({
      where: {
        inquiryId_supplierId_round: {
          inquiryId: inquiry.id,
          supplierId: body.supplierId,
          round: targetRound,
        },
      },
      create: {
        inquiryId: inquiry.id,
        supplierId: body.supplierId,
        round: targetRound,
        quoteMode: "online",
        unitPrice: body.unitPrice ? parseFloat(body.unitPrice) : null,
        totalPrice: totalPriceValue,
        deliveryDays: body.deliveryDays ? parseInt(body.deliveryDays) : null,
        remark: body.remark || null,
        attachments: body.attachments || [],
        quotedAt: new Date(),
      },
      update: {
        unitPrice: body.unitPrice ? parseFloat(body.unitPrice) : null,
        totalPrice: totalPriceValue,
        deliveryDays: body.deliveryDays ? parseInt(body.deliveryDays) : null,
        remark: body.remark || null,
        attachments: body.attachments || [],
        quotedAt: new Date(),
        isValid: true,
      },
    }),
    ...(inquiry.onlineStatus === "pending"
      ? [
          prisma.inquiry.update({
            where: { id: inquiry.id },
            data: { onlineStatus: "opened" },
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ data: quote, message: "报价提交成功" });
}

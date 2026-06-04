import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractType = searchParams.get("contractType");
    const contractId = searchParams.get("contractId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (contractType) where.contractType = contractType;
    if (contractId) where.contractId = contractId;
    if (status) where.status = status;

    const data = await prisma.contractChangeOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取变更单列表失败:", error);
    return NextResponse.json({ error: "获取变更单列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.changeReason?.trim()) {
      return NextResponse.json({ error: "变更原因不能为空" }, { status: 400 });
    }

    const data = await prisma.contractChangeOrder.create({
      data: {
        changeNo: `BG-${Date.now()}`,
        contractType: body.contractType,
        contractId: body.contractId,
        changeReason: body.changeReason,
        previousAmount: parseFloat(body.previousAmount),
        previousData: body.previousData || {},
        newAmount: parseFloat(body.newAmount),
        newData: body.newData || {},
        amountDifference:
          parseFloat(body.newAmount) - parseFloat(body.previousAmount),
        newFiles: body.newFiles || [],
        status: "草稿",
        remark: body.remark || null,
      },
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("创建变更单失败:", error);
    return NextResponse.json({ error: "创建变更单失败" }, { status: 500 });
  }
}

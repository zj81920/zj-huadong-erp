import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { supplierId, ...changeData } = body;
    if (!supplierId) {
      return NextResponse.json({ error: "供应商ID不能为空" }, { status: 400 });
    }

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return NextResponse.json({ error: "供应商不存在" }, { status: 404 });
    }

    // 检查是否已有审批中的变更
    const activeChange = await prisma.supplierChange.findFirst({
      where: { supplierId, approvalStatus: "审批中" },
    });
    if (activeChange) {
      return NextResponse.json({ error: "该供应商已有审批中的变更，请等待审批完成" }, { status: 400 });
    }

    const change = await prisma.supplierChange.create({
      data: {
        supplierId,
        ...changeData,
        approvalStatus: "草稿",
        createdById: currentUser.id,
      },
    });

    return NextResponse.json({ data: change });
  } catch (error) {
    console.error("创建供应商变更单失败:", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplierId");
    const changes = await prisma.supplierChange.findMany({
      where: supplierId ? { supplierId } : undefined,
      orderBy: { createdAt: "desc" },
      include: { supplier: { select: { name: true } } },
    });
    return NextResponse.json({ data: changes });
  } catch (error) {
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supply = await prisma.officeSupply.findUnique({ where: { id } });

    if (!supply) {
      return NextResponse.json({ error: "办公用品不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: supply });
  } catch (error) {
    console.error("获取办公用品详情失败:", error);
    return NextResponse.json({ error: "获取办公用品详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, category, spec, unit, quantity, unitPrice, totalPrice, storeLocation, remark } = body;

    const existing = await prisma.officeSupply.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "办公用品不存在" }, { status: 404 });
    }

    const supply = await prisma.officeSupply.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(category !== undefined && { category: category || null }),
        ...(spec !== undefined && { spec: spec?.trim() || null }),
        ...(unit !== undefined && { unit: unit?.trim() || null }),
        ...(quantity !== undefined && { quantity }),
        ...(unitPrice !== undefined && { unitPrice: unitPrice ?? null }),
        ...(totalPrice !== undefined && { totalPrice: totalPrice ?? null }),
        ...(storeLocation !== undefined && { storeLocation: storeLocation?.trim() || null }),
        ...(remark !== undefined && { remark: remark?.trim() || null }),
      },
    });

    return NextResponse.json({ data: supply });
  } catch (error) {
    console.error("更新办公用品失败:", error);
    return NextResponse.json({ error: "更新办公用品失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.officeSupply.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "办公用品不存在" }, { status: 404 });
    }

    await prisma.officeSupply.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除办公用品失败:", error);
    return NextResponse.json({ error: "删除办公用品失败" }, { status: 500 });
  }
}

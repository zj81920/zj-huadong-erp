import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const record = await prisma.seal.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json({ error: "印章不存在" }, { status: 404 });
    }
    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("获取印章详情失败:", error);
    return NextResponse.json({ error: "获取印章详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await prisma.seal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "印章不存在" }, { status: 404 });
    }
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.sealType !== undefined) updateData.sealType = body.sealType;
    if (body.custodian !== undefined) updateData.custodian = body.custodian?.trim() || null;
    if (body.location !== undefined) updateData.location = body.location?.trim() || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.remark !== undefined) updateData.remark = body.remark?.trim() || null;

    const record = await prisma.seal.update({ where: { id }, data: updateData });
    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("更新印章失败:", error);
    return NextResponse.json({ error: "更新印章失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.seal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "印章不存在" }, { status: 404 });
    }
    await prisma.seal.delete({ where: { id } });
    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除印章失败:", error);
    return NextResponse.json({ error: "删除印章失败" }, { status: 500 });
  }
}

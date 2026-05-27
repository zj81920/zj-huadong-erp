import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shareholder = await prisma.shareholder.findUnique({
      where: { id },
      include: {
        contributions: { orderBy: { contributeDate: "desc" } },
        equityChanges: { orderBy: { changeDate: "desc" } },
      },
    });

    if (!shareholder) {
      return NextResponse.json({ error: "股东不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: shareholder });
  } catch (error) {
    console.error("获取股东详情失败:", error);
    return NextResponse.json({ error: "获取股东详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.shareholder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "股东不存在" }, { status: 404 });
    }

    const shareholder = await prisma.shareholder.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.idNumber !== undefined && { idNumber: body.idNumber?.trim() || null }),
        ...(body.shareRatio !== undefined && { shareRatio: body.shareRatio ? parseFloat(body.shareRatio) : null }),
        ...(body.contactPhone !== undefined && { contactPhone: body.contactPhone?.trim() || null }),
      },
    });

    return NextResponse.json({ data: shareholder });
  } catch (error) {
    console.error("更新股东失败:", error);
    return NextResponse.json({ error: "更新股东失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.shareholder.findUnique({
      where: { id },
      include: { contributions: true, equityChanges: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "股东不存在" }, { status: 404 });
    }

    if (existing.contributions.length > 0 || existing.equityChanges.length > 0) {
      return NextResponse.json({ error: "该股东下有出资记录或股权变更记录，无法删除" }, { status: 400 });
    }

    await prisma.shareholder.delete({ where: { id } });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除股东失败:", error);
    return NextResponse.json({ error: "删除股东失败" }, { status: 500 });
  }
}

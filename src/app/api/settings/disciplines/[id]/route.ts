import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await prisma.disciplineDictionary.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "专业不存在" }, { status: 404 });

    if (body.code && body.code !== existing.code) {
      const dup = await prisma.disciplineDictionary.findUnique({ where: { code: body.code } });
      if (dup) return NextResponse.json({ error: "专业编码已存在" }, { status: 409 });
    }

    const data: Record<string, unknown> = {};
    if (body.code !== undefined) data.code = body.code;
    if (body.name !== undefined) data.name = body.name;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

    const discipline = await prisma.disciplineDictionary.update({ where: { id }, data });
    return NextResponse.json({ data: discipline });
  } catch (error) {
    console.error("更新专业失败:", error);
    return NextResponse.json({ error: "更新专业失败" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await prisma.disciplineDictionary.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "专业不存在" }, { status: 404 });
    await prisma.disciplineDictionary.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除专业失败:", error);
    return NextResponse.json({ error: "删除专业失败" }, { status: 500 });
  }
}

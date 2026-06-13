import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const discipline = await prisma.disciplineDictionary.update({
      where: { id },
      data: { name: body.name, code: body.code },
    });
    return NextResponse.json({ data: discipline });
  } catch (error) {
    console.error("编辑专业失败:", error);
    return NextResponse.json({ error: "编辑专业失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.disciplineDictionary.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除专业失败:", error);
    return NextResponse.json({ error: "删除专业失败" }, { status: 500 });
  }
}

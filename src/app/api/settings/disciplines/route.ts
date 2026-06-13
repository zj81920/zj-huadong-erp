import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const data = await prisma.disciplineDictionary.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取专业字典失败:", error);
    return NextResponse.json({ error: "获取专业字典失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { code, name, sortOrder } = await request.json();
    if (!code || !name) {
      return NextResponse.json({ error: "缺少必填字段: code, name" }, { status: 400 });
    }
    const existing = await prisma.disciplineDictionary.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: "专业编码已存在" }, { status: 409 });
    }
    const data = await prisma.disciplineDictionary.create({
      data: { code, name, sortOrder: sortOrder ?? 0 },
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("创建专业失败:", error);
    return NextResponse.json({ error: "创建专业失败" }, { status: 500 });
  }
}

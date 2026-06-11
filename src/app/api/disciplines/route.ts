import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const disciplines = await prisma.disciplineDictionary.findMany({
      orderBy: { code: "asc" },
    });
    return NextResponse.json({ data: disciplines });
  } catch (error) {
    console.error("获取专业字典失败:", error);
    return NextResponse.json({ error: "获取专业字典失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code } = body;
    if (!name || !code) {
      return NextResponse.json({ error: "专业名称和代码为必填" }, { status: 400 });
    }
    const existing = await prisma.disciplineDictionary.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: "专业代码已存在" }, { status: 409 });
    }
    const discipline = await prisma.disciplineDictionary.create({
      data: { name, code },
    });
    return NextResponse.json({ data: discipline }, { status: 201 });
  } catch (error) {
    console.error("创建专业失败:", error);
    return NextResponse.json({ error: "创建专业失败" }, { status: 500 });
  }
}

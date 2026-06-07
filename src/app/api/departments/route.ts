import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      orderBy: { sort: "asc" },
      include: {
        roles: {
          where: { isActive: true },
          select: { id: true, name: true },
        },
      },
    });
    const data = departments.map((d) => ({
      id: d.id,
      name: d.name,
      sort: d.sort,
      isActive: d.isActive,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      roleCount: d.roles.length,
    }));
    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取部门列表失败:", error);
    return NextResponse.json({ error: "获取部门列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json({ error: "仅管理员可执行此操作" }, { status: 403 });
    }
    const body = await request.json();
    const { name, sort } = body;
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "部门名称不能为空" }, { status: 400 });
    }
    const existing = await prisma.department.findFirst({
      where: { name: name.trim(), isActive: true },
    });
    if (existing) {
      return NextResponse.json({ error: "该部门名称已存在" }, { status: 409 });
    }
    const dept = await prisma.department.create({
      data: {
        name: name.trim(),
        sort: sort || 0,
      },
    });
    return NextResponse.json({ data: dept }, { status: 201 });
  } catch (error) {
    console.error("创建部门失败:", error);
    return NextResponse.json({ error: "创建部门失败" }, { status: 500 });
  }
}

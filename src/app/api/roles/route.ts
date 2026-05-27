import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const roles = await prisma.role.findMany({
      where: { isActive: true },
      orderBy: { sort: "asc" },
      include: {
        users: {
          include: {
            user: { select: { id: true, username: true, realName: true } },
          },
        },
      },
    });
    const data = roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isProjectRole: r.isProjectRole,
      sort: r.sort,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      userCount: r.users.length,
    }));
    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取角色列表失败:", error);
    return NextResponse.json({ error: "获取角色列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name, description, isProjectRole, sort } = body;
    if (!code || !name) {
      return NextResponse.json({ error: "角色编码和名称不能为空" }, { status: 400 });
    }
    const existing = await prisma.role.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: "该角色编码已存在" }, { status: 409 });
    }
    const role = await prisma.role.create({
      data: {
        code,
        name,
        description: description || null,
        isProjectRole: isProjectRole || false,
        sort: sort || 0,
      },
    });
    return NextResponse.json({ data: role }, { status: 201 });
  } catch (error) {
    console.error("创建角色失败:", error);
    return NextResponse.json({ error: "创建角色失败" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function generateCode(name: string): string {
  return (
    "role_" +
    name
      .replace(/[\s\/\\]/g, "_")
      .slice(0, 20) +
    "_" +
    Date.now().toString(36)
  );
}

export async function GET() {
  try {
    const roles = await prisma.role.findMany({
      where: { isActive: true },
      orderBy: { sort: "asc" },
      include: {
        department: { select: { id: true, name: true } },
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
      departmentId: r.departmentId,
      departmentName: r.department?.name || null,
      isProjectRole: r.isProjectRole,
      accessibleModules: r.accessibleModules,
      isGlobalVisible: r.isGlobalVisible,
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
    const { name, description, departmentId, isProjectRole, sort, accessibleModules, isGlobalVisible } = body;
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "角色名称不能为空" }, { status: 400 });
    }

    const existingByName = await prisma.role.findFirst({
      where: { name: name.trim(), isActive: true },
    });
    if (existingByName) {
      return NextResponse.json({ error: "该角色名称已存在" }, { status: 409 });
    }

    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) {
        return NextResponse.json({ error: "所选部门不存在" }, { status: 400 });
      }
    }

    const code = generateCode(name.trim());

    const role = await prisma.role.create({
      data: {
        code,
        name: name.trim(),
        description: description || null,
        departmentId: departmentId || null,
        isProjectRole: isProjectRole || false,
        sort: sort || 0,
        accessibleModules: typeof accessibleModules === "string" ? accessibleModules : JSON.stringify(accessibleModules || []),
        isGlobalVisible: isGlobalVisible || false,
      },
    });
    return NextResponse.json({ data: role }, { status: 201 });
  } catch (error) {
    console.error("创建角色失败:", error);
    return NextResponse.json({ error: "创建角色失败" }, { status: 500 });
  }
}

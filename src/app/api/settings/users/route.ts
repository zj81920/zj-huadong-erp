import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") || "20") || 20);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { realName: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          userRoles: {
            include: {
              role: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const data = users.map((u) => ({
      id: u.id,
      username: u.username,
      realName: u.realName,
      phone: u.phone,
      email: u.email,
      role: u.role,
      department: u.department,
      signatureUrl: u.signatureUrl,
      avatarUrl: u.avatarUrl,
      isActive: u.isActive,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      roles: u.userRoles.map((ur) => ({
        id: ur.role.id,
        code: ur.role.code,
        name: ur.role.name,
      })),
    }));

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取用户列表失败:", error);
    return NextResponse.json({ error: "获取用户列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json({ error: "仅管理员可执行此操作" }, { status: 403 });
    }
    const body = await request.json();
    const { username, realName, password, phone, email, department, roleIds, signatureUrl, avatarUrl } = body;

    if (!username || !realName) {
      return NextResponse.json({ error: "用户名和姓名不能为空" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (existing) {
      return NextResponse.json({ error: "该用户名已存在" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        password: password || "123456",
        realName: realName.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        department: department?.trim() || null,
        signatureUrl: signatureUrl || null,
        avatarUrl: avatarUrl || null,
        role: roleIds && roleIds.length > 0 ? "custom" : "staff",
        userRoles: {
          create: (roleIds || []).map((roleId: string) => ({ roleId })),
        },
      },
      include: {
        userRoles: {
          include: { role: { select: { id: true, code: true, name: true } } },
        },
      },
    });

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    console.error("创建用户失败:", error);
    return NextResponse.json({ error: "创建用户失败" }, { status: 500 });
  }
}

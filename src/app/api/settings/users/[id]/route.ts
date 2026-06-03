import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { realName, password, phone, email, department, roleIds, signatureUrl, avatarUrl, isActive } = body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (realName !== undefined) updateData.realName = realName.trim();
    if (password !== undefined && password.trim()) updateData.password = password.trim();
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (department !== undefined) updateData.department = department?.trim() || null;
    if (signatureUrl !== undefined) updateData.signatureUrl = signatureUrl || null;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (roleIds !== undefined) {
      await prisma.userRole.deleteMany({ where: { userId: id } });
      if (roleIds.length > 0) {
        updateData.userRoles = {
          create: roleIds.map((roleId: string) => ({ roleId })),
        };
      }
      updateData.role = roleIds.length > 0 ? "custom" : "staff";
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        userRoles: {
          include: { role: { select: { id: true, code: true, name: true } } },
        },
      },
    });

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error("更新用户失败:", error);
    return NextResponse.json({ error: "更新用户失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    if (existing.username === "admin") {
      return NextResponse.json({ error: "系统管理员账号不可删除" }, { status: 403 });
    }

    await prisma.userRole.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ data: { id } });
  } catch (error) {
    console.error("删除用户失败:", error);
    return NextResponse.json({ error: "删除用户失败" }, { status: 500 });
  }
}

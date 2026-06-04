import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        users: {
          include: {
            user: { select: { id: true, username: true, realName: true } },
          },
        },
      },
    });
    if (!role || !role.isActive) {
      return NextResponse.json({ error: "角色不存在" }, { status: 404 });
    }
    const data = {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      departmentId: role.departmentId,
      departmentName: role.department?.name || null,
      modulePermissions:
        typeof role.modulePermissions === "string"
          ? JSON.parse(role.modulePermissions)
          : role.modulePermissions,
      subModuleOverrides:
        typeof role.subModuleOverrides === "string"
          ? JSON.parse(role.subModuleOverrides)
          : role.subModuleOverrides,
      isGlobalVisible: role.isGlobalVisible,
      isActive: role.isActive,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role.users.length,
    };
    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取角色详情失败:", error);
    return NextResponse.json({ error: "获取角色详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, departmentId, isActive, modulePermissions, subModuleOverrides, isGlobalVisible } = body;

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "角色不存在" }, { status: 404 });
    }

    if (existing.code === "admin") {
      return NextResponse.json({ error: "系统内定角色不可编辑" }, { status: 403 });
    }

    if (existing.code === "finance" && name && name.trim() !== existing.name) {
      return NextResponse.json({ error: "系统角色名称不可修改" }, { status: 403 });
    }

    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.role.findFirst({
        where: { name: name.trim(), isActive: true, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json({ error: "该角色名称已存在" }, { status: 409 });
      }
    }

    const role = await prisma.role.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(departmentId !== undefined && { departmentId: departmentId || null }),
        ...(isActive !== undefined && { isActive }),
        ...(modulePermissions !== undefined && { modulePermissions: typeof modulePermissions === "string" ? modulePermissions : JSON.stringify(modulePermissions) }),
        ...(subModuleOverrides !== undefined && { subModuleOverrides: typeof subModuleOverrides === "string" ? subModuleOverrides : JSON.stringify(subModuleOverrides) }),
        ...(isGlobalVisible !== undefined && { isGlobalVisible }),
      },
    });
    return NextResponse.json({ data: role });
  } catch (error) {
    console.error("更新角色失败:", error);
    return NextResponse.json({ error: "更新角色失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "角色不存在" }, { status: 404 });
    }
    if (existing.code === "admin" || existing.code === "finance") {
      return NextResponse.json({ error: "系统内定角色不可删除" }, { status: 403 });
    }
    const flowUsage = await prisma.approvalFlowDefinition.count({
      where: { approverRole: existing.code, isActive: true },
    });
    if (flowUsage > 0) {
      return NextResponse.json(
        { error: `该角色已被 ${flowUsage} 个审批流程节点引用，无法删除` },
        { status: 400 }
      );
    }
    const userCount = await prisma.userRole.count({
      where: { roleId: id },
    });
    if (userCount > 0) {
      await prisma.userRole.deleteMany({ where: { roleId: id } });
    }
    await prisma.role.delete({ where: { id } });
    return NextResponse.json({ data: { id } });
  } catch (error) {
    console.error("删除角色失败:", error);
    return NextResponse.json({ error: "删除角色失败" }, { status: 500 });
  }
}

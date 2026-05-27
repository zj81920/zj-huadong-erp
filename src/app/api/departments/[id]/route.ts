import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, sort, isActive } = body;

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "部门不存在" }, { status: 404 });
    }

    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.department.findFirst({
        where: { name: name.trim(), isActive: true, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json({ error: "该部门名称已存在" }, { status: 409 });
      }
    }

    const dept = await prisma.department.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(sort !== undefined && { sort }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    return NextResponse.json({ data: dept });
  } catch (error) {
    console.error("更新部门失败:", error);
    return NextResponse.json({ error: "更新部门失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "部门不存在" }, { status: 404 });
    }

    const roleCount = await prisma.role.count({
      where: { departmentId: id, isActive: true },
    });
    if (roleCount > 0) {
      return NextResponse.json(
        { error: `该部门下有 ${roleCount} 个关联角色，无法删除` },
        { status: 400 }
      );
    }

    await prisma.department.delete({ where: { id } });
    return NextResponse.json({ data: { id } });
  } catch (error) {
    console.error("删除部门失败:", error);
    return NextResponse.json({ error: "删除部门失败" }, { status: 500 });
  }
}

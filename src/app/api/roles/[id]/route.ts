import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { code, name, description, isProjectRole, sort, isActive } = body;
    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "角色不存在" }, { status: 404 });
    }
    if (code && code !== existing.code) {
      const duplicate = await prisma.role.findUnique({ where: { code } });
      if (duplicate) {
        return NextResponse.json({ error: "该角色编码已存在" }, { status: 409 });
      }
    }
    const role = await prisma.role.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(isProjectRole !== undefined && { isProjectRole }),
        ...(sort !== undefined && { sort }),
        ...(isActive !== undefined && { isActive }),
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
